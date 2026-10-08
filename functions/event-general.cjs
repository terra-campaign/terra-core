'use strict';

// ======================================================
// TERRA CAMPAIGN
// BUILD-118D1A
// EVENTO GENERAL POR ALCANCE ORGANIZACIONAL
//
// Regla:
// - Responsable de Organización crea.
// - Alcance inicial: su propio municipio.
// - Admin Técnico NO opera.
// - Líder Principal supervisa, no opera este callable.
// - No requiere seleccionar destinatarios.
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

const {
  classifyEventAttendanceActivity
} = require(
  './activity-classification.cjs'
);


const OPTIONS = {
  region:
    'us-central1',

  timeoutSeconds:
    60
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


function validId(
  value,
  label =
    'Identificador'
) {

  if (
    typeof value !==
      'string' ||
    !value.length ||
    value.length >
      128 ||
    value.includes('/')
  ) {

    fail(
      'invalid-argument',
      `${label} inválido.`
    );
  }


  return value;
}


function text(
  value,
  max,
  required =
    false
) {

  if (
    value == null &&
    !required
  ) {
    return '';
  }


  if (
    typeof value !==
      'string' ||
    value.length >
      max ||
    (
      required &&
      !value.trim()
    )
  ) {

    fail(
      'invalid-argument',
      'Revisa los datos del evento.'
    );
  }


  return value.trim();
}


function eventDate(
  value
) {

  if (
    typeof value !==
      'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
      .test(
        value
      ) ||
    !Number.isFinite(
      Date.parse(
        value
      )
    )
  ) {

    fail(
      'invalid-argument',
      'Fecha y hora del evento inválidas.'
    );
  }


  return value;
}


function eventRecordMode(
  value
) {

  const mode =
    value ||
    'production';


  if (
    ![
      'production',
      'test'
    ].includes(
      mode
    )
  ) {

    fail(
      'invalid-argument',
      'El modo del evento no es válido.'
    );
  }


  return mode;
}


function confirmationLeadMinutes(
  value
) {

  const minutes =
    Number(
      value
    );


  if (
    !Number.isInteger(
      minutes
    ) ||
    minutes < 0 ||
    minutes >
      10080
  ) {

    fail(
      'invalid-argument',
      'Cierre de confirmaciones inválido.'
    );
  }


  return minutes;
}


// ======================================================
// POLÍTICA OPERACIONAL
// ======================================================

function expectedGeneralEventScopeForRole(
  role
) {

  if (role === 'lider_principal') {
    return 'campaign';
  }

  if (role === 'coordinador_municipal') {
    return 'municipality';
  }

  if (role === 'jefe_estructura') {
    return 'structure';
  }

  return '';
}


function canCreateGeneralOrganizationalEvent(
  profile
) {

  if (
    !profile ||
    profile.active !== true ||
    typeof profile.uid !== 'string' ||
    !profile.uid.trim() ||
    typeof profile.campaignId !== 'string' ||
    !profile.campaignId.trim()
  ) {
    return false;
  }

  const scopeType =
    expectedGeneralEventScopeForRole(
      profile.role
    );

  if (!scopeType) {
    return false;
  }

  if (scopeType === 'municipality') {
    return Boolean(
      typeof profile.municipalityId === 'string' &&
      profile.municipalityId.trim()
    );
  }

  if (scopeType === 'structure') {
    return Boolean(
      typeof profile.municipalityId === 'string' &&
      profile.municipalityId.trim() &&
      typeof profile.structureId === 'string' &&
      profile.structureId.trim()
    );
  }

  return true;
}


function canCreateGeneralMunicipalEvent(
  profile
) {

  return Boolean(
    profile &&
    profile.role === 'coordinador_municipal' &&
    canCreateGeneralOrganizationalEvent(profile)
  );
}


function buildGeneralOrganizationalScopeDescriptor(
  profile
) {

  if (!canCreateGeneralOrganizationalEvent(profile)) {
    return null;
  }

  const scopeType =
    expectedGeneralEventScopeForRole(
      profile.role
    );

  if (scopeType === 'campaign') {
    return {
      scopeType: 'campaign'
    };
  }

  if (scopeType === 'municipality') {
    return {
      scopeType: 'municipality',
      municipalityId: profile.municipalityId,
      municipalityName:
        profile.municipalityName || ''
    };
  }

  return {
    scopeType: 'structure',
    municipalityId: profile.municipalityId,
    municipalityName:
      profile.municipalityName || '',
    structureId: profile.structureId,
    structureName:
      profile.structureName || ''
  };
}


// ======================================================
// CONSTRUCCIÓN DEL EVENTO
// ======================================================

function archiveScopeAuditFields(
  profile
) {

  const municipalityId =
    typeof profile?.municipalityId ===
      'string'
      ? profile.municipalityId.trim()
      : '';

  const structureId =
    typeof profile?.structureId ===
      'string'
      ? profile.structureId.trim()
      : '';


  return {
    ...(
      municipalityId
        ? {
            municipalityId
          }
        : {}
    ),

    ...(
      structureId
        ? {
            structureId
          }
        : {}
    )
  };
}

function canManageEventArchive(
  profile,
  event
) {

  const scope =
    buildGeneralOrganizationalScopeDescriptor(
      profile
    );

  if (
    !scope ||
    !event ||
    event.campaignId !==
      profile.campaignId ||
    event.scopeType !==
      scope.scopeType ||
    event.operationalOwnerId !==
      profile.uid
  ) {
    return false;
  }

  if (
    scope.municipalityId &&
    event.scopeMunicipalityId !==
      scope.municipalityId
  ) {
    return false;
  }

  if (
    scope.structureId &&
    event.scopeStructureId !==
      scope.structureId
  ) {
    return false;
  }

  return true;
}


// ======================================================
// CONSTRUCCIÓN DEL EVENTO
// ======================================================

function buildGeneralOrganizationalEvent({
  profile,
  eventId,
  title,
  description,
  venue,
  locality,
  startsAt,
  endsAt,
  recordMode =
    'production',
  confirmationLeadMinutes:
    leadMinutes,
  activityCode =
    '',
  activityCatalogVersion =
    ''
}) {

  const startsAtMillis =
    Date.parse(
      startsAt
    );

  const endsAtMillis =
    endsAt
      ? Date.parse(
          endsAt
        )
      : null;

  const confirmationClosesAtMillis =
    startsAtMillis -
    leadMinutes *
    60 *
    1000;


  const scope =
    buildGeneralOrganizationalScopeDescriptor(
      profile
    );

  if (!scope) {
    throw new Error(
      'Perfil no autorizado para crear evento general.'
    );
  }

  return {
    id:
      eventId,

    campaignId:
      profile.campaignId,

    title,

    description,

    venue,

    locality,

    recordMode,

    ...(activityCode
      ? {
          activityCode,
          activityCatalogVersion
        }
      : {}),

    startsAt,

    startsAtMillis,

    endsAt:
      endsAt || '',

    endsAtMillis,

    confirmationLeadMinutes:
      leadMinutes,

    confirmationClosesAtMillis,

    confirmationClosesAt:
      new Date(
        confirmationClosesAtMillis
      ).toISOString(),

    attendanceRequired:
      true,

    active:
      true,

    archived:
      false,

    archivedAt:
      null,

    archivedBy:
      '',

    archivedByName:
      '',

    // ================================================
    // ALCANCE ORGANIZACIONAL
    // ================================================

    scopeMode:
      'organizational',

    scopeType:
      scope.scopeType,

    ...(
      scope.municipalityId
        ? {
            scopeMunicipalityId:
              scope.municipalityId,
            scopeMunicipalityName:
              scope.municipalityName || ''
          }
        : {}
    ),

    ...(
      scope.structureId
        ? {
            scopeStructureId:
              scope.structureId,
            scopeStructureName:
              scope.structureName || ''
          }
        : {}
    ),

    // ================================================
    // RESPONSABILIDAD OPERACIONAL
    // ================================================

    operationalOwnerId:
      profile.uid,

    operationalOwnerName:
      profile.name ||
      'Sin nombre',

    createdBy:
      profile.uid,

    createdByName:
      profile.name ||
      'Sin nombre',

    createdByRole:
      profile.role,

    transportManagerIds: [
      profile.uid
    ],

    version:
      1
  };
}


function buildGeneralMunicipalEvent(
  args
) {

  return buildGeneralOrganizationalEvent(
    args
  );
}


// ======================================================
// CALLER
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


  const profile = {
    ...snapshot.data(),
    uid:
      snapshot.id
  };


  if (
    !canCreateGeneralOrganizationalEvent(
      profile
    )
  ) {

    fail(
      'permission-denied',
      'Tu nivel no puede crear eventos generales o tu alcance organizacional está incompleto.'
    );
  }


  return profile;
}


