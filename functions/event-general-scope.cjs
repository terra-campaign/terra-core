'use strict';

// ======================================================
// TERRA CAMPAIGN
// BUILD-118D1B
// RESOLUCION CANONICA DEL UNIVERSO DE EVENTO GENERAL
//
// FUENTE OFICIAL:
// territorialMemberships + persons
//
// NO usa "usuarios" como universo.
// NO requiere cuenta digital.
// NO crea invitaciones artificiales.
// ======================================================

const {
  onCall,
  HttpsError
} = require(
  'firebase-functions/v2/https'
);

const {
  getFirestore,
  FieldValue
} = require(
  'firebase-admin/firestore'
);

const {
  createHash
} = require(
  'node:crypto'
);


const OPTIONS = {
  region:
    'us-central1',

  timeoutSeconds:
    120
};


// ======================================================
// UTILIDADES
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


function cleanId(
  value
) {

  return typeof value ===
    'string'
    ? value.trim()
    : '';
}


function validId(
  value,
  label =
    'Identificador'
) {

  const id =
    cleanId(
      value
    );


  if (
    !id ||
    id.length >
      128 ||
    id.includes('/')
  ) {

    fail(
      'invalid-argument',
      `${label} inválido.`
    );
  }


  return id;
}


function hash(
  ...parts
) {

  return createHash(
    'sha256'
  )
    .update(
      JSON.stringify(
        parts
      )
    )
    .digest(
      'hex'
    );
}


function scopeMemberId(
  eventId,
  personId
) {

  return hash(
    eventId,
    personId,
    'event-scope-member'
  );
}


// ======================================================
// POLITICA
// ======================================================

function canResolveGeneralMunicipalScope({
  profile,
  event,
  scope
}) {

  if (
    !profile ||
    profile.active !==
      true ||
    profile.role !==
      'coordinador_municipal'
  ) {

    return false;
  }


  if (
    !event ||
    event.active !==
      true ||
    event.scopeMode !==
      'organizational' ||
    event.scopeType !==
      'municipality'
  ) {

    return false;
  }


  if (
    !scope ||
    scope.active !==
      true ||
    scope.scopeMode !==
      'organizational' ||
    scope.scopeType !==
      'municipality'
  ) {

    return false;
  }


  if (
    profile.campaignId !==
      event.campaignId ||
    profile.campaignId !==
      scope.campaignId
  ) {

    return false;
  }


  if (
    profile.municipalityId !==
      event.scopeMunicipalityId ||
    profile.municipalityId !==
      scope.municipalityId
  ) {

    return false;
  }


  return (
    event.createdBy ===
      profile.uid ||
    event.operationalOwnerId ===
      profile.uid
  );
}


// ======================================================
// RESOLVER UNIVERSO EN MEMORIA
// ======================================================

