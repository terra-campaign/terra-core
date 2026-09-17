'use strict';

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
  region:
    'us-central1',

  timeoutSeconds:
    60
};


const ALLOCATION_TYPES =
  new Set([
    'full_vehicle',
    'capacity_block',
    'seat_selection'
  ]);


const ALLOCATION_ZONES =
  new Set([
    'none',
    'left',
    'right',
    'front',
    'rear',
    'custom'
  ]);


const ALLOCATION_TARGET_ROLES =
  new Set([
    'lider_principal',
    'coordinador_municipal',
    'jefe_estructura',
    'integrante',
    'participante'
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
// HASH
// ======================================================

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


// ======================================================
// VALIDACIONES
// ======================================================

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


function validRequestId(
  value
) {

  if (
    typeof value !==
      'string' ||
    !/^[A-Za-z0-9_-]{8,128}$/
      .test(
        value
      )
  ) {

    fail(
      'invalid-argument',
      'Identificador de operación inválido.'
    );
  }


  return value;
}


function allocationType(
  value
) {

  if (
    typeof value !==
      'string' ||
    !ALLOCATION_TYPES.has(
      value
    )
  ) {

    fail(
      'invalid-argument',
      'Tipo de asignación de cupo inválido.'
    );
  }


  return value;
}


function allocationZone(
  value
) {

  const normalized =
    typeof value ===
      'string'
      ? value.trim()
      : 'none';


  if (
    !ALLOCATION_ZONES.has(
      normalized
    )
  ) {

    fail(
      'invalid-argument',
      'Zona de asientos inválida.'
    );
  }


  return normalized;
}


function optionalText(
  value,
  maxLength =
    160
) {

  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return '';
  }


  const normalized =
    typeof value ===
      'string'
      ? value.trim()
      : '';


  if (
    !normalized ||
    normalized.length >
      maxLength
  ) {

    fail(
      'invalid-argument',
      'Texto complementario inválido.'
    );
  }


  return normalized;
}


function requestedCapacity(
  value
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isInteger(
      number
    ) ||
    number < 1 ||
    number > 120
  ) {

    fail(
      'invalid-argument',
      'El número de lugares solicitado no es válido.'
    );
  }


  return number;
}


function normalizeSeatNumbers(
  value
) {

  if (
    !Array.isArray(
      value
    ) ||
    value.length < 1 ||
    value.length > 120
  ) {

    fail(
      'invalid-argument',
      'Selecciona al menos un asiento.'
    );
  }


  const normalized =
    value.map(
      number =>
        Number(
          number
        )
    );


  if (
    normalized.some(
      number =>
        !Number.isInteger(
          number
        ) ||
        number < 1 ||
        number > 120
    )
  ) {

    fail(
      'invalid-argument',
      'La selección contiene un asiento inválido.'
    );
  }


  const unique = [
    ...new Set(
      normalized
    )
  ];


  if (
    unique.length !==
      normalized.length
  ) {

    fail(
      'invalid-argument',
      'No puedes seleccionar el mismo asiento dos veces.'
    );
  }


  return unique.sort(
    (a, b) =>
      a - b
  );
}


// ======================================================
// AUTORIDAD LOGISTICA
// ======================================================

function canManageEventTransport(
  profile,
  event
) {

  if (
    !profile ||
    !event ||
    profile.active !==
      true ||
    !profile.uid ||
    !profile.campaignId ||
    event.active !==
      true ||
    event.campaignId !==
      profile.campaignId
  ) {
    return false;
  }


  if (
    event.createdBy ===
      profile.uid
  ) {
    return true;
  }


  return (
    Array.isArray(
      event.transportManagerIds
    ) &&
    event.transportManagerIds
      .includes(
        profile.uid
      )
  );
}


// ======================================================
// DESTINATARIO DEL CUPO
// ======================================================

function canReceiveAllocation(
  targetProfile,
  event,
  invitation =
    null
) {

  if (
    !targetProfile ||
    !event ||
    targetProfile.active !==
      true ||
    !targetProfile.uid ||
    targetProfile.campaignId !==
      event.campaignId ||
    !ALLOCATION_TARGET_ROLES.has(
      targetProfile.role
    )
  ) {
    return false;
  }


  // El creador del evento puede recibir
  // un bloque para su propia operación.
  if (
    event.createdBy ===
      targetProfile.uid
  ) {
    return true;
  }


  // Los demás responsables deben formar
  // parte real de la cadena de invitaciones.
  return Boolean(
    invitation &&
    invitation.active ===
      true &&
    invitation.campaignId ===
      event.campaignId &&
    invitation.eventId ===
      event.id &&
    invitation.assignedTo ===
      targetProfile.uid
  );
}


