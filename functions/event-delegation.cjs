'use strict';

// ======================================================
// TERRA CAMPAIGN
// BUILD-118A-1
// EVENTOS OPERATIVOS E INVITACIONES JERÁRQUICAS
// ======================================================

const {
  onCall,
  HttpsError
} = require('firebase-functions/v2/https');

const {
  getFirestore,
  FieldValue
} = require('firebase-admin/firestore');

const {
  createHash
} = require('node:crypto');


const OPTIONS = {
  region: 'us-central1',
  timeoutSeconds: 60
};


const NEXT = {
  lider_principal: 'coordinador_municipal',
  admin: 'coordinador_municipal',
  coordinador_municipal: 'jefe_estructura',
  jefe_estructura: 'integrante',
  integrante: 'participante',
  participante: 'colaborador_base'
};


const EVENT_RESPONSE_STATUSES =
  new Set([
    'attending',
    'not_attending'
  ]);



const EVENT_CONFIRMATION_LEAD_MINUTES =
  new Set([
    0,
    60,
    120,
    360,
    720,
    1440
  ]);


function confirmationLeadMinutes(value) {

  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    !EVENT_CONFIRMATION_LEAD_MINUTES.has(
      number
    )
  ) {
    fail(
      'invalid-argument',
      'Selecciona un cierre de confirmaciones válido.'
    );
  }

  return number;
}


function eventConfirmationClosesAtMillis(
  event
) {

  if (
    Number.isFinite(
      event?.confirmationClosesAtMillis
    )
  ) {
    return event.confirmationClosesAtMillis;
  }


  const startsAtMillis =
    eventStartsAtMillis(
      event
    );


  if (
    !Number.isFinite(
      startsAtMillis
    )
  ) {
    return NaN;
  }


  const leadMinutes =
    Number.isFinite(
      event?.confirmationLeadMinutes
    )
      ? event.confirmationLeadMinutes
      : 60;


  return (
    startsAtMillis -
    leadMinutes * 60 * 1000
  );
}


function eventResponseStatus(value) {

  if (
    typeof value !== 'string' ||
    !EVENT_RESPONSE_STATUSES.has(value)
  ) {
    fail(
      'invalid-argument',
      'Respuesta de evento inválida.'
    );
  }

  return value;
}


function eventStartsAtMillis(event) {

  if (
    Number.isFinite(
      event?.startsAtMillis
    )
  ) {
    return event.startsAtMillis;
  }

  const parsed =
    Date.parse(
      event?.startsAt || ''
    );

  return Number.isFinite(parsed)
    ? parsed
    : NaN;
}


function canRespondToEventInvitation(
  profile,
  invitation,
  event,
  nowMillis = Date.now()
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

  const confirmationClosesAtMillis =
    eventConfirmationClosesAtMillis(
      event
    );

  return (
    Number.isFinite(
      confirmationClosesAtMillis
    ) &&
    confirmationClosesAtMillis >
      nowMillis
  );
}


function timestampIso(value) {

  if (
    value &&
    typeof value.toDate ===
      'function'
  ) {
    return value
      .toDate()
      .toISOString();
  }

  return null;
}


function eventResponseView(snapshot) {

  if (
    !snapshot ||
    !snapshot.exists
  ) {
    return {
      status: 'pending',
      commitment: false,
      respondedAt: null,
      updatedAt: null
    };
  }

  const d =
    snapshot.data();

  const status =
    EVENT_RESPONSE_STATUSES.has(
      d.status
    )
      ? d.status
      : 'pending';

  return {
    status,

    commitment:
      status === 'attending',

    respondedAt:
      timestampIso(
        d.respondedAt
      ),

    updatedAt:
      timestampIso(
        d.updatedAt
      )
  };
}



function eventIncidentView(snapshot) {

  if (
    !snapshot ||
    !snapshot.exists
  ) {
    return null;
  }


  const d =
    snapshot.data();


  const reason =
    EVENT_INCIDENT_REASONS.has(
      d.reason
    )
      ? d.reason
      : 'other';


  return {
    reported: true,

    reason,

    note:
      typeof d.note === 'string'
        ? d.note
        : '',

    reportedAt:
      timestampIso(
        d.reportedAt
      ),

    originalResponseStatus:
      d.originalResponseStatus ||
      'attending',

    version:
      Number(
        d.version
      ) || 1
  };
}


const EVENT_INCIDENT_REASONS =
  new Set([
    'transport',
    'health',
    'family',
    'work',
    'other'
  ]);


function eventIncidentReason(value) {

  if (
    typeof value !== 'string' ||
    !EVENT_INCIDENT_REASONS.has(
      value
    )
  ) {
    fail(
      'invalid-argument',
      'Selecciona el motivo del imprevisto.'
    );
  }

  return value;
}


function canReportEventIncident(
  profile,
  invitation,
  event,
  response,
  nowMillis = Date.now()
) {

  if (
    !profile ||
    !invitation ||
    !event ||
    !response
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


  if (
    response.status !==
      'attending'
  ) {
    return false;
  }


  const closesAtMillis =
    eventConfirmationClosesAtMillis(
      event
    );


  const startsAtMillis =
    eventStartsAtMillis(
      event
    );


  return (
    Number.isFinite(
      closesAtMillis
    ) &&
    Number.isFinite(
      startsAtMillis
    ) &&
    nowMillis >=
      closesAtMillis &&
    nowMillis <
      startsAtMillis
  );
}


const EVENT_CHECKIN_METHODS =
  new Set([
    'manual',
    'qr',
    'code'
  ]);



// QR y código existen en el modelo,
// pero todavía no pueden declarar asistencia
// hasta tener validación segura propia.
const EVENT_ENABLED_CHECKIN_METHODS =
  new Set([
    'manual'
  ]);


function eventCheckInMethod(value) {

  if (
    typeof value !== 'string' ||
    !EVENT_CHECKIN_METHODS.has(
      value
    )
  ) {
    fail(
      'invalid-argument',
      'Método de registro de asistencia inválido.'
    );
  }

  return value;
}


function eventScopeMemberDocumentId(
  eventId,
  personId
) {

  return hash(
    eventId,
    personId,
    'event-scope-member'
  );
}


function eventAttendanceRequestMode(
  data
) {

  const hasInvitationId =
    typeof data?.invitationId ===
      'string' &&
    Boolean(
      data.invitationId
    );


  const hasEventId =
    typeof data?.eventId ===
      'string' &&
    Boolean(
      data.eventId
    );


  const hasPersonId =
    typeof data?.personId ===
      'string' &&
    Boolean(
      data.personId
    );


  if (
    hasInvitationId &&
    !hasEventId &&
    !hasPersonId
  ) {
    return 'invitation';
  }


  if (
    !hasInvitationId &&
    hasEventId &&
    hasPersonId
  ) {
    return 'event_scope';
  }


  return 'invalid';
}


function eventAttendanceDocumentId(
  eventId,
  personId
) {

  return hash(
    'event-attendance',
    eventId,
    personId
  );
}


function eventAttendanceView(snapshot) {

  if (
    !snapshot ||
    !snapshot.exists
  ) {
    return null;
  }


  const d =
    snapshot.data();


  return {
    attended:
      d.attended === true,

    eventId:
      d.eventId || '',

    personId:
      d.personId || '',

    accountUid:
      d.accountUid || null,

    invitationId:
      d.invitationId || null,

    personName:
      d.personName || '',

    checkInMethod:
      EVENT_CHECKIN_METHODS.has(
        d.checkInMethod
      )
        ? d.checkInMethod
        : 'manual',

    checkedInAt:
      timestampIso(
        d.checkedInAt
      ),

    validatedByUserId:
      d.validatedByUserId || '',

    validatedByName:
      d.validatedByName || '',

    validatedByRole:
      d.validatedByRole || '',

    version:
      Number(
        d.version
      ) || 1
  };
}


const EVENT_ATTENDANCE_EARLY_MINUTES =
  45;


const EVENT_ATTENDANCE_LATE_MINUTES =
  90;


function eventAttendanceWindow(
  event
) {

  const startsAtMillis =
    eventStartsAtMillis(
      event
    );


  if (
    !Number.isFinite(
      startsAtMillis
    )
  ) {
    return null;
  }


  return {

    startsAtMillis,

    opensAtMillis:
      startsAtMillis -
      (
        EVENT_ATTENDANCE_EARLY_MINUTES *
        60 *
        1000
      ),

    closesAtMillis:
      startsAtMillis +
      (
        EVENT_ATTENDANCE_LATE_MINUTES *
        60 *
        1000
      )
  };
}


function canRecordEventAttendanceAt(
  event,
  nowMillis = Date.now()
) {

  if (
    !event ||
    event.active !== true
  ) {
    return false;
  }


  const window =
    eventAttendanceWindow(
      event
    );


  if (!window) {
    return false;
  }


  return (
    nowMillis >=
      window.opensAtMillis &&
    nowMillis <
      window.closesAtMillis
  );
}


function canValidateEventAttendance(
  validator,
  invitation,
  event
) {

  if (
    !validator ||
    !invitation ||
    !event
  ) {
    return false;
  }


  if (
    validator.active !== true ||
    invitation.active !== true ||
    event.active !== true
  ) {
    return false;
  }


  if (
    invitation.campaignId !==
      validator.campaignId ||
    event.campaignId !==
      validator.campaignId
  ) {
    return false;
  }


  if (
    invitation.eventId !==
      event.id
  ) {
    return false;
  }


  // En 118C-1 el validador puede ser:
  // 1) quien creó directamente la invitación, o
  // 2) quien creó el evento maestro.
  // BUILD-118C posterior incorporará validadores designados.
  return (
    invitation.createdBy ===
      validator.uid ||
    event.createdBy ===
      validator.uid
  );
}


function fail(code, message) {
  throw new HttpsError(code, message);
}


function hash(...parts) {
  return createHash('sha256')
    .update(JSON.stringify(parts))
    .digest('hex');
}


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


function text(value, max, required = false) {

  if (value == null && !required) {
    return '';
  }

  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  ) {
    fail(
      'invalid-argument',
      'Revisa los datos del evento.'
    );
  }

  return value.trim();
}


function eventDate(value) {

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    fail(
      'invalid-argument',
      'Fecha y hora del evento inválidas.'
    );
  }

  return new Date(value).toISOString();
}


