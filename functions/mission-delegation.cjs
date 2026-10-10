// TERRA Campaign — linked assignments. Private registry is authoritative.
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {createHash} = require('node:crypto');
const {
  classifyMissionActivity
} = require('./activity-classification.cjs');

const {
  resolveCanonicalPersonForAccount
} = require('./person-identity.cjs');

const {
  canonicalMembershipDocumentId
} = require('./territorial-membership-id.cjs');

const {
  membershipMatchesSubject
} = require('./activity-preferences.cjs');

const {
  evaluateMissionAssigneeEligibility
} = require('./mission-assignee-eligibility.cjs');
const NEXT = {lider_principal:'coordinador_municipal', admin:'coordinador_municipal', coordinador_municipal:'jefe_estructura', jefe_estructura:'integrante', integrante:'participante', participante:'colaborador_base', colaborador_base:'apoyo_territorial'};

const MISSION_CREATE_ROLES = new Set([
  'lider_principal',
  'coordinador_municipal',
  'jefe_estructura'
]);
const OPTIONS = {region:'us-central1', timeoutSeconds:60};
const fail = (code, message) => { throw new HttpsError(code, message); };
const hash = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
function id(value) {
  if (typeof value !== 'string' || !value.length || value.length > 128 || value.includes('/')) fail('invalid-argument','Identificador inválido.');
  return value;
}
function text(value, max, required=false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('invalid-argument','Revisa los campos de la misión.');
  return value.trim();
}
async function caller(tx, db, request) {
  if (!request.auth) fail('unauthenticated','Inicia sesión.');
  const s = await tx.get(db.collection('usuarios').doc(request.auth.uid));
  const p = s.data();
  if (!p || p.active !== true || !p.campaignId || ![...Object.keys(NEXT),'apoyo_territorial'].includes(p.role)) fail('permission-denied','Perfil no autorizado.');
  if (p.role === 'lider_principal') {
    const lock = await tx.get(db.collection('principalLeaders').doc(p.campaignId));
    if (lock.data()?.uid !== s.id) fail('permission-denied','Líder no registrado para esta campaña.');
  }
  return {...p, uid:s.id};
}
function targetAllowed(p, t) {
  return t && t.active === true && t.campaignId === p.campaignId && t.role === NEXT[p.role] &&
    (['admin','lider_principal'].includes(p.role) || (t.parentUserId === p.uid && !!p.municipalityId && t.municipalityId === p.municipalityId)) &&
    (!['jefe_estructura','integrante','participante','colaborador_base'].includes(p.role) || (!!p.structureId && t.structureId === p.structureId));
}
function deadline(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail('invalid-argument','Fecha límite inválida.');
  return new Date(value).toISOString();
}
exports.createLinkedMissions = onCall(OPTIONS, async request => {
  const d = request.data || {};
  const requestId = id(d.requestId);
  const rawAssigneeRefs =
    Array.isArray(d.assigneeRefs)
      ? d.assigneeRefs
      : [];

  const rawAssigneeIds =
    Array.isArray(d.assigneeIds)
      ? d.assigneeIds
      : [];

  if (
    rawAssigneeRefs.length &&
    rawAssigneeIds.length
  ) {
    fail(
      'invalid-argument',
      'Usa assigneeRefs o assigneeIds, no ambos.'
    );
  }

  const selectionMode =
    rawAssigneeRefs.length
      ? 'ref'
      : 'uid';

  const rawSelections =
    selectionMode === 'ref'
      ? rawAssigneeRefs
      : rawAssigneeIds;

  if (
    !rawSelections.length ||
    rawSelections.length > 50
  ) {
    fail(
      'invalid-argument',
      'Selecciona entre 1 y 50 personas.'
    );
  }

  const selections =
    [
      ...new Set(
        rawSelections.map(id)
      )
    ].sort();
  const parentId = d.parentMissionId == null ? null : id(d.parentMissionId);

  let activityClassification = null;

  if (!parentId) {
    try {
      activityClassification =
        classifyMissionActivity(
          d.activityCode
        );
    } catch {
      fail(
        'invalid-argument',
        'El tipo de actividad no es v?lido para esta misi?n.'
      );
    }
  }

  const fields = parentId ? null : {
    title:text(d.title,150,true), description:text(d.description,1500),
    locality:text(d.locality,120), missionDate:text(d.missionDate,10) || null, deadlineAt:deadline(d.deadlineAt),
    ...(activityClassification ? {
      activityCode:
        activityClassification.activityCode,
      activityCatalogVersion:
        activityClassification.activityCatalogVersion
    } : {})
  };
  if (fields?.missionDate && (!/^\d{4}-\d{2}-\d{2}$/.test(fields.missionDate) || !Number.isFinite(Date.parse(fields.missionDate)) || new Date(fields.missionDate).toISOString().slice(0,10) !== fields.missionDate)) fail('invalid-argument','Fecha inválida.');
  const fingerprint = hash(parentId,selectionMode,selections,fields);
  const db = getFirestore();
  return db.runTransaction(async tx => {
    const p = await caller(tx,db,request);

    if (
      !parentId &&
      !MISSION_CREATE_ROLES.has(p.role)
    ) {
      fail(
        'permission-denied',
        'Tu nivel no puede crear misiones nuevas.'
      );
    }

    if (
      parentId &&
      p.role === 'admin'
    ) {
      fail(
        'permission-denied',
        'El administrador técnico no participa en la delegación operativa de misiones.'
      );
    }
    if (p.role === 'lider_principal' && (parentId || !fields?.deadlineAt)) fail('invalid-argument','El líder debe crear una misión con fecha límite.');
    if (!NEXT[p.role]) fail('permission-denied','Tu nivel no puede delegar.');
    const receiptRef = db.collection('missionDispatches').doc(hash(p.uid,requestId));
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      if (receipt.data().fingerprint !== fingerprint || receipt.data().campaignId !== p.campaignId) fail('already-exists','Este intento ya se usó con otros datos. Cierra y abre el formulario.');
      return receipt.data().result;
    }
    if (!parentId && !activityClassification) {
      fail(
        'invalid-argument',
        'Selecciona el tipo de actividad de la mision.'
      );
    }

    if (fields?.deadlineAt && Date.parse(fields.deadlineAt) <= Date.now()) fail('invalid-argument','La fecha límite debe ser futura.');
    let parent = null;
    if (parentId) {
      const registry = await tx.get(db.collection('missionLinks').doc(parentId));
      const source = await tx.get(db.collection('misiones').doc(parentId));
      parent = registry.data();
      if (!parent || !source.exists || parent.campaignId !== p.campaignId || parent.assignedTo !== p.uid || parent.assignedToRole !== p.role || source.data().active !== true) fail('permission-denied','Solo puedes delegar una misión vinculada, activa y asignada a ti.');
      if (parent.content?.deadlineAt && Date.parse(parent.content.deadlineAt) <= Date.now()) fail('failed-precondition','La misión ya venció; no se puede delegar.');
      if (parent.ancestorMissionIds.length >= 4) fail('failed-precondition','Se alcanzó el último nivel de delegación.');
    }
    const effectiveActivityCode =
      parent
        ? parent.content?.activityCode
        : fields?.activityCode;

    if (!effectiveActivityCode) {
      fail(
        'failed-precondition',
        'La misión no tiene un tipo de actividad operativo válido.'
      );
    }

    const actorIdentity =
      await resolveCanonicalPersonForAccount({
        db,
        tx,
        accountUid:
          p.uid,
        profile:
          p,
        campaignId:
          p.campaignId
      });

    const actorPersonId =
      actorIdentity.personId;

    const groupId =
      parent
        ? parent.groupId
        : hash(
            p.uid,
            requestId,
            'group'
          );

    const ancestors =
      parent
        ? [
            ...parent.ancestorMissionIds,
            parentId
          ]
        : [];

    // ==================================================
    // B7B - RESOLUCION DE assigneeRef
    // ==================================================

    const refCandidates =
      new Map();

    if (selectionMode === 'ref') {

      let membershipQuery =
        db
          .collection(
            'territorialMemberships'
          )
          .where(
            'campaignId',
            '==',
            p.campaignId
          )
          .where(
            'role',
            '==',
            NEXT[p.role]
          );

      if (
        ![
          'admin',
          'lider_principal'
        ].includes(
          p.role
        )
      ) {
        membershipQuery =
          membershipQuery.where(
            'parentPersonId',
            '==',
            actorPersonId
          );
      }

      const membershipTargets =
        await tx.get(
          membershipQuery.limit(
            1001
          )
        );

      if (
        membershipTargets.size >
          1000
      ) {
        fail(
          'resource-exhausted',
          'La campaña requiere un índice escalable antes de continuar.'
        );
      }

      for (
        const membershipSnapshot
        of membershipTargets.docs
      ) {

        const membership = {
          ...membershipSnapshot.data(),
          membershipId:
            membershipSnapshot.id
        };

        const personId =
          typeof membership.personId ===
            'string'
            ? membership.personId.trim()
            : '';

        if (!personId) {
          continue;
        }

        const expectedMembershipId =
          canonicalMembershipDocumentId(
            p.campaignId,
            personId
          );

        if (
          membership.active !== true ||
          membership.role !==
            NEXT[p.role] ||
          membership.membershipId !==
            expectedMembershipId ||
          !membershipMatchesSubject({
            membership,
            membershipId:
              expectedMembershipId,
            campaignId:
              p.campaignId,
            personId
          }) ||
          !targetAllowed(
            p,
            membership
          )
        ) {
          continue;
        }

        if (
          ![
            'admin',
            'lider_principal'
          ].includes(
            p.role
          ) &&
          membership.parentPersonId !==
            actorPersonId
        ) {
          continue;
        }

        const personSnapshot =
          await tx.get(
            db
              .collection(
                'persons'
              )
              .doc(
                personId
              )
          );

        if (!personSnapshot.exists) {
          continue;
        }

        const person = {
          ...personSnapshot.data(),
          personId:
            personSnapshot.id
        };

        if (
          person.active === false ||
          person.campaignId !==
            p.campaignId
        ) {
          continue;
        }

        const membershipAccountUid =
          typeof membership.accountUid ===
            'string' &&
          membership.accountUid.trim()
            ? membership.accountUid.trim()
            : null;

        const personAccountUid =
          typeof person.accountUid ===
            'string' &&
          person.accountUid.trim()
            ? person.accountUid.trim()
            : null;

        if (
          membershipAccountUid &&
          personAccountUid &&
          membershipAccountUid !==
            personAccountUid
        ) {
          continue;
        }

        const accountUid =
          membershipAccountUid ||
          personAccountUid ||
          null;

        const assigneeRef =
          hash(
            'mission-assignee',
            p.campaignId,
            actorPersonId,
            personId
          );

        refCandidates.set(
          assigneeRef,
          {
            personId,
            accountUid,
            membership,
            person
          }
        );
      }
    }

    const records = [];

    for (
      const selectionValue
      of selections
    ) {

      let personId =
        null;

      let accountUid =
        null;

      let targetMembership =
        null;

      let targetPerson =
        null;

      if (
        selectionMode === 'uid'
      ) {

        const uid =
          selectionValue;

        const target =
          await tx.get(
            db
              .collection(
                'usuarios'
              )
              .doc(
                uid
              )
          );

        const profile =
          target.data();

        if (
          !targetAllowed(
            p,
            profile
          )
        ) {
          fail(
            'permission-denied',
            'Una persona ya no pertenece a tu nivel inmediato o está inactiva. Actualiza la lista.'
          );
        }

        const targetIdentity =
          await resolveCanonicalPersonForAccount({
            db,
            tx,
            accountUid:
              uid,
            profile,
            campaignId:
              p.campaignId
          });

        personId =
          targetIdentity.personId;

        accountUid =
          targetIdentity.accountUid ||
          null;

        const targetMembershipId =
          canonicalMembershipDocumentId(
            p.campaignId,
            personId
          );

        const targetMembershipSnapshot =
          await tx.get(
            db
              .collection(
                'territorialMemberships'
              )
              .doc(
                targetMembershipId
              )
          );

        if (
          !targetMembershipSnapshot.exists
        ) {
          fail(
            'failed-precondition',
            'Una persona seleccionada no tiene membresía territorial canónica.'
          );
        }

        targetMembership = {
          ...targetMembershipSnapshot.data(),
          membershipId:
            targetMembershipSnapshot.id
        };

        if (
          targetMembership.active !==
            true ||
          !membershipMatchesSubject({
            membership:
              targetMembership,
            membershipId:
              targetMembershipId,
            campaignId:
              p.campaignId,
            personId
          })
        ) {
          fail(
            'failed-precondition',
            'La membresía territorial de una persona seleccionada no es válida.'
          );
        }

        targetPerson = {
          ...profile,
          personId
        };
      }
      else {

        const resolved =
          refCandidates.get(
            selectionValue
          );

        if (!resolved) {
          fail(
            'permission-denied',
            'Una persona seleccionada ya no pertenece a tu nivel inmediato o la referencia dejó de ser válida. Actualiza la lista.'
          );
        }

        personId =
          resolved.personId;

        accountUid =
          resolved.accountUid ||
          null;

        targetMembership =
          resolved.membership;

        targetPerson =
          resolved.person;
      }

      const eligibility =
        evaluateMissionAssigneeEligibility({
          activityCode:
            effectiveActivityCode,

          activityPreferences:
            targetMembership
              .activityPreferences,

          hasDigitalAccount:
            Boolean(
              accountUid
            )
        });

      if (!eligibility.eligible) {

        if (
          eligibility.reason ===
            'activity-not-selected'
        ) {
          fail(
            'failed-precondition',
            'Una persona seleccionada no indicó disponibilidad para este tipo de actividad.'
          );
        }

        if (
          eligibility.reason ===
            'digital-account-required'
        ) {
          fail(
            'failed-precondition',
            'Esta actividad requiere una cuenta digital activa en TERRA.'
          );
        }

        fail(
          'failed-precondition',
          'Una persona seleccionada no es elegible para este tipo de misión.'
        );
      }

      const recipientKey =
        accountUid ||
        personId;

      const missionId =
        hash(
          groupId,
          parentId,
          recipientKey
        );

      const missionRef =
        db
          .collection(
            'misiones'
          )
          .doc(
            missionId
          );

      const linkRef =
        db
          .collection(
            'missionLinks'
          )
          .doc(
            missionId
          );

      const existing =
        await tx.get(
          linkRef
        );

      const existingMission =
        await tx.get(
          missionRef
        );

      if (existing.exists) {

        if (
          !existingMission.exists ||
          existing.data().createdBy !==
            p.uid
        ) {
          fail(
            'failed-precondition',
            'La asignación existente requiere revisión.'
          );
        }

        continue;
      }

      if (existingMission.exists) {
        fail(
          'already-exists',
          'El identificador de asignación ya está ocupado.'
        );
      }

      const content =
        parent
          ? parent.content
          : fields;

      const assignedTo =
        accountUid ||
        null;

      const assignedToName =
        targetPerson.name ||
        'Sin nombre';

      const assignedToRole =
        targetMembership.role;

      const data = {
        id:
          missionId,

        campaignId:
          p.campaignId,

        ...content,

        deadlineAtMillis:
          content.deadlineAt
            ? Date.parse(
                content.deadlineAt
              )
            : null,

        active:
          true,

        createdBy:
          p.uid,

        createdByName:
          p.name ||
          'Sin nombre',

        createdByRole:
          p.role,

        assignedTo,

        accountUid:
          accountUid ||
          null,

        personId,

        assignedToName,

        assignedToRole,

        supervisorIds:
          [
            ...new Set([
              p.uid,
              ...(
                Array.isArray(
                  p.ancestorIds
                )
                  ? p.ancestorIds
                  : []
              )
            ])
          ],

        municipalityId:
          targetMembership
            .municipalityId ||
          '',

        municipalityName:
          targetMembership
            .municipalityName ||
          '',

        structureId:
          targetMembership
            .structureId ||
          '',

        structureName:
          targetMembership
            .structureName ||
          '',

        groupId,

        parentMissionId:
          parentId,

        linkedVersion:
          1,

        version:
          4,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp()
      };

      records.push({
        missionRef,
        linkRef,
        data,

        link: {
          campaignId:
            p.campaignId,

          groupId,

          parentMissionId:
            parentId,

          ancestorMissionIds:
            ancestors,

          assignedTo,

          accountUid:
            accountUid ||
            null,

          personId,

          assignedToRole,

          createdBy:
            p.uid,

          content
        }
      });
    }

    // Todas las validaciones y lecturas preceden
    // las escrituras: despacho atómico.
    for (
      const record
      of records
    ) {
      tx.create(
        record.missionRef,
        record.data
      );

      tx.create(
        record.linkRef,
        record.link
      );
    }

    const result = {
      created:
        records.length,

      alreadyAssigned:
        selections.length -
        records.length
    };

    tx.create(
      receiptRef,
      {
        campaignId:
          p.campaignId,

        fingerprint,

        result,

        createdAt:
          FieldValue.serverTimestamp()
      }
    );

    return result;
  });
});
exports.getEligibleMissionAssignees = onCall(
  OPTIONS,
  async request => {

    const d =
      request.data || {};

    const parentId =
      d.parentMissionId == null
        ? null
        : id(
            d.parentMissionId
          );

    let requestedActivityCode =
      null;

    if (!parentId) {

      try {

        requestedActivityCode =
          classifyMissionActivity(
            d.activityCode
          ).activityCode;

      } catch {

        fail(
          'invalid-argument',
          'Selecciona un tipo de actividad valido para la mision.'
        );
      }
    }

    const db =
      getFirestore();

    return db.runTransaction(
      async tx => {

        const p =
          await caller(
            tx,
            db,
            request
          );

        if (!NEXT[p.role]) {
          fail(
            'permission-denied',
            'Tu nivel no puede delegar.'
          );
        }

        let parent =
          null;

        if (parentId) {

          const registry =
            await tx.get(
              db
                .collection(
                  'missionLinks'
                )
                .doc(
                  parentId
                )
            );

          const sourceMission =
            await tx.get(
              db
                .collection(
                  'misiones'
                )
                .doc(
                  parentId
                )
            );

          parent =
            registry.data();

          if (
            !parent ||
            !sourceMission.exists ||
            parent.campaignId !==
              p.campaignId ||
            parent.assignedTo !==
              p.uid ||
            parent.assignedToRole !==
              p.role ||
            sourceMission.data()
              .active !== true
          ) {
            fail(
              'permission-denied',
              'Solo puedes delegar una mision vinculada, activa y asignada a ti.'
            );
          }

          if (
            parent.content
              ?.deadlineAt &&
            Date.parse(
              parent.content.deadlineAt
            ) <= Date.now()
          ) {
            fail(
              'failed-precondition',
              'La mision ya vencio y no se puede delegar.'
            );
          }

          if (
            parent.ancestorMissionIds
              .length >= 4
          ) {
            fail(
              'failed-precondition',
              'Se alcanzo el ultimo nivel de delegacion.'
            );
          }
        }

        const effectiveActivityCode =
          parent
            ? parent.content
                ?.activityCode
            : requestedActivityCode;

        if (!effectiveActivityCode) {
          fail(
            'failed-precondition',
            'La mision no tiene un tipo de actividad operativo valido.'
          );
        }
        const assignableRole =
          NEXT[p.role];

        // ==================================================
        // B7A - DESCUBRIMIENTO CANONICO DE DESTINATARIOS
        //
        // personId es la identidad operacional primaria.
        // accountUid puede ser null.
        // ==================================================

        const actorIdentity =
          await resolveCanonicalPersonForAccount({
            db,
            tx,
            accountUid:
              p.uid,
            profile:
              p,
            campaignId:
              p.campaignId
          });

        const actorPersonId =
          actorIdentity.personId;

        let membershipsQuery =
          db
            .collection(
              'territorialMemberships'
            )
            .where(
              'campaignId',
              '==',
              p.campaignId
            )
            .where(
              'role',
              '==',
              assignableRole
            );

        if (
          ![
            'admin',
            'lider_principal'
          ].includes(
            p.role
          )
        ) {
          membershipsQuery =
            membershipsQuery.where(
              'parentPersonId',
              '==',
              actorPersonId
            );
        }

        const targets =
          await tx.get(
            membershipsQuery.limit(
              1001
            )
          );

        if (
          targets.size >
            1000
        ) {
          fail(
            'resource-exhausted',
            'La campaña requiere un indice escalable antes de continuar.'
          );
        }

        const eligible = [];

        for (
          const targetMembershipSnapshot
          of targets.docs
        ) {

          const targetMembership = {
            ...targetMembershipSnapshot.data(),
            membershipId:
              targetMembershipSnapshot.id
          };

          const personId =
            typeof targetMembership
              .personId ===
              'string'
              ? targetMembership
                  .personId
                  .trim()
              : '';

          if (!personId) {
            continue;
          }

          const targetMembershipId =
            canonicalMembershipDocumentId(
              p.campaignId,
              personId
            );

          if (
            targetMembership
              .membershipId !==
              targetMembershipId ||
            targetMembership.active !==
              true ||
            targetMembership.role !==
              assignableRole ||
            !membershipMatchesSubject({
              membership:
                targetMembership,
              membershipId:
                targetMembershipId,
              campaignId:
                p.campaignId,
              personId
            })
          ) {
            continue;
          }

          // Segunda defensa:
          // mantenemos las restricciones territoriales
          // que ya existen en Campaign V1.
          if (
            !targetAllowed(
              p,
              targetMembership
            )
          ) {
            continue;
          }

          if (
            ![
              'admin',
              'lider_principal'
            ].includes(
              p.role
            ) &&
            targetMembership
              .parentPersonId !==
              actorPersonId
          ) {
            continue;
          }

          const targetPersonSnapshot =
            await tx.get(
              db
                .collection(
                  'persons'
                )
                .doc(
                  personId
                )
            );

          if (
            !targetPersonSnapshot.exists
          ) {
            continue;
          }

          const targetPerson = {
            ...targetPersonSnapshot.data(),
            personId:
              targetPersonSnapshot.id
          };

          if (
            targetPerson.active ===
              false ||
            targetPerson.campaignId !==
              p.campaignId
          ) {
            continue;
          }

          const membershipAccountUid =
            typeof targetMembership
              .accountUid ===
              'string' &&
            targetMembership
              .accountUid
              .trim()
              ? targetMembership
                  .accountUid
                  .trim()
              : null;

          const personAccountUid =
            typeof targetPerson
              .accountUid ===
              'string' &&
            targetPerson
              .accountUid
              .trim()
              ? targetPerson
                  .accountUid
                  .trim()
              : null;

          if (
            membershipAccountUid &&
            personAccountUid &&
            membershipAccountUid !==
              personAccountUid
          ) {
            continue;
          }

          const accountUid =
            membershipAccountUid ||
            personAccountUid ||
            null;

          const eligibility =
            evaluateMissionAssigneeEligibility({
              activityCode:
                effectiveActivityCode,

              activityPreferences:
                targetMembership
                  .activityPreferences,

              hasDigitalAccount:
                Boolean(
                  accountUid
                )
            });

          if (
            !eligibility.eligible
          ) {
            continue;
          }

          const assigneeRef =
            hash(
              'mission-assignee',
              p.campaignId,
              actorPersonId,
              personId
            );

          const publicUid =
            accountUid || '';

          const hasDigitalAccount =
            Boolean(
              accountUid
            );

          eligible.push({
            assigneeRef,

            // Compatibilidad temporal con clientes
            // que todavía usan UID para personas digitales.
            uid:
              publicUid,

            hasDigitalAccount,

            name:
              targetPerson.name ||
              'Sin nombre',

            role:
              targetMembership.role ||
              '',

            municipalityId:
              targetMembership
                .municipalityId ||
              '',

            structureId:
              targetMembership
                .structureId ||
              ''
          });
        }

        eligible.sort(
          (a, b) =>
            String(
              a.name || ''
            ).localeCompare(
              String(
                b.name || ''
              ),
              'es'
            )
        );

        return {
          activityCode:
            effectiveActivityCode,

          eligible
        };
      }
    );
  }
);

