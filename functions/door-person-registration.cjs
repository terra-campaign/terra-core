'use strict';

// ======================================================
// TERRA CAMPAIGN
// BUILD-118C-3B3E-1
//
// ALTA DE COLABORADOR DE BASE SIN FIREBASE AUTH
//
// MODELO:
// PERSONA -> MEMBERSHIP -> ROLE
//
// La puerta NO crea directamente a la persona.
// La puerta genera un handoff para el tutor.
// El PARTICIPANTE tutor completa el alta.
//
// NO crea Authentication.
// NO toma asistencia.
// ======================================================

const {
  createHash
} =
  require(
    'node:crypto'
  );


const {
  onCall,
  HttpsError
} =
  require(
    'firebase-functions/v2/https'
  );


const {
  getFirestore,
  FieldValue,
  Timestamp
} =
  require(
    'firebase-admin/firestore'
  );


const {
  resolveCanonicalPersonForAccount
} =
  require(
    './person-identity.cjs'
  );


const {
  canonicalMembershipDocumentId
} =
  require(
    './territorial-membership-id.cjs'
  );


const OPTIONS = {
  region:
    'us-central1',

  timeoutSeconds:
    60
};


const DOOR_CALLER_ROLES =
  new Set([
    'admin',
    'lider_principal',
    'coordinador_municipal',
    'jefe_estructura',
    'integrante',
    'participante'
  ]);


const HANDOFF_TTL_MS =
  24 * 60 * 60 * 1000;


// ======================================================
// HELPERS
// ======================================================

function fail(
  code,
  message
) {

  throw new HttpsError(
    code,
    message
  );
}


