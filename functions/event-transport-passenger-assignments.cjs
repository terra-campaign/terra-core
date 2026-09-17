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
  require(
    'node:crypto'
  );


const OPTIONS = {
  region:
    'us-central1',

  timeoutSeconds:
    60
};


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


function validSeatNumber(
  value
) {

  const seatNumber =
    Number(
      value
    );


  if (
    !Number.isInteger(
      seatNumber
    ) ||
    seatNumber < 1 ||
    seatNumber > 120
  ) {

    fail(
      'invalid-argument',
      'Número de asiento inválido.'
    );
  }


  return seatNumber;
}


// ======================================================
// AUTORIDAD LOGISTICA GENERAL
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
// AUTORIDAD PARA ASIGNAR PERSONAS
//
// Puede hacerlo:
//
// A) creador / transport manager;
// B) responsable del allocation.
//
// Un responsable ordinario NO administra allocations
// pertenecientes a otra rama.
// ======================================================

function canAssignPassengers(
  profile,
  event,
  allocation
) {

  if (
    !profile ||
    !event ||
    !allocation ||
    profile.active !==
      true ||
    allocation.active !==
      true ||
    profile.campaignId !==
      event.campaignId ||
    allocation.campaignId !==
      event.campaignId ||
    allocation.eventId !==
      event.id
  ) {

    return false;
  }


  if (
    canManageEventTransport(
      profile,
      event
    )
  ) {

    return true;
  }


  return (
    allocation
      .allocatedToUserId ===
    profile.uid
  );
}


// ======================================================
// PERSONA DENTRO DE LA RAMA DEL CUPO
//
// La identidad primaria siempre es personId.
//
// accountUid puede existir o ser null.
//
// Se admite:
// - propio responsable del cupo;
// - subordinado directo;
// - descendiente territorial.
//
// Además respetamos estructura/municipio cuando el
// allocation los tiene definidos.
// ======================================================

function personBelongsToAllocationBranch({
  person,
  membership,
  allocation
}) {

  if (
    !person ||
    !membership ||
    !allocation ||
    person.active !==
      true ||
    membership.active !==
      true ||
    person.campaignId !==
      allocation.campaignId ||
    membership.campaignId !==
      allocation.campaignId
  ) {

    return false;
  }


  if (
    allocation
      .allocatedToStructureId &&
    membership.structureId !==
      allocation
        .allocatedToStructureId
  ) {

    return false;
  }


  if (
    allocation
      .allocatedToMunicipalityId &&
    membership.municipalityId !==
      allocation
        .allocatedToMunicipalityId
  ) {

    return false;
  }


  const responsibleUid =
    allocation
      .allocatedToUserId;


  if (!responsibleUid) {
    return false;
  }


  // El responsable puede ocupar uno de
  // sus propios lugares.
  if (
    person.accountUid ===
      responsibleUid
  ) {

    return true;
  }


  // Subordinado directo.
  if (
    membership.parentUserId ===
      responsibleUid
  ) {

    return true;
  }


  // Descendiente de la rama.
  return (
    Array.isArray(
      membership.ancestorUserIds
    ) &&
    membership.ancestorUserIds
      .includes(
        responsibleUid
      )
  );
}


// ======================================================
// ASIENTO ELEGIBLE
// ======================================================

function seatCanReceivePassenger({
  seat,
  allocation,
  seatNumber
}) {

  return Boolean(
    seat &&
    allocation &&
    seat.active ===
      true &&
    seat.seatNumber ===
      seatNumber &&
    seat.allocationId ===
      allocation.id &&
    seat.status ===
      'allocated' &&
    !seat.assignmentId &&
    !seat.personId &&
    !seat.accountUid
  );
}


// ======================================================
// RESOLVER ASIENTO REAL
//
// IMPORTANTE:
//
// NO se relacionan seatNumbers[] y seatIds[] por índice.
//
// Una consulta Firestore no garantiza el mismo orden
// utilizado por chosenNumbers al crear el allocation.
//
// La fuente de verdad es:
//
// vehicleId + seatNumber + allocationId
// ======================================================

function resolveAllocatedSeat({
  seats,
  allocation,
  vehicleId,
  seatNumber
}) {

  const allowedNumbers =
    Array.isArray(
      allocation?.seatNumbers
    )
      ? allocation.seatNumbers
      : [];


  if (
    !allowedNumbers.includes(
      seatNumber
    )
  ) {

    fail(
      'permission-denied',
      'El asiento no pertenece a este cupo.'
    );
  }


  const matches =
    Array.isArray(
      seats
    )
      ? seats.filter(
          seat =>
            seat &&
            seat.active ===
              true &&
            seat.vehicleId ===
              vehicleId &&
            seat.seatNumber ===
              seatNumber &&
            seat.allocationId ===
              allocation.id
        )
      : [];


  if (
    matches.length !==
      1
  ) {

    fail(
      'failed-precondition',
      'No fue posible resolver de forma única el asiento dentro del cupo.'
    );
  }


  return matches[0];
}


// ======================================================
// IDENTIDAD DEL PASSENGER ASSIGNMENT
//
// UNA PERSONA -> MAXIMO UN ASIENTO POR EVENTO.
//
// Por eso NO usamos seatNumber en el ID.
// ======================================================

function assignmentIdFor(
  eventId,
  personId
) {

  return hash(
    eventId,
    personId,
    'event-transport-passenger-assignment-v1'
  );
}


// ======================================================
// VISTA
// ======================================================