// ======================================================
// SELECCION DE ASIENTOS
// ======================================================

function chooseSeatNumbers({
  type,
  capacity,
  requested,
  selectedSeatNumbers,
  zone = 'none',
  seats
}) {

  const activeSeats =
    Array.isArray(
      seats
    )
      ? seats.filter(
          seat =>
            seat.active ===
              true
        )
      : [];


  const freeSeats =
    activeSeats
      .filter(
        seat =>
          !seat.allocationId &&
          !seat.assignmentId &&
          !seat.personId &&
          (
            seat.status ===
              'free' ||
            !seat.status
          )
      )
      .sort(
        (a, b) =>
          a.seatNumber -
          b.seatNumber
      );


  if (
    type ===
      'full_vehicle'
  ) {

    if (
      freeSeats.length !==
        capacity
    ) {

      fail(
        'failed-precondition',
        'El vehículo ya tiene lugares repartidos y no puede asignarse completo.'
      );
    }


    return freeSeats.map(
      seat =>
        seat.seatNumber
    );
  }


  if (
    type ===
      'capacity_block'
  ) {

    if (
      requested >
        freeSeats.length
    ) {

      fail(
        'failed-precondition',
        `Solo existen ${freeSeats.length} lugares disponibles.`
      );
    }


    return freeSeats
      .slice(
        0,
        requested
      )
      .map(
        seat =>
          seat.seatNumber
      );
  }


  const selected =
    Array.isArray(
      selectedSeatNumbers
    )
      ? selectedSeatNumbers
      : [];


  // ====================================================
  // SELECCION AUTOMATICA POR LADO
  //
  // left  = lado chofer
  // right = lado copiloto
  // ====================================================

  if (
    selected.length === 0 &&
    (
      zone === 'left' ||
      zone === 'right'
    )
  ) {

    const sideSeats =
      freeSeats.filter(
        seat =>
          seat.physicalSide ===
            zone
      );


    if (
      sideSeats.length < 1
    ) {

      fail(
        'failed-precondition',
        zone === 'left'
          ? 'No quedan lugares disponibles del lado del chofer.'
          : 'No quedan lugares disponibles del lado del copiloto.'
      );
    }


    return sideSeats.map(
      seat =>
        seat.seatNumber
    );
  }


  const freeSet =
    new Set(
      freeSeats.map(
        seat =>
          seat.seatNumber
      )
    );


  const freeSeatByNumber =
    new Map(
      freeSeats.map(
        seat => [
          seat.seatNumber,
          seat
        ]
      )
    );


  for (
    const number of
    selected
  ) {

    if (
      number > capacity
    ) {

      fail(
        'invalid-argument',
        `El asiento ${number} excede la capacidad del vehículo.`
      );
    }


    if (
      !freeSet.has(
        number
      )
    ) {

      fail(
        'failed-precondition',
        `El asiento ${number} ya no está disponible.`
      );
    }


    // Cuando se declara un lado físico,
    // cada asiento manual debe pertenecer
    // realmente a ese lado.
    if (
      zone === 'left' ||
      zone === 'right'
    ) {

      const seat =
        freeSeatByNumber.get(
          number
        );


      if (
        seat?.physicalSide !==
          zone
      ) {

        fail(
          'invalid-argument',
          zone === 'left'
            ? `El asiento ${number} no pertenece al lado del chofer.`
            : `El asiento ${number} no pertenece al lado del copiloto.`
        );
      }
    }
  }


  return selected;
}


// ======================================================
// ID
// ======================================================

function allocationIdFor(
  actorUid,
  vehicleId,
  requestId
) {

  return hash(
    actorUid,
    vehicleId,
    requestId,
    'event-transport-allocation-v1'
  );
}


// ======================================================
// CALLER
// ======================================================

async function loadCaller(
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
      db.collection(
        'usuarios'
      ).doc(
        request.auth.uid
      )
    );


  if (
    !snapshot.exists
  ) {

    fail(
      'permission-denied',
      'Perfil no disponible.'
    );
  }


  const profile = {
    ...snapshot.data(),
    uid:
      snapshot.id
  };


  if (
    profile.active !==
      true ||
    !profile.campaignId
  ) {

    fail(
      'permission-denied',
      'Perfil no autorizado.'
    );
  }


  return profile;
}