function cleanText(
  value,
  maxLength = 160
) {

  return String(
    value || ''
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
    .slice(
      0,
      maxLength
    );
}


function normalizeText(
  value
) {

  return cleanText(
    value,
    240
  )
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase();
}


function normalizePhone(
  value
) {

  const digits =
    String(
      value || ''
    )
      .replace(
        /\D/g,
        ''
      );


  if (
    /^52\d{10}$/.test(
      digits
    )
  ) {

    return digits.slice(
      2
    );
  }


  return digits;
}


function validId(
  value
) {

  const id =
    String(
      value || ''
    ).trim();


  if (
    !id ||
    id.length > 128 ||
    id.includes('/')
  ) {

    return '';
  }


  return id;
}


function validOpaqueRef(
  value
) {

  return /^[a-f0-9]{64}$/.test(
    String(
      value || ''
    ).trim()
  );
}


function opaqueInviterRef(
  campaignId,
  uid
) {

  return createHash(
    'sha256'
  )
    .update(
      JSON.stringify([
        campaignId,
        uid,
        'door-inviter-v1'
      ])
    )
    .digest(
      'hex'
    );
}


function opaqueTutorRef(
  campaignId,
  uid
) {

  return createHash(
    'sha256'
  )
    .update(
      JSON.stringify([
        campaignId,
        uid,
        'door-tutor-v1'
      ])
    )
    .digest(
      'hex'
    );
}


function membershipDocumentId(
  campaignId,
  personId
) {

  return canonicalMembershipDocumentId(
    campaignId,
    personId
  );
}


// ======================================================
// INVITADOR -> TUTOR
// Misma política que BUILD-118C-3B3C.
// ======================================================

function tutorMatchesInviter(
  inviter,
  tutor
) {

  if (
    !inviter ||
    !tutor ||
    inviter.active !== true ||
    tutor.active !== true ||
    tutor.role !==
      'participante' ||
    inviter.campaignId !==
      tutor.campaignId ||
    inviter.municipalityId !==
      tutor.municipalityId
  ) {

    return false;
  }


  if (
    inviter.role ===
      'participante'
  ) {

    return (
      inviter.uid ===
      tutor.uid
    );
  }


  if (
    inviter.role ===
      'integrante'
  ) {

    return Boolean(
      inviter.structureId &&
      tutor.structureId ===
        inviter.structureId &&
      tutor.parentUserId ===
        inviter.uid
    );
  }


  if (
    inviter.role ===
      'jefe_estructura'
  ) {

    return Boolean(
      inviter.structureId &&
      tutor.structureId ===
        inviter.structureId
    );
  }


  return false;
}


// ======================================================
// CALLER
// ======================================================

async function readCaller(
  db,
  request
) {

  if (!request.auth) {

    fail(
      'unauthenticated',
      'Inicia sesión.'
    );
  }


  const snapshot =
    await db
      .collection(
        'usuarios'
      )
      .doc(
        request.auth.uid
      )
      .get();


  if (!snapshot.exists) {

    fail(
      'permission-denied',
      'Perfil no autorizado.'
    );
  }


  const profile = {
    ...snapshot.data(),

    uid:
      snapshot.id
  };


  if (
    profile.active !== true ||
    !profile.campaignId ||
    !DOOR_CALLER_ROLES.has(
      profile.role
    )
  ) {

    fail(
      'permission-denied',
      'Perfil no autorizado.'
    );
  }


  return profile;
}


// ======================================================
// USUARIOS DE CAMPAÑA
// ======================================================

async function loadCampaignUsers(
  db,
  campaignId
) {

  const snapshot =
    await db
      .collection(
        'usuarios'
      )
      .where(
        'campaignId',
        '==',
        campaignId
      )
      .limit(
        1001
      )
      .get();


  if (
    snapshot.size > 1000
  ) {

    fail(
      'resource-exhausted',
      'La campaña requiere un índice escalable antes de continuar.'
    );
  }


  return snapshot.docs.map(
    document => ({
      ...document.data(),

      uid:
        document.id
    })
  );
}


// ======================================================
// RESOLVER REFERENCIAS OPACAS
// ======================================================

function resolveInviter(
  users,
  campaignId,
  inviterRef
) {

  return users.find(
    user =>
      opaqueInviterRef(
        campaignId,
        user.uid
      ) ===
        inviterRef
  ) || null;
}


function resolveTutor(
  users,
  campaignId,
  tutorRef
) {

  return users.find(
    user =>
      opaqueTutorRef(
        campaignId,
        user.uid
      ) ===
        tutorRef
  ) || null;
}


// ======================================================
// DUPLICADOS FUERTES
// ======================================================

async function assertNoStrongDuplicate({
  db,
  campaignId,
  name,
  locality,
  phone,
  street,
  houseNumber
}) {

  const normalizedPhone =
    normalizePhone(
      phone
    );


  const normalizedName =
    normalizeText(
      name
    );


  const normalizedLocality =
    normalizeText(
      locality
    );


  const normalizedStreet =
    normalizeText(
      street
    );


  const normalizedHouseNumber =
    normalizeText(
      houseNumber
    );


  const [
    personsSnapshot,
    usersSnapshot
  ] =
    await Promise.all([

      db
        .collection(
          'persons'
        )
        .where(
          'campaignId',
          '==',
          campaignId
        )
        .limit(
          1001
        )
        .get(),

      db
        .collection(
          'usuarios'
        )
        .where(
          'campaignId',
          '==',
          campaignId
        )
        .limit(
          1001
        )
        .get()
    ]);


  if (
    personsSnapshot.size > 1000 ||
    usersSnapshot.size > 1000
  ) {

    fail(
      'resource-exhausted',
      'La campaña requiere un índice escalable para control de identidad.'
    );
  }


  const records = [

    ...personsSnapshot.docs.map(
      item => item.data()
    ),

    ...usersSnapshot.docs.map(
      item => item.data()
    )
  ];


  for (
    const record of
    records
  ) {

    const recordPhone =
      normalizePhone(
        record.phone
      );


    if (
      normalizedPhone &&
      recordPhone &&
      normalizedPhone ===
        recordPhone
    ) {

      fail(
        'already-exists',
        'Ya existe una persona en TERRA con ese teléfono.'
      );
    }


    if (
      normalizedStreet &&
      normalizedHouseNumber &&
      normalizedName ===
        normalizeText(
          record.name
        ) &&
      normalizedLocality ===
        normalizeText(
          record.locality
        ) &&
      normalizedStreet ===
        normalizeText(
          record.street
        ) &&
      normalizedHouseNumber ===
        normalizeText(
          record.houseNumber
        )
    ) {

      fail(
        'already-exists',
        'Ya existe una persona con el mismo nombre y domicilio.'
      );
    }
  }
}


// ======================================================
// 1. PUERTA CREA HANDOFF
// ======================================================

exports.createDoorRegistrationHandoff =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const caller =
        await readCaller(
          db,
          request
        );


      const data =
        request.data || {};


      const residenceMunicipalityId =
        validId(
          data.residenceMunicipalityId
        );


      const inviterRef =
        String(
          data.inviterRef || ''
        ).trim();


      const tutorRef =
        String(
          data.tutorRef || ''
        ).trim();


      const name =
        cleanText(
          data.name,
          120
        );


      const locality =
        cleanText(
          data.locality,
          120
        );


      if (
        name.length < 2
      ) {

        fail(
          'invalid-argument',
          'Ingrese el nombre de la persona.'
        );
      }


      if (
        locality.length < 2
      ) {

        fail(
          'invalid-argument',
          'Ingrese la población de la persona.'
        );
      }


      if (
        !residenceMunicipalityId ||
        !validOpaqueRef(
          inviterRef
        ) ||
        !validOpaqueRef(
          tutorRef
        )
      ) {

        fail(
          'invalid-argument',
          'Falta resolver municipio, invitador o tutor.'
        );
      }


      const callerMunicipalityId =
        validId(
          caller.municipalityId
        );


      if (
        !callerMunicipalityId ||
        callerMunicipalityId !==
          residenceMunicipalityId
      ) {

        fail(
          'permission-denied',
          'La persona no puede incorporarse territorialmente desde este municipio.'
        );
      }


      const users =
        await loadCampaignUsers(
          db,
          caller.campaignId
        );


      const inviter =
        resolveInviter(
          users,
          caller.campaignId,
          inviterRef
        );


      const tutor =
        resolveTutor(
          users,
          caller.campaignId,
          tutorRef
        );


      if (
        !inviter ||
        !tutor
      ) {

        fail(
          'not-found',
          'No fue posible resolver invitador o tutor.'
        );
      }


      if (
        inviter.active !== true ||
        tutor.active !== true ||
        inviter.municipalityId !==
          residenceMunicipalityId ||
        tutor.municipalityId !==
          residenceMunicipalityId ||
        tutor.role !==
          'participante'
      ) {

        fail(
          'failed-precondition',
          'La relación territorial ya no es válida.'
        );
      }


      if (
        !tutorMatchesInviter(
          inviter,
          tutor
        )
      ) {

        fail(
          'permission-denied',
          'El tutor no pertenece a la rama territorial del invitador.'
        );
      }


      // ==================================================
      // BUILD-123B3
      // IDENTIDADES CANONICAS DEL HANDOFF
      //
      // invitador -> referredByPersonId
      // tutor     -> parent / introducedBy / mentor
      // ==================================================

      const [
        inviterIdentity,
        tutorIdentity
      ] =
        await Promise.all([

          resolveCanonicalPersonForAccount({

            db,

            accountUid:
              inviter.uid,

            profile:
              inviter,

            campaignId:
              caller.campaignId
          }),

          resolveCanonicalPersonForAccount({

            db,

            accountUid:
              tutor.uid,

            profile:
              tutor,

            campaignId:
              caller.campaignId
          })
        ]);


      const inviterPersonId =
        inviterIdentity.personId;


      const tutorPersonId =
        tutorIdentity.personId;


      const structureId =
        validId(
          tutor.structureId
        );


      if (!structureId) {

        fail(
          'failed-precondition',
          'El tutor no tiene una estructura territorial válida.'
        );
      }


      const handoffRef =
        db
          .collection(
            'doorRegistrationHandoffs'
          )
          .doc();


      const expiresAt =
        Timestamp.fromMillis(
          Date.now() +
          HANDOFF_TTL_MS
        );


      const now =
        FieldValue.serverTimestamp();


      await handoffRef.set({

        id:
          handoffRef.id,

        campaignId:
          caller.campaignId,

        status:
          'pending',

        source:
          'event_door',

        residenceMunicipalityId,

        municipalityName:
          cleanText(
            tutor.municipalityName,
            120
          ),

        structureId,

        structureName:
          cleanText(
            tutor.structureName,
            120
          ),

        draftName:
          name,

        draftLocality:
          locality,

        inviterUserId:
          inviter.uid,

        inviterPersonId:
          inviterPersonId,

        inviterName:
          cleanText(
            inviter.name,
            120
          ),

        inviterRole:
          inviter.role,

        mentorUserId:
          tutor.uid,

        mentorPersonId:
          tutorPersonId,

        mentorName:
          cleanText(
            tutor.name,
            120
          ),

        createdByUserId:
          caller.uid,

        createdByName:
          cleanText(
            caller.name,
            120
          ),

        createdByRole:
          caller.role,

        personId:
          null,

        membershipId:
          null,

        expiresAt,

        completedAt:
          null,

        createdAt:
          now,

        updatedAt:
          now,

        version:
          1
      });


      return {

        success:
          true,

        handoff: {

          id:
            handoffRef.id,

          status:
            'pending',

          name,

          locality,

          municipalityName:
            cleanText(
              tutor.municipalityName,
              120
            ),

          structureName:
            cleanText(
              tutor.structureName,
              120
            ),

          inviterName:
            cleanText(
              inviter.name,
              120
            ),

          mentorName:
            cleanText(
              tutor.name,
              120
            ),

          expiresAt:
            expiresAt
              .toDate()
              .toISOString()
        }
      };
    }
  );