function assignmentView(
  assignment
) {

  return {
    id:
      assignment.id,

    eventId:
      assignment.eventId,

    vehicleId:
      assignment.vehicleId,

    allocationId:
      assignment.allocationId,

    seatId:
      assignment.seatId,

    seatNumber:
      assignment.seatNumber,

    personId:
      assignment.personId,

    accountUid:
      assignment.accountUid ||
      null,

    personName:
      assignment.personName ||
      '',

    status:
      assignment.status,

    confirmationStatus:
      assignment.confirmationStatus,

    boardingStatus:
      assignment.boardingStatus
  };
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
// CREATE PASSENGER ASSIGNMENT
// ======================================================

exports.createEventTransportPassengerAssignment =
  onCall(
    OPTIONS,

    async request => {

      const input =
        request.data ||
        {};


      const allocationId =
        validId(
          input.allocationId,
          'Cupo'
        );


      const personId =
        validId(
          input.personId,
          'Persona'
        );


      const seatNumber =
        validSeatNumber(
          input.seatNumber
        );


      const requestId =
        validRequestId(
          input.requestId
        );


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
          // ALLOCATION
          // ==============================================

          const allocationRef =
            db.collection(
              'eventTransportAllocations'
            ).doc(
              allocationId
            );


          const allocationSnapshot =
            await tx.get(
              allocationRef
            );


          if (
            !allocationSnapshot.exists
          ) {

            fail(
              'not-found',
              'El cupo de transporte no existe.'
            );
          }


          const allocation = {
            ...allocationSnapshot.data(),
            id:
              allocationSnapshot.id
          };


          if (
            allocation.active !==
              true ||
            allocation.campaignId !==
              profile.campaignId
          ) {

            fail(
              'permission-denied',
              'Cupo de transporte no disponible.'
            );
          }


          // ==============================================
          // VEHICULO
          // ==============================================

          const vehicleId =
            validId(
              allocation.vehicleId,
              'Vehículo'
            );


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
              profile.campaignId ||
            vehicle.eventId !==
              allocation.eventId
          ) {

            fail(
              'failed-precondition',
              'El vehículo no corresponde al cupo.'
            );
          }


          // ==============================================
          // EVENTO
          // ==============================================

          const eventId =
            validId(
              allocation.eventId,
              'Evento'
            );


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
            !canAssignPassengers(
              profile,
              event,
              allocation
            )
          ) {

            fail(
              'permission-denied',
              'No tienes autorización para asignar pasajeros a este cupo.'
            );
          }


          // ==============================================
          // LOCALIZAR ASIENTO DENTRO DEL ALLOCATION
          // ==============================================

          const seatNumbers =
            Array.isArray(
              allocation.seatNumbers
            )
              ? allocation.seatNumbers
              : [];


          if (
            !seatNumbers.includes(
              seatNumber
            )
          ) {

            fail(
              'permission-denied',
              'El asiento no pertenece a este cupo.'
            );
          }


          // No usamos allocation.seatIds por posición.
          //
          // Buscamos los asientos físicos del vehículo
          // y resolvemos por seatNumber + allocationId.
          const vehicleSeatsQuery =
            db.collection(
              'eventTransportSeats'
            )
              .where(
                'vehicleId',
                '==',
                vehicleId
              );


          // ==============================================
          // PERSONA + MEMBERSHIP + IDEMPOTENCIA
          //
          // TODAVIA NO ESCRIBIMOS NADA.
          // ==============================================

          const personRef =
            db.collection(
              'persons'
            ).doc(
              personId
            );


          const membershipsQuery =
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
              );


          const assignmentId =
            assignmentIdFor(
              event.id,
              personId
            );


          const assignmentRef =
            db.collection(
              'eventTransportAssignments'
            ).doc(
              assignmentId
            );


          const [
            vehicleSeatsSnapshot,
            personSnapshot,
            membershipsSnapshot,
            existingAssignmentSnapshot
          ] =
            await Promise.all([
              tx.get(
                vehicleSeatsQuery
              ),

              tx.get(
                personRef
              ),

              tx.get(
                membershipsQuery
              ),

              tx.get(
                assignmentRef
              )
            ]);


          const vehicleSeats =
            vehicleSeatsSnapshot.docs
              .map(
                doc => ({
                  ...doc.data(),

                  id:
                    doc.id,

                  ref:
                    doc.ref
                })
              );


          const seat =
            resolveAllocatedSeat({
              seats:
                vehicleSeats,

              allocation,

              vehicleId,

              seatNumber
            });


          const seatId =
            seat.id;


          const seatRef =
            seat.ref;


          // ==============================================
          // PERSONA
          // ==============================================

          if (
            !personSnapshot.exists
          ) {

            fail(
              'not-found',
              'La persona no existe.'
            );
          }


          const person = {
            ...personSnapshot.data(),
            personId:
              personSnapshot.id
          };


          if (
            person.active !==
              true ||
            person.campaignId !==
              profile.campaignId
          ) {

            fail(
              'failed-precondition',
              'La persona no está activa en esta campaña.'
            );
          }


          const memberships =
            membershipsSnapshot.docs
              .map(
                doc => ({
                  ...doc.data(),
                  membershipId:
                    doc.id
                })
              )
              .filter(
                membership =>
                  membership.active ===
                    true &&
                  membership.campaignId ===
                    profile.campaignId
              );


          if (
            memberships.length !==
              1
          ) {

            fail(
              'failed-precondition',
              'La persona debe tener una única membresía territorial activa en esta campaña.'
            );
          }


          const membership =
            memberships[0];


          if (
            !personBelongsToAllocationBranch({
              person,
              membership,
              allocation
            })
          ) {

            fail(
              'permission-denied',
              'La persona no pertenece a la rama territorial de este cupo.'
            );
          }


          // ==============================================
          // IDEMPOTENCIA / UNA PERSONA POR EVENTO
          //
          // PERSONA + EVENTO conserva un único
          // PassengerAssignment canónico.
          //
          // Si fue liberado, se reutiliza exactamente
          // el mismo assignmentId.
          // ==============================================

          const fingerprint =
            hash(
              allocation.id,
              seatNumber,
              personId
            );


          let existingAssignment =
            null;


          let isReactivation =
            false;


          if (
            existingAssignmentSnapshot
              .exists
          ) {

            existingAssignment = {
              ...existingAssignmentSnapshot
                .data(),

              id:
                assignmentId
            };


            // --------------------------------------------
            // ASSIGNMENT ACTIVO
            // --------------------------------------------

            if (
              existingAssignment.active ===
                true
            ) {

              if (
                existingAssignment
                  .requestFingerprint ===
                    fingerprint
              ) {

                return {

                  success:
                    true,

                  idempotent:
                    true,

                  reactivated:
                    (
                      Number(
                        existingAssignment
                          .reactivationCount
                      ) ||
                      0
                    ) > 0,

                  assignment:
                    assignmentView(
                      existingAssignment
                    )
                };
              }


              fail(
                'already-exists',
                'La persona ya tiene un asiento asignado para este evento.'
              );
            }


            // --------------------------------------------
            // ASSIGNMENT LIBERADO
            // --------------------------------------------

            if (
              assignmentCanReactivate(
                existingAssignment
              )
            ) {

              isReactivation =
                true;
            }
            else {

              fail(
                'failed-precondition',
                'La asignación existente no puede reactivarse.'
              );
            }
          }


          // ==============================================
          // ASIENTO
          // ==============================================

          if (
            !seatCanReceivePassenger({
              seat,
              allocation,
              seatNumber
            })
          ) {

            fail(
              'failed-precondition',
              'El asiento ya no está disponible para asignar una persona.'
            );
          }


          // ==============================================
          // CONTADORES
          // ==============================================

          const allocatedCapacity =
            Number(
              allocation
                .allocatedCapacity
            );


          if (
            !Number.isInteger(
              allocatedCapacity
            ) ||
            allocatedCapacity < 1
          ) {

            fail(
              'failed-precondition',
              'El cupo no tiene una capacidad válida.'
            );
          }


          const currentAssigned =
            Number(
              allocation
                .assignedSeatCount
            ) ||
            0;


          if (
            currentAssigned >=
              allocatedCapacity
          ) {

            fail(
              'failed-precondition',
              'El cupo ya no tiene asientos disponibles para asignar personas.'
            );
          }


          const assignedAfter =
            currentAssigned +
            1;


          const remainingAfter =
            allocatedCapacity -
            assignedAfter;


          const vehicleAssignedAfter =
            (
              Number(
                vehicle
                  .assignedSeatCount
              ) ||
              0
            ) +
            1;


          // ==============================================
          // TODAS LAS LECTURAS TERMINARON
          // ==============================================

          const serverNow =
            FieldValue
              .serverTimestamp();


          const accountUid =
            typeof person.accountUid ===
              'string' &&
            person.accountUid.trim()
              ? person.accountUid.trim()
              : null;


          const personName =
            typeof person.name ===
              'string'
              ? person.name.trim()
              : '';


          const assignmentRecord = {

            id:
              assignmentId,

            campaignId:
              profile.campaignId,

            eventId:
              event.id,

            vehicleId:
              vehicle.id,

            allocationId:
              allocation.id,

            seatId:
              seat.id,

            seatNumber,

            personId,

            accountUid,

            personName,

            membershipId:
              membership
                .membershipId,

            membershipRole:
              membership.role ||
              '',

            status:
              'assigned',

            // B3A no interpreta estos estados
            // como cumplimiento real.
            confirmationStatus:
              'pending',

            boardingStatus:
              'pending',

            requestId,

            requestFingerprint:
              fingerprint,

            assignedByUserId:
              profile.uid,

            assignedByName:
              profile.name ||
              '',

            assignedByRole:
              profile.role,

            active:
              true,

            reactivationCount:
              isReactivation
                ? (
                    (
                      Number(
                        existingAssignment
                          ?.reactivationCount
                      ) ||
                      0
                    ) +
                    1
                  )
                : 0,

            reactivatedAt:
              isReactivation
                ? serverNow
                : null,

            reactivatedFromReleaseId:
              isReactivation
                ? (
                    existingAssignment
                      ?.lastReleaseId ||
                    null
                  )
                : null,

            version:
              isReactivation
                ? (
                    (
                      Number(
                        existingAssignment
                          ?.version
                      ) ||
                      0
                    ) +
                    1
                  )
                : 1,

            createdAt:
              isReactivation
                ? (
                    existingAssignment
                      ?.createdAt ||
                    serverNow
                  )
                : serverNow,

            updatedAt:
              serverNow
          };


          // ==============================================
          // CREAR PASSENGER ASSIGNMENT
          // ==============================================

          if (
            isReactivation
          ) {

            tx.update(
              assignmentRef,
              assignmentRecord
            );
          }
          else {

            tx.create(
              assignmentRef,
              assignmentRecord
            );
          }


          // ==============================================
          // OCUPAR LOGICAMENTE EL ASIENTO
          //
          // NO modifica occupiedCount.
          // "assigned" NO significa "boarded".
          // ==============================================

          tx.update(
            seatRef,
            {

              status:
                'assigned',

              assignmentId,

              personId,

              accountUid,

              assignedByUserId:
                profile.uid,

              assignedAt:
                serverNow,

              updatedAt:
                serverNow,

              version:
                Number(
                  seat.version
                ) + 1 ||
                2
            }
          );


          // ==============================================
          // CONTADORES DEL ALLOCATION
          // ==============================================

          tx.update(
            allocationRef,
            {

              assignedSeatCount:
                assignedAfter,

              remainingAssignableSeatCount:
                remainingAfter,

              updatedAt:
                serverNow,

              version:
                Number(
                  allocation.version
                ) + 1 ||
                2
            }
          );


          // ==============================================
          // CONTADOR DE PERSONAS ASIGNADAS AL VEHICULO
          //
          // allocatedSeatCount NO cambia.
          // availableSeatCount NO cambia.
          // occupiedCount NO cambia.
          // ==============================================

          tx.update(
            vehicleRef,
            {

              assignedSeatCount:
                vehicleAssignedAfter,

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
                isReactivation
                  ? 'EVENT_TRANSPORT_PASSENGER_REASSIGNED'
                  : 'EVENT_TRANSPORT_PASSENGER_ASSIGNED',

              campaignId:
                profile.campaignId,

              eventId:
                event.id,

              vehicleId:
                vehicle.id,

              allocationId:
                allocation.id,

              assignmentId,

              seatId:
                seat.id,

              seatNumber,

              personId,

              accountUid,

              personName,

              assignedByUserId:
                profile.uid,

              assignedByRole:
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

            reactivated:
              isReactivation,

            assignment:
              assignmentView(
                assignmentRecord
              ),

            allocationAssignedSeatCount:
              assignedAfter,

            allocationRemainingSeatCount:
              remainingAfter,

            vehicleAssignedSeatCount:
              vehicleAssignedAfter,

            // Importante:
            // no incrementamos abordaje.
            vehicleOccupiedCount:
              Number(
                vehicle.occupiedCount
              ) ||
              0
          };
        }
      );
    }
  );