function buildGeneralMunicipalScopeMembers({
  event,
  scope,
  memberships,
  persons
}) {

  const safeMemberships =
    Array.isArray(
      memberships
    )
      ? memberships
      : [];


  const safePersons =
    Array.isArray(
      persons
    )
      ? persons
      : [];


  const personsById =
    new Map();


  for (
    const person of
    safePersons
  ) {

    if (!person) {
      continue;
    }


    const personId =
      cleanId(
        person.personId ||
        person.id
      );


    if (!personId) {
      continue;
    }


    personsById.set(
      personId,
      {
        ...person,
        personId
      }
    );
  }


  const membershipsByPerson =
    new Map();


  for (
    const membership of
    safeMemberships
  ) {

    if (
      !membership ||
      membership.active !==
        true ||
      membership.campaignId !==
        event.campaignId ||
      membership.municipalityId !==
        scope.municipalityId
    ) {

      continue;
    }


    const personId =
      cleanId(
        membership.personId
      );


    if (!personId) {

      throw new Error(
        'Existe una membresía territorial activa sin personId.'
      );
    }


    const current =
      membershipsByPerson.get(
        personId
      ) || [];


    current.push(
      membership
    );


    membershipsByPerson.set(
      personId,
      current
    );
  }


  const members = [];


  for (
    const [
      personId,
      personMemberships
    ] of
    membershipsByPerson.entries()
  ) {

    if (
      personMemberships.length !==
      1
    ) {

      throw new Error(
        `La persona ${personId} tiene ${personMemberships.length} membresías territoriales activas dentro del alcance.`
      );
    }


    const membership =
      personMemberships[0];


    const person =
      personsById.get(
        personId
      );


    if (!person) {

      throw new Error(
        `No existe la persona canónica ${personId}.`
      );
    }


    if (
      person.active !==
        true
    ) {

      throw new Error(
        `La persona ${personId} está inactiva.`
      );
    }


    if (
      person.campaignId !==
        event.campaignId
    ) {

      throw new Error(
        `La persona ${personId} pertenece a otra campaña.`
      );
    }


    const accountUid =
      cleanId(
        person.accountUid ||
        membership.accountUid
      ) ||
      null;


    members.push({
      id:
        scopeMemberId(
          event.id,
          personId
        ),

      eventId:
        event.id,

      scopeId:
        scope.id ||
        event.id,

      campaignId:
        event.campaignId,

      personId,

      accountUid,

      hasDigitalAccount:
        Boolean(
          accountUid
        ),

      membershipId:
        cleanId(
          membership.membershipId ||
          membership.id
        ),

      role:
        cleanId(
          membership.role
        ),

      municipalityId:
        cleanId(
          membership.municipalityId
        ),

      municipalityName:
        membership.municipalityName ||
        person.municipalityName ||
        '',

      structureId:
        cleanId(
          membership.structureId
        ),

      structureDocumentId:
        cleanId(
          membership.structureDocumentId
        ),

      structureName:
        membership.structureName ||
        person.structureName ||
        '',

      parentUserId:
        cleanId(
          membership.parentUserId
        ) ||
        null,

      mentorUserId:
        cleanId(
          membership.mentorUserId
        ) ||
        null,

      introducedByUserId:
        cleanId(
          membership.introducedByUserId
        ) ||
        null,

      name:
        person.name ||
        person.fullName ||
        person.displayName ||
        '',

      locality:
        person.locality ||
        person.localidad ||
        '',

      active:
        true,

      source:
        'event_scope_resolution',

      scopeType:
        'municipality'
    });
  }


  members.sort(
    (a, b) =>
      String(
        a.name ||
        a.personId
      )
        .localeCompare(
          String(
            b.name ||
            b.personId
          ),
          'es',
          {
            sensitivity:
              'base'
          }
        )
  );


  return members;
}


// ======================================================
// CARGAR CALLER
// ======================================================

async function loadCaller(
  db,
  request
) {

  const uid =
    request.auth?.uid;


  if (!uid) {

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
        uid
      )
      .get();


  if (!snapshot.exists) {

    fail(
      'permission-denied',
      'Perfil no autorizado.'
    );
  }


  return {
    ...snapshot.data(),
    uid:
      snapshot.id
  };
}


// ======================================================
// LEER PERSONAS POR IDS
// ======================================================

async function readPersonsByIds(
  db,
  personIds
) {

  const persons = [];


  for (
    let offset = 0;
    offset < personIds.length;
    offset += 100
  ) {

    const part =
      personIds.slice(
        offset,
        offset + 100
      );


    if (!part.length) {
      continue;
    }


    const refs =
      part.map(
        personId =>
          db
            .collection(
              'persons'
            )
            .doc(
              personId
            )
      );


    const snapshots =
      await db.getAll(
        ...refs
      );


    for (
      const snapshot of
      snapshots
    ) {

      if (!snapshot.exists) {

        persons.push({
          id:
            snapshot.id,

          personId:
            snapshot.id,

          __missing:
            true
        });

        continue;
      }


      persons.push({
        ...snapshot.data(),

        id:
          snapshot.id,

        personId:
          snapshot.id
      });
    }
  }


  return persons;
}


// ======================================================
// ESCRITURA POR LOTES
// ======================================================