// ======================================================
// 2. TUTOR CONSULTA SU HANDOFF
// ======================================================

exports.getMyDoorRegistrationHandoff =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const caller =
        await readCaller(
          db,
          request
        );


      if (
        caller.role !==
          'participante'
      ) {

        fail(
          'permission-denied',
          'Solo el tutor participante puede completar esta alta.'
        );
      }


      const handoffId =
        validId(
          request.data?.handoffId
        );


      if (!handoffId) {

        fail(
          'invalid-argument',
          'Registro de transferencia inválido.'
        );
      }


      const snapshot =
        await db
          .collection(
            'doorRegistrationHandoffs'
          )
          .doc(
            handoffId
          )
          .get();


      if (!snapshot.exists) {

        fail(
          'not-found',
          'El registro de transferencia no existe.'
        );
      }


      const handoff = {
        ...snapshot.data(),

        id:
          snapshot.id
      };


      if (
        handoff.campaignId !==
          caller.campaignId ||
        handoff.mentorUserId !==
          caller.uid
      ) {

        fail(
          'permission-denied',
          'Este registro pertenece a otro tutor.'
        );
      }


      return {

        success:
          true,

        handoff: {

          id:
            handoff.id,

          status:
            handoff.status,

          name:
            handoff.draftName || '',

          locality:
            handoff.draftLocality || '',

          municipalityName:
            handoff.municipalityName || '',

          structureName:
            handoff.structureName || '',

          inviterName:
            handoff.inviterName || '',

          mentorName:
            handoff.mentorName || '',

          personId:
            handoff.personId || null,

          expiresAt:
            handoff.expiresAt
              ?.toDate?.()
              ?.toISOString?.() ||
            null
        }
      };
    }
  );