// ======================================================
// B3B3-A — REACTIVACION DE PASSENGER ASSIGNMENT
//
// Solo puede reactivarse una asignación:
// - inactive
// - released
// - sin asiento actual
// - no confirmada
// - no abordada
// ======================================================

function assignmentCanReactivate(
  assignment
) {

  return Boolean(
    assignment &&
    assignment.active ===
      false &&
    assignment.status ===
      'released' &&
    !assignment.seatId &&
    (
      assignment.seatNumber ===
        null ||
      assignment.seatNumber ===
        undefined
    ) &&
    assignment.confirmationStatus ===
      'pending' &&
    assignment.boardingStatus ===
      'pending'
  );
}


// ======================================================
// B3B2 — CAMBIO DE ASIENTO
//
// La persona y el PassengerAssignment permanecen.
//
// asiento anterior:
//   assigned -> allocated
//
// asiento nuevo:
//   allocated -> assigned
//
// assignedSeatCount NO cambia.
// remainingAssignableSeatCount NO cambia.
// occupiedCount NO cambia.
//
// En esta fase solamente se permite antes de:
// - confirmación
// - abordaje
// ======================================================

function assignmentCanMove(
  assignment
) {

  return Boolean(
    assignment &&
    assignment.active ===
      true &&
    assignment.status ===
      'assigned' &&
    assignment.confirmationStatus ===
      'pending' &&
    assignment.boardingStatus ===
      'pending' &&
    assignment.personId &&
    assignment.seatId &&
    Number.isInteger(
      assignment.seatNumber
    )
  );
}