// ======================================================
// INVITACION DEL DESTINATARIO
// ======================================================

async function findTargetInvitation(
  tx,
  db,
  targetProfile,
  event
) {

  if (
    targetProfile.uid ===
      event.createdBy
  ) {
    return null;
  }


  const snapshot =
    await tx.get(
      db.collection(
        'eventInvitations'
      )
        .where(
          'assignedTo',
          '==',
          targetProfile.uid
        )
        .limit(
          200
        )
    );


  const matches =
    snapshot.docs
      .map(
        doc => ({
          ...doc.data(),
          id:
            doc.id
        })
      )
      .filter(
        invitation =>
          invitation.active ===
            true &&
          invitation.eventId ===
            event.id &&
          invitation.campaignId ===
            event.campaignId
      );


  if (
    matches.length > 1
  ) {

    fail(
      'failed-precondition',
      'Existen múltiples invitaciones activas del destinatario para este evento.'
    );
  }


  return matches[0] ||
    null;
}


// ======================================================
// BUILD-118C-3B3E-3G-B4D2B
// DESTINATARIOS ELEGIBLES PARA REPARTO DE CUPOS
// ======================================================

function buildEventTransportAllocationTargets({
  event,
  invitations,
  profiles
}) {

  const safeInvitations =
    Array.isArray(
      invitations
    )
      ? invitations
      : [];


  const safeProfiles =
    Array.isArray(
      profiles
    )
      ? profiles
      : [];


  const invitationsByUid =
    new Map();


  for (
    const invitation of
    safeInvitations
  ) {

    if (
      !invitation ||
      invitation.active !==
        true ||
      invitation.eventId !==
        event.id ||
      invitation.campaignId !==
        event.campaignId ||
      typeof invitation.assignedTo !==
        'string' ||
      !invitation.assignedTo.trim()
    ) {

      continue;
    }


    const uid =
      invitation.assignedTo.trim();


    const current =
      invitationsByUid.get(
        uid
      ) || [];


    current.push(
      invitation
    );


    invitationsByUid.set(
      uid,
      current
    );
  }


  const targets = [];


  for (
    const profile of
    safeProfiles
  ) {

    if (
      !profile ||
      typeof profile.uid !==
        'string' ||
      !profile.uid
    ) {

      continue;
    }


    let invitation =
      null;


    if (
      profile.uid !==
        event.createdBy
    ) {

      const matches =
        invitationsByUid.get(
          profile.uid
        ) || [];


      // El create real rechaza múltiples
      // invitaciones activas. No ofrecerlo
      // en la interfaz hasta corregir datos.
      if (
        matches.length !==
          1
      ) {

        continue;
      }


      invitation =
        matches[0];
    }


    if (
      !canReceiveAllocation(
        profile,
        event,
        invitation
      )
    ) {

      continue;
    }


    targets.push({
      uid:
        profile.uid,

      name:
        (
          profile.name ||
          profile.displayName ||
          ''
        ),

      role:
        profile.role ||
        '',

      structureId:
        profile.structureId ||
        '',

      structureName:
        profile.structureName ||
        '',

      municipalityId:
        profile.municipalityId ||
        '',

      municipalityName:
        profile.municipalityName ||
        '',

      invitationId:
        invitation
          ? invitation.id
          : null
    });
  }


  targets.sort(
    (a, b) =>
      String(
        a.name ||
        a.uid
      ).localeCompare(
        String(
          b.name ||
          b.uid
        ),
        'es',
        {
          sensitivity:
            'base'
        }
      )
  );


  return targets;
}