// ======================================================
// 3. TUTOR COMPLETA ALTA
// ======================================================

exports.completeDoorRegistrationHandoff =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const caller =
        await readCaller(
          db,
          request
        );


      if (
        caller.role !==
          'participante'
      ) {

        fail(
          'permission-denied',
          'Solo el participante tutor puede registrar al colaborador de base.'
        );
      }


      const handoffId =
        validId(
          request.data?.handoffId
        );


      if (!handoffId) {

        fail(
          'invalid-argument',
          'Registro de transferencia inválido.'
        );
      }


      const handoffRef =
        db
          .collection(
            'doorRegistrationHandoffs'
          )
          .doc(
            handoffId
          );


      const handoffSnapshot =
        await handoffRef.get();


      if (!handoffSnapshot.exists) {

        fail(
          'not-found',
          'El registro de transferencia no existe.'
        );
      }


      const handoff = {
        ...handoffSnapshot.data(),

        id:
          handoffSnapshot.id
      };


      if (
        handoff.campaignId !==
          caller.campaignId ||
        handoff.mentorUserId !==
          caller.uid
      ) {

        fail(
          'permission-denied',
          'Este registro pertenece a otro tutor.'
        );
      }


      if (
        handoff.status ===
          'completed'
      ) {

        return {

          success:
            true,

          unchanged:
            true,

          person: {

            personId:
              handoff.personId,

            membershipId:
              handoff.membershipId,

            name:
              handoff.completedPersonName ||
              handoff.draftName ||
              ''
          }
        };
      }


      if (
        handoff.status !==
          'pending'
      ) {

        fail(
          'failed-precondition',
          'Este registro ya no está pendiente.'
        );
      }


      const expiresMillis =
        handoff.expiresAt
          ?.toMillis?.();


      if (
        !Number.isFinite(
          expiresMillis
        ) ||
        Date.now() >=
          expiresMillis
      ) {

        fail(
          'failed-precondition',
          'Este registro de transferencia ya venció.'
        );
      }


      // ==================================================
      // BUILD-123B3
      // IDENTIDAD CANONICA DEL TUTOR QUE COMPLETA EL ALTA
      // ==================================================

      const callerIdentity =
        await resolveCanonicalPersonForAccount({

          db,

          accountUid:
            caller.uid,

          profile:
            caller,

          campaignId:
            caller.campaignId
        });


      const callerPersonId =
        callerIdentity.personId;


      const storedMentorPersonId =
        validId(
          handoff.mentorPersonId
        );


      if (
        storedMentorPersonId &&
        storedMentorPersonId !==
          callerPersonId
      ) {

        fail(
          'failed-precondition',
          'La identidad canónica del tutor ya no coincide con el registro.'
        );
      }


      let inviterPersonId =
        validId(
          handoff.inviterPersonId
        );


      // --------------------------------------------------
      // COMPATIBILIDAD CON HANDOFFS ANTERIORES A BUILD-123B3
      // --------------------------------------------------

      if (!inviterPersonId) {

        const inviterUid =
          validId(
            handoff.inviterUserId
          );


        if (!inviterUid) {

          fail(
            'failed-precondition',
            'El registro no conserva un invitador válido.'
          );
        }


        const inviterSnapshot =
          await db
            .collection(
              'usuarios'
            )
            .doc(
              inviterUid
            )
            .get();


        if (!inviterSnapshot.exists) {

          fail(
            'failed-precondition',
            'No fue posible resolver la identidad del invitador.'
          );
        }


        const inviterProfile = {

          ...inviterSnapshot.data(),

          uid:
            inviterSnapshot.id
        };


        const inviterIdentity =
          await resolveCanonicalPersonForAccount({

            db,

            accountUid:
              inviterUid,

            profile:
              inviterProfile,

            campaignId:
              caller.campaignId
          });


        inviterPersonId =
          inviterIdentity.personId;
      }


      const data =
        request.data || {};


      const name =
        cleanText(
          data.name ||
          handoff.draftName,
          120
        );


      const locality =
        cleanText(
          data.locality ||
          handoff.draftLocality,
          120
        );


      const street =
        cleanText(
          data.street,
          160
        );


      const houseNumber =
        cleanText(
          data.houseNumber,
          30
        );


      const phone =
        normalizePhone(
          data.phone
        );


      let hasWhatsApp =
        false;


      if (phone) {

        if (
          typeof data.hasWhatsApp !==
            'boolean'
        ) {

          fail(
            'invalid-argument',
            'Indica si el teléfono tiene WhatsApp.'
          );
        }


        hasWhatsApp =
          data.hasWhatsApp;
      }


      if (
        name.length < 2 ||
        locality.length < 2
      ) {

        fail(
          'invalid-argument',
          'Nombre y población son obligatorios.'
        );
      }


      if (
        phone &&
        (
          phone.length < 10 ||
          phone.length > 15
        )
      ) {

        fail(
          'invalid-argument',
          'Ingrese un teléfono válido.'
        );
      }


      if (
        hasWhatsApp === true &&
        !phone
      ) {

        fail(
          'invalid-argument',
          'Debe ingresar el teléfono que tiene WhatsApp.'
        );
      }


      if (
        caller.municipalityId !==
          handoff.residenceMunicipalityId ||
        caller.structureId !==
          handoff.structureId
      ) {

        fail(
          'permission-denied',
          'El tutor ya no pertenece a la estructura territorial del registro.'
        );
      }


      await assertNoStrongDuplicate({
        db,

        campaignId:
          caller.campaignId,

        name,

        locality,

        phone,

        street,

        houseNumber
      });


      const personRef =
        db
          .collection(
            'persons'
          )
          .doc();


      const membershipId =
        membershipDocumentId(
          caller.campaignId,
          personRef.id
        );


      const membershipRef =
        db
          .collection(
            'territorialMemberships'
          )
          .doc(
            membershipId
          );


      const logRef =
        db
          .collection(
            'logs'
          )
          .doc();


      await db.runTransaction(
        async tx => {

          const currentHandoffSnapshot =
            await tx.get(
              handoffRef
            );


          if (
            !currentHandoffSnapshot.exists
          ) {

            fail(
              'not-found',
              'El registro de transferencia ya no existe.'
            );
          }


          const currentHandoff =
            currentHandoffSnapshot.data();


          if (
            currentHandoff.status !==
              'pending'
          ) {

            fail(
              'failed-precondition',
              'El registro ya fue procesado.'
            );
          }


          const now =
            FieldValue.serverTimestamp();


          const ancestorUserIds = [
            caller.uid,
            ...(
              Array.isArray(
                caller.ancestorIds
              )
                ? caller.ancestorIds
                : []
            )
          ];


          tx.create(
            personRef,
            {

              id:
                personRef.id,

              campaignId:
                caller.campaignId,

              name,

              normalizedName:
                normalizeText(
                  name
                ),

              phone:
                phone || '',

              normalizedPhone:
                phone || '',

              hasWhatsApp,

              locality,

              street,

              houseNumber,

              municipalityId:
                handoff.residenceMunicipalityId,

              municipalityName:
                handoff.municipalityName || '',

              accountUid:
                null,

              active:
                true,

              identityStatus:
                'minimal',

              source:
                'event_door',

              introducedByUserId:
                caller.uid,

              introducedByPersonId:
                callerPersonId,

              referredByUserId:
                handoff.inviterUserId,

              referredByPersonId:
                inviterPersonId,

              mentorUserId:
                caller.uid,

              mentorPersonId:
                callerPersonId,

              createdByUserId:
                caller.uid,

              createdByRole:
                caller.role,

              createdAt:
                now,

              updatedAt:
                now,

              version:
                1
            }
          );


          tx.create(
            membershipRef,
            {

              id:
                membershipId,

              personId:
                personRef.id,

              campaignId:
                caller.campaignId,

              role:
                'colaborador_base',

              active:
                true,

              municipalityId:
                handoff.residenceMunicipalityId,

              municipalityName:
                handoff.municipalityName || '',

              structureId:
                handoff.structureId,

              structureName:
                handoff.structureName || '',

              parentUserId:
                caller.uid,

              parentPersonId:
                callerPersonId,

              mentorUserId:
                caller.uid,

              mentorPersonId:
                callerPersonId,

              introducedByUserId:
                caller.uid,

              introducedByPersonId:
                callerPersonId,

              referredByUserId:
                handoff.inviterUserId,

              referredByPersonId:
                inviterPersonId,

              ancestorUserIds,

              originHandoffId:
                handoff.id,

              activityPreferences: {
                eventos_mitines:
                  true
              },

              preferencesVersion:
                1,

              createdAt:
                now,

              updatedAt:
                now,

              version:
                1
            }
          );


          tx.update(
            handoffRef,
            {

              status:
                'completed',

              personId:
                personRef.id,

              membershipId,

              completedPersonName:
                name,

              completedByUserId:
                caller.uid,

              completedByPersonId:
                callerPersonId,

              inviterPersonId:
                inviterPersonId,

              mentorPersonId:
                callerPersonId,

              completedAt:
                now,

              updatedAt:
                now
            }
          );


          tx.create(
            logRef,
            {

              action:
                'CREATE_BASE_COLLABORATOR',

              campaignId:
                caller.campaignId,

              personId:
                personRef.id,

              membershipId,

              municipalityId:
                handoff.residenceMunicipalityId,

              structureId:
                handoff.structureId,

              mentorUserId:
                caller.uid,

              mentorPersonId:
                callerPersonId,

              mentorName:
                caller.name || '',

              referredByUserId:
                handoff.inviterUserId,

              referredByPersonId:
                inviterPersonId,

              handoffId:
                handoff.id,

              createdBy:
                caller.uid,

              createdByRole:
                caller.role,

              createdAt:
                now
            }
          );
        }
      );


      return {

        success:
          true,

        unchanged:
          false,

        person: {

          personId:
            personRef.id,

          membershipId,

          name,

          locality,

          municipalityName:
            handoff.municipalityName || '',

          structureName:
            handoff.structureName || '',

          mentorName:
            caller.name || '',

          inviterName:
            handoff.inviterName || '',

          role:
            'colaborador_base',

          accountUid:
            null
        },

        message:
          `${name} fue registrado correctamente en TERRA.`
      };
    }
  );