async function caller(tx, db, request) {

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
    ![
      ...Object.keys(NEXT),
      'colaborador_base'
    ].includes(profile.role)
  ) {
    fail(
      'permission-denied',
      'Perfil no autorizado.'
    );
  }


  if (
    profile.role ===
    'lider_principal'
  ) {

    const lock =
      await tx.get(
        db.collection('principalLeaders')
          .doc(profile.campaignId)
      );

    if (
      lock.data()?.uid !== snapshot.id
    ) {
      fail(
        'permission-denied',
        'Líder no registrado para esta campaña.'
      );
    }
  }


  return {
    ...profile,
    uid: snapshot.id
  };
}


// ======================================================
// BUILD-118C-3B3E-3G-B3D1
// IDENTIDAD CANONICA EN EVENTOS
//
// PERSONA:
//   personId = identidad primaria permanente.
//
// CUENTA:
//   accountUid = Firebase Auth UID.
//
// assignedTo se conserva por compatibilidad del dominio
// actual de invitaciones, pero NO sustituye personId.
// ======================================================

async function resolveDigitalCanonicalIdentity(
  tx,
  db,
  {
    accountUid,
    profile,
    campaignId
  }
) {

  const uid =
    validId(
      accountUid
    );


  if (
    !profile ||
    profile.active !== true ||
    profile.campaignId !==
      campaignId
  ) {

    fail(
      'failed-precondition',
      'La cuenta no tiene una identidad territorial activa válida.'
    );
  }


  const profilePersonId =
    typeof profile.personId ===
      'string'
      ? profile.personId.trim()
      : '';


  let personSnapshot;


  // ------------------------------------------------------
  // MODELO CANONICO ACTUAL
  // usuarios/{uid}.personId
  // ------------------------------------------------------

  if (profilePersonId) {

    personSnapshot =
      await tx.get(
        db.collection(
          'persons'
        ).doc(
          validId(
            profilePersonId
          )
        )
      );

  } else {

    // ----------------------------------------------------
    // COMPATIBILIDAD CON CUENTAS DIGITALES ANTERIORES
    //
    // Si usuarios todavía no tiene personId, buscamos la
    // persona por accountUid. Debe existir exactamente una
    // persona activa dentro de la misma campaña.
    // ----------------------------------------------------

    const personsSnapshot =
      await tx.get(
        db.collection(
          'persons'
        )
          .where(
            'accountUid',
            '==',
            uid
          )
          .limit(
            3
          )
      );


    const matches =
      personsSnapshot.docs
        .filter(
          snapshot => {

            const person =
              snapshot.data();

            return (
              person.active ===
                true &&
              person.campaignId ===
                campaignId
            );
          }
        );


    if (
      matches.length !==
        1
    ) {

      fail(
        'failed-precondition',
        'No fue posible resolver de forma única la persona canónica de esta cuenta.'
      );
    }


    personSnapshot =
      matches[0];
  }


  if (
    !personSnapshot ||
    !personSnapshot.exists
  ) {

    fail(
      'failed-precondition',
      'La persona canónica vinculada a la cuenta no existe.'
    );
  }


  const person = {
    ...personSnapshot.data(),

    id:
      personSnapshot.id
  };


  const storedPersonId =
    typeof person.personId ===
      'string' &&
    person.personId.trim()
      ? person.personId.trim()
      : personSnapshot.id;


  const personId =
    validId(
      storedPersonId
    );


  const personAccountUid =
    typeof person.accountUid ===
      'string'
      ? person.accountUid.trim()
      : '';


  if (
    personSnapshot.id !==
      personId ||
    person.active !==
      true ||
    person.campaignId !==
      campaignId ||
    personAccountUid !==
      uid ||
    (
      profilePersonId &&
      profilePersonId !==
        personId
    )
  ) {

    fail(
      'failed-precondition',
      'La cuenta y la persona canónica tienen datos de identidad inconsistentes.'
    );
  }


  return {

    personId,

    accountUid:
      uid,

    person
  };
}


// ======================================================
// RESOLVER IDENTIDAD DE UNA INVITACION
//
// Soporta:
// 1) invitación nueva con personId;
// 2) invitación digital anterior con solo assignedTo;
// 3) futura invitación accountless con personId.
// ======================================================

async function resolveInvitationCanonicalIdentity(
  tx,
  db,
  invitation,
  campaignId
) {

  if (!invitation) {

    fail(
      'failed-precondition',
      'La invitación no tiene identidad válida.'
    );
  }


  const storedPersonId =
    typeof invitation.personId ===
      'string'
      ? invitation.personId.trim()
      : '';


  const storedAccountUid =
    typeof invitation.accountUid ===
      'string' &&
    invitation.accountUid.trim()
      ? invitation.accountUid.trim()
      : (
          typeof invitation.assignedTo ===
            'string' &&
          invitation.assignedTo.trim()
            ? invitation.assignedTo.trim()
            : ''
        );


  // ------------------------------------------------------
  // INVITACION CANONICA / ACCOUNTLESS
  // ------------------------------------------------------

  if (storedPersonId) {

    const personSnapshot =
      await tx.get(
        db.collection(
          'persons'
        ).doc(
          validId(
            storedPersonId
          )
        )
      );


    if (
      !personSnapshot.exists
    ) {

      fail(
        'failed-precondition',
        'La persona canónica de la invitación no existe.'
      );
    }


    const person = {
      ...personSnapshot.data(),

      id:
        personSnapshot.id
    };


    const canonicalPersonId =
      validId(
        typeof person.personId ===
          'string' &&
        person.personId.trim()
          ? person.personId.trim()
          : personSnapshot.id
      );


    const personAccountUid =
      typeof person.accountUid ===
        'string' &&
      person.accountUid.trim()
        ? person.accountUid.trim()
        : null;


    if (
      personSnapshot.id !==
        canonicalPersonId ||
      canonicalPersonId !==
        validId(
          storedPersonId
        ) ||
      person.active !==
        true ||
      person.campaignId !==
        campaignId ||
      (
        storedAccountUid &&
        personAccountUid !==
          storedAccountUid
      )
    ) {

      fail(
        'failed-precondition',
        'La identidad canónica almacenada en la invitación es inconsistente.'
      );
    }


    return {

      personId:
        canonicalPersonId,

      accountUid:
        storedAccountUid ||
        personAccountUid ||
        null,

      person
    };
  }


  // ------------------------------------------------------
  // INVITACION DIGITAL LEGADA
  // assignedTo = Firebase UID
  // ------------------------------------------------------

  if (!storedAccountUid) {

    fail(
      'failed-precondition',
      'La invitación no permite resolver una persona canónica.'
    );
  }


  const userSnapshot =
    await tx.get(
      db.collection(
        'usuarios'
      ).doc(
        validId(
          storedAccountUid
        )
      )
    );


  if (
    !userSnapshot.exists
  ) {

    fail(
      'failed-precondition',
      'La cuenta asociada a la invitación ya no existe.'
    );
  }


  return resolveDigitalCanonicalIdentity(
    tx,
    db,
    {

      accountUid:
        storedAccountUid,

      profile:
        userSnapshot.data(),

      campaignId
    }
  );
}


function targetAllowed(parent, target) {

  if (
    !target ||
    target.active !== true ||
    target.campaignId !== parent.campaignId ||
    target.role !== NEXT[parent.role]
  ) {
    return false;
  }


  if (
    !['admin', 'lider_principal']
      .includes(parent.role)
  ) {

    if (
      target.parentUserId !== parent.uid
    ) {
      return false;
    }

    if (
      !parent.municipalityId ||
      target.municipalityId !==
        parent.municipalityId
    ) {
      return false;
    }
  }


  if (
    ['jefe_estructura', 'integrante', 'participante']
      .includes(parent.role)
  ) {

    if (
      !parent.structureId ||
      target.structureId !==
        parent.structureId
    ) {
      return false;
    }
  }


  return true;
}


// ======================================================
// CREAR / DELEGAR EVENTO
// ======================================================