exports.getEventTransportAllocationTargets =
  onCall(
    OPTIONS,

    async request => {

      const input =
        request.data || {};


      const eventId =
        validId(
          input.eventId,
          'Evento'
        );


      const db =
        getFirestore();


      // ================================================
      // AUTORIZACION + EVENTO
      // ================================================

      const context =
        await db.runTransaction(
          async tx => {

            const profile =
              await loadCaller(
                tx,
                db,
                request
              );


            const eventSnapshot =
              await tx.get(
                db.collection(
                  'events'
                ).doc(
                  eventId
                )
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
              event.active !==
                true ||
              event.campaignId !==
                profile.campaignId
            ) {

              fail(
                'permission-denied',
                'Evento no disponible.'
              );
            }


            if (
              !canManageEventTransport(
                profile,
                event
              )
            ) {

              fail(
                'permission-denied',
                'No tienes autorización para repartir transporte en este evento.'
              );
            }


            return {
              profile,
              event
            };
          }
        );


      const {
        event
      } = context;


      // ================================================
      // INVITACIONES DEL EVENTO
      // ================================================

      const invitationsSnapshot =
        await db.collection(
          'eventInvitations'
        )
          .where(
            'eventId',
            '==',
            event.id
          )
          .get();


      const invitations =
        invitationsSnapshot.docs
          .map(
            doc => ({
              ...doc.data(),

              id:
                doc.id
            })
          )
          .filter(
            invitation =>
              invitation.active ===
                true &&
              invitation.campaignId ===
                event.campaignId &&
              typeof invitation.assignedTo ===
                'string' &&
              Boolean(
                invitation.assignedTo
                  .trim()
              )
          );


      // ================================================
      // UIDs POSIBLES
      // ================================================

      const uidSet =
        new Set();


      if (
        typeof event.createdBy ===
          'string' &&
        event.createdBy
      ) {

        uidSet.add(
          event.createdBy
        );
      }


      for (
        const invitation of
        invitations
      ) {

        uidSet.add(
          invitation.assignedTo
            .trim()
        );
      }


      const refs =
        Array.from(
          uidSet
        ).map(
          uid =>
            db.collection(
              'usuarios'
            ).doc(
              uid
            )
        );


      // ================================================
      // PERFILES
      // ================================================

      const profiles = [];


      for (
        let offset = 0;
        offset < refs.length;
        offset += 100
      ) {

        const part =
          refs.slice(
            offset,
            offset + 100
          );


        if (!part.length) {

          continue;
        }


        const snapshots =
          await db.getAll(
            ...part
          );


        for (
          const snapshot of
          snapshots
        ) {

          if (
            !snapshot.exists
          ) {

            continue;
          }


          profiles.push({
            ...snapshot.data(),

            uid:
              snapshot.id
          });
        }
      }


      const targets =
        buildEventTransportAllocationTargets({
          event,
          invitations,
          profiles
        });


      return {
        success:
          true,

        eventId:
          event.id,

        total:
          targets.length,

        targets
      };
    }
  );


// ======================================================
// CREATE ALLOCATION
// ======================================================