// ======================================================
// 4. PUERTA CONSULTA ESTADO DEL HANDOFF
// ======================================================

exports.getDoorRegistrationHandoffStatus =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const caller =
        await readCaller(
          db,
          request
        );


      const handoffId =
        validId(
          request.data?.handoffId
        );


      if (!handoffId) {

        fail(
          'invalid-argument',
          'Registro de transferencia inválido.'
        );
      }


      const snapshot =
        await db
          .collection(
            'doorRegistrationHandoffs'
          )
          .doc(
            handoffId
          )
          .get();


      if (!snapshot.exists) {

        fail(
          'not-found',
          'El registro no existe.'
        );
      }


      const handoff = {
        ...snapshot.data(),

        id:
          snapshot.id
      };


      if (
        handoff.campaignId !==
          caller.campaignId ||
        (
          handoff.createdByUserId !==
            caller.uid &&
          handoff.mentorUserId !==
            caller.uid
        )
      ) {

        fail(
          'permission-denied',
          'No tienes autorización para consultar este registro.'
        );
      }


      return {

        success:
          true,

        status:
          handoff.status,

        handoffId:
          handoff.id,

        personId:
          handoff.personId || null,

        membershipId:
          handoff.membershipId || null,

        personName:
          handoff.completedPersonName ||
          handoff.draftName ||
          '',

        mentorName:
          handoff.mentorName || '',

        inviterName:
          handoff.inviterName || '',

        municipalityName:
          handoff.municipalityName || '',

        structureName:
          handoff.structureName || '',

        completed:
          handoff.status ===
            'completed'
      };
    }
  );


// ======================================================
// TEST HELPERS
// ======================================================

exports._test = {
  cleanText,
  normalizeText,
  normalizePhone,
  validId,
  validOpaqueRef,
  opaqueInviterRef,
  opaqueTutorRef,
  membershipDocumentId,
  tutorMatchesInviter
};