exports.createEventInvitations =
  onCall(
    OPTIONS,

    async (request) => {

      const data =
        request.data || {};


      const requestId =
        validId(
          data.requestId
        );


      if (
        !Array.isArray(
          data.assigneeIds
        ) ||
        !data.assigneeIds.length ||
        data.assigneeIds.length > 50
      ) {
        fail(
          'invalid-argument',
          'Selecciona entre 1 y 50 personas.'
        );
      }


      const assigneeIds =
        [
          ...new Set(
            data.assigneeIds.map(
              validId
            )
          )
        ].sort();


      const parentInvitationId =
        data.parentInvitationId == null
          ? null
          : validId(
              data.parentInvitationId
            );


      const newEvent =
        parentInvitationId
          ? null
          : {
              title:
                text(
                  data.title,
                  150,
                  true
                ),

              description:
                text(
                  data.description,
                  1500
                ),

              venue:
                text(
                  data.venue,
                  200,
                  true
                ),

              locality:
                text(
                  data.locality,
                  120
                ),

              startsAt:
                eventDate(
                  data.startsAt
                ),

              confirmationLeadMinutes:
                confirmationLeadMinutes(
                  data.confirmationLeadMinutes ??
                  60
                )
            };


      const fingerprint =
        hash(
          parentInvitationId,
          assigneeIds,
          newEvent
        );


      const db =
        getFirestore();


      return db.runTransaction(
        async (tx) => {

          const parent =
            await caller(
              tx,
              db,
              request
            );


          if (!NEXT[parent.role]) {
            fail(
              'permission-denied',
              'Tu nivel no puede invitar a un nivel inferior.'
            );
          }


          // ==================================================
          // IDEMPOTENCIA
          // ==================================================

          const receiptRef =
            db.collection(
              'eventDispatches'
            ).doc(
              hash(
                parent.uid,
                requestId
              )
            );


          const receipt =
            await tx.get(
              receiptRef
            );


          if (receipt.exists) {

            const saved =
              receipt.data();

            if (
              saved.fingerprint !==
                fingerprint ||
              saved.campaignId !==
                parent.campaignId
            ) {
              fail(
                'already-exists',
                'Este intento ya se utilizó con otros datos. Cierra y abre nuevamente el formulario.'
              );
            }

            return saved.result;
          }



          let eventId;
          let eventRecord;
          let parentInvitation = null;
          let ancestorInvitationIds = [];


          // ==================================================
          // EVENTO NUEVO
          // ==================================================

          if (!parentInvitationId) {

            if (
              Date.parse(
                newEvent.startsAt
              ) <= Date.now()
            ) {
              fail(
                'invalid-argument',
                'La fecha del evento debe ser futura.'
              );
            }


            const startsAtMillis =
              Date.parse(
                newEvent.startsAt
              );


            const confirmationClosesAtMillis =
              startsAtMillis -
              newEvent.confirmationLeadMinutes *
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


            eventId =
              hash(
                parent.uid,
                requestId,
                'event'
              );


            eventRecord = {
              id:
                eventId,

              campaignId:
                parent.campaignId,

              ...newEvent,

              startsAtMillis,

              confirmationLeadMinutes:
                newEvent.confirmationLeadMinutes,

              confirmationClosesAtMillis,

              confirmationClosesAt:
                new Date(
                  confirmationClosesAtMillis
                ).toISOString(),

              active:
                true,

              createdBy:
                parent.uid,

              createdByName:
                parent.name ||
                'Sin nombre',

              createdByRole:
                parent.role,

              version:
                1,

              createdAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp()
            };

          } else {

            // ==================================================
            // DELEGACIÓN DE EVENTO EXISTENTE
            // ==================================================

            const invitationSnapshot =
              await tx.get(
                db.collection(
                  'eventInvitations'
                ).doc(
                  parentInvitationId
                )
              );


            parentInvitation =
              invitationSnapshot.data();


            if (
              !parentInvitation ||
              parentInvitation.campaignId !==
                parent.campaignId ||
              parentInvitation.assignedTo !==
                parent.uid ||
              parentInvitation.assignedToRole !==
                parent.role ||
              parentInvitation.active !==
                true
            ) {
              fail(
                'permission-denied',
                'Solo puedes delegar un evento activo asignado a ti.'
              );
            }


            eventId =
              parentInvitation.eventId;


            const eventSnapshot =
              await tx.get(
                db.collection('events')
                  .doc(eventId)
              );


            eventRecord =
              eventSnapshot.data();


            if (
              !eventRecord ||
              eventRecord.campaignId !==
                parent.campaignId ||
              eventRecord.active !==
                true
            ) {
              fail(
                'failed-precondition',
                'El evento ya no está disponible.'
              );
            }


            const delegationClosesAtMillis =
              eventConfirmationClosesAtMillis(
                eventRecord
              );


            if (
              !Number.isFinite(
                delegationClosesAtMillis
              ) ||
              delegationClosesAtMillis <=
                Date.now()
            ) {
              fail(
                'failed-precondition',
                'El cierre de confirmaciones ya ocurrió; no se pueden crear nuevas invitaciones.'
              );
            }


            ancestorInvitationIds = [
              ...(
                Array.isArray(
                  parentInvitation
                    .ancestorInvitationIds
                )
                  ? parentInvitation
                      .ancestorInvitationIds
                  : []
              ),
              parentInvitationId
            ];


            if (
              ancestorInvitationIds.length >
              4
            ) {
              fail(
                'failed-precondition',
                'Se alcanzó el último nivel de invitación.'
              );
            }
          }


          // ==================================================
          // VALIDAR DESTINATARIOS
          // ==================================================

          const invitations = [];


          for (
            const uid of assigneeIds
          ) {

            const targetSnapshot =
              await tx.get(
                db.collection('usuarios')
                  .doc(uid)
              );


            const target =
              targetSnapshot.data();


            if (
              !targetAllowed(
                parent,
                target
              )
            ) {
              fail(
                'permission-denied',
                'Una persona ya no pertenece a tu nivel inmediato o está inactiva. Actualiza la lista.'
              );
            }


            const targetIdentity =
              await resolveDigitalCanonicalIdentity(
                tx,
                db,
                {
                  accountUid:
                    uid,

                  profile:
                    target,

                  campaignId:
                    parent.campaignId
                }
              );


            const invitationId =
              hash(
                eventId,
                parentInvitationId,
                uid
              );


            const invitationRef =
              db.collection(
                'eventInvitations'
              ).doc(
                invitationId
              );


            const existing =
              await tx.get(
                invitationRef
              );


            if (existing.exists) {

              const saved =
                existing.data();

              if (
                saved.eventId !==
                  eventId ||
                saved.assignedTo !==
                  uid
              ) {
                fail(
                  'failed-precondition',
                  'La invitación existente requiere revisión.'
                );
              }

              continue;
            }


            invitations.push({
              ref:
                invitationRef,

              data: {
                id:
                  invitationId,

                eventId,

                campaignId:
                  parent.campaignId,

                active:
                  true,

                createdBy:
                  parent.uid,

                createdByName:
                  parent.name ||
                  'Sin nombre',

                createdByRole:
                  parent.role,

                assignedTo:
                  uid,

                accountUid:
                  uid,

                personId:
                  targetIdentity.personId,

                assignedToName:
                  target.name ||
                  'Sin nombre',

                assignedToRole:
                  target.role,

                parentInvitationId,

                ancestorInvitationIds,

                municipalityId:
                  target.municipalityId ||
                  '',

                municipalityName:
                  target.municipalityName ||
                  '',

                structureId:
                  target.structureId ||
                  '',

                structureName:
                  target.structureName ||
                  '',

                version:
                  1,

                createdAt:
                  FieldValue.serverTimestamp(),

                updatedAt:
                  FieldValue.serverTimestamp()
              }
            });
          }


          // ==================================================
          // ESCRITURAS — SOLO DESPUÉS DE TODAS LAS LECTURAS
          // ==================================================

          if (!parentInvitationId) {

            const eventRef =
              db.collection('events')
                .doc(eventId);

            const existingEvent =
              await tx.get(
                eventRef
              );

            if (
              existingEvent.exists
            ) {
              fail(
                'already-exists',
                'El identificador del evento ya está ocupado.'
              );
            }


            tx.create(
              eventRef,
              eventRecord
            );
          }


          for (
            const invitation of invitations
          ) {
            tx.create(
              invitation.ref,
              invitation.data
            );
          }


          const result = {
            eventId,

            created:
              invitations.length,

            alreadyAssigned:
              assigneeIds.length -
              invitations.length
          };


          tx.create(
            receiptRef,
            {
              campaignId:
                parent.campaignId,

              fingerprint,

              result,

              createdAt:
                FieldValue.serverTimestamp()
            }
          );


          return result;
        }
      );
    }
  );



// ======================================================
// BUILD-118A-2A
// ESPACIO DE TRABAJO SEGURO DE EVENTOS
// ======================================================

async function readCaller(db, request) {

  if (!request.auth) {
    fail(
      'unauthenticated',
      'Inicia sesión.'
    );
  }

  const snapshot =
    await db.collection('usuarios')
      .doc(request.auth.uid)
      .get();

  const profile =
    snapshot.data();

  if (
    !profile ||
    profile.active !== true ||
    !profile.campaignId ||
    ![
      ...Object.keys(NEXT),
      'colaborador_base'
    ].includes(profile.role)
  ) {
    fail(
      'permission-denied',
      'Perfil no autorizado.'
    );
  }

  if (
    profile.role ===
    'lider_principal'
  ) {

    const lock =
      await db.collection(
        'principalLeaders'
      )
        .doc(profile.campaignId)
        .get();

    if (
      lock.data()?.uid !==
      snapshot.id
    ) {
      fail(
        'permission-denied',
        'Líder no registrado para esta campaña.'
      );
    }
  }

  return {
    ...profile,
    uid: snapshot.id
  };
}


function eventView(snapshot) {

  if (!snapshot?.exists) {
    return null;
  }

  const d =
    snapshot.data();

  return {
    id:
      snapshot.id,

    campaignId:
      d.campaignId || '',

    title:
      d.title || '',

    description:
      d.description || '',

    venue:
      d.venue || '',

    locality:
      d.locality || '',

    startsAt:
      d.startsAt || '',

    startsAtMillis:
      Number.isFinite(
        d.startsAtMillis
      )
        ? d.startsAtMillis
        : null,

    endsAt:
      typeof d.endsAt ===
        'string'
        ? d.endsAt
        : '',

    endsAtMillis:
      Number.isFinite(
        d.endsAtMillis
      )
        ? d.endsAtMillis
        : null,

    confirmationLeadMinutes:
      Number.isFinite(
        d.confirmationLeadMinutes
      )
        ? d.confirmationLeadMinutes
        : 60,

    confirmationClosesAt:
      typeof d.confirmationClosesAt ===
        'string'
        ? d.confirmationClosesAt
        : '',

    confirmationClosesAtMillis:
      Number.isFinite(
        d.confirmationClosesAtMillis
      )
        ? d.confirmationClosesAtMillis
        : (
            Number.isFinite(
              d.startsAtMillis
            )
              ? d.startsAtMillis -
                60 * 60 * 1000
              : null
          ),

    active:
      d.active === true,

    recordMode:
      d.recordMode ===
        'test'
        ? 'test'
        : 'production',

    archived:
      d.archived ===
        true,

    archivedAtMillis:
      typeof d.archivedAt?.toMillis ===
        'function'
        ? d.archivedAt.toMillis()
        : null,

    archivedBy:
      d.archivedBy || '',

    archivedByName:
      d.archivedByName || '',

    createdBy:
      d.createdBy || '',

    createdByName:
      d.createdByName || '',

    createdByRole:
      d.createdByRole || '',

    // ==================================================
    // BUILD-118D1E
    // EVENTO GENERAL / EVENT SCOPE
    // ==================================================

    scopeMode:
      d.scopeMode || '',

    scopeType:
      d.scopeType || '',

    scopeMunicipalityId:
      d.scopeMunicipalityId || '',

    scopeMunicipalityName:
      d.scopeMunicipalityName || '',

    operationalOwnerId:
      d.operationalOwnerId || '',

    scopeResolved:
      d.scopeResolved === true,

    scopeMemberCount:
      Number(
        d.scopeMemberCount
      ) || 0,

    scopeDigitalMemberCount:
      Number(
        d.scopeDigitalMemberCount
      ) || 0,

    scopeAccountlessMemberCount:
      Number(
        d.scopeAccountlessMemberCount
      ) || 0,

    version:
      d.version || 1
  };
}