exports.getMissionBranchProgress = onCall(OPTIONS, async request => {
  const missionId = id(request.data?.missionId);
  const db = getFirestore();
  return db.runTransaction(async tx => {
    const p = await caller(tx,db,request);
    const root = (await tx.get(db.collection('missionLinks').doc(missionId))).data();
    if (!root || root.campaignId !== p.campaignId || (p.role !== 'admin' && root.createdBy !== p.uid && root.assignedTo !== p.uid)) fail('permission-denied','No tienes acceso al resumen de esta asignación.');
    const all = await tx.get(db.collection('missionLinks').where('groupId','==',root.groupId).limit(5001));
    const evidence = await tx.get(db.collection('missionEvidence').where('campaignId','==',p.campaignId).limit(5001));
    if (all.size > 5000 || evidence.size > 5000) fail('resource-exhausted','El resumen supera el límite de esta versión; no se mostrarán totales parciales.');
    const branch = new Map();
    for (const s of all.docs) {
      const l = s.data();
      if (l.campaignId === p.campaignId && (s.id === missionId || l.ancestorMissionIds.includes(missionId))) branch.set(s.id,l.assignedTo);
    }
    const reported = new Set();
    let latest = 0;
    for (const s of evidence.docs) {
      const e = s.data();
      if (branch.has(e.missionId) && branch.get(e.missionId) === e.uploadedBy) {
        reported.add(e.missionId);
        latest = Math.max(latest,e.createdAt?.toMillis?.() || 0);
      }
    }
    return {total:branch.size,withEvidence:reported.size,withoutEvidence:branch.size-reported.size,
      percentage:branch.size ? Math.round(1000*reported.size/branch.size)/10 : null,
      lastEvidence:latest ? new Date(latest).toISOString() : null, calculatedAt:new Date().toISOString()};
  });
});