function movementIdFor(
  assignmentId,
  requestId
) {

  return hash(
    assignmentId,
    requestId,
    'event-transport-passenger-movement-v1'
  );
}


// ======================================================
// MOVE EVENT TRANSPORT PASSENGER ASSIGNMENT
// ======================================================

exports.moveEventTransportPassengerAssignment =
  onCall(
    OPTIONS,

    async request => {

      const input =
        request.data ||
        {};


      const assignmentId =
        validId(
          input.assignmentId,
          'Asignación'
        );


      const targetSeatNumber =
        validSeatNumber(
          input.targetSeatNumber
        );


      const requestId =
        validRequestId(
          input.requestId
        );


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
          // PASSENGER ASSIGNMENT
          // ==============================================

          const assignmentRef =
            db.collection(
              'eventTransportAssignments'
            ).doc(
              assignmentId
            );


          const assignmentSnapshot =
            await tx.get(
              assignmentRef
            );


          if (
            !assignmentSnapshot.exists
          ) {

            fail(
              'not-found',
              'La asignación de pasajero no existe.'
            );
          }


          const assignment = {
            ...assignmentSnapshot.data(),

            id:
              assignmentSnapshot.id
          };


          if (
            assignment.campaignId !==
              profile.campaignId
          ) {

            fail(
              'permission-denied',
              'La asignación no pertenece a esta campaña.'
            );
          }


          // ==============================================
          // IDEMPOTENCIA ANTES DE VALIDAR ESTADO MUTABLE
          //
          // Un retry legítimo debe poder devolver el
          // resultado original aunque el primer intento
          // ya haya cambiado el asiento.
          // ==============================================

          // ==============================================
          // IDEMPOTENCIA DEL MOVIMIENTO
          // ==============================================

          const movementId =
            movementIdFor(
              assignmentId,
              requestId
            );


          const movementRef =
            db.collection(
              'eventTransportAssignmentMovements'
            ).doc(
              movementId
            );


          const movementSnapshot =
            await tx.get(
              movementRef
            );


          const fingerprint =
            hash(
              assignmentId,
              targetSeatNumber
            );


          if (
            movementSnapshot.exists
          ) {

            const saved =
              movementSnapshot.data();


            if (
              saved.requestFingerprint ===
                fingerprint &&
              saved.movedByUserId ===
                profile.uid
            ) {

              return {

                success:
                  true,

                idempotent:
                  true,

                movement: {

                  id:
                    movementId,

                  assignmentId,

                  personId:
                    saved.personId,

                  fromSeatNumber:
                    saved.fromSeatNumber,

                  toSeatNumber:
                    saved.toSeatNumber
                }
              };
            }


            fail(
              'already-exists',
              'Este identificador de operación ya fue utilizado con otros datos.'
            );
          }


          if (
            !assignmentCanMove(
              assignment
            )
          ) {

            fail(
              'failed-precondition',
              'La asignación ya no puede cambiarse de asiento.'
            );
          }


          if (
            assignment.seatNumber ===
              targetSeatNumber
          ) {

            fail(
              'invalid-argument',
              'La persona ya está asignada a ese asiento.'
            );
          }


          // ==============================================
          // ALLOCATION
          // ==============================================

          const allocationId =
            validId(
              assignment.allocationId,
              'Cupo'
            );


          const allocationRef =
            db.collection(
              'eventTransportAllocations'
            ).doc(
              allocationId
            );


          const allocationSnapshot =
            await tx.get(
              allocationRef
            );


          if (
            !allocationSnapshot.exists
          ) {

            fail(
              'not-found',
              'El cupo de transporte no existe.'
            );
          }


          const allocation = {
            ...allocationSnapshot.data(),

            id:
              allocationSnapshot.id
          };


          if (
            allocation.active !==
              true ||
            allocation.campaignId !==
              profile.campaignId ||
            allocation.eventId !==
              assignment.eventId ||
            allocation.vehicleId !==
              assignment.vehicleId
          ) {

            fail(
              'failed-precondition',
              'La asignación y el cupo ya no son consistentes.'
            );
          }


          // ==============================================
          // VEHICULO
          // ==============================================

          const vehicleId =
            validId(
              assignment.vehicleId,
              'Vehículo'
            );


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
              profile.campaignId ||
            vehicle.eventId !==
              assignment.eventId
          ) {

            fail(
              'failed-precondition',
              'El vehículo ya no corresponde a la asignación.'
            );
          }


          // ==============================================
          // EVENTO
          // ==============================================

          const eventId =
            validId(
              assignment.eventId,
              'Evento'
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
            !canAssignPassengers(
              profile,
              event,
              allocation
            )
          ) {

            fail(
              'permission-denied',
              'No tienes autorización para modificar pasajeros de este cupo.'
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


          // ==============================================
          // ASIENTO ACTUAL
          // ==============================================

          const currentSeatId =
            validId(
              assignment.seatId,
              'Asiento actual'
            );


          const currentSeat =
            seats.find(
              seat =>
                seat.id ===
                  currentSeatId
            );


          if (
            !currentSeat ||
            currentSeat.active !==
              true ||
            currentSeat.vehicleId !==
              vehicleId ||
            currentSeat.allocationId !==
              allocationId ||
            currentSeat.status !==
              'assigned' ||
            currentSeat.assignmentId !==
              assignmentId ||
            currentSeat.personId !==
              assignment.personId ||
            currentSeat.seatNumber !==
              assignment.seatNumber
          ) {

            fail(
              'failed-precondition',
              'El asiento actual no coincide con la asignación del pasajero.'
            );
          }


          // ==============================================
          // ASIENTO DESTINO
          // ==============================================

          const targetSeat =
            resolveAllocatedSeat({

              seats,

              allocation,

              vehicleId,

              seatNumber:
                targetSeatNumber
            });


          if (
            !seatCanReceivePassenger({

              seat:
                targetSeat,

              allocation,

              seatNumber:
                targetSeatNumber
            })
          ) {

            fail(
              'failed-precondition',
              'El asiento destino ya no está disponible.'
            );
          }


          // ==============================================
          // TODAS LAS LECTURAS TERMINARON
          // ==============================================

          const serverNow =
            FieldValue
              .serverTimestamp();


          const accountUid =
            assignment.accountUid ||
            null;


          // ==============================================
          // LIBERAR ASIENTO ANTERIOR DENTRO DEL CUPO
          //
          // Sigue reservado para allocation.
          // NO vuelve al pool general del vehículo.
          // ==============================================

          tx.update(
            currentSeat.ref,
            {

              status:
                'allocated',

              assignmentId:
                null,

              personId:
                null,

              accountUid:
                null,

              assignedByUserId:
                FieldValue.delete(),

              assignedAt:
                FieldValue.delete(),

              updatedAt:
                serverNow,

              version:
                Number(
                  currentSeat.version
                ) + 1 ||
                2
            }
          );


          // ==============================================
          // ASIGNAR NUEVO ASIENTO
          // ==============================================

          tx.update(
            targetSeat.ref,
            {

              status:
                'assigned',

              assignmentId,

              personId:
                assignment.personId,

              accountUid,

              assignedByUserId:
                profile.uid,

              assignedAt:
                serverNow,

              updatedAt:
                serverNow,

              version:
                Number(
                  targetSeat.version
                ) + 1 ||
                2
            }
          );


          // ==============================================
          // ACTUALIZAR MISMO PASSENGER ASSIGNMENT
          // ==============================================

          tx.update(
            assignmentRef,
            {

              seatId:
                targetSeat.id,

              seatNumber:
                targetSeatNumber,

              movedAt:
                serverNow,

              movedByUserId:
                profile.uid,

              lastMovementId:
                movementId,

              updatedAt:
                serverNow,

              version:
                Number(
                  assignment.version
                ) + 1 ||
                2
            }
          );


          // ==============================================
          // REGISTRO IDEMPOTENTE DEL MOVIMIENTO
          // ==============================================

          tx.create(
            movementRef,
            {

              id:
                movementId,

              campaignId:
                profile.campaignId,

              eventId:
                event.id,

              vehicleId:
                vehicle.id,

              allocationId:
                allocation.id,

              assignmentId,

              personId:
                assignment.personId,

              accountUid,

              personName:
                assignment.personName ||
                '',

              requestId,

              requestFingerprint:
                fingerprint,

              fromSeatId:
                currentSeat.id,

              fromSeatNumber:
                currentSeat.seatNumber,

              toSeatId:
                targetSeat.id,

              toSeatNumber:
                targetSeatNumber,

              movedByUserId:
                profile.uid,

              movedByName:
                profile.name ||
                '',

              movedByRole:
                profile.role,

              createdAt:
                serverNow,

              version:
                1
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
                'EVENT_TRANSPORT_PASSENGER_MOVED',

              campaignId:
                profile.campaignId,

              eventId:
                event.id,

              vehicleId:
                vehicle.id,

              allocationId:
                allocation.id,

              assignmentId,

              personId:
                assignment.personId,

              fromSeatId:
                currentSeat.id,

              fromSeatNumber:
                currentSeat.seatNumber,

              toSeatId:
                targetSeat.id,

              toSeatNumber:
                targetSeatNumber,

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

            movement: {

              id:
                movementId,

              assignmentId,

              personId:
                assignment.personId,

              personName:
                assignment.personName ||
                '',

              fromSeatNumber:
                currentSeat.seatNumber,

              toSeatNumber:
                targetSeatNumber
            },

            assignment: {

              id:
                assignmentId,

              personId:
                assignment.personId,

              accountUid,

              seatId:
                targetSeat.id,

              seatNumber:
                targetSeatNumber,

              status:
                assignment.status,

              confirmationStatus:
                assignment.confirmationStatus,

              boardingStatus:
                assignment.boardingStatus
            },

            counters: {

              allocationAssignedSeatCount:
                Number(
                  allocation
                    .assignedSeatCount
                ) ||
                0,

              allocationRemainingSeatCount:
                Number(
                  allocation
                    .remainingAssignableSeatCount
                ) ||
                0,

              vehicleAssignedSeatCount:
                Number(
                  vehicle
                    .assignedSeatCount
                ) ||
                0,

              vehicleOccupiedCount:
                Number(
                  vehicle
                    .occupiedCount
                ) ||
                0
            }
          };
        }
      );
    }
  );