function invitationView(snapshot) {

  const d =
    snapshot.data();

  return {
    id:
      snapshot.id,

    eventId:
      d.eventId || '',

    active:
      d.active === true,

    createdBy:
      d.createdBy || '',

    createdByName:
      d.createdByName || '',

    createdByRole:
      d.createdByRole || '',

    assignedTo:
      d.assignedTo || '',

    // Identidad primaria permanente.
    //
    // IMPORTANTE:
    // assignedTo NO es fallback de personId.
    personId:
      d.personId ||
      '',

    // Cuenta digital explícita.
    //
    // assignedTo se conserva como compatibilidad del
    // dominio actual de invitaciones.
    accountUid:
      d.accountUid ||
      d.assignedTo ||
      null,

    assignedToName:
      d.assignedToName || '',

    assignedToRole:
      d.assignedToRole || '',

    parentInvitationId:
      d.parentInvitationId || null,

    ancestorInvitationIds:
      Array.isArray(
        d.ancestorInvitationIds
      )
        ? d.ancestorInvitationIds.filter(
            value =>
              typeof value ===
              'string'
          )
        : [],

    municipalityId:
      d.municipalityId || '',

    municipalityName:
      d.municipalityName || '',

    structureId:
      d.structureId || '',

    structureName:
      d.structureName || '',

    version:
      d.version || 1
  };
}


// ======================================================
// BUILD-118D1F3
// EVENT SCOPE MEMBER -> PADRON DE ASISTENCIA
// ======================================================

function eventScopeMemberAttendanceView(
  member
) {

  if (
    !member ||
    typeof member !==
      'object'
  ) {
    return null;
  }


  const accountUid =
    typeof member.accountUid ===
      'string' &&
    member.accountUid
      ? member.accountUid
      : null;


  return {
    id:
      member.id || '',

    rosterSource:
      'event_scope',

    scopeMemberId:
      member.id || '',

    eventId:
      member.eventId || '',

    active:
      member.active ===
        true,

    assignedTo:
      accountUid || '',

    personId:
      member.personId || '',

    accountUid,

    hasDigitalAccount:
      member.hasDigitalAccount ===
        true,

    assignedToName:
      member.name || '',

    assignedToRole:
      member.role || '',

    parentInvitationId:
      null,

    ancestorInvitationIds:
      [],

    municipalityId:
      member.municipalityId || '',

    municipalityName:
      member.municipalityName || '',

    structureId:
      member.structureId || '',

    structureName:
      member.structureName || '',

    membershipId:
      member.membershipId || '',

    locality:
      member.locality || '',

    version:
      Number(
        member.resolutionVersion
      ) || 1
  };
}


function eventContactView(parent, person) {

  if (
    !targetAllowed(
      parent,
      person
    )
  ) {
    return {
      assignedToPhone: '',
      assignedToHasWhatsApp: false
    };
  }

  return {
    assignedToPhone:
      typeof person.phone === 'string'
        ? person.phone
        : '',

    assignedToHasWhatsApp:
      person.hasWhatsApp === true
  };
}


function assigneeView(person) {

  return {
    uid:
      person.uid,

    name:
      person.name ||
      person.email ||
      'Sin nombre',

    role:
      person.role || '',

    municipalityId:
      person.municipalityId || '',

    municipalityName:
      person.municipalityName || '',

    structureId:
      person.structureId || '',

    structureName:
      person.structureName || '',

    phone:
      person.phone || '',

    hasWhatsApp:
      person.hasWhatsApp === true
  };
}


exports.getEventWorkspace =
  onCall(
    OPTIONS,

    async (request) => {

      const db =
        getFirestore();

      const profile =
        await readCaller(
          db,
          request
        );

      const assignableRole =
        NEXT[profile.role] ||
        null;

      // ==================================================
      // NIVEL INMEDIATO DISPONIBLE
      // ==================================================

      let assignees = [];
      let assigneesTruncated =
        false;

      if (assignableRole) {

        let snapshot;

        if (
          profile.role === 'admin' ||
          profile.role ===
            'lider_principal'
        ) {

          snapshot =
            await db.collection(
              'usuarios'
            )
              .where(
                'campaignId',
                '==',
                profile.campaignId
              )
              .where(
                'role',
                '==',
                assignableRole
              )
              .limit(500)
              .get();

          assigneesTruncated =
            snapshot.size >= 500;

        } else {

          snapshot =
            await db.collection(
              'usuarios'
            )
              .where(
                'parentUserId',
                '==',
                profile.uid
              )
              .limit(500)
              .get();

          assigneesTruncated =
            snapshot.size >= 500;
        }

        snapshot.forEach(
          documentSnapshot => {

            const person = {
              ...documentSnapshot.data(),
              uid:
                documentSnapshot.id
            };

            if (
              targetAllowed(
                profile,
                person
              )
            ) {
              assignees.push(
                assigneeView(
                  person
                )
              );
            }
          }
        );

        assignees.sort(
          (a, b) =>
            a.name.localeCompare(
              b.name,
              'es',
              {
                sensitivity:
                  'base'
              }
            )
        );
      }

      // ==================================================
      // INVITACIONES RECIBIDAS Y CREADAS
      // ==================================================

      const [
        receivedSnapshot,
        createdSnapshot
      ] =
        await Promise.all([

          db.collection(
            'eventInvitations'
          )
            .where(
              'assignedTo',
              '==',
              profile.uid
            )
            .limit(200)
            .get(),

          db.collection(
            'eventInvitations'
          )
            .where(
              'createdBy',
              '==',
              profile.uid
            )
            .limit(200)
            .get()
        ]);

      const receivedInvitations =
        receivedSnapshot.docs
          .filter(
            snapshot =>
              snapshot.data()
                .campaignId ===
              profile.campaignId
          )
          .map(invitationView);

      const createdInvitations =
        createdSnapshot.docs
          .filter(
            snapshot =>
              snapshot.data()
                .campaignId ===
              profile.campaignId
          )
          .map(invitationView);


      // ==================================================
      // CONTACTO ACTUAL DEL DESTINATARIO
      // Solo para invitaciones creadas por este usuario.
      // Se vuelve a validar la relación jerárquica actual.
      // ==================================================

      const contactIds =
        [
          ...new Set(
            createdInvitations
              .map(
                invitation =>
                  invitation.assignedTo
              )
              .filter(Boolean)
          )
        ];


      const contacts =
        new Map();


      for (
        let offset = 0;
        offset < contactIds.length;
        offset += 100
      ) {

        const part =
          contactIds.slice(
            offset,
            offset + 100
          );


        const snapshots =
          await db.getAll(
            ...part.map(
              uid =>
                db.collection(
                  'usuarios'
                ).doc(uid)
            )
          );


        for (
          const snapshot of snapshots
        ) {

          if (!snapshot.exists) {
            continue;
          }


          const person = {
            ...snapshot.data(),
            uid:
              snapshot.id
          };


          contacts.set(
            snapshot.id,
            eventContactView(
              profile,
              person
            )
          );
        }
      }


      for (
        const invitation of
        createdInvitations
      ) {

        const contact =
          contacts.get(
            invitation.assignedTo
          ) || {
            assignedToPhone: '',
            assignedToHasWhatsApp: false
          };


        invitation.assignedToPhone =
          contact.assignedToPhone;


        invitation.assignedToHasWhatsApp =
          contact.assignedToHasWhatsApp;
      }


      // ==================================================
      // RESPUESTAS DE EVENTO
      // Una respuesta por invitación.
      // Ausencia de documento = pending.
      // ==================================================

      const responseInvitationIds =
        [
          ...new Set(
            [
              ...receivedInvitations,
              ...createdInvitations
            ]
              .map(
                invitation =>
                  invitation.id
              )
              .filter(Boolean)
          )
        ];


      const responses =
        new Map();


      for (
        let offset = 0;
        offset <
          responseInvitationIds.length;
        offset += 100
      ) {

        const part =
          responseInvitationIds.slice(
            offset,
            offset + 100
          );


        const snapshots =
          await db.getAll(
            ...part.map(
              invitationId =>
                db.collection(
                  'eventResponses'
                ).doc(
                  invitationId
                )
            )
          );


        for (
          const snapshot of
          snapshots
        ) {

          if (!snapshot.exists) {
            continue;
          }


          const data =
            snapshot.data();


          if (
            data.campaignId !==
              profile.campaignId
          ) {
            continue;
          }


          responses.set(
            snapshot.id,
            eventResponseView(
              snapshot
            )
          );
        }
      }


      const attachResponse =
        invitation => {

          invitation.response =
            responses.get(
              invitation.id
            ) || {
              status: 'pending',
              commitment: false,
              respondedAt: null,
              updatedAt: null
            };
        };


      receivedInvitations.forEach(
        attachResponse
      );


      createdInvitations.forEach(
        attachResponse
      );


      // ==================================================
      // IMPREVISTOS DE EVENTO
      // Un registro inmutable por invitación.
      // Solo se consultan invitaciones ya visibles
      // para el usuario actual.
      // ==================================================

      const incidents =
        new Map();


      for (
        let offset = 0;
        offset <
          responseInvitationIds.length;
        offset += 100
      ) {

        const part =
          responseInvitationIds.slice(
            offset,
            offset + 100
          );


        const snapshots =
          await db.getAll(
            ...part.map(
              invitationId =>
                db.collection(
                  'eventIncidents'
                ).doc(
                  invitationId
                )
            )
          );


        for (
          const snapshot of
          snapshots
        ) {

          if (!snapshot.exists) {
            continue;
          }


          const data =
            snapshot.data();


          if (
            data.campaignId !==
              profile.campaignId
          ) {
            continue;
          }


          incidents.set(
            snapshot.id,
            eventIncidentView(
              snapshot
            )
          );
        }
      }


      const attachIncident =
        invitation => {

          invitation.incident =
            incidents.get(
              invitation.id
            ) || null;
        };


      receivedInvitations.forEach(
        attachIncident
      );


      createdInvitations.forEach(
        attachIncident
      );


      // ==================================================
      // ASISTENCIA REAL
      // Un solo registro por evento + persona.
      //
      // Por ahora personId coincide con assignedTo.
      // BUILD-119 podrá usar una persona operacional
      // aunque no tenga cuenta digital.
      // ==================================================

      const attendanceLookupIds =
        [
          ...new Set(
            [
              ...receivedInvitations,
              ...createdInvitations
            ]
              .map(
                invitation => {

                  const personId =
                    invitation.personId ||
                    '';


                  if (
                    !invitation.eventId ||
                    !personId
                  ) {
                    return null;
                  }


                  return eventAttendanceDocumentId(
                    invitation.eventId,
                    personId
                  );
                }
              )
              .filter(Boolean)
          )
        ];


      const attendanceRecords =
        new Map();


      for (
        let offset = 0;
        offset <
          attendanceLookupIds.length;
        offset += 100
      ) {

        const part =
          attendanceLookupIds.slice(
            offset,
            offset + 100
          );


        const snapshots =
          await db.getAll(
            ...part.map(
              attendanceId =>
                db.collection(
                  'eventAttendance'
                ).doc(
                  attendanceId
                )
            )
          );


        for (
          const snapshot of
          snapshots
        ) {

          if (!snapshot.exists) {
            continue;
          }


          const data =
            snapshot.data();


          if (
            data.campaignId !==
              profile.campaignId
          ) {
            continue;
          }


          attendanceRecords.set(
            snapshot.id,
            eventAttendanceView(
              snapshot
            )
          );
        }
      }


      const attachAttendance =
        invitation => {

          const personId =
            invitation.personId ||
            '';


          if (
            !invitation.eventId ||
            !personId
          ) {
            invitation.attendance =
              null;

            return;
          }


          const attendanceId =
            eventAttendanceDocumentId(
              invitation.eventId,
              personId
            );


          invitation.attendance =
            attendanceRecords.get(
              attendanceId
            ) || null;
        };


      receivedInvitations.forEach(
        attachAttendance
      );


      createdInvitations.forEach(
        attachAttendance
      );


      // ==================================================
      // EVENTOS MAESTROS RELACIONADOS
      // ==================================================

      // ==================================================
      // BUILD-118D1E
      // EVENTOS GENERALES OPERADOS DIRECTAMENTE
      // ==================================================

      const organizedEventIds = [];


      if (
        profile.role ===
          'coordinador_municipal'
      ) {

        const organizedSnapshot =
          await db.collection(
            'events'
          )
            .where(
              'operationalOwnerId',
              '==',
              profile.uid
            )
            .limit(
              200
            )
            .get();


        for (
          const snapshot of
          organizedSnapshot.docs
        ) {

          const data =
            snapshot.data();


          if (
            data.active ===
              true &&
            data.campaignId ===
              profile.campaignId &&
            data.scopeMode ===
              'organizational' &&
            data.scopeType ===
              'municipality' &&
            data.scopeMunicipalityId ===
              (
                profile.municipalityId ||
                ''
              )
          ) {

            organizedEventIds.push(
              snapshot.id
            );
          }
        }
      }


      const eventIds =
        [
          ...new Set([
            ...[
              ...receivedInvitations,
              ...createdInvitations
            ]
              .map(
                invitation =>
                  invitation.eventId
              )
              .filter(Boolean),

            ...organizedEventIds
          ])
        ];


      const events = [];

      for (
        let offset = 0;
        offset < eventIds.length;
        offset += 100
      ) {

        const part =
          eventIds.slice(
            offset,
            offset + 100
          );

        const snapshots =
          await db.getAll(
            ...part.map(
              id =>
                db.collection(
                  'events'
                ).doc(id)
            )
          );

        for (
          const snapshot of
          snapshots
        ) {

          const event =
            eventView(
              snapshot
            );

          if (
            event &&
            event.campaignId ===
              profile.campaignId
          ) {
            events.push(event);
          }
        }
      }

      events.sort(
        (a, b) => {

          const av =
            Number.isFinite(
              a.startsAtMillis
            )
              ? a.startsAtMillis
              : Number.MAX_SAFE_INTEGER;

          const bv =
            Number.isFinite(
              b.startsAtMillis
            )
              ? b.startsAtMillis
              : Number.MAX_SAFE_INTEGER;

          return av - bv;
        }
      );

      return {
        viewer: {
          uid:
            profile.uid,

          name:
            profile.name ||
            request.auth.token?.email ||
            'Sin nombre',

          role:
            profile.role,

          campaignId:
            profile.campaignId,

          municipalityId:
            profile.municipalityId ||
            '',

          municipalityName:
            profile.municipalityName ||
            '',

          structureId:
            profile.structureId ||
            '',

          structureName:
            profile.structureName ||
            ''
        },

        assignableRole,

        canCreateEvent:
          Boolean(
            assignableRole
          ),

        assignees,

        events,

        organizedEvents:
          events.filter(
            event =>
              organizedEventIds.includes(
                event.id
              )
          ),

        receivedInvitations,

        createdInvitations,

        limits: {
          assigneesTruncated,

          receivedTruncated:
            receivedSnapshot.size >=
            200,

          createdTruncated:
            createdSnapshot.size >=
            200
        }
      };
    }
  );