// Aggregate only: descendants are authorized through the private registry.
exports.getMissionEvidenceTotal = onCall(OPTIONS, async request => {
  const db = getFirestore();
  return db.runTransaction(async tx => {
    const p = await caller(tx, db, request);
    const read = name => tx.get(db.collection(name).where('campaignId','==',p.campaignId).limit(5001));
    const missions = await read('misiones');
    const links = await read('missionLinks');
    const evidence = await read('missionEvidence');
    if ([missions,links,evidence].some(s => s.size > 5000)) fail('resource-exhausted','El total supera el límite de esta versión. No se muestran cifras parciales.');
    const allowed = new Set();
    const roots = new Map();
    for (const s of missions.docs) {
      const m = s.data();
      if (p.role === 'admin' || m.createdBy === p.uid || m.assignedTo === p.uid ||
          (p.role !== 'coordinador_municipal' && Array.isArray(m.supervisorIds) && m.supervisorIds.includes(p.uid))) allowed.add(s.id);
    }
    for (const s of links.docs) {
      const l = s.data();
      if (p.role === 'admin' || l.createdBy === p.uid || l.assignedTo === p.uid) roots.set(s.id,l.groupId);
    }
    const assignees = new Map();
    for (const s of links.docs) {
      const l = s.data();
      if (roots.has(s.id) || (Array.isArray(l.ancestorMissionIds) && l.ancestorMissionIds.some(a => roots.has(a) && roots.get(a) === l.groupId))) allowed.add(s.id);
      assignees.set(s.id,l.assignedTo);
    }
    let total = 0;
    for (const s of evidence.docs) {
      const e = s.data();
      if (allowed.has(e.missionId) && (!assignees.has(e.missionId) || assignees.get(e.missionId) === e.uploadedBy)) total++;
    }
    return {total, calculatedAt:new Date().toISOString()};
  });
});

