'use strict';

// ======================================================
// TERRA CAMPAIGN
// BUILD-118C-3B3E-3G-A
// NECESIDAD DE TRANSPORTE PARA EVENTOS
// ======================================================

const {
  onCall,
  HttpsError
} =
  require(
    'firebase-functions/v2/https'
  );


const {
  getFirestore,
  FieldValue
} =
  require(
    'firebase-admin/firestore'
  );


const {
  createHash
} =
  require('node:crypto');


const OPTIONS = {
  region: 'us-central1',
  timeoutSeconds: 60
};


const ALLOWED_ROLES =
  new Set([
    'admin',
    'lider_principal',
    'coordinador_municipal',
    'jefe_estructura',
    'integrante',
    'participante',
    'colaborador_base'
  ]);


// ======================================================
// ERRORES
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


// ======================================================
// VALIDACIONES
// ======================================================

function validId(value) {

  if (
    typeof value !== 'string' ||
    !value.length ||
    value.length > 128 ||
    value.includes('/')
  ) {

    fail(
      'invalid-argument',
      'Identificador inválido.'
    );
  }


  return value;
}


function booleanValue(value) {

  if (
    typeof value !== 'boolean'
  ) {

    fail(
      'invalid-argument',
      'La necesidad de transporte debe ser Sí o No.'
    );
  }


  return value;
}


// ======================================================
// IDENTIFICADOR ESTABLE
//
// Una persona tiene una sola respuesta de transporte
// por evento, aunque existieran varias rutas jerárquicas.
// ======================================================

function transportRequestId(
  eventId,
  personId
) {

  return createHash('sha256')
    .update(
      JSON.stringify([
        eventId,
        personId
      ])
    )
    .digest('hex');
}


// ======================================================
// AUTORIZACION DE AUTOGESTION
// ======================================================

function canSelfManageTransport(
  profile,
  invitation,
  event,
  response
) {

  if (
    !profile ||
    !invitation ||
    !event
  ) {
    return false;
  }


  if (
    profile.active !== true ||
    invitation.active !== true ||
    event.active !== true
  ) {
    return false;
  }


  if (
    invitation.assignedTo !==
      profile.uid
  ) {
    return false;
  }


  if (
    invitation.campaignId !==
      profile.campaignId ||
    event.campaignId !==
      profile.campaignId
  ) {
    return false;
  }


  if (
    invitation.eventId !==
      event.id
  ) {
    return false;
  }


  return (
    response?.status ===
    'attending'
  );
}


// ======================================================
// PERFIL DEL USUARIO
// ======================================================

async function caller(
  tx,
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
    await tx.get(
      db.collection('usuarios')
        .doc(request.auth.uid)
    );


  const profile =
    snapshot.data();


  if (
    !profile ||
    profile.active !== true ||
    !profile.campaignId ||
    !ALLOWED_ROLES.has(
      profile.role
    )
  ) {

    fail(
      'permission-denied',
      'Perfil no autorizado.'
    );
  }


  return {
    ...profile,
    uid: snapshot.id
  };
}


// ======================================================
// PERSONA CANONICA
//
// La identidad operativa es PERSONA.
// accountUid solamente representa la cuenta digital.
// ======================================================

function canonicalPersonMatchesProfile(
  person,
  profile
) {

  return !!(
    person &&
    profile &&
    person.campaignId ===
      profile.campaignId &&
    person.accountUid ===
      profile.uid
  );
}


async function resolveCanonicalPersonId(
  tx,
  db,
  profile,
  invitation
) {

  if (
    typeof invitation.personId ===
      'string' &&
    invitation.personId.trim()
  ) {

    const personId =
      validId(
        invitation.personId.trim()
      );


    const personSnapshot =
      await tx.get(
        db.collection('persons')
          .doc(personId)
      );


    if (
      !personSnapshot.exists ||
      !canonicalPersonMatchesProfile(
        personSnapshot.data(),
        profile
      )
    ) {

      fail(
        'permission-denied',
        'La identidad canónica de la invitación no corresponde a esta cuenta.'
      );
    }


    return personId;
  }


  const snapshot =
    await tx.get(
      db.collection('persons')
        .where(
          'accountUid',
          '==',
          profile.uid
        )
        .limit(3)
    );


  const matches =
    snapshot.docs.filter(
      documentSnapshot => {

        const data =
          documentSnapshot.data();

        return canonicalPersonMatchesProfile(
          data,
          profile
        );
      }
    );


  if (matches.length !== 1) {

    fail(
      'failed-precondition',
      'No fue posible resolver una identidad canónica única para este usuario.'
    );
  }


  return matches[0].id;
}


// ======================================================
// VISTA SEGURA
// ======================================================

function transportRequestView(
  snapshot
) {

  if (
    !snapshot ||
    !snapshot.exists
  ) {
    return null;
  }


  const d =
    snapshot.data();


  return {
    id:
      snapshot.id,

    eventId:
      d.eventId || '',

    invitationId:
      d.invitationId || '',

    personId:
      d.personId || '',

    accountUid:
      d.accountUid || null,

    needsTransport:
      d.needsTransport === true,

    recordedByUserId:
      d.recordedByUserId || '',

    recordedByRole:
      d.recordedByRole || '',

    recordedMode:
      d.recordedMode || '',

    version:
      Number(d.version) || 1
  };
}


// ======================================================
// CARGAR CONTEXTO COMUN
// ======================================================