// ======================================================
// BUILD-118C-3B3E-2B
// IDENTIDAD DE PERSONA EN PUERTA
// ======================================================

function doorPersonCandidateRef(
  campaignId,
  source,
  id
) {

  return hash(
    campaignId,
    source,
    id,
    'person-candidate-v1'
  );
}


function canonicalDoorIdentityRecords(
  userRecords,
  personRecords
) {

  const records =
    new Map();


  for (
    const record of
    Array.isArray(
      userRecords
    )
      ? userRecords
      : []
  ) {

    records.set(
      `account:${record.id}`,
      record
    );
  }


  // PERSONA es canónica cuando ya está vinculada
  // con una cuenta digital.
  for (
    const record of
    Array.isArray(
      personRecords
    )
      ? personRecords
      : []
  ) {

    const accountUid =
      typeof record
        ?.profile
        ?.accountUid ===
          'string'
        ? record.profile
            .accountUid
            .trim()
        : '';


    records.set(
      accountUid
        ? `account:${accountUid}`
        : `person:${record.id}`,
      record
    );
  }


  return [
    ...records.values()
  ];
}


// ======================================================
// REGISTRAR ASISTENCIA DE PERSONA ENCONTRADA EN PUERTA
//
// IMPORTANTE:
// - NO crea invitación ficticia.
// - NO asigna estructura.
// - NO cambia nivel.
// - Solo validadores con alcance total del evento.
// ======================================================

exports.recordDoorEventAttendance =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const data =
        request.data || {};


      const eventId =
        validId(
          data.eventId
        );


      const candidateRef =
        typeof data.candidateRef ===
          'string'
          ? data.candidateRef.trim()
          : '';


      if (
        !/^[a-f0-9]{64}$/.test(
          candidateRef
        )
      ) {

        fail(
          'invalid-argument',
          'La referencia de persona no es válida.'
        );
      }


      const checkInMethod =
        eventCheckInMethod(
          data.checkInMethod
        );


      return db.runTransaction(
        async tx => {

          // ==============================================
          // VALIDADOR
          // ==============================================

          const validator =
            await caller(
              tx,
              db,
              request
            );


          // ==============================================
          // EVENTO
          // ==============================================

          const eventRef =
            db.collection(
              'events'
            ).doc(
              eventId
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
              validator.campaignId
          ) {

            fail(
              'permission-denied',
              'El evento pertenece a otra campaña.'
            );
          }


          // Persona sin invitación no tiene una relación
          // "direct" que limite al validador.
          // Por eso solamente se permite al creador del
          // evento o a un attendanceValidatorId designado.
          const scope =
            eventAttendanceWorkspaceScope(
              validator,
              event
            );


          if (
            scope !==
              'event'
          ) {

            fail(
              'permission-denied',
              'Solo un responsable autorizado del control general del evento puede validar una persona encontrada en puerta.'
            );
          }


          // ==============================================
          // METODO
          // ==============================================

          if (
            !EVENT_ENABLED_CHECKIN_METHODS.has(
              checkInMethod
            )
          ) {

            fail(
              'failed-precondition',
              'Este método de asistencia todavía no está habilitado.'
            );
          }


          // ==============================================
          // VENTANA -45 / +90
          // ==============================================

          if (
            !canRecordEventAttendanceAt(
              event,
              Date.now()
            )
          ) {

            fail(
              'failed-precondition',
              'La asistencia real solo puede registrarse entre 45 minutos antes y 1 hora 30 minutos después de la hora citada.'
            );
          }


          // ==============================================
          // RESOLVER candidateRef EN BACKEND
          // ==============================================

          const [
            usersSnapshot,
            personsSnapshot
          ] =
            await Promise.all([

              tx.get(
                db.collection(
                  'usuarios'
                )
                  .where(
                    'campaignId',
                    '==',
                    validator.campaignId
                  )
                  .limit(
                    1001
                  )
              ),

              tx.get(
                db.collection(
                  'persons'
                )
                  .where(
                    'campaignId',
                    '==',
                    validator.campaignId
                  )
                  .limit(
                    1001
                  )
              )
            ]);


          if (
            usersSnapshot.size > 1000 ||
            personsSnapshot.size > 1000
          ) {

            fail(
              'resource-exhausted',
              'La campaña requiere el índice de identidad escalable antes de continuar.'
            );
          }


          const identityRecords =
            canonicalDoorIdentityRecords(

              usersSnapshot.docs.map(
                document => ({
                  source:
                    'user',

                  id:
                    document.id,

                  profile:
                    document.data()
                })
              ),

              personsSnapshot.docs.map(
                document => ({
                  source:
                    'person',

                  id:
                    document.id,

                  profile:
                    document.data()
                })
              )
            );


          const identity =
            identityRecords.find(
              record =>
                doorPersonCandidateRef(
                  validator.campaignId,
                  record.source,
                  record.id
                ) ===
                  candidateRef
            );


          if (!identity) {

            fail(
              'not-found',
              'La persona ya no puede resolverse con esta búsqueda. Vuelve a buscarla.'
            );
          }


          const profile =
            identity.profile ||
            {};


          // ==============================================
          // VALIDAR AFILIACION / ESTADO
          // ==============================================

          let personId =
            '';

          let accountUid =
            null;

          let affiliationVerified =
            false;


          if (
            identity.source ===
              'user'
          ) {

            if (
              profile.active !==
                true
            ) {

              fail(
                'failed-precondition',
                'La cuenta encontrada no está activa.'
              );
            }


            const canonicalIdentity =
              await resolveDigitalCanonicalIdentity(
                tx,
                db,
                {
                  accountUid:
                    identity.id,

                  profile,

                  campaignId:
                    validator.campaignId
                }
              );


            personId =
              canonicalIdentity.personId;


            accountUid =
              canonicalIdentity.accountUid;


            affiliationVerified =
              true;

          } else {

            if (
              profile.active ===
                false
            ) {

              fail(
                'failed-precondition',
                'La persona encontrada está inactiva.'
              );
            }


            personId =
              validId(
                identity.id
              );


            if (
              typeof profile.accountUid ===
                'string' &&
              profile.accountUid.trim()
            ) {

              accountUid =
                validId(
                  profile.accountUid
                );
            }


            // Para PERSONA accountless exigimos que
            // realmente haya quedado afiliada:
            // una membresía territorial activa.
            const membershipsSnapshot =
              await tx.get(
                db.collection(
                  'territorialMemberships'
                )
                  .where(
                    'personId',
                    '==',
                    personId
                  )
                  .limit(
                    20
                  )
              );


            affiliationVerified =
              membershipsSnapshot.docs
                .some(
                  snapshot => {

                    const membership =
                      snapshot.data();


                    return (
                      membership.campaignId ===
                        validator.campaignId &&
                      membership.active ===
                        true
                    );
                  }
                );


            if (
              !affiliationVerified
            ) {

              fail(
                'failed-precondition',
                'La persona existe, pero todavía no tiene una afiliación territorial activa. Debe terminar su registro y volver a recepción.'
              );
            }
          }


          const personName =
            typeof profile.name ===
              'string'
              ? profile.name.trim()
              : '';


          if (!personName) {

            fail(
              'failed-precondition',
              'La persona encontrada no tiene un nombre válido.'
            );
          }


          // ==============================================
          // IDEMPOTENCIA
          // ==============================================

          const attendanceId =
            eventAttendanceDocumentId(
              event.id,
              personId
            );


          const attendanceRef =
            db.collection(
              'eventAttendance'
            ).doc(
              attendanceId
            );


          const attendanceSnapshot =
            await tx.get(
              attendanceRef
            );


          if (
            attendanceSnapshot.exists
          ) {

            const existing =
              attendanceSnapshot.data();


            return {

              success:
                true,

              unchanged:
                true,

              affiliationVerified,

              attendance: {

                attended:
                  existing.attended ===
                    true,

                eventId:
                  event.id,

                personName:
                  existing.personName ||
                  personName,

                checkInMethod:
                  existing.checkInMethod ||
                  'manual'
              }
            };
          }


          // ==============================================
          // CREAR ASISTENCIA REAL
          // ==============================================

          const serverNow =
            FieldValue.serverTimestamp();


          const attendance = {

            eventId:
              event.id,

            personId,

            accountUid,

            // No existe invitación previa.
            invitationId:
              null,

            personName,

            campaignId:
              validator.campaignId,

            attended:
              true,

            checkInMethod,

            checkInSource:
              'door_identity_search',

            affiliationVerified:
              true,

            checkedInAt:
              serverNow,

            validatedByUserId:
              validator.uid,

            validatedByName:
              validator.name ||
              '',

            validatedByRole:
              validator.role ||
              '',

            version:
              1,

            createdAt:
              serverNow,

            updatedAt:
              serverNow
          };


          tx.create(
            attendanceRef,
            attendance
          );


          return {

            success:
              true,

            unchanged:
              false,

            affiliationVerified:
              true,

            attendance: {

              attended:
                true,

              eventId:
                event.id,

              personName,

              checkInMethod
            }
          };
        }
      );
    }
  );