// ======================================================
// B3B3-B — LIBERAR PASAJERO DEL ASIENTO
//
// IMPORTANTE:
//
// liberar pasajero
// != liberar cupo
// != abordar
// != asistir
//
// El asiento vuelve a estado "allocated" y continúa
// reservado al allocation.
//
// El PassengerAssignment NO se borra:
// queda released / inactive y B3A podrá reactivarlo.
// ======================================================

function assignmentCanRelease(
  assignment
) {

  return Boolean(
    assignment &&
    assignment.active ===
      true &&
    assignment.status ===
      'assigned' &&
    assignment.confirmationStatus ===
      'pending' &&
    assignment.boardingStatus ===
      'pending' &&
    assignment.personId &&
    assignment.seatId &&
    Number.isInteger(
      assignment.seatNumber
    )
  );
}


function releaseIdFor(
  assignmentId,
  requestId
) {

  return hash(
    assignmentId,
    requestId,
    'event-transport-passenger-release-v1'
  );
}


// ======================================================
// RELEASE EVENT TRANSPORT PASSENGER ASSIGNMENT
// ======================================================

exports.releaseEventTransportPassengerAssignment =
  onCall(
    OPTIONS,

    async request => {

      const input =
        request.data ||
        {};


      const assignmentId =
        validId(
          input.assignmentId,
          'Asignación'
        );


      const requestId =
        validRequestId(
          input.requestId
        );


      const releaseId =
        releaseIdFor(
          assignmentId,
          requestId
        );


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


          const assignmentRef =
            db.collection(
              'eventTransportAssignments'
            ).doc(
              assignmentId
            );


          const releaseRef =
            db.collection(
              'eventTransportAssignmentReleases'
            ).doc(
              releaseId
            );


          const [
            assignmentSnapshot,
            releaseSnapshot
          ] =
            await Promise.all([

              tx.get(
                assignmentRef
              ),

              tx.get(
                releaseRef
              )
            ]);


          // ==============================================
          // IDEMPOTENCIA PRIMERO
          //
          // Un retry legítimo debe funcionar aunque
          // el primer intento ya haya dejado:
          //
          // assignment.active = false
          // status = released
          // ==============================================

          if (
            releaseSnapshot.exists
          ) {

            const saved =
              releaseSnapshot.data();


            if (
              saved.campaignId ===
                profile.campaignId &&
              saved.assignmentId ===
                assignmentId &&
              saved.releasedByUserId ===
                profile.uid
            ) {

              return {

                success:
                  true,

                idempotent:
                  true,

                release: {

                  id:
                    releaseId,

                  assignmentId,

                  personId:
                    saved.personId,

                  personName:
                    saved.personName ||
                    '',

                  fromSeatId:
                    saved.fromSeatId,

                  fromSeatNumber:
                    saved.fromSeatNumber
                }
              };
            }


            fail(
              'already-exists',
              'Este identificador de liberación ya fue utilizado.'
            );
          }


          // ==============================================
          // ASSIGNMENT
          // ==============================================

          if (
            !assignmentSnapshot.exists
          ) {

            fail(
              'not-found',
              'La asignación de pasajero no existe.'
            );
          }


          const assignment = {
            ...assignmentSnapshot.data(),

            id:
              assignmentSnapshot.id
          };


          if (
            assignment.campaignId !==
              profile.campaignId
          ) {

            fail(
              'permission-denied',
              'La asignación no pertenece a esta campaña.'
            );
          }


          if (
            !assignmentCanRelease(
              assignment
            )
          ) {

            fail(
              'failed-precondition',
              'La asignación ya no puede liberarse en esta etapa.'
            );
          }


          // ==============================================
          // IDS CANONICOS
          // ==============================================

          const allocationId =
            validId(
              assignment.allocationId,
              'Cupo'
            );


          const vehicleId =
            validId(
              assignment.vehicleId,
              'Vehículo'
            );


          const eventId =
            validId(
              assignment.eventId,
              'Evento'
            );


          // ==============================================
          // REFERENCES
          // ==============================================

          const allocationRef =
            db.collection(
              'eventTransportAllocations'
            ).doc(
              allocationId
            );


          const vehicleRef =
            db.collection(
              'eventTransportVehicles'
            ).doc(
              vehicleId
            );


          const eventRef =
            db.collection(
              'events'
            ).doc(
              eventId
            );


          // ==============================================
          // LEER ALLOCATION / VEHICLE / EVENT
          // ==============================================

          const [
            allocationSnapshot,
            vehicleSnapshot,
            eventSnapshot
          ] =
            await Promise.all([

              tx.get(
                allocationRef
              ),

              tx.get(
                vehicleRef
              ),

              tx.get(
                eventRef
              )
            ]);


          if (
            !allocationSnapshot.exists
          ) {

            fail(
              'not-found',
              'El cupo de transporte no existe.'
            );
          }


          if (
            !vehicleSnapshot.exists
          ) {

            fail(
              'not-found',
              'El vehículo no existe.'
            );
          }


          if (
            !eventSnapshot.exists
          ) {

            fail(
              'not-found',
              'El evento no existe.'
            );
          }


          const allocation = {
            ...allocationSnapshot.data(),

            id:
              allocationSnapshot.id
          };


          const vehicle = {
            ...vehicleSnapshot.data(),

            id:
              vehicleSnapshot.id
          };


          const event = {
            ...eventSnapshot.data(),

            id:
              eventSnapshot.id
          };


          // ==============================================
          // CONSISTENCIA DE DOMINIO
          // ==============================================

          if (
            allocation.active !==
              true ||
            allocation.campaignId !==
              profile.campaignId ||
            allocation.eventId !==
              eventId ||
            allocation.vehicleId !==
              vehicleId
          ) {

            fail(
              'failed-precondition',
              'El cupo ya no corresponde a esta asignación.'
            );
          }


          if (
            vehicle.active !==
              true ||
            vehicle.campaignId !==
              profile.campaignId ||
            vehicle.eventId !==
              eventId
          ) {

            fail(
              'failed-precondition',
              'El vehículo ya no corresponde a esta asignación.'
            );
          }


          // ==============================================
          // AUTORIDAD
          // ==============================================

          if (
            !canAssignPassengers(
              profile,
              event,
              allocation
            )
          ) {

            fail(
              'permission-denied',
              'No tienes autorización para liberar pasajeros de este cupo.'
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


          // ==============================================
          // ASIENTO ACTUAL
          // ==============================================

          const currentSeat =
            seats.find(
              seat =>
                seat.id ===
                  assignment.seatId
            );


          if (
            !currentSeat ||
            currentSeat.active !==
              true ||
            currentSeat.vehicleId !==
              vehicleId ||
            currentSeat.allocationId !==
              allocationId ||
            currentSeat.status !==
              'assigned' ||
            currentSeat.assignmentId !==
              assignmentId ||
            currentSeat.personId !==
              assignment.personId ||
            currentSeat.seatNumber !==
              assignment.seatNumber
          ) {

            fail(
              'failed-precondition',
              'El asiento físico no coincide con la asignación.'
            );
          }


          // ==============================================
          // CONTADORES
          // ==============================================

          const allocatedCapacity =
            Number(
              allocation
                .allocatedCapacity
            );


          const currentAssigned =
            Number(
              allocation
                .assignedSeatCount
            ) ||
            0;


          const currentVehicleAssigned =
            Number(
              vehicle
                .assignedSeatCount
            ) ||
            0;


          if (
            !Number.isInteger(
              allocatedCapacity
            ) ||
            allocatedCapacity < 1
          ) {

            fail(
              'failed-precondition',
              'El cupo no tiene una capacidad válida.'
            );
          }


          if (
            currentAssigned < 1
          ) {

            fail(
              'failed-precondition',
              'El contador assignedSeatCount del cupo es inconsistente.'
            );
          }


          if (
            currentVehicleAssigned < 1
          ) {

            fail(
              'failed-precondition',
              'El contador assignedSeatCount del vehículo es inconsistente.'
            );
          }


          const assignedAfter =
            currentAssigned -
            1;


          const remainingAfter =
            allocatedCapacity -
            assignedAfter;


          const vehicleAssignedAfter =
            currentVehicleAssigned -
            1;


          // ==============================================
          // TODAS LAS LECTURAS TERMINARON
          // ==============================================

          const serverNow =
            FieldValue
              .serverTimestamp();


          // ==============================================
          // ASIENTO
          //
          // assigned -> allocated
          //
          // IMPORTANTE:
          // allocationId NO se toca.
          // ==============================================

          tx.update(
            currentSeat.ref,
            {

              status:
                'allocated',

              assignmentId:
                null,

              personId:
                null,

              accountUid:
                null,

              assignedByUserId:
                FieldValue.delete(),

              assignedAt:
                FieldValue.delete(),

              updatedAt:
                serverNow,

              version:
                (
                  Number(
                    currentSeat.version
                  ) ||
                  0
                ) +
                1
            }
          );


          // ==============================================
          // PASSENGER ASSIGNMENT
          //
          // Se conserva el documento canónico.
          // ==============================================

          tx.update(
            assignmentRef,
            {

              seatId:
                null,

              seatNumber:
                null,

              status:
                'released',

              active:
                false,

              lastReleaseId:
                releaseId,

              lastReleasedSeatId:
                currentSeat.id,

              lastReleasedSeatNumber:
                currentSeat.seatNumber,

              lastReleasedAt:
                serverNow,

              lastReleasedByUserId:
                profile.uid,

              lastReleasedByRole:
                profile.role,

              lastReleaseRequestId:
                requestId,

              updatedAt:
                serverNow,

              version:
                (
                  Number(
                    assignment.version
                  ) ||
                  0
                ) +
                1
            }
          );


          // ==============================================
          // ALLOCATION
          // ==============================================

          tx.update(
            allocationRef,
            {

              assignedSeatCount:
                assignedAfter,

              remainingAssignableSeatCount:
                remainingAfter,

              updatedAt:
                serverNow,

              version:
                (
                  Number(
                    allocation.version
                  ) ||
                  0
                ) +
                1
            }
          );


          // ==============================================
          // VEHICULO
          //
          // NO se modifica:
          // - allocatedSeatCount
          // - availableSeatCount
          // - occupiedCount
          // ==============================================

          tx.update(
            vehicleRef,
            {

              assignedSeatCount:
                vehicleAssignedAfter,

              updatedAt:
                serverNow,

              version:
                (
                  Number(
                    vehicle.version
                  ) ||
                  0
                ) +
                1
            }
          );


          // ==============================================
          // HISTORIAL INMUTABLE DE LIBERACION
          // ==============================================

          tx.create(
            releaseRef,
            {

              id:
                releaseId,

              campaignId:
                profile.campaignId,

              eventId:
                event.id,

              vehicleId:
                vehicle.id,

              allocationId:
                allocation.id,

              assignmentId,

              personId:
                assignment.personId,

              accountUid:
                assignment.accountUid ||
                null,

              personName:
                assignment.personName ||
                '',

              fromSeatId:
                currentSeat.id,

              fromSeatNumber:
                currentSeat.seatNumber,

              requestId,

              releasedByUserId:
                profile.uid,

              releasedByName:
                profile.name ||
                '',

              releasedByRole:
                profile.role,

              createdAt:
                serverNow,

              version:
                1
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
                'EVENT_TRANSPORT_PASSENGER_RELEASED',

              campaignId:
                profile.campaignId,

              eventId:
                event.id,

              vehicleId:
                vehicle.id,

              allocationId:
                allocation.id,

              assignmentId,

              releaseId,

              personId:
                assignment.personId,

              fromSeatId:
                currentSeat.id,

              fromSeatNumber:
                currentSeat.seatNumber,

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


          // ==============================================
          // RESPUESTA
          // ==============================================

          return {

            success:
              true,

            idempotent:
              false,

            release: {

              id:
                releaseId,

              assignmentId,

              personId:
                assignment.personId,

              personName:
                assignment.personName ||
                '',

              fromSeatId:
                currentSeat.id,

              fromSeatNumber:
                currentSeat.seatNumber
            },

            assignment: {

              id:
                assignmentId,

              personId:
                assignment.personId,

              status:
                'released',

              active:
                false,

              seatId:
                null,

              seatNumber:
                null,

              confirmationStatus:
                assignment
                  .confirmationStatus,

              boardingStatus:
                assignment
                  .boardingStatus
            },

            counters: {

              allocationAssignedSeatCount:
                assignedAfter,

              allocationRemainingSeatCount:
                remainingAfter,

              vehicleAssignedSeatCount:
                vehicleAssignedAfter,

              vehicleOccupiedCount:
                Number(
                  vehicle
                    .occupiedCount
                ) ||
                0
            }
          };
        }
      );
    }
  );


// ======================================================
// B3B1 — MANIFIESTO DEL CUPO
//
// Vista operacional de:
//
// allocation
//   -> asientos reservados
//   -> PassengerAssignments activos
//
// NO modifica datos.
// ======================================================

function buildAllocationManifest({
  allocation,
  seats,
  assignments
}) {

  const allowedSeatNumbers =
    new Set(
      Array.isArray(
        allocation?.seatNumbers
      )
        ? allocation.seatNumbers
        : []
    );


  const activeAssignments =
    Array.isArray(
      assignments
    )
      ? assignments.filter(
          assignment =>
            assignment &&
            assignment.active ===
              true &&
            assignment.allocationId ===
              allocation.id &&
            assignment.eventId ===
              allocation.eventId &&
            assignment.vehicleId ===
              allocation.vehicleId
        )
      : [];


  const assignmentsById =
    new Map(
      activeAssignments.map(
        assignment => [
          assignment.id,
          assignment
        ]
      )
    );


  const allocationSeats =
    (
      Array.isArray(
        seats
      )
        ? seats
        : []
    )
      .filter(
        seat =>
          seat &&
          seat.active ===
            true &&
          seat.vehicleId ===
            allocation.vehicleId &&
          seat.allocationId ===
            allocation.id &&
          allowedSeatNumbers.has(
            seat.seatNumber
          )
      )
      .sort(
        (a, b) =>
          a.seatNumber -
          b.seatNumber
      );


  const issues = [];


  const rows =
    allocationSeats.map(
      seat => {

        const assignment =
          seat.assignmentId
            ? assignmentsById.get(
                seat.assignmentId
              ) ||
              null
            : null;


        if (
          seat.status ===
            'assigned' &&
          !assignment
        ) {

          issues.push(
            `Asiento ${seat.seatNumber}: marcado assigned sin PassengerAssignment activo.`
          );
        }


        if (
          assignment &&
          (
            assignment.seatId !==
              seat.id ||
            assignment.seatNumber !==
              seat.seatNumber ||
            assignment.personId !==
              seat.personId
          )
        ) {

          issues.push(
            `Asiento ${seat.seatNumber}: PassengerAssignment no coincide con el asiento físico.`
          );
        }


        if (
          seat.status ===
            'allocated' &&
          (
            seat.assignmentId ||
            seat.personId
          )
        ) {

          issues.push(
            `Asiento ${seat.seatNumber}: estado allocated conserva identidad de pasajero.`
          );
        }


        return {

          seatId:
            seat.id,

          seatNumber:
            seat.seatNumber,

          seatLabel:
            seat.seatLabel ||
            String(
              seat.seatNumber
            ),

          physicalSide:
            seat.physicalSide ||
            null,

          status:
            seat.status ||
            null,

          assignmentId:
            seat.assignmentId ||
            null,

          personId:
            seat.personId ||
            null,

          accountUid:
            seat.accountUid ||
            null,

          passenger:
            assignment
              ? {
                  assignmentId:
                    assignment.id,

                  personId:
                    assignment.personId,

                  accountUid:
                    assignment.accountUid ||
                    null,

                  personName:
                    assignment.personName ||
                    '',

                  membershipRole:
                    assignment.membershipRole ||
                    '',

                  status:
                    assignment.status,

                  confirmationStatus:
                    assignment.confirmationStatus,

                  boardingStatus:
                    assignment.boardingStatus
                }
              : null
        };
      }
    );


  const representedAssignmentIds =
    new Set(
      rows
        .filter(
          row =>
            row.assignmentId
        )
        .map(
          row =>
            row.assignmentId
        )
    );


  for (
    const assignment of
    activeAssignments
  ) {

    if (
      !representedAssignmentIds.has(
        assignment.id
      )
    ) {

      issues.push(
        `PassengerAssignment ${assignment.id} no está representado por un asiento del cupo.`
      );
    }
  }


  if (
    allocationSeats.length !==
      allowedSeatNumbers.size
  ) {

    issues.push(
      `El cupo declara ${allowedSeatNumbers.size} asientos pero se resolvieron ${allocationSeats.length}.`
    );
  }


  const observedAssignedSeatCount =
    rows.filter(
      row =>
        row.status ===
          'assigned' &&
        row.passenger
    ).length;


  const assignedSeatCount =
    Number(
      allocation
        .assignedSeatCount
    ) ||
    0;


  if (
    assignedSeatCount !==
      observedAssignedSeatCount
  ) {

    issues.push(
      `Contador assignedSeatCount=${assignedSeatCount}, observado=${observedAssignedSeatCount}.`
    );
  }


  const allocatedCapacity =
    Number(
      allocation
        .allocatedCapacity
    ) ||
    allowedSeatNumbers.size;


  const remainingAssignableSeatCount =
    Number.isInteger(
      allocation
        .remainingAssignableSeatCount
    )
      ? allocation
          .remainingAssignableSeatCount
      : Math.max(
          0,
          allocatedCapacity -
            observedAssignedSeatCount
        );


  return {

    allocation: {

      id:
        allocation.id,

      eventId:
        allocation.eventId,

      vehicleId:
        allocation.vehicleId,

      allocationType:
        allocation.allocationType ||
        '',

      zone:
        allocation.zone ||
        'none',

      allocatedCapacity,

      allocatedToUserId:
        allocation.allocatedToUserId ||
        '',

      allocatedToName:
        allocation.allocatedToName ||
        '',

      allocatedToRole:
        allocation.allocatedToRole ||
        '',

      allocatedToStructureId:
        allocation.allocatedToStructureId ||
        ''
    },

    summary: {

      allocatedCapacity,

      assignedSeatCount,

      observedAssignedSeatCount,

      remainingAssignableSeatCount,

      integrityOk:
        issues.length ===
        0
    },

    seats:
      rows,

    issues
  };
}


// ======================================================
// GET EVENT TRANSPORT ALLOCATION MANIFEST
// ======================================================

exports.getEventTransportAllocationManifest =
  onCall(
    OPTIONS,

    async request => {

      const input =
        request.data ||
        {};


      const allocationId =
        validId(
          input.allocationId,
          'Cupo'
        );


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
          // ALLOCATION
          // ==============================================

          const allocationRef =
            db.collection(
              'eventTransportAllocations'
            ).doc(
              allocationId
            );


          const allocationSnapshot =
            await tx.get(
              allocationRef
            );


          if (
            !allocationSnapshot.exists
          ) {

            fail(
              'not-found',
              'El cupo de transporte no existe.'
            );
          }


          const allocation = {
            ...allocationSnapshot.data(),

            id:
              allocationSnapshot.id
          };


          if (
            allocation.active !==
              true ||
            allocation.campaignId !==
              profile.campaignId
          ) {

            fail(
              'permission-denied',
              'Cupo de transporte no disponible.'
            );
          }


          const eventId =
            validId(
              allocation.eventId,
              'Evento'
            );


          const vehicleId =
            validId(
              allocation.vehicleId,
              'Vehículo'
            );


          // ==============================================
          // EVENTO
          // ==============================================

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
            !canAssignPassengers(
              profile,
              event,
              allocation
            )
          ) {

            fail(
              'permission-denied',
              'No tienes autorización para consultar este cupo.'
            );
          }


          // ==============================================
          // ASIENTOS + ASSIGNMENTS
          // ==============================================

          const seatsQuery =
            db.collection(
              'eventTransportSeats'
            )
              .where(
                'vehicleId',
                '==',
                vehicleId
              );


          const assignmentsQuery =
            db.collection(
              'eventTransportAssignments'
            )
              .where(
                'allocationId',
                '==',
                allocationId
              );


          const [
            seatsSnapshot,
            assignmentsSnapshot
          ] =
            await Promise.all([
              tx.get(
                seatsQuery
              ),

              tx.get(
                assignmentsQuery
              )
            ]);


          const seats =
            seatsSnapshot.docs.map(
              doc => ({
                ...doc.data(),

                id:
                  doc.id
              })
            );


          const assignments =
            assignmentsSnapshot.docs.map(
              doc => ({
                ...doc.data(),

                id:
                  doc.id
              })
            );


          const manifest =
            buildAllocationManifest({
              allocation,
              seats,
              assignments
            });


          return {

            success:
              true,

            manifest
          };
        }
      );
    }
  );


// ======================================================
// TEST HELPERS
// ======================================================

exports._test = {
  canManageEventTransport,
  canAssignPassengers,
  personBelongsToAllocationBranch,
  seatCanReceivePassenger,
  resolveAllocatedSeat,
  assignmentIdFor,
  assignmentCanReactivate,
  assignmentCanRelease,
  releaseIdFor,
  assignmentCanMove,
  movementIdFor,
  buildAllocationManifest
};