async function readContext(
  tx,
  db,
  request,
  invitationId
) {

  const profile =
    await caller(
      tx,
      db,
      request
    );


  const invitationRef =
    db.collection(
      'eventInvitations'
    ).doc(
      invitationId
    );


  const invitationSnapshot =
    await tx.get(
      invitationRef
    );


  if (
    !invitationSnapshot.exists
  ) {

    fail(
      'not-found',
      'La invitación no existe.'
    );
  }


  const invitation = {
    ...invitationSnapshot.data(),
    id:
      invitationSnapshot.id
  };


  if (
    invitation.assignedTo !==
      profile.uid
  ) {

    fail(
      'permission-denied',
      'Solo puedes gestionar el transporte de tu propia invitación.'
    );
  }


  if (
    invitation.campaignId !==
      profile.campaignId
  ) {

    fail(
      'permission-denied',
      'La invitación pertenece a otra campaña.'
    );
  }


  const eventRef =
    db.collection('events')
      .doc(
        validId(
          invitation.eventId
        )
      );


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


  const event = {
    ...eventSnapshot.data(),
    id:
      eventSnapshot.id
  };


  if (
    event.campaignId !==
      profile.campaignId
  ) {

    fail(
      'permission-denied',
      'El evento pertenece a otra campaña.'
    );
  }


  const responseSnapshot =
    await tx.get(
      db.collection(
        'eventResponses'
      ).doc(
        invitationId
      )
    );


  const response =
    responseSnapshot.exists
      ? responseSnapshot.data()
      : null;


  const personId =
    await resolveCanonicalPersonId(
      tx,
      db,
      profile,
      invitation
    );


  const requestId =
    transportRequestId(
      event.id,
      personId
    );


  const transportRef =
    db.collection(
      'eventTransportRequests'
    ).doc(
      requestId
    );


  const transportSnapshot =
    await tx.get(
      transportRef
    );


  return {
    profile,
    invitation,
    event,
    response,
    personId,
    requestId,
    transportRef,
    transportSnapshot
  };
}


// ======================================================
// CONSULTAR MI NECESIDAD DE TRANSPORTE
// ======================================================

exports.getMyEventTransportNeed =
  onCall(
    OPTIONS,

    async request => {

      const invitationId =
        validId(
          request.data
            ?.invitationId
        );


      const db =
        getFirestore();


      return db.runTransaction(
        async tx => {

          const context =
            await readContext(
              tx,
              db,
              request,
              invitationId
            );


          const eligible =
            canSelfManageTransport(
              context.profile,
              context.invitation,
              context.event,
              context.response
            );


          return {
            invitationId,

            event: {
              id:
                context.event.id,

              title:
                context.event.title ||
                '',

              venue:
                context.event.venue ||
                '',

              locality:
                context.event.locality ||
                '',

              startsAt:
                context.event.startsAt ||
                ''
            },

            personId:
              context.personId,

            accountUid:
              context.profile.uid,

            eventResponseStatus:
              context.response?.status ||
              'pending',

            eligible,

            request:
              transportRequestView(
                context.transportSnapshot
              )
          };
        }
      );
    }
  );


// ======================================================
// REGISTRAR MI NECESIDAD DE TRANSPORTE
// ======================================================

exports.setMyEventTransportNeed =
  onCall(
    OPTIONS,

    async request => {

      const invitationId =
        validId(
          request.data
            ?.invitationId
        );


      const needsTransport =
        booleanValue(
          request.data
            ?.needsTransport
        );


      const db =
        getFirestore();


      return db.runTransaction(
        async tx => {

          const context =
            await readContext(
              tx,
              db,
              request,
              invitationId
            );


          if (
            !canSelfManageTransport(
              context.profile,
              context.invitation,
              context.event,
              context.response
            )
          ) {

            fail(
              'failed-precondition',
              'Primero debes confirmar que asistirás al evento para indicar si necesitas transporte.'
            );
          }


          const previous =
            context.transportSnapshot
              .exists
              ? context.transportSnapshot
                  .data()
              : null;


          const serverNow =
            FieldValue
              .serverTimestamp();


          const data = {
            id:
              context.requestId,

            campaignId:
              context.profile
                .campaignId,

            eventId:
              context.event.id,

            invitationId:
              context.invitation.id,

            personId:
              context.personId,

            accountUid:
              context.profile.uid,

            needsTransport,

            recordedByUserId:
              context.profile.uid,

            recordedByRole:
              context.profile.role,

            recordedForPersonId:
              context.personId,

            recordedMode:
              'self_service',

            source:
              'event_invitation',

            version:
              1,

            updatedAt:
              serverNow
          };


          if (!previous) {
            data.createdAt =
              serverNow;
          }


          tx.set(
            context.transportRef,
            data,
            {
              merge: true
            }
          );


          const logRef =
            db.collection('logs')
              .doc();


          tx.create(
            logRef,
            {
              action:
                'EVENT_TRANSPORT_NEED_SET',

              campaignId:
                context.profile
                  .campaignId,

              eventId:
                context.event.id,

              invitationId:
                context.invitation.id,

              personId:
                context.personId,

              accountUid:
                context.profile.uid,

              actorUid:
                context.profile.uid,

              actorRole:
                context.profile.role,

              previousNeedsTransport:
                previous
                  ? previous
                      .needsTransport ===
                    true
                  : null,

              needsTransport,

              createdAt:
                serverNow,

              version:
                1
            }
          );


          return {
            success: true,

            request: {
              id:
                context.requestId,

              eventId:
                context.event.id,

              invitationId:
                context.invitation.id,

              personId:
                context.personId,

              accountUid:
                context.profile.uid,

              needsTransport,

              recordedByUserId:
                context.profile.uid,

              recordedByRole:
                context.profile.role,

              recordedMode:
                'self_service',

              version:
                1
            }
          };
        }
      );
    }
  );


// ======================================================
// HELPERS DE PRUEBA
// ======================================================

exports._test = {
  ALLOWED_ROLES,
  transportRequestId,
  canSelfManageTransport,
  canonicalPersonMatchesProfile
};