// ======================================================
// BUILD-118C-2A
// AUTORIZACION DEL WORKSPACE DE ASISTENCIA
// ======================================================

function eventAttendanceUsesCanonicalRoster(
  event
) {

  return (
    event?.scopeMode ===
      'organizational' &&
    event?.scopeType ===
      'municipality'
  );
}


function eventAttendanceWorkspaceScope(
  profile,
  event
) {

  if (
    !profile ||
    !event ||
    profile.active !== true ||
    !profile.uid ||
    !profile.campaignId ||
    event.campaignId !==
      profile.campaignId
  ) {
    return 'none';
  }


  // El Colaborador de base es destinatario operativo.
  // Puede responder su propia invitación, pero no
  // administra el control de asistencia de terceros.
  if (
    profile.role ===
    'colaborador_base'
  ) {
    return 'none';
  }


  // Quien creó el evento maestro puede
  // controlar la asistencia completa.
  if (
    event.createdBy ===
      profile.uid
  ) {
    return 'event';
  }


  // Preparado para validadores designados.
  // Todavía no existe UI para asignarlos.
  if (
    Array.isArray(
      event.attendanceValidatorIds
    ) &&
    event.attendanceValidatorIds
      .includes(
        profile.uid
      )
  ) {
    return 'event';
  }


  // Un responsable que delegó personas
  // puede controlar únicamente sus
  // invitaciones directas.
  return 'direct';
}


function eventAttendanceInvitationAllowed(
  scope,
  profile,
  invitation,
  eventId
) {

  if (
    !profile ||
    !invitation ||
    invitation.active !== true ||
    invitation.campaignId !==
      profile.campaignId ||
    invitation.eventId !==
      eventId
  ) {
    return false;
  }


  if (scope === 'event') {
    return true;
  }


  if (scope === 'direct') {
    return (
      invitation.createdBy ===
      profile.uid
    );
  }


  return false;
}


function canValidateEventScopeAttendance(
  validator,
  member,
  event
) {

  if (
    !validator ||
    !member ||
    !event
  ) {
    return false;
  }


  if (
    validator.active !== true ||
    member.active !== true ||
    event.active !== true
  ) {
    return false;
  }


  if (
    !eventAttendanceUsesCanonicalRoster(
      event
    )
  ) {
    return false;
  }


  if (
    validator.campaignId !==
      event.campaignId ||
    member.campaignId !==
      event.campaignId
  ) {
    return false;
  }


  if (
    member.eventId !==
      event.id ||
    !member.personId
  ) {
    return false;
  }


  return (
    eventAttendanceWorkspaceScope(
      validator,
      event
    ) ===
      'event'
  );
}


// ======================================================
// HELPERS PARA PRUEBAS
// ======================================================

exports._test = {
  NEXT,
  targetAllowed,
  invitationView,
  eventContactView,
  EVENT_RESPONSE_STATUSES,
  eventStartsAtMillis,
  canRespondToEventInvitation,
  eventResponseView,
  EVENT_CONFIRMATION_LEAD_MINUTES,
  eventConfirmationClosesAtMillis,
  EVENT_INCIDENT_REASONS,
  canReportEventIncident,
  eventIncidentView,
  EVENT_CHECKIN_METHODS,
  eventCheckInMethod,
  eventScopeMemberDocumentId,
  eventAttendanceRequestMode,
  eventAttendanceDocumentId,
  eventAttendanceView,
  canValidateEventAttendance,
  EVENT_ENABLED_CHECKIN_METHODS,
  EVENT_ATTENDANCE_EARLY_MINUTES,
  EVENT_ATTENDANCE_LATE_MINUTES,
  eventAttendanceWindow,
  canRecordEventAttendanceAt,
  eventAttendanceWorkspaceScope,
  eventAttendanceInvitationAllowed,
  eventAttendanceUsesCanonicalRoster,
  eventScopeMemberAttendanceView,
  canValidateEventScopeAttendance,
  doorPersonCandidateRef,
  canonicalDoorIdentityRecords
};


// ======================================================
// BUILD-118B-1
// RESPONDER INVITACIÓN DE EVENTO
// ======================================================

exports.respondToEventInvitation =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const data =
        request.data || {};


      const invitationId =
        validId(
          data.invitationId
        );


      const status =
        eventResponseStatus(
          data.status
        );


      return db.runTransaction(
        async tx => {

          // ==============================================
          // PERFIL DEL USUARIO
          // ==============================================

          const profile =
            await caller(
              tx,
              db,
              request
            );


          // ==============================================
          // INVITACIÓN
          // ==============================================

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
              'Solo puedes responder tu propia invitación.'
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


          if (
            invitation.active !== true
          ) {
            fail(
              'failed-precondition',
              'La invitación ya no está activa.'
            );
          }


          // ==============================================
          // EVENTO
          // ==============================================

          const eventRef =
            db.collection(
              'events'
            ).doc(
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


          const nowMillis =
            Date.now();


          if (
            !canRespondToEventInvitation(
              profile,
              invitation,
              event,
              nowMillis
            )
          ) {

            if (
              event.active !== true
            ) {
              fail(
                'failed-precondition',
                'El evento ya no está activo.'
              );
            }


            const confirmationClosesAtMillis =
              eventConfirmationClosesAtMillis(
                event
              );


            if (
              Number.isFinite(
                confirmationClosesAtMillis
              ) &&
              confirmationClosesAtMillis <=
                nowMillis
            ) {
              fail(
                'failed-precondition',
                'El cierre de confirmaciones ya ocurrió. La respuesta normal ya no puede modificarse.'
              );
            }


            fail(
              'failed-precondition',
              'Esta invitación ya no puede ser respondida.'
            );
          }


          // ==============================================
          // RESPUESTA EXISTENTE
          // Un documento por invitación.
          // ==============================================

            // ==============================================
            // IDENTIDAD CANONICA DEL RESPONDIENTE
            //
            // personId = identidad permanente.
            // accountUid = cuenta Firebase Auth.
            // ==============================================

            const canonicalIdentity =
              await resolveInvitationCanonicalIdentity(
                tx,
                db,
                invitation,
                profile.campaignId
              );

            if (
              canonicalIdentity.accountUid !==
                profile.uid
            ) {
              fail(
                'failed-precondition',
                'La identidad canónica de la invitación no corresponde a la cuenta autenticada.'
              );
            }

            const personId =
              canonicalIdentity.personId;

            const accountUid =
              canonicalIdentity.accountUid;


          const responseRef =
            db.collection(
              'eventResponses'
            ).doc(
              invitationId
            );


          const responseSnapshot =
            await tx.get(
              responseRef
            );


          const previous =
            responseSnapshot.exists
              ? responseSnapshot.data()
              : null;


          const previousStatus =
            EVENT_RESPONSE_STATUSES.has(
              previous?.status
            )
              ? previous.status
              : 'pending';


          // ==============================================
          // MISMA RESPUESTA
          // Evita escrituras e historial duplicados.
          // ==============================================

          if (
            previousStatus ===
              status
          ) {

            return {

              success:
                true,

              unchanged:
                true,

              response: {

                invitationId,

                eventId:
                  event.id,

                status,

                commitment:
                  status ===
                    'attending',

                version:
                  Number(
                    previous?.version
                  ) || 1
              }
            };
          }


          // ==============================================
          // GUARDAR ESTADO ACTUAL
          // ==============================================

          const serverNow =
            FieldValue.serverTimestamp();


          const nextVersion =
            (
              Number(
                previous?.version
              ) || 0
            ) + 1;


          const response = {

            invitationId,

            eventId:
              event.id,

            campaignId:
              profile.campaignId,

            personId,

            accountUid,

            personName:
              profile.name || '',

            status,

            commitment:
              status ===
                'attending',

            // Primera respuesta real.
            // No cambia en modificaciones posteriores.
            respondedAt:
              previous?.respondedAt ||
              serverNow,

            createdAt:
              previous?.createdAt ||
              serverNow,

            updatedAt:
              serverNow,

            version:
              nextVersion
          };


          // ==============================================
          // HISTORIAL INMUTABLE DEL CAMBIO
          // ==============================================

          const historyRef =
            db.collection(
              'eventResponseHistory'
            ).doc();


          tx.set(
            responseRef,
            response
          );


          tx.create(
            historyRef,
            {

              responseId:
                invitationId,

              invitationId,

              eventId:
                event.id,

              campaignId:
                profile.campaignId,

              personId,

              accountUid,

              personName:
                profile.name || '',

              previousStatus,

              status,

              commitment:
                status ===
                  'attending',

              version:
                nextVersion,

              changedBy:
                profile.uid,

              changedByName:
                profile.name || '',

              channel:
                'terra_web',

              changedAt:
                serverNow
            }
          );


          return {

            success:
              true,

            unchanged:
              false,

            response: {

              invitationId,

              eventId:
                event.id,

              status,

              commitment:
                status ===
                  'attending',

              version:
                nextVersion
            }
          };
        }
      );
    }
  );