// ======================================================
// CREATE GENERAL EVENT
// ======================================================

exports.createGeneralEvent =
  onCall(
    OPTIONS,

    async request => {

      const input =
        request.data ||
        {};


      const requestId =
        validId(
          input.requestId,
          'Operación'
        );


      const title =
        text(
          input.title,
          150,
          true
        );


      const description =
        text(
          input.description,
          1500
        );


      const venue =
        text(
          input.venue,
          200,
          true
        );


      const locality =
        text(
          input.locality,
          120
        );


      const recordMode =
        eventRecordMode(
          input.recordMode
        );

      const activityClassification =
        classifyEventAttendanceActivity(
          'EVENT_GENERAL_ATTENDANCE'
        );
      const startsAt =
        eventDate(
          input.startsAt
        );


      const endsAt =
        input.endsAt
          ? eventDate(
              input.endsAt
            )
          : '';


      if (
        endsAt &&
        Date.parse(endsAt) <=
        Date.parse(startsAt)
      ) {

        fail(
          'invalid-argument',
          'La hora de término debe ser posterior a la hora de inicio.'
        );
      }


      const leadMinutes =
        confirmationLeadMinutes(
          input.confirmationLeadMinutes ??
          60
        );


      const db =
        getFirestore();


      const profile =
        await loadCaller(
          db,
          request
        );


      const scope =
        buildGeneralOrganizationalScopeDescriptor(
          profile
        );


      if (!scope) {
        fail(
          'permission-denied',
          'No se pudo determinar el alcance organizacional del evento.'
        );
      }


      const eventId =
        hash(
          profile.uid,
          requestId,
          'general-event'
        );


      const fingerprint =
        hash(
          profile.uid,
          profile.campaignId,
          scope.scopeType,
          scope.municipalityId || '',
          scope.structureId || '',
          title,
          description,
          venue,
          locality,
          recordMode,
          startsAt,
          endsAt,
          leadMinutes,
          ...(
            activityClassification
              ? [
                  activityClassification.activityCode,
                  activityClassification.activityCatalogVersion
                ]
              : []
          )
        );


      const eventRecord =
        buildGeneralOrganizationalEvent({
          profile,
          eventId,
          title,
          description,
          venue,
          locality,
          startsAt,
          endsAt,
          recordMode,
          confirmationLeadMinutes:
            leadMinutes,
          activityCode:
            activityClassification
              ?.activityCode ||
            '',
          activityCatalogVersion:
            activityClassification
              ?.activityCatalogVersion ||
            ''
        });


      return db.runTransaction(
        async tx => {

          const receiptRef =
            db.collection(
              'eventGeneralDispatches'
            )
              .doc(
                hash(
                  profile.uid,
                  requestId
                )
              );


          const receiptSnapshot =
            await tx.get(
              receiptRef
            );


          if (
            receiptSnapshot.exists
          ) {

            const saved =
              receiptSnapshot.data();


            if (
              saved.fingerprint !==
                fingerprint ||
              saved.campaignId !==
                profile.campaignId
            ) {

              fail(
                'already-exists',
                'Este intento ya se utilizó con otros datos.'
              );
            }


            return saved.result;
          }


      const startsAtMillis =
        Date.parse(
          startsAt
        );


      if (
        startsAtMillis <=
        Date.now()
      ) {

        fail(
          'invalid-argument',
          'La fecha del evento debe ser futura.'
        );
      }


      const confirmationClosesAtMillis =
        startsAtMillis -
        leadMinutes *
        60 *
        1000;


      if (
        confirmationClosesAtMillis <=
        Date.now()
      ) {

        fail(
          'invalid-argument',
          'La hora límite de confirmaciones ya pasó. Programa el evento con mayor anticipación o selecciona otro cierre.'
        );
      }


          if (!activityClassification) {

            fail(
              'invalid-argument',
              'Selecciona el tipo de actividad del evento.'
            );
          }


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


          const existingEvent =
            await tx.get(
              eventRef
            );


          if (
            existingEvent.exists
          ) {

            fail(
              'already-exists',
              'El evento ya existe.'
            );
          }


          tx.create(
            eventRef,
            {
              ...eventRecord,

              createdAt:
                FieldValue
                  .serverTimestamp(),

              updatedAt:
                FieldValue
                  .serverTimestamp()
            }
          );


          tx.create(
            scopeRef,
            {
              id:
                eventId,

              eventId,

              campaignId:
                profile.campaignId,

              active:
                true,

              scopeMode:
                'organizational',

              scopeType:
                scope.scopeType,

              ...(
                scope.municipalityId
                  ? {
                      municipalityId:
                        scope.municipalityId,
                      municipalityName:
                        scope.municipalityName || ''
                    }
                  : {}
              ),

              ...(
                scope.structureId
                  ? {
                      structureId:
                        scope.structureId,
                      structureName:
                        scope.structureName || ''
                    }
                  : {}
              ),

              createdBy:
                profile.uid,

              createdByRole:
                profile.role,

              createdAt:
                FieldValue
                  .serverTimestamp(),

              updatedAt:
                FieldValue
                  .serverTimestamp(),

              version:
                1
            }
          );


          const result = {
            success:
              true,

            eventId,

            scopeMode:
              'organizational',

            scopeType:
              scope.scopeType,

            ...(
              scope.municipalityId
                ? {
                    municipalityId:
                      scope.municipalityId,
                    municipalityName:
                      scope.municipalityName || ''
                  }
                : {}
            ),

            ...(
              scope.structureId
                ? {
                    structureId:
                      scope.structureId,
                    structureName:
                      scope.structureName || ''
                  }
                : {}
            )
          };


          tx.create(
            receiptRef,
            {
              id:
                receiptRef.id,

              campaignId:
                profile.campaignId,

              actorUid:
                profile.uid,

              eventId,

              fingerprint,

              result,

              createdAt:
                FieldValue
                  .serverTimestamp()
            }
          );


          const auditRef =
            db.collection(
              'logs'
            )
              .doc();


          tx.create(
            auditRef,
            {
              action:
                'CREATE_GENERAL_EVENT',

              campaignId:
                profile.campaignId,

              ...(
                scope.municipalityId
                  ? {
                      municipalityId:
                        scope.municipalityId
                    }
                  : {}
              ),

              ...(
                scope.structureId
                  ? {
                      structureId:
                        scope.structureId
                    }
                  : {}
              ),

              eventId,

              actorUid:
                profile.uid,

              actorRole:
                profile.role,

              scopeType:
                scope.scopeType,

              createdAt:
                FieldValue
                  .serverTimestamp()
            }
          );


          return result;
        }
      );
    }
  );