exports.createEventTransportAllocation =
  onCall(
    OPTIONS,

    async request => {

      const input =
        request.data || {};


      const vehicleId =
        validId(
          input.vehicleId,
          'Vehículo'
        );


      const targetUserId =
        validId(
          input.allocatedToUserId,
          'Destinatario'
        );


      const requestId =
        validRequestId(
          input.requestId
        );


      const type =
        allocationType(
          input.allocationType
        );


      const zone =
        allocationZone(
          input.zone
        );


      const customZoneLabel =
        optionalText(
          input.customZoneLabel,
          100
        );


      let requested =
        null;


      let selectedSeatNumbers =
        [];


      if (
        type ===
          'capacity_block'
      ) {

        requested =
          requestedCapacity(
            input.allocatedCapacity
          );
      }


      if (
        type ===
          'seat_selection'
      ) {

        const suppliedSeatNumbers =
          Array.isArray(
            input.seatNumbers
          )
            ? input.seatNumbers
            : [];


        if (
          suppliedSeatNumbers.length >
            0
        ) {

          selectedSeatNumbers =
            normalizeSeatNumbers(
              suppliedSeatNumbers
            );

        } else if (
          zone !== 'left' &&
          zone !== 'right'
        ) {

          fail(
            'invalid-argument',
            'Selecciona asientos concretos o indica el lado del chofer/copiloto.'
          );
        }
      }


      if (
        type !==
          'seat_selection' &&
        zone !==
          'none'
      ) {

        fail(
          'invalid-argument',
          'La zona izquierda/derecha requiere seleccionar asientos concretos.'
        );
      }


      if (
        zone ===
          'custom' &&
        !customZoneLabel
      ) {

        fail(
          'invalid-argument',
          'Describe la zona personalizada.'
        );
      }


      const db =
        getFirestore();


      return db.runTransaction(
        async tx => {

          // ==============================================
          // ACTOR
          // ==============================================

          const profile =
            await loadCaller(
              tx,
              db,
              request
            );


          // ==============================================
          // VEHICULO
          // ==============================================

          const vehicleRef =
            db.collection(
              'eventTransportVehicles'
            ).doc(
              vehicleId
            );


          const vehicleSnapshot =
            await tx.get(
              vehicleRef
            );


          if (
            !vehicleSnapshot.exists
          ) {

            fail(
              'not-found',
              'El vehículo no existe.'
            );
          }


          const vehicle = {
            ...vehicleSnapshot.data(),
            id:
              vehicleSnapshot.id
          };


          if (
            vehicle.active !==
              true ||
            vehicle.campaignId !==
              profile.campaignId
          ) {

            fail(
              'permission-denied',
              'Vehículo no disponible.'
            );
          }


          // ==============================================
          // EVENTO
          // ==============================================

          const eventSnapshot =
            await tx.get(
              db.collection(
                'events'
              ).doc(
                vehicle.eventId
              )
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
            !canManageEventTransport(
              profile,
              event
            )
          ) {

            fail(
              'permission-denied',
              'No tienes autorización para repartir transporte en este evento.'
            );
          }


          // ==============================================
          // DESTINATARIO DEL CUPO
          // ==============================================

          const targetSnapshot =
            await tx.get(
              db.collection(
                'usuarios'
              ).doc(
                targetUserId
              )
            );


          if (
            !targetSnapshot.exists
          ) {

            fail(
              'not-found',
              'El responsable del cupo no existe.'
            );
          }


          const target = {
            ...targetSnapshot.data(),
            uid:
              targetSnapshot.id
          };


          const targetInvitation =
            await findTargetInvitation(
              tx,
              db,
              target,
              event
            );


          if (
            !canReceiveAllocation(
              target,
              event,
              targetInvitation
            )
          ) {

            fail(
              'permission-denied',
              'El destinatario no pertenece a la operación de este evento.'
            );
          }


          // ==============================================
          // ASIENTOS DEL VEHICULO
          // ==============================================

          const seatsSnapshot =
            await tx.get(
              db.collection(
                'eventTransportSeats'
              )
                .where(
                  'vehicleId',
                  '==',
                  vehicleId
                )
          );


          const seats =
            seatsSnapshot.docs.map(
              doc => ({
                ...doc.data(),
                id:
                  doc.id,
                ref:
                  doc.ref
              })
            );


          if (
            seats.length !==
              vehicle.capacity
          ) {

            fail(
              'failed-precondition',
              'La capacidad del vehículo no coincide con sus asientos registrados.'
            );
          }


          // ==============================================
          // IDENTIDAD IDEMPOTENTE
          // ==============================================

          const allocationId =
            allocationIdFor(
              profile.uid,
              vehicleId,
              requestId
            );


          const allocationRef =
            db.collection(
              'eventTransportAllocations'
            ).doc(
              allocationId
            );


          const existing =
            await tx.get(
              allocationRef
            );


          const fingerprint =
            hash(
              vehicleId,
              targetUserId,
              type,
              requested,
              selectedSeatNumbers,
              zone,
              customZoneLabel
            );


          if (
            existing.exists
          ) {

            const saved =
              existing.data();


            if (
              saved.requestFingerprint !==
                fingerprint ||
              saved.createdByUserId !==
                profile.uid
            ) {

              fail(
                'already-exists',
                'Este identificador de operación ya fue utilizado con otros datos.'
              );
            }


            return {
              success:
                true,

              idempotent:
                true,

              allocation: {
                id:
                  allocationId,

                vehicleId:
                  saved.vehicleId,

                eventId:
                  saved.eventId,

                allocationType:
                  saved.allocationType,

                allocatedCapacity:
                  saved.allocatedCapacity,

                seatNumbers:
                  saved.seatNumbers,

                zone:
                  saved.zone,

                allocatedToUserId:
                  saved.allocatedToUserId
              }
            };
          }


          // ==============================================
          // ELEGIR ASIENTOS
          // ==============================================

          const chosenNumbers =
            chooseSeatNumbers({
              type,
              capacity:
                vehicle.capacity,
              requested,
              selectedSeatNumbers,
              zone,
              seats
            });


          if (
            chosenNumbers.length <
              1
          ) {

            fail(
              'failed-precondition',
              'No se seleccionaron lugares para el cupo.'
            );
          }


          const chosenSet =
            new Set(
              chosenNumbers
            );


          const chosenSeats =
            seats.filter(
              seat =>
                chosenSet.has(
                  seat.seatNumber
                )
            );


          if (
            chosenSeats.length !==
              chosenNumbers.length
          ) {

            fail(
              'failed-precondition',
              'No fue posible localizar todos los asientos seleccionados.'
            );
          }


          const currentAllocated =
            seats.filter(
              seat =>
                Boolean(
                  seat.allocationId
                )
            ).length;


          const allocatedAfter =
            currentAllocated +
            chosenSeats.length;


          const availableAfter =
            vehicle.capacity -
            allocatedAfter;


          if (
            availableAfter < 0
          ) {

            fail(
              'failed-precondition',
              'La asignación excedería la capacidad física del vehículo.'
            );
          }


          // ==============================================
          // TODAS LAS LECTURAS TERMINARON
          // ==============================================

          const serverNow =
            FieldValue
              .serverTimestamp();


          const allocationRecord = {
            id:
              allocationId,

            campaignId:
              profile.campaignId,

            eventId:
              event.id,

            vehicleId,

            requestId,

            requestFingerprint:
              fingerprint,

            allocationType:
              type,

            allocatedCapacity:
              chosenSeats.length,

            seatIds:
              chosenSeats.map(
                seat =>
                  seat.id
              ),

            seatNumbers:
              chosenNumbers,

            zone,

            customZoneLabel,

            allocatedToUserId:
              target.uid,

            allocatedToName:
              target.name ||
              '',

            allocatedToRole:
              target.role ||
              '',

            allocatedToStructureId:
              target.structureId ||
              '',

            allocatedToStructureName:
              target.structureName ||
              '',

            allocatedToMunicipalityId:
              target.municipalityId ||
              '',

            allocatedToMunicipalityName:
              target.municipalityName ||
              '',

            targetInvitationId:
              targetInvitation
                ? targetInvitation.id
                : null,

            createdByUserId:
              profile.uid,

            createdByName:
              profile.name ||
              '',

            createdByRole:
              profile.role,

            active:
              true,

            version:
              1,

            createdAt:
              serverNow,

            updatedAt:
              serverNow
          };


          tx.create(
            allocationRef,
            allocationRecord
          );


          // ==============================================
          // RESERVAR ASIENTOS PARA EL CUPO
          // ==============================================

          for (
            const seat of
            chosenSeats
          ) {

            tx.update(
              seat.ref,
              {
                status:
                  'allocated',

                allocationId,

                allocatedToUserId:
                  target.uid,

                allocatedToRole:
                  target.role ||
                  '',

                allocatedToStructureId:
                  target.structureId ||
                  '',

                allocatedToMunicipalityId:
                  target.municipalityId ||
                  '',

                allocationZone:
                  zone,

                updatedAt:
                  serverNow,

                version:
                  Number(
                    seat.version
                  ) + 1 ||
                  2
              }
            );
          }


          // ==============================================
          // CONTADORES VEHICULO
          // ==============================================

          tx.update(
            vehicleRef,
            {
              allocatedSeatCount:
                allocatedAfter,

              availableSeatCount:
                availableAfter,

              updatedAt:
                serverNow,

              version:
                Number(
                  vehicle.version
                ) + 1 ||
                2
            }
          );


          // ==============================================
          // AUDITORIA
          // ==============================================

          tx.create(
            db.collection(
              'logs'
            ).doc(),
            {
              action:
                'EVENT_TRANSPORT_ALLOCATION_CREATED',

              campaignId:
                profile.campaignId,

              eventId:
                event.id,

              vehicleId,

              allocationId,

              allocationType:
                type,

              allocatedCapacity:
                chosenSeats.length,

              seatNumbers:
                chosenNumbers,

              zone,

              allocatedToUserId:
                target.uid,

              allocatedToRole:
                target.role ||
                '',

              allocatedToStructureId:
                target.structureId ||
                '',

              actorUid:
                profile.uid,

              actorRole:
                profile.role,

              createdAt:
                serverNow,

              version:
                1
            }
          );


          return {
            success:
              true,

            idempotent:
              false,

            allocation: {
              id:
                allocationId,

              eventId:
                event.id,

              vehicleId,

              allocationType:
                type,

              allocatedCapacity:
                chosenSeats.length,

              seatNumbers:
                chosenNumbers,

              zone,

              allocatedToUserId:
                target.uid,

              allocatedToName:
                target.name ||
                '',

              allocatedToRole:
                target.role ||
                '',

              allocatedToStructureId:
                target.structureId ||
                '',

              vehicleAllocatedSeatCount:
                allocatedAfter,

              vehicleAvailableSeatCount:
                availableAfter
            }
          };
        }
      );
    }
  );


// ======================================================
// TEST HELPERS
// ======================================================

exports._test = {
  ALLOCATION_TYPES,
  ALLOCATION_ZONES,
  ALLOCATION_TARGET_ROLES,
  buildEventTransportAllocationTargets,
  canManageEventTransport,
  canReceiveAllocation,
  chooseSeatNumbers,
  allocationIdFor
};
