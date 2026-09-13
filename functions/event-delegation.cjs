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
// HELPERS PARA PRUEBAS
// ======================================================

exports._test = {
  NEXT,
  targetAllowed
};
