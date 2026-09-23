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

function canCreateGeneralMunicipalEvent(
  profile
) {

  return Boolean(
    profile &&
    profile.active ===
      true &&
    profile.role ===
      'coordinador_municipal' &&
    typeof profile.uid ===
      'string' &&
    profile.uid &&
    typeof profile.campaignId ===
      'string' &&
    profile.campaignId &&
    typeof profile.municipalityId ===
      'string' &&
    profile.municipalityId
  );
}


// ======================================================
// CONSTRUCCIÓN DEL EVENTO
// ======================================================

function canManageEventArchive(
  profile,
  event
) {

  return Boolean(
    canCreateGeneralMunicipalEvent(
      profile
    ) &&
    event &&
    event.campaignId ===
      profile.campaignId &&
    event.scopeType ===
      'municipality' &&
    event.scopeMunicipalityId ===
      profile.municipalityId &&
    event.operationalOwnerId ===
      profile.uid
  );
}


// ======================================================
// CONSTRUCCIÓN DEL EVENTO
// ======================================================

function buildGeneralMunicipalEvent({
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
      'municipality',

    scopeMunicipalityId:
      profile.municipalityId,

    scopeMunicipalityName:
      profile.municipalityName ||
      '',

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
    !canCreateGeneralMunicipalEvent(
      profile
    )
  ) {

    fail(
      'permission-denied',
      'Solo el Responsable de Organización puede crear un evento general dentro de su municipio.'
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

      let activityClassification =
        null;

      try {
        activityClassification =
          classifyEventAttendanceActivity(
            input.activityCode
          );
      } catch {
        fail(
          'invalid-argument',
          'El tipo de actividad no es v?lido para este evento.'
        );
      }


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
          profile.municipalityId,
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
        buildGeneralMunicipalEvent({
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
                'municipality',

              municipalityId:
                profile.municipalityId,

              municipalityName:
                profile.municipalityName ||
                '',

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
              'municipality',

            municipalityId:
              profile.municipalityId,

            municipalityName:
              profile.municipalityName ||
              ''
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

              municipalityId:
                profile.municipalityId,

              eventId,

              actorUid:
                profile.uid,

              actorRole:
                profile.role,

              scopeType:
                'municipality',

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

              municipalityId:
                profile.municipalityId,

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
  canCreateGeneralMunicipalEvent,
  canManageEventArchive,
  buildGeneralMunicipalEvent,
  eventRecordMode
};