// ======================================================
// BUILD-118D1F2
// ARCHIVAR / RESTAURAR EVENTO
// ======================================================

exports.setEventArchived =
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


      if (
        typeof input.archived !==
          'boolean'
      ) {

        fail(
          'invalid-argument',
          'El estado de archivo no es válido.'
        );
      }


      const archived =
        input.archived;


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


      return db.runTransaction(
        async tx => {

          const eventSnapshot =
            await tx.get(
              eventRef
            );


          if (
            !eventSnapshot.exists
          ) {

            fail(
              'not-found',
              'El evento no existe.'
            );
          }


          const event =
            eventSnapshot.data();


          if (
            !canManageEventArchive(
              profile,
              event
            )
          ) {

            fail(
              'permission-denied',
              'No tienes autorización para archivar o restaurar este evento.'
            );
          }


          const currentArchived =
            event.archived ===
              true;


          if (
            currentArchived ===
              archived
          ) {

            return {
              eventId,
              archived,
              changed:
                false
            };
          }


          const update = archived
            ? {
                archived:
                  true,

                archivedAt:
                  FieldValue
                    .serverTimestamp(),

                archivedBy:
                  profile.uid,

                archivedByName:
                  profile.name ||
                  'Sin nombre'
              }
            : {
                archived:
                  false,

                archivedAt:
                  null,

                archivedBy:
                  '',

                archivedByName:
                  ''
              };


          tx.update(
            eventRef,
            update
          );


          const auditRef =
            db.collection(
              'logs'
            )
              .doc();


          tx.create(
            auditRef,
            {
              action:
                archived
                  ? 'ARCHIVE_EVENT'
                  : 'RESTORE_EVENT',

              campaignId:
                profile.campaignId,

              ...archiveScopeAuditFields(
                profile
              ),

              eventId,

              actorUid:
                profile.uid,

              actorRole:
                profile.role,

              archived,

              createdAt:
                FieldValue
                  .serverTimestamp()
            }
          );


          return {
            eventId,
            archived,
            changed:
              true
          };
        }
      );
    }
  );


// ======================================================
// TEST HELPERS
// ======================================================

exports._test = {
  archiveScopeAuditFields,
  expectedGeneralEventScopeForRole,
  canCreateGeneralOrganizationalEvent,
  canCreateGeneralMunicipalEvent,
  buildGeneralOrganizationalScopeDescriptor,
  canManageEventArchive,
  buildGeneralOrganizationalEvent,
  buildGeneralMunicipalEvent,
  eventRecordMode
};