async function commitOperations(
  db,
  operations,
  chunkSize =
    400
) {

  for (
    let offset = 0;
    offset < operations.length;
    offset += chunkSize
  ) {

    const part =
      operations.slice(
        offset,
        offset + chunkSize
      );


    const batch =
      db.batch();


    for (
      const operation of
      part
    ) {

      if (
        operation.type ===
          'set'
      ) {

        batch.set(
          operation.ref,
          operation.data,
          operation.options ||
          {}
        );

      } else if (
        operation.type ===
          'update'
      ) {

        batch.update(
          operation.ref,
          operation.data
        );

      } else {

        throw new Error(
          'Operación de escritura no soportada.'
        );
      }
    }


    await batch.commit();
  }
}


// ======================================================
// CALLABLE
// ======================================================

exports.resolveGeneralEventScope =
  onCall(
    OPTIONS,

    async request => {

      const input =
        request.data ||
        {};


      const eventId =
        validId(
          input.eventId,
          'Evento'
        );


      const requestId =
        validId(
          input.requestId,
          'Operación'
        );


      const db =
        getFirestore();


      const profile =
        await loadCaller(
          db,
          request
        );


      const eventRef =
        db.collection(
          'events'
        )
          .doc(
            eventId
          );


      const scopeRef =
        db.collection(
          'eventScopes'
        )
          .doc(
            eventId
          );


      const [
        eventSnapshot,
        scopeSnapshot
      ] =
        await Promise.all([
          eventRef.get(),
          scopeRef.get()
        ]);


      if (
        !eventSnapshot.exists ||
        !scopeSnapshot.exists
      ) {

        fail(
          'not-found',
          'El evento general o su alcance no existe.'
        );
      }


      const event = {
        ...eventSnapshot.data(),
        id:
          eventSnapshot.id
      };


      const scope = {
        ...scopeSnapshot.data(),
        id:
          scopeSnapshot.id
      };


      if (
        !canResolveGeneralMunicipalScope({
          profile,
          event,
          scope
        })
      ) {

        fail(
          'permission-denied',
          'No puedes resolver el alcance de este evento.'
        );
      }


      // ==================================================
      // MEMBERSHIPS DEL MUNICIPIO
      // ==================================================

      const membershipsSnapshot =
        await db
          .collection(
            'territorialMemberships'
          )
          .where(
            'municipalityId',
            '==',
            scope.municipalityId
          )
          .get();


      const memberships =
        membershipsSnapshot.docs
          .map(
            doc => ({
              ...doc.data(),

              id:
                doc.id,

              membershipId:
                doc.id
            })
          )
          .filter(
            membership =>
              membership.active ===
                true &&
              membership.campaignId ===
                event.campaignId
          );


      const personIds =
        [
          ...new Set(
            memberships
              .map(
                membership =>
                  cleanId(
                    membership.personId
                  )
              )
              .filter(Boolean)
          )
        ];


      const persons =
        await readPersonsByIds(
          db,
          personIds
        );


      const missingPersons =
        persons.filter(
          person =>
            person.__missing ===
            true
        );


      if (
        missingPersons.length
      ) {

        fail(
          'failed-precondition',
          `Hay ${missingPersons.length} membresía(s) con persona canónica inexistente.`
        );
      }


      let members;


      try {

        members =
          buildGeneralMunicipalScopeMembers({
            event,
            scope,
            memberships,
            persons
          });

      } catch (error) {

        fail(
          'failed-precondition',
          error.message ||
          'El universo canónico del evento es inconsistente.'
        );
      }


      // ==================================================
      // EVENT SCOPE MEMBERS EXISTENTES
      // ==================================================

      const existingSnapshot =
        await db
          .collection(
            'eventScopeMembers'
          )
          .where(
            'eventId',
            '==',
            event.id
          )
          .get();


      const existingById =
        new Map(
          existingSnapshot.docs
            .map(
              doc => [
                doc.id,
                {
                  ...doc.data(),
                  id:
                    doc.id
                }
              ]
            )
        );


      const currentIds =
        new Set(
          members.map(
            member =>
              member.id
          )
        );


      const now =
        FieldValue
          .serverTimestamp();


      const operations = [];


      // ==================================================
      // ALTAS / ACTUALIZACIONES DEL UNIVERSO
      // ==================================================

      for (
        const member of
        members
      ) {

        const ref =
          db.collection(
            'eventScopeMembers'
          )
            .doc(
              member.id
            );


        const existed =
          existingById.has(
            member.id
          );


        operations.push({
          type:
            'set',

          ref,

          data: {
            ...member,

            active:
              true,

            excludedAt:
              null,

            resolvedAt:
              now,

            updatedAt:
              now,

            ...(
              existed
                ? {}
                : {
                    createdAt:
                      now
                  }
            ),

            resolutionVersion:
              1
          },

          options: {
            merge:
              true
          }
        });
      }


      // ==================================================
      // PERSONAS QUE YA NO PERTENECEN AL ALCANCE
      // ==================================================

      let excludedCount =
        0;


      for (
        const [
          existingId,
          existing
        ] of
        existingById.entries()
      ) {

        if (
          currentIds.has(
            existingId
          )
        ) {
          continue;
        }


        if (
          existing.active !==
            true
        ) {
          continue;
        }


        excludedCount++;


        operations.push({
          type:
            'update',

          ref:
            db.collection(
              'eventScopeMembers'
            )
              .doc(
                existingId
              ),

          data: {
            active:
              false,

            excludedAt:
              now,

            updatedAt:
              now
          }
        });
      }


      await commitOperations(
        db,
        operations
      );


      const digitalCount =
        members.filter(
          member =>
            member.hasDigitalAccount ===
            true
        )
          .length;


      const accountlessCount =
        members.length -
        digitalCount;


      // ==================================================
      // RESUMEN EN EVENT + SCOPE
      // ==================================================

      const summaryBatch =
        db.batch();


      summaryBatch.set(
        scopeRef,
        {
          resolutionStatus:
            'resolved',

          memberCount:
            members.length,

          digitalMemberCount:
            digitalCount,

          accountlessMemberCount:
            accountlessCount,

          lastResolvedBy:
            profile.uid,

          lastResolvedByRole:
            profile.role,

          lastResolvedAt:
            now,

          updatedAt:
            now,

          resolutionVersion:
            1
        },
        {
          merge:
            true
        }
      );


      summaryBatch.set(
        eventRef,
        {
          scopeResolved:
            true,

          scopeMemberCount:
            members.length,

          scopeDigitalMemberCount:
            digitalCount,

          scopeAccountlessMemberCount:
            accountlessCount,

          scopeLastResolvedAt:
            now,

          updatedAt:
            now
        },
        {
          merge:
            true
        }
      );


      const receiptRef =
        db.collection(
          'eventScopeResolutions'
        )
          .doc(
            hash(
              profile.uid,
              event.id,
              requestId
            )
          );


      summaryBatch.set(
        receiptRef,
        {
          eventId:
            event.id,

          scopeId:
            scope.id,

          campaignId:
            event.campaignId,

          municipalityId:
            scope.municipalityId,

          actorUid:
            profile.uid,

          actorRole:
            profile.role,

          requestId,

          memberCount:
            members.length,

          digitalMemberCount:
            digitalCount,

          accountlessMemberCount:
            accountlessCount,

          excludedCount,

          createdAt:
            now,

          version:
            1
        },
        {
          merge:
            false
        }
      );


      const logRef =
        db.collection(
          'logs'
        )
          .doc();


      summaryBatch.set(
        logRef,
        {
          action:
            'RESOLVE_GENERAL_EVENT_SCOPE',

          eventId:
            event.id,

          campaignId:
            event.campaignId,

          municipalityId:
            scope.municipalityId,

          actorUid:
            profile.uid,

          actorRole:
            profile.role,

          memberCount:
            members.length,

          digitalMemberCount:
            digitalCount,

          accountlessMemberCount:
            accountlessCount,

          excludedCount,

          createdAt:
            now
        }
      );


      await summaryBatch.commit();


      return {
        success:
          true,

        eventId:
          event.id,

        scopeType:
          scope.scopeType,

        municipalityId:
          scope.municipalityId,

        memberCount:
          members.length,

        digitalMemberCount:
          digitalCount,

        accountlessMemberCount:
          accountlessCount,

        excludedCount
      };
    }
  );


// ======================================================
// TEST HELPERS
// ======================================================

exports._test = {
  canResolveGeneralMunicipalScope,
  buildGeneralMunicipalScopeMembers,
  scopeMemberId
};