// ======================================================
// BUILD-118B-3C-1
// REPORTAR IMPREVISTO POSTERIOR AL CIERRE
// ======================================================

exports.reportEventIncident =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const data =
        request.data || {};


      const invitationId =
        validId(
          data.invitationId
        );


      const reason =
        eventIncidentReason(
          data.reason
        );


      const note =
        text(
          data.note,
          300
        );


      return db.runTransaction(
        async tx => {

          // ==============================================
          // PERSONA QUE REPORTA
          // ==============================================

          const profile =
            await caller(
              tx,
              db,
              request
            );


          // ==============================================
          // INVITACION
          // ==============================================

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
              'Solo puedes reportar un imprevisto sobre tu propia invitación.'
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


          if (
            invitation.active !== true
          ) {
            fail(
              'failed-precondition',
              'La invitación ya no está activa.'
            );
          }


          // ==============================================
          // EVENTO
          // ==============================================

          const eventRef =
            db.collection(
              'events'
            ).doc(
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


          // ==============================================
          // RESPUESTA / COMPROMISO ORIGINAL
          // ==============================================

          const responseRef =
            db.collection(
              'eventResponses'
            ).doc(
              invitationId
            );


          const responseSnapshot =
            await tx.get(
              responseRef
            );


          if (
            !responseSnapshot.exists
          ) {
            fail(
              'failed-precondition',
              'No existe una confirmación de asistencia.'
            );
          }


          const response =
            responseSnapshot.data();


          const nowMillis =
            Date.now();


          const closesAtMillis =
            eventConfirmationClosesAtMillis(
              event
            );


          const startsAtMillis =
            eventStartsAtMillis(
              event
            );


          if (
            response.status !==
              'attending'
          ) {
            fail(
              'failed-precondition',
              'Solo quien confirmó Asistiré puede reportar un imprevisto posterior.'
            );
          }


          if (
            Number.isFinite(
              closesAtMillis
            ) &&
            nowMillis <
              closesAtMillis
          ) {
            fail(
              'failed-precondition',
              'La confirmación todavía está abierta. Puedes cambiar tu respuesta normalmente.'
            );
          }


          if (
            Number.isFinite(
              startsAtMillis
            ) &&
            nowMillis >=
              startsAtMillis
          ) {
            fail(
              'failed-precondition',
              'El evento ya comenzó. El periodo para reportar un imprevisto previo terminó.'
            );
          }


          if (
            !canReportEventIncident(
              profile,
              invitation,
              event,
              response,
              nowMillis
            )
          ) {
            fail(
              'failed-precondition',
              'No es posible reportar este imprevisto.'
            );
          }


          // ==============================================
          // UN IMPREVISTO INMUTABLE POR INVITACION
          // ==============================================

          const incidentRef =
            db.collection(
              'eventIncidents'
            ).doc(
              invitationId
            );


          const incidentSnapshot =
            await tx.get(
              incidentRef
            );


          if (
            incidentSnapshot.exists
          ) {

            const existing =
              incidentSnapshot.data();


            return {

              success:
                true,

              unchanged:
                true,

              incident: {

                invitationId,

                eventId:
                  event.id,

                reason:
                  existing.reason ||
                  'other',

                alreadyReported:
                  true
              }
            };
          }


          const serverNow =
            FieldValue.serverTimestamp();


          const incident = {

            invitationId,

            eventId:
              event.id,

            campaignId:
              profile.campaignId,

            personId:
              profile.uid,

            personName:
              profile.name || '',

            originalResponseStatus:
              'attending',

            responseVersion:
              Number(
                response.version
              ) || 1,

            reason,

            note,

            confirmationClosesAtMillis:
              closesAtMillis,

            startsAtMillis,

            reportedBy:
              profile.uid,

            reportedByName:
              profile.name || '',

            channel:
              'terra_web',

            reportedAt:
              serverNow,

            version:
              1
          };


          tx.create(
            incidentRef,
            incident
          );


          return {

            success:
              true,

            unchanged:
              false,

            incident: {

              invitationId,

              eventId:
                event.id,

              reason,

              alreadyReported:
                false
            }
          };
        }
      );
    }
  );


// ======================================================
// BUILD-118C-1A
// REGISTRO SEGURO DE ASISTENCIA REAL
// ======================================================

exports.recordEventAttendance =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const data =
        request.data || {};


      const requestMode =
        eventAttendanceRequestMode(
          data
        );


      if (
        requestMode ===
          'invalid'
      ) {
        fail(
          'invalid-argument',
          'Indica invitationId o bien eventId + personId para registrar asistencia.'
        );
      }


      const invitationId =
        requestMode ===
          'invitation'
          ? validId(
              data.invitationId
            )
          : null;


      const requestedEventId =
        requestMode ===
          'event_scope'
          ? validId(
              data.eventId
            )
          : null;


      const requestedPersonId =
        requestMode ===
          'event_scope'
          ? validId(
              data.personId
            )
          : null;


      const checkInMethod =
        eventCheckInMethod(
          data.checkInMethod
        );


      return db.runTransaction(
        async tx => {

          // ==============================================
          // VALIDADOR
          // ==============================================

          const validator =
            await caller(
              tx,
              db,
              request
            );


          // ==============================================
          // ORIGEN DEL PADRON
          //
          // invitation:
          //   compatibilidad con eventInvitations.
          //
          // event_scope:
          //   persona canónica de eventScopeMembers.
          // ==============================================

          let invitation =
            null;

          let scopeMember =
            null;

          let resolvedEventId =
            '';


          if (
            requestMode ===
              'invitation'
          ) {

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


            invitation = {
              ...invitationSnapshot.data(),
              id:
                invitationSnapshot.id
            };


            if (
              invitation.campaignId !==
                validator.campaignId
            ) {
              fail(
                'permission-denied',
                'La invitación pertenece a otra campaña.'
              );
            }


            resolvedEventId =
              validId(
                invitation.eventId
              );

          } else {

            const scopeMemberRef =
              db.collection(
                'eventScopeMembers'
              ).doc(
                eventScopeMemberDocumentId(
                  requestedEventId,
                  requestedPersonId
                )
              );


            const scopeMemberSnapshot =
              await tx.get(
                scopeMemberRef
              );


            if (
              !scopeMemberSnapshot.exists
            ) {
              fail(
                'not-found',
                'La persona no pertenece al padrón canónico de este evento.'
              );
            }


            scopeMember = {
              ...scopeMemberSnapshot.data(),
              id:
                scopeMemberSnapshot.id
            };


            if (
              scopeMember.eventId !==
                requestedEventId ||
              scopeMember.personId !==
                requestedPersonId
            ) {
              fail(
                'failed-precondition',
                'El miembro del padrón no coincide con el evento o la persona solicitada.'
              );
            }


            resolvedEventId =
              requestedEventId;
          }


          // ==============================================
          // EVENTO
          // ==============================================

          const eventRef =
            db.collection(
              'events'
            ).doc(
              resolvedEventId
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
            event.archived ===
              true
          ) {
            fail(
              'failed-precondition',
              'El evento está archivado. Restáuralo antes de operar el control de asistencia.'
            );
          }


          // ==============================================
          // AUTORIZACION
          // ==============================================

          const authorized =
            requestMode ===
              'invitation'
              ? canValidateEventAttendance(
                  validator,
                  invitation,
                  event
                )
              : canValidateEventScopeAttendance(
                  validator,
                  scopeMember,
                  event
                );


          if (!authorized) {
            fail(
              'permission-denied',
              'No tienes autorización para validar esta asistencia.'
            );
          }


          // ==============================================
          // METODO HABILITADO
          // ==============================================

          if (
            !EVENT_ENABLED_CHECKIN_METHODS.has(
              checkInMethod
            )
          ) {
            fail(
              'failed-precondition',
              'Este método de asistencia todavía no está habilitado. El QR y el código requerirán validación segura propia.'
            );
          }


          // ==============================================
          // ASISTENCIA REAL
          // Puede registrarse desde 45 minutos antes y hasta 90 minutos después de la hora citada.
          // ==============================================

          if (
            !canRecordEventAttendanceAt(
              event,
              Date.now()
            )
          ) {
            fail(
              'failed-precondition',
              'La asistencia real solo puede registrarse entre 45 minutos antes y 1 hora 30 minutos después de la hora citada.'
            );
          }


          // ==============================================
          // IDENTIDAD CANONICA
          //
          // personId = identidad primaria permanente.
          // accountUid = cuenta digital opcional.
          //
          // invitation:
          //   resuelve compatibilidad histórica.
          //
          // event_scope:
          //   usa directamente eventScopeMembers.
          // ==============================================

          let personId =
            '';

          let accountUid =
            null;

          let personName =
            '';

          let attendanceInvitationId =
            null;


          if (
            requestMode ===
              'invitation'
          ) {

            const canonicalIdentity =
              await resolveInvitationCanonicalIdentity(
                tx,
                db,
                invitation,
                validator.campaignId
              );


            personId =
              canonicalIdentity.personId;


            accountUid =
              canonicalIdentity.accountUid;


            personName =
              typeof invitation.assignedToName ===
                'string' &&
              invitation.assignedToName.trim()
                ? invitation.assignedToName
                : (
                    canonicalIdentity.person
                      ?.name ||
                    ''
                  );


            attendanceInvitationId =
              invitation.id;

          } else {

            personId =
              requestedPersonId;


            accountUid =
              typeof scopeMember.accountUid ===
                'string' &&
              scopeMember.accountUid
                ? scopeMember.accountUid
                : null;


            personName =
              typeof scopeMember.name ===
                'string'
                ? scopeMember.name.trim()
                : '';


            attendanceInvitationId =
              null;
          }


          const attendanceId =
            eventAttendanceDocumentId(
              event.id,
              personId
            );


          const attendanceRef =
            db.collection(
              'eventAttendance'
            ).doc(
              attendanceId
            );


          const attendanceSnapshot =
            await tx.get(
              attendanceRef
            );


          // ==============================================
          // IDEMPOTENCIA
          // Una persona solo tiene una asistencia
          // por evento.
          // ==============================================

          if (
            attendanceSnapshot.exists
          ) {

            return {

              success:
                true,

              unchanged:
                true,

              attendance:
                eventAttendanceView(
                  attendanceSnapshot
                )
            };
          }


          const serverNow =
            FieldValue.serverTimestamp();


          const attendance = {

            eventId:
              event.id,

            personId,

            accountUid,

            invitationId:
              attendanceInvitationId,

            personName,

            campaignId:
              validator.campaignId,

            attended:
              true,

            checkInMethod,

            checkedInAt:
              serverNow,

            validatedByUserId:
              validator.uid,

            validatedByName:
              validator.name ||
              '',

            validatedByRole:
              validator.role ||
              '',

            version:
              1,

            createdAt:
              serverNow,

            updatedAt:
              serverNow
          };


          tx.create(
            attendanceRef,
            attendance
          );


          return {

            success:
              true,

            unchanged:
              false,

            attendance: {

              attended:
                true,

              eventId:
                event.id,

              personId,

              accountUid,

              invitationId:
                attendanceInvitationId,

              personName,

              checkInMethod,

              validatedByUserId:
                validator.uid,

              validatedByName:
                validator.name ||
                '',

              validatedByRole:
                validator.role ||
                '',

              version:
                1
            }
          };
        }
      );
    }
  );