exports.manageMissionLifecycle = onCall(OPTIONS, async request => {
  const missionId = id(request.data?.missionId);
  const action = request.data?.action;
  if (!['deactivate','deadline'].includes(action)) fail('invalid-argument','Acción inválida.');
  const reason = action === 'deactivate' ? text(request.data.reason,500,true) : '';
  const due = action === 'deadline' ? deadline(request.data.deadlineAt) : null;
  if (action === 'deadline' && (!due || Date.parse(due) <= Date.now())) fail('invalid-argument','Elige una fecha futura.');
  const db = getFirestore();
  return db.runTransaction(async tx => {
    const p = await caller(tx,db,request);
    const sourceRef = db.collection('misiones').doc(missionId);
    const source = (await tx.get(sourceRef)).data();
    if (!source || source.campaignId !== p.campaignId || source.createdBy !== p.uid) fail('permission-denied','Solo quien creó esta asignación puede administrarla.');
    const root = (await tx.get(db.collection('missionLinks').doc(missionId))).data();
    if (action === 'deactivate' && source.active === false) return {affected:0};
    if (source.active !== true) fail('failed-precondition','La misión está desactivada.');
    if (action === 'deadline' && (source.deadlineAt || root?.parentMissionId)) fail('failed-precondition','El plazo ya está fijado o se hereda de la misión original.');
    const records = [{id:missionId,mission:source,link:root}];
    if (root) {
      const all = await tx.get(db.collection('missionLinks').where('groupId','==',root.groupId).limit(5001));
      if (all.size > 5000) fail('resource-exhausted','La cadena supera el límite de esta versión.');
      const descendants = all.docs.filter(s => s.id !== missionId && s.data().campaignId === p.campaignId && s.data().ancestorMissionIds.includes(missionId));
      if (descendants.length > 199) fail('resource-exhausted','Máximo 200 asignaciones por operación; no se aplicó ningún cambio.');
      for (const s of descendants) {
        const m = (await tx.get(db.collection('misiones').doc(s.id))).data();
        if (!m || m.campaignId !== p.campaignId) fail('failed-precondition','La cadena requiere revisión.');
        if (action === 'deadline' && m.deadlineAt) fail('failed-precondition','Una delegación ya tiene plazo; no se modificó la cadena.');
        records.push({id:s.id,mission:m,link:s.data()});
      }
    }
    for (const r of records) {
      const patch = action === 'deactivate'
        ? {active:false,deactivatedBy:p.uid,deactivatedAt:FieldValue.serverTimestamp(),deactivationReason:reason}
        : {deadlineAt:due,deadlineAtMillis:Date.parse(due),deadlineSetBy:p.uid,deadlineSetAt:FieldValue.serverTimestamp()};
      // Preserve an earlier cancellation and its audit fields.
      if (action === 'deactivate' && r.mission.active === false) continue;
      tx.update(db.collection('misiones').doc(r.id),{...patch,updatedAt:FieldValue.serverTimestamp()});
      if (r.link && action === 'deadline') tx.update(db.collection('missionLinks').doc(r.id),{content:{...r.link.content,deadlineAt:due}});
    }
    return {affected:records.length};
  });
});
