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
  integrante: 'participante'
};


const EVENT_RESPONSE_STATUSES =
  new Set([
    'attending',
    'not_attending'
  ]);


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

  const startsAtMillis =
    eventStartsAtMillis(event);

  return (
    Number.isFinite(
      startsAtMillis
    ) &&
    startsAtMillis >
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
      'participante'
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
    ['jefe_estructura', 'integrante']
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

              startsAtMillis:
                Date.parse(
                  newEvent.startsAt
                ),

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


            if (
              Number.isFinite(
                eventRecord.startsAtMillis
              ) &&
              eventRecord.startsAtMillis <=
                Date.now()
            ) {
              fail(
                'failed-precondition',
                'El evento ya comenzó; no se pueden crear nuevas invitaciones.'
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
              3
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
      'participante'
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

    active:
      d.active === true,

    createdBy:
      d.createdBy || '',

    createdByName:
      d.createdByName || '',

    createdByRole:
      d.createdByRole || '',

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
      // EVENTOS MAESTROS RELACIONADOS
      // ==================================================

      const eventIds =
        [
          ...new Set(
            [
              ...receivedInvitations,
              ...createdInvitations
            ]
              .map(
                invitation =>
                  invitation.eventId
              )
              .filter(Boolean)
          )
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
// HELPERS PARA PRUEBAS
// ======================================================

exports._test = {
  NEXT,
  targetAllowed,
  eventContactView,
  EVENT_RESPONSE_STATUSES,
  eventStartsAtMillis,
  canRespondToEventInvitation,
  eventResponseView
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


          if (
            !canRespondToEventInvitation(
              profile,
              invitation,
              event,
              Date.now()
            )
          ) {
            fail(
              'failed-precondition',
              'Este evento ya inició, está inactivo o no puede ser respondido.'
            );
          }


          // ==============================================
          // RESPUESTA EXISTENTE
          // Un documento por invitación.
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

            personId:
              profile.uid,

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

              personId:
                profile.uid,

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