// ======================================================
// BUILD-118C-2A
// WORKSPACE SEGURO DE CONTROL DE ASISTENCIA
// ======================================================

exports.getEventAttendanceWorkspace =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const eventId =
        validId(
          request.data?.eventId
        );


      const profile =
        await readCaller(
          db,
          request
        );


      // ==============================================
      // EVENTO MAESTRO
      // ==============================================

      const eventSnapshot =
        await db.collection(
          'events'
        ).doc(
          eventId
        ).get();


      if (!eventSnapshot.exists) {
        fail(
          'not-found',
          'El evento no existe.'
        );
      }


      const rawEvent = {
        ...eventSnapshot.data(),
        id:
          eventSnapshot.id
      };


      if (
        rawEvent.campaignId !==
          profile.campaignId
      ) {
        fail(
          'permission-denied',
          'El evento pertenece a otra campaña.'
        );
      }


      if (
        rawEvent.archived ===
          true
      ) {
        fail(
          'failed-precondition',
          'El evento está archivado. Restáuralo antes de operar el control de asistencia.'
        );
      }


      const event =
        eventView(
          eventSnapshot
        );


      const scope =
        eventAttendanceWorkspaceScope(
          profile,
          rawEvent
        );


      if (scope === 'none') {
        fail(
          'permission-denied',
          'No tienes autorización para consultar la asistencia de este evento.'
        );
      }


      // ==============================================
      // PADRON DE ASISTENCIA
      //
      // Evento general:
      //   eventScopeMembers.
      //
      // Evento legado:
      //   eventInvitations.
      // ==============================================

      const usesCanonicalRoster =
        eventAttendanceUsesCanonicalRoster(
          rawEvent
        );


      let invitations = [];

      let rosterTruncated =
        false;


      if (usesCanonicalRoster) {

        // El padrón general representa el universo
        // completo del evento. No debe exponerse bajo
        // el alcance legacy "direct".
        if (scope !== 'event') {

          fail(
            'permission-denied',
            'No tienes autorización para consultar el padrón completo de este evento.'
          );
        }


        const scopeMemberSnapshot =
          await db.collection(
            'eventScopeMembers'
          )
            .where(
              'eventId',
              '==',
              eventId
            )
            .limit(500)
            .get();


        invitations =
          scopeMemberSnapshot.docs
            .filter(
              snapshot => {

                const member =
                  snapshot.data();

                return (
                  member.active ===
                    true &&
                  member.campaignId ===
                    profile.campaignId &&
                  member.eventId ===
                    eventId
                );
              }
            )
            .map(
              snapshot =>
                eventScopeMemberAttendanceView({
                  ...snapshot.data(),
                  id:
                    snapshot.id
                })
            )
            .filter(Boolean);


        rosterTruncated =
          scopeMemberSnapshot.size >=
            500;

      } else {

        const invitationSnapshot =
          await db.collection(
            'eventInvitations'
          )
            .where(
              'eventId',
              '==',
              eventId
            )
            .limit(500)
            .get();


        const allowedSnapshots =
          invitationSnapshot.docs
            .filter(
              snapshot =>
                eventAttendanceInvitationAllowed(
                  scope,
                  profile,
                  snapshot.data(),
                  eventId
                )
            );


        if (
          scope === 'direct' &&
          !allowedSnapshots.length
        ) {

          fail(
            'permission-denied',
            'No tienes personas a tu cargo para validar en este evento.'
          );
        }


        invitations =
          allowedSnapshots.map(
            invitationView
          );


        rosterTruncated =
          invitationSnapshot.size >=
            500;
      }


      // ==============================================
      // RESPUESTAS
      // ==============================================

      const responses =
        new Map();


      for (
        let offset = 0;
        offset < invitations.length;
        offset += 100
      ) {

        const part =
          invitations.slice(
            offset,
            offset + 100
          );


        const snapshots =
          await db.getAll(
            ...part.map(
              invitation =>
                db.collection(
                  'eventResponses'
                ).doc(
                  invitation.id
                )
            )
          );


        for (const snapshot of snapshots) {

          if (!snapshot.exists) {
            continue;
          }


          const data =
            snapshot.data();


          if (
            data.campaignId !==
              profile.campaignId
          ) {
            continue;
          }


          responses.set(
            snapshot.id,
            eventResponseView(
              snapshot
            )
          );
        }
      }


      // ==============================================
      // IMPREVISTOS
      // ==============================================

      const incidents =
        new Map();


      for (
        let offset = 0;
        offset < invitations.length;
        offset += 100
      ) {

        const part =
          invitations.slice(
            offset,
            offset + 100
          );


        const snapshots =
          await db.getAll(
            ...part.map(
              invitation =>
                db.collection(
                  'eventIncidents'
                ).doc(
                  invitation.id
                )
            )
          );


        for (const snapshot of snapshots) {

          if (!snapshot.exists) {
            continue;
          }


          const data =
            snapshot.data();


          if (
            data.campaignId !==
              profile.campaignId
          ) {
            continue;
          }


          incidents.set(
            snapshot.id,
            eventIncidentView(
              snapshot
            )
          );
        }
      }


      // ==============================================
      // ASISTENCIA REAL
      // ==============================================

      const attendanceIds =
        invitations
          .map(
            invitation => {

              const personId =
                invitation.personId ||
                '';


              if (!personId) {
                return null;
              }


              return {
                invitationId:
                  invitation.id,

                attendanceId:
                  eventAttendanceDocumentId(
                    eventId,
                    personId
                  )
              };
            }
          )
          .filter(Boolean);


      const attendance =
        new Map();


      for (
        let offset = 0;
        offset < attendanceIds.length;
        offset += 100
      ) {

        const part =
          attendanceIds.slice(
            offset,
            offset + 100
          );


        const snapshots =
          await db.getAll(
            ...part.map(
              item =>
                db.collection(
                  'eventAttendance'
                ).doc(
                  item.attendanceId
                )
            )
          );


        snapshots.forEach(
          (snapshot, index) => {

            if (!snapshot.exists) {
              return;
            }


            const data =
              snapshot.data();


            if (
              data.campaignId !==
                profile.campaignId
            ) {
              return;
            }


            attendance.set(
              part[index].invitationId,
              eventAttendanceView(
                snapshot
              )
            );
          }
        );
      }


      // ==============================================
      // ENSAMBLAR PADRON OPERATIVO
      // ==============================================

      for (const invitation of invitations) {

        invitation.response =
          responses.get(
            invitation.id
          ) || {
            status:
              'pending',

            commitment:
              false,

            respondedAt:
              null,

            updatedAt:
              null
          };


        invitation.incident =
          incidents.get(
            invitation.id
          ) || null;


        invitation.attendance =
          attendance.get(
            invitation.id
          ) || null;
      }


      invitations.sort(
        (a, b) =>
          String(
            a.assignedToName ||
            ''
          ).localeCompare(
            String(
              b.assignedToName ||
              ''
            ),
            'es'
          )
      );


      // ==============================================
      // RESUMEN
      // ==============================================

      const summary = {
        total:
          invitations.length,

        pending:
          0,

        attending:
          0,

        notAttending:
          0,

        checkedIn:
          0
      };


      for (const invitation of invitations) {

        const status =
          invitation.response?.status ||
          'pending';


        if (status === 'attending') {
          summary.attending += 1;

        } else if (
          status === 'not_attending'
        ) {
          summary.notAttending += 1;

        } else {
          summary.pending += 1;
        }


        if (
          invitation.attendance?.attended ===
            true
        ) {
          summary.checkedIn += 1;
        }
      }


      return {
        event,

        scope,

        canValidateWholeEvent:
          scope === 'event',

        rosterSource:
          usesCanonicalRoster
            ? 'event_scope'
            : 'event_invitations',

        invitations,

        summary,

        limits: {
          invitationsTruncated:
            rosterTruncated
        }
      };
    }
  );
