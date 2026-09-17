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
// BUILD-118C-3B3E-3G-B4C
// PUNTO Y HORA PROGRAMADA DE ABORDAJE
// ======================================================

function optionalSeatNumber(
  value
) {

  if (
    value === undefined ||
    value === null ||
    (
      typeof value ===
        'string' &&
      !value.trim()
    )
  ) {

    return null;
  }


  return validSeatNumber(
    value
  );
}


// ======================================================
// B4D3A
// ASIENTO AUTOMATICO DENTRO DE UN CAPACITY BLOCK
// ======================================================

function resolveAutomaticAllocatedSeat({
  seats,
  allocation,
  vehicleId
}) {

  const allowedNumbers =
    new Set(
      Array.isArray(
        allocation?.seatNumbers
      )
        ? allocation.seatNumbers
        : []
    );


  const candidates =
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
            vehicleId &&
          seat.allocationId ===
            allocation?.id &&
          allowedNumbers.has(
            seat.seatNumber
          ) &&
          seat.status ===
            'allocated' &&
          !seat.assignmentId &&
          !seat.personId &&
          !seat.accountUid
      )
      .sort(
        (a, b) =>
          a.seatNumber -
          b.seatNumber
      );


  return candidates[0] ||
    null;
}


function validBoardingPoint(
  value
) {

  if (
    typeof value !==
      'string'
  ) {

    fail(
      'invalid-argument',
      'Punto de abordaje inválido.'
    );
  }


  const boardingPoint =
    value.trim();


  if (
    boardingPoint.length < 2 ||
    boardingPoint.length > 200
  ) {

    fail(
      'invalid-argument',
      'Punto de abordaje inválido.'
    );
  }


  return boardingPoint;
}


function validScheduledBoardingAt(
  value
) {

  if (
    typeof value !==
      'string' ||
    !value.trim()
  ) {

    fail(
      'invalid-argument',
      'Hora de abordaje inválida.'
    );
  }


  const millis =
    Date.parse(
      value.trim()
    );


  if (
    !Number.isFinite(
      millis
    )
  ) {

    fail(
      'invalid-argument',
      'Hora de abordaje inválida.'
    );
  }


  return {
    iso:
      new Date(
        millis
      ).toISOString(),

    millis
  };
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


      const requestedSeatNumber =
        optionalSeatNumber(
          input.seatNumber
        );


      const boardingPoint =
        validBoardingPoint(
          input.boardingPoint
        );


      const scheduledBoarding =
        validScheduledBoardingAt(
          input.scheduledBoardingAt
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


          const automaticSeatSelection =
            requestedSeatNumber ===
              null &&
            allocation.allocationType ===
              'capacity_block';


          if (
            requestedSeatNumber ===
              null &&
            !automaticSeatSelection
          ) {

            fail(
              'invalid-argument',
              'Selecciona un asiento para este tipo de cupo.'
            );
          }


          if (
            requestedSeatNumber !==
              null &&
            !seatNumbers.includes(
              requestedSeatNumber
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


          let seatNumber =
            requestedSeatNumber;


          let seat =
            null;


          if (
            !automaticSeatSelection
          ) {

            seat =
              resolveAllocatedSeat({
                seats:
                  vehicleSeats,

                allocation,

                vehicleId,

                seatNumber
              });
          }


          let seatId =
            seat
              ? seat.id
              : null;


          let seatRef =
            seat
              ? seat.ref
              : null;


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

          const seatFingerprint =
            automaticSeatSelection
              ? 'AUTO_CAPACITY_BLOCK'
              : seatNumber;


          const fingerprint =
            hash(
              allocation.id,
              seatFingerprint,
              personId,
              boardingPoint,
              scheduledBoarding.iso
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
          //
          // En capacity_block, el usuario no escoge
          // asiento. TERRA toma un asiento reservado
          // que siga disponible.
          //
          // Esto ocurre DESPUES de la comprobación
          // de idempotencia.
          // ==============================================

          if (
            automaticSeatSelection
          ) {

            seat =
              resolveAutomaticAllocatedSeat({
                seats:
                  vehicleSeats,

                allocation,

                vehicleId
              });


            if (!seat) {

              fail(
                'failed-precondition',
                'El cupo ya no tiene lugares disponibles para asignar personas.'
              );
            }


            seatNumber =
              seat.seatNumber;

            seatId =
              seat.id;

            seatRef =
              seat.ref;
          }


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

            boardingPoint,

            scheduledBoardingAt:
              scheduledBoarding.iso,

            scheduledBoardingAtMillis:
              scheduledBoarding.millis,

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
// B3C1 — CONFIRMACION DEL PASAJERO
//
// ASIGNADO
// confirmationStatus = pending
// boardingStatus     = pending
//
//              ↓
//
// CONFIRMADO
// confirmationStatus = confirmed
// boardingStatus     = pending
//
// CONFIRMAR != ABORDAR != ASISTIR
//
// Autoridad:
// A) la propia persona si tiene accountUid;
// B) responsable del allocation;
// C) transport manager.
//
// En B y C la confirmación queda marcada como
// "assisted" y conserva al actor que la registró.
// ======================================================

function assignmentCanConfirm(
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


function confirmationModeFor({
  profile,
  event,
  allocation,
  assignment
}) {

  if (
    !profile ||
    !event ||
    !allocation ||
    !assignment ||
    profile.active !==
      true ||
    profile.campaignId !==
      assignment.campaignId ||
    event.campaignId !==
      assignment.campaignId ||
    allocation.campaignId !==
      assignment.campaignId ||
    allocation.eventId !==
      assignment.eventId ||
    assignment.allocationId !==
      allocation.id
  ) {

    return null;
  }


  // ------------------------------------------------------
  // CONFIRMACION DIRECTA DEL PASAJERO DIGITAL
  // ------------------------------------------------------

  if (
    assignment.accountUid &&
    assignment.accountUid ===
      profile.uid
  ) {

    return 'self';
  }


  // ------------------------------------------------------
  // CONFIRMACION ASISTIDA
  //
  // Sirve también para persona accountless.
  // ------------------------------------------------------

  if (
    canAssignPassengers(
      profile,
      event,
      allocation
    )
  ) {

    return 'assisted';
  }


  return null;
}


function confirmationIdFor(
  assignmentId,
  assignmentCycle,
  requestId
) {

  return hash(
    assignmentId,
    assignmentCycle,
    requestId,
    'event-transport-passenger-confirmation-v1'
  );
}


// ======================================================
// CONFIRM EVENT TRANSPORT PASSENGER ASSIGNMENT
// ======================================================

exports.confirmEventTransportPassengerAssignment =
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
          // CICLO DE ASIGNACION
          //
          // 1 = asignación inicial
          // 2 = primera reactivación
          // 3 = segunda reactivación
          // ...
          //
          // Evita que un requestId viejo de otro ciclo
          // pueda confundirse con una confirmación nueva.
          // ==============================================

          const reactivationCount =
            Math.max(
              0,
              Number(
                assignment
                  .reactivationCount
              ) ||
              0
            );


          const assignmentCycle =
            reactivationCount +
            1;


          const confirmationId =
            confirmationIdFor(
              assignmentId,
              assignmentCycle,
              requestId
            );


          const confirmationRef =
            db.collection(
              'eventTransportAssignmentConfirmations'
            ).doc(
              confirmationId
            );


          const confirmationSnapshot =
            await tx.get(
              confirmationRef
            );


          // ==============================================
          // IDEMPOTENCIA PRIMERO
          //
          // Después del primer éxito el assignment ya está
          // confirmed, por eso el retry debe resolverse
          // antes de assignmentCanConfirm().
          // ==============================================

          if (
            confirmationSnapshot.exists
          ) {

            const saved =
              confirmationSnapshot.data();


            if (
              saved.campaignId ===
                profile.campaignId &&
              saved.assignmentId ===
                assignmentId &&
              saved.assignmentCycle ===
                assignmentCycle &&
              saved.confirmedByUserId ===
                profile.uid
            ) {

              return {

                success:
                  true,

                idempotent:
                  true,

                confirmation: {

                  id:
                    confirmationId,

                  assignmentId,

                  assignmentCycle,

                  personId:
                    saved.personId,

                  confirmationStatus:
                    'confirmed',

                  confirmationMode:
                    saved.confirmationMode,

                  confirmedByUserId:
                    saved.confirmedByUserId
                }
              };
            }


            fail(
              'already-exists',
              'Este identificador de confirmación ya fue utilizado.'
            );
          }


          // ==============================================
          // ESTADO DEL ASSIGNMENT
          // ==============================================

          if (
            !assignmentCanConfirm(
              assignment
            )
          ) {

            fail(
              'failed-precondition',
              'La asignación ya no puede confirmarse en esta etapa.'
            );
          }


          const allocationId =
            validId(
              assignment.allocationId,
              'Cupo'
            );


          const eventId =
            validId(
              assignment.eventId,
              'Evento'
            );


          const seatId =
            validId(
              assignment.seatId,
              'Asiento'
            );


          const allocationRef =
            db.collection(
              'eventTransportAllocations'
            ).doc(
              allocationId
            );


          const eventRef =
            db.collection(
              'events'
            ).doc(
              eventId
            );


          const seatRef =
            db.collection(
              'eventTransportSeats'
            ).doc(
              seatId
            );


          const [
            allocationSnapshot,
            eventSnapshot,
            seatSnapshot
          ] =
            await Promise.all([

              tx.get(
                allocationRef
              ),

              tx.get(
                eventRef
              ),

              tx.get(
                seatRef
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
            !eventSnapshot.exists
          ) {

            fail(
              'not-found',
              'El evento no existe.'
            );
          }


          if (
            !seatSnapshot.exists
          ) {

            fail(
              'not-found',
              'El asiento no existe.'
            );
          }


          const allocation = {
            ...allocationSnapshot.data(),

            id:
              allocationSnapshot.id
          };


          const event = {
            ...eventSnapshot.data(),

            id:
              eventSnapshot.id
          };


          const seat = {
            ...seatSnapshot.data(),

            id:
              seatSnapshot.id
          };


          // ==============================================
          // INTEGRIDAD DEL CUPO / EVENTO
          // ==============================================

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
              'El cupo ya no corresponde a esta asignación.'
            );
          }


          if (
            event.campaignId !==
              profile.campaignId ||
            event.id !==
              assignment.eventId
          ) {

            fail(
              'failed-precondition',
              'El evento ya no corresponde a esta asignación.'
            );
          }


          // ==============================================
          // INTEGRIDAD DEL ASIENTO
          // ==============================================

          if (
            seat.active !==
              true ||
            seat.status !==
              'assigned' ||
            seat.assignmentId !==
              assignmentId ||
            seat.personId !==
              assignment.personId ||
            seat.allocationId !==
              assignment.allocationId ||
            seat.vehicleId !==
              assignment.vehicleId ||
            seat.seatNumber !==
              assignment.seatNumber
          ) {

            fail(
              'failed-precondition',
              'El asiento físico no coincide con la asignación.'
            );
          }


          // ==============================================
          // AUTORIDAD DE CONFIRMACION
          // ==============================================

          const confirmationMode =
            confirmationModeFor({
              profile,
              event,
              allocation,
              assignment
            });


          if (
            !confirmationMode
          ) {

            fail(
              'permission-denied',
              'No tienes autorización para confirmar este transporte.'
            );
          }


          // ==============================================
          // TODAS LAS LECTURAS TERMINARON
          // ==============================================

          const serverNow =
            FieldValue
              .serverTimestamp();


          // ==============================================
          // ACTUALIZAR ASSIGNMENT
          //
          // NO modifica asiento.
          // NO modifica contadores.
          // NO modifica boardingStatus.
          // ==============================================

          tx.update(
            assignmentRef,
            {

              confirmationStatus:
                'confirmed',

              confirmationId,

              confirmationMode,

              confirmedAt:
                serverNow,

              confirmedByUserId:
                profile.uid,

              confirmedByName:
                profile.name ||
                '',

              confirmedByRole:
                profile.role,

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
          // HISTORIAL INMUTABLE DE CONFIRMACION
          // ==============================================

          tx.create(
            confirmationRef,
            {

              id:
                confirmationId,

              campaignId:
                profile.campaignId,

              eventId:
                assignment.eventId,

              vehicleId:
                assignment.vehicleId,

              allocationId:
                assignment.allocationId,

              assignmentId,

              assignmentCycle,

              personId:
                assignment.personId,

              accountUid:
                assignment.accountUid ||
                null,

              personName:
                assignment.personName ||
                '',

              seatId:
                assignment.seatId,

              seatNumber:
                assignment.seatNumber,

              confirmationStatus:
                'confirmed',

              confirmationMode,

              requestId,

              confirmedByUserId:
                profile.uid,

              confirmedByName:
                profile.name ||
                '',

              confirmedByRole:
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
                'EVENT_TRANSPORT_PASSENGER_CONFIRMED',

              campaignId:
                profile.campaignId,

              eventId:
                assignment.eventId,

              vehicleId:
                assignment.vehicleId,

              allocationId:
                assignment.allocationId,

              assignmentId,

              assignmentCycle,

              confirmationId,

              personId:
                assignment.personId,

              accountUid:
                assignment.accountUid ||
                null,

              seatId:
                assignment.seatId,

              seatNumber:
                assignment.seatNumber,

              confirmationMode,

              confirmedByUserId:
                profile.uid,

              confirmedByRole:
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

            confirmation: {

              id:
                confirmationId,

              assignmentId,

              assignmentCycle,

              personId:
                assignment.personId,

              seatId:
                assignment.seatId,

              seatNumber:
                assignment.seatNumber,

              confirmationStatus:
                'confirmed',

              confirmationMode,

              confirmedByUserId:
                profile.uid
            },

            assignment: {

              id:
                assignmentId,

              personId:
                assignment.personId,

              seatId:
                assignment.seatId,

              seatNumber:
                assignment.seatNumber,

              status:
                assignment.status,

              confirmationStatus:
                'confirmed',

              boardingStatus:
                assignment.boardingStatus,

              active:
                assignment.active
            }
          };
        }
      );
    }
  );


// ======================================================
// B3C2 — ABORDAJE DEL PASAJERO
//
// confirmationStatus = confirmed
// boardingStatus     = pending
//
//              ↓
//
// boardingStatus     = boarded
//
// CONFIRMAR != ABORDAR != ASISTIR
//
// El abordaje es una validación física/operativa.
// NO existe autoabordaje.
//
// Puede registrarlo:
// A) creador / transport manager;
// B) responsable del allocation.
//
// Efecto contable:
// vehicle.occupiedCount += 1
//
// NO modifica:
// - assignedSeatCount
// - allocatedSeatCount
// - availableSeatCount
// - allocation
// - asiento
// - eventAttendance
// ======================================================

function assignmentCanBoard(
  assignment
) {

  return Boolean(
    assignment &&
    assignment.active ===
      true &&
    assignment.status ===
      'assigned' &&
    assignment.confirmationStatus ===
      'confirmed' &&
    assignment.confirmationId &&
    assignment.boardingStatus ===
      'pending' &&
    assignment.personId &&
    assignment.seatId &&
    Number.isInteger(
      assignment.seatNumber
    )
  );
}


function canRecordBoarding(
  profile,
  event,
  allocation
) {

  // Intencionalmente NO existe modalidad "self".
  //
  // El pasajero puede confirmar su intención cuando
  // corresponda, pero "abordó" requiere validación
  // operativa de un responsable autorizado.

  return canAssignPassengers(
    profile,
    event,
    allocation
  );
}


function boardingIdFor(
  assignmentId,
  assignmentCycle,
  requestId
) {

  return hash(
    assignmentId,
    assignmentCycle,
    requestId,
    'event-transport-passenger-boarding-v1'
  );
}


// ======================================================
// CONTADORES DE ABORDAJE DEL VEHICULO
// ======================================================

function vehicleBoardingCounters(
  vehicle
) {

  if (!vehicle) {
    return null;
  }


  const capacity =
    Number(
      vehicle.capacity
    );


  const occupiedBefore =
    Number(
      vehicle.occupiedCount
    );


  const assignedSeatCount =
    Number(
      vehicle.assignedSeatCount
    );


  if (
    !Number.isInteger(
      capacity
    ) ||
    capacity < 1 ||
    !Number.isInteger(
      occupiedBefore
    ) ||
    occupiedBefore < 0 ||
    !Number.isInteger(
      assignedSeatCount
    ) ||
    assignedSeatCount < 1 ||
    assignedSeatCount >
      capacity ||
    occupiedBefore >
      assignedSeatCount
  ) {

    return null;
  }


  const occupiedAfter =
    occupiedBefore +
    1;


  if (
    occupiedAfter >
      capacity ||
    occupiedAfter >
      assignedSeatCount
  ) {

    return null;
  }


  return {

    capacity,

    assignedSeatCount,

    occupiedBefore,

    occupiedAfter
  };
}


// ======================================================
// RECORD EVENT TRANSPORT PASSENGER BOARDING
// ======================================================

exports.recordEventTransportPassengerBoarding =
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
          // ASSIGNMENT
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
          // CICLO DE ASSIGNMENT
          // ==============================================

          const reactivationCount =
            Math.max(
              0,
              Number(
                assignment
                  .reactivationCount
              ) ||
              0
            );


          const assignmentCycle =
            reactivationCount +
            1;


          const boardingId =
            boardingIdFor(
              assignmentId,
              assignmentCycle,
              requestId
            );


          const boardingRef =
            db.collection(
              'eventTransportAssignmentBoardings'
            ).doc(
              boardingId
            );


          const boardingSnapshot =
            await tx.get(
              boardingRef
            );


          // ==============================================
          // IDEMPOTENCIA PRIMERO
          //
          // Después del éxito boardingStatus ya será
          // "boarded", por eso el retry se resuelve aquí.
          // ==============================================

          if (
            boardingSnapshot.exists
          ) {

            const saved =
              boardingSnapshot.data();


            if (
              saved.campaignId ===
                profile.campaignId &&
              saved.assignmentId ===
                assignmentId &&
              saved.assignmentCycle ===
                assignmentCycle &&
              saved.boardedByUserId ===
                profile.uid
            ) {

              return {

                success:
                  true,

                idempotent:
                  true,

                boarding: {

                  id:
                    boardingId,

                  assignmentId,

                  assignmentCycle,

                  personId:
                    saved.personId,

                  seatNumber:
                    saved.seatNumber,

                  boardingStatus:
                    'boarded',

                  boardedByUserId:
                    saved.boardedByUserId
                },

                vehicleOccupiedCount:
                  saved
                    .vehicleOccupiedCountAfter
              };
            }


            fail(
              'already-exists',
              'Este identificador de abordaje ya fue utilizado.'
            );
          }


          // ==============================================
          // ESTADO PREVIO
          // ==============================================

          if (
            !assignmentCanBoard(
              assignment
            )
          ) {

            fail(
              'failed-precondition',
              'La asignación no puede registrar abordaje en esta etapa.'
            );
          }


          const allocationId =
            validId(
              assignment.allocationId,
              'Cupo'
            );


          const eventId =
            validId(
              assignment.eventId,
              'Evento'
            );


          const vehicleId =
            validId(
              assignment.vehicleId,
              'Vehículo'
            );


          const seatId =
            validId(
              assignment.seatId,
              'Asiento'
            );


          const confirmationId =
            validId(
              assignment.confirmationId,
              'Confirmación'
            );


          const allocationRef =
            db.collection(
              'eventTransportAllocations'
            ).doc(
              allocationId
            );


          const eventRef =
            db.collection(
              'events'
            ).doc(
              eventId
            );


          const vehicleRef =
            db.collection(
              'eventTransportVehicles'
            ).doc(
              vehicleId
            );


          const seatRef =
            db.collection(
              'eventTransportSeats'
            ).doc(
              seatId
            );


          const confirmationRef =
            db.collection(
              'eventTransportAssignmentConfirmations'
            ).doc(
              confirmationId
            );


          const [
            allocationSnapshot,
            eventSnapshot,
            vehicleSnapshot,
            seatSnapshot,
            confirmationSnapshot
          ] =
            await Promise.all([

              tx.get(
                allocationRef
              ),

              tx.get(
                eventRef
              ),

              tx.get(
                vehicleRef
              ),

              tx.get(
                seatRef
              ),

              tx.get(
                confirmationRef
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
            !eventSnapshot.exists
          ) {

            fail(
              'not-found',
              'El evento no existe.'
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
            !seatSnapshot.exists
          ) {

            fail(
              'not-found',
              'El asiento no existe.'
            );
          }


          if (
            !confirmationSnapshot.exists
          ) {

            fail(
              'failed-precondition',
              'La confirmación previa no existe.'
            );
          }


          const allocation = {
            ...allocationSnapshot.data(),

            id:
              allocationSnapshot.id
          };


          const event = {
            ...eventSnapshot.data(),

            id:
              eventSnapshot.id
          };


          const vehicle = {
            ...vehicleSnapshot.data(),

            id:
              vehicleSnapshot.id
          };


          const seat = {
            ...seatSnapshot.data(),

            id:
              seatSnapshot.id
          };


          const confirmation = {
            ...confirmationSnapshot.data(),

            id:
              confirmationSnapshot.id
          };


          // ==============================================
          // INTEGRIDAD DEL EVENTO / CUPO / VEHICULO
          // ==============================================

          if (
            event.active !==
              true ||
            event.campaignId !==
              profile.campaignId ||
            event.id !==
              assignment.eventId
          ) {

            fail(
              'failed-precondition',
              'El evento no está activo o no corresponde a la asignación.'
            );
          }


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
              'El cupo ya no corresponde a esta asignación.'
            );
          }


          if (
            vehicle.active !==
              true ||
            vehicle.campaignId !==
              profile.campaignId ||
            vehicle.eventId !==
              assignment.eventId ||
            vehicle.id !==
              assignment.vehicleId
          ) {

            fail(
              'failed-precondition',
              'El vehículo ya no corresponde a esta asignación.'
            );
          }


          // ==============================================
          // CONFIRMACION B3C1 REAL
          // ==============================================

          if (
            confirmation.campaignId !==
              profile.campaignId ||
            confirmation.assignmentId !==
              assignmentId ||
            confirmation.assignmentCycle !==
              assignmentCycle ||
            confirmation.confirmationStatus !==
              'confirmed' ||
            confirmation.personId !==
              assignment.personId
          ) {

            fail(
              'failed-precondition',
              'La confirmación previa no corresponde al pasajero actual.'
            );
          }


          // ==============================================
          // INTEGRIDAD DEL ASIENTO
          // ==============================================

          if (
            seat.active !==
              true ||
            seat.status !==
              'assigned' ||
            seat.assignmentId !==
              assignmentId ||
            seat.personId !==
              assignment.personId ||
            seat.allocationId !==
              assignment.allocationId ||
            seat.vehicleId !==
              assignment.vehicleId ||
            seat.seatNumber !==
              assignment.seatNumber
          ) {

            fail(
              'failed-precondition',
              'El asiento físico no coincide con la asignación.'
            );
          }


          // ==============================================
          // AUTORIDAD
          // ==============================================

          if (
            !canRecordBoarding(
              profile,
              event,
              allocation
            )
          ) {

            fail(
              'permission-denied',
              'No tienes autorización para registrar el abordaje.'
            );
          }


          // ==============================================
          // CAPACIDAD FISICA
          // ==============================================

          const counters =
            vehicleBoardingCounters(
              vehicle
            );


          if (!counters) {

            fail(
              'failed-precondition',
              'Los contadores del vehículo son inconsistentes o no existe capacidad física disponible.'
            );
          }


          // ==============================================
          // TODAS LAS LECTURAS TERMINARON
          // ==============================================

          const serverNow =
            FieldValue
              .serverTimestamp();


          // ==============================================
          // ASSIGNMENT
          // ==============================================

          tx.update(
            assignmentRef,
            {

              boardingStatus:
                'boarded',

              boardingId,

              boardedAt:
                serverNow,

              boardedByUserId:
                profile.uid,

              boardedByName:
                profile.name ||
                '',

              boardedByRole:
                profile.role,

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
          // VEHICULO
          //
          // Esta es la primera transición real que
          // incrementa occupiedCount.
          //
          // NO modifica assignedSeatCount.
          // NO modifica allocatedSeatCount.
          // NO modifica availableSeatCount.
          // ==============================================

          tx.update(
            vehicleRef,
            {

              occupiedCount:
                counters
                  .occupiedAfter,

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
          // HISTORIAL INMUTABLE
          // ==============================================

          tx.create(
            boardingRef,
            {

              id:
                boardingId,

              campaignId:
                profile.campaignId,

              eventId:
                assignment.eventId,

              vehicleId:
                assignment.vehicleId,

              allocationId:
                assignment.allocationId,

              assignmentId,

              assignmentCycle,

              confirmationId:

                assignment
                  .confirmationId,

              personId:
                assignment.personId,

              accountUid:
                assignment.accountUid ||
                null,

              personName:
                assignment.personName ||
                '',

              seatId:
                assignment.seatId,

              seatNumber:
                assignment.seatNumber,

              boardingStatus:
                'boarded',

              requestId,

              boardedByUserId:
                profile.uid,

              boardedByName:
                profile.name ||
                '',

              boardedByRole:
                profile.role,

              vehicleCapacity:
                counters.capacity,

              vehicleAssignedSeatCount:
                counters
                  .assignedSeatCount,

              vehicleOccupiedCountBefore:
                counters
                  .occupiedBefore,

              vehicleOccupiedCountAfter:
                counters
                  .occupiedAfter,

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
                'EVENT_TRANSPORT_PASSENGER_BOARDED',

              campaignId:
                profile.campaignId,

              eventId:
                assignment.eventId,

              vehicleId:
                assignment.vehicleId,

              allocationId:
                assignment.allocationId,

              assignmentId,

              assignmentCycle,

              confirmationId:
                assignment
                  .confirmationId,

              boardingId,

              personId:
                assignment.personId,

              accountUid:
                assignment.accountUid ||
                null,

              seatId:
                assignment.seatId,

              seatNumber:
                assignment.seatNumber,

              boardedByUserId:
                profile.uid,

              boardedByRole:
                profile.role,

              vehicleOccupiedCountBefore:
                counters
                  .occupiedBefore,

              vehicleOccupiedCountAfter:
                counters
                  .occupiedAfter,

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

            boarding: {

              id:
                boardingId,

              assignmentId,

              assignmentCycle,

              confirmationId:
                assignment
                  .confirmationId,

              personId:
                assignment.personId,

              seatId:
                assignment.seatId,

              seatNumber:
                assignment.seatNumber,

              boardingStatus:
                'boarded',

              boardedByUserId:
                profile.uid
            },

            assignment: {

              id:
                assignmentId,

              personId:
                assignment.personId,

              seatId:
                assignment.seatId,

              seatNumber:
                assignment.seatNumber,

              status:
                assignment.status,

              confirmationStatus:
                assignment
                  .confirmationStatus,

              boardingStatus:
                'boarded',

              active:
                assignment.active
            },

            vehicle: {

              id:
                vehicle.id,

              capacity:
                counters.capacity,

              assignedSeatCount:
                counters
                  .assignedSeatCount,

              occupiedCount:
                counters
                  .occupiedAfter
            }
          };
        }
      );
    }
  );


// ======================================================
// BUILD-118C-3B3E-3G-B4D3B
// PERSONAS ELEGIBLES PARA UN CUPO
// ======================================================

function buildTransportPassengerCandidates({
  allocation,
  memberships,
  persons,
  assignments
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


  const safeAssignments =
    Array.isArray(
      assignments
    )
      ? assignments
      : [];


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
        allocation.campaignId ||
      typeof membership.personId !==
        'string' ||
      !membership.personId
    ) {

      continue;
    }


    const current =
      membershipsByPerson.get(
        membership.personId
      ) || [];


    current.push(
      membership
    );


    membershipsByPerson.set(
      membership.personId,
      current
    );
  }


  const alreadyAssigned =
    new Set(
      safeAssignments
        .filter(
          assignment =>
            assignment &&
            assignment.active ===
              true &&
            assignment.eventId ===
              allocation.eventId &&
            typeof assignment.personId ===
              'string'
        )
        .map(
          assignment =>
            assignment.personId
        )
    );


  const candidates = [];


  for (
    const person of
    safePersons
  ) {

    if (!person) {

      continue;
    }


    const personId =
      typeof person.personId ===
        'string' &&
      person.personId
        ? person.personId
        : (
            typeof person.id ===
              'string'
              ? person.id
              : ''
          );


    if (
      !personId ||
      person.active !==
        true ||
      person.campaignId !==
        allocation.campaignId ||
      alreadyAssigned.has(
        personId
      )
    ) {

      continue;
    }


    const personMemberships =
      membershipsByPerson.get(
        personId
      ) || [];


    // createEventTransportPassengerAssignment
    // exige una sola membresía activa.
    if (
      personMemberships.length !==
        1
    ) {

      continue;
    }


    const membership =
      personMemberships[0];


    if (
      !personBelongsToAllocationBranch({
        person,
        membership,
        allocation
      })
    ) {

      continue;
    }


    candidates.push({
      personId,

      name:
        (
          person.name ||
          person.fullName ||
          person.displayName ||
          ''
        ),

      locality:
        (
          person.locality ||
          person.localidad ||
          ''
        ),

      accountUid:
        typeof person.accountUid ===
          'string' &&
        person.accountUid
          ? person.accountUid
          : null,

      hasDigitalAccount:
        Boolean(
          typeof person.accountUid ===
            'string' &&
          person.accountUid
        ),

      membershipId:
        membership.membershipId ||
        membership.id ||
        '',

      role:
        membership.role ||
        '',

      structureId:
        membership.structureId ||
        '',

      municipalityId:
        membership.municipalityId ||
        ''
    });
  }


  candidates.sort(
    (a, b) =>
      String(
        a.name ||
        a.personId
      ).localeCompare(
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


  return candidates;
}


// ======================================================
// GET EVENT TRANSPORT PASSENGER CANDIDATES
// ======================================================

exports.getEventTransportPassengerCandidates =
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


      // ================================================
      // AUTORIZACION
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


            const allocationSnapshot =
              await tx.get(
                db.collection(
                  'eventTransportAllocations'
                ).doc(
                  allocationId
                )
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
                'No tienes autorización para administrar pasajeros de este cupo.'
              );
            }


            const responsibleUid =
              validId(
                allocation
                  .allocatedToUserId,
                'Responsable'
              );


            return {
              profile,
              event,
              allocation,
              responsibleUid
            };
          }
        );


      const {
        event,
        allocation,
        responsibleUid
      } = context;


      // ================================================
      // RAMA TERRITORIAL + RESPONSABLE
      // ================================================

      const [
        descendantMembershipsSnapshot,
        directMembershipsSnapshot,
        responsiblePersonsSnapshot,
        eventAssignmentsSnapshot
      ] =
        await Promise.all([

          db.collection(
            'territorialMemberships'
          )
            .where(
              'ancestorUserIds',
              'array-contains',
              responsibleUid
            )
            .limit(
              500
            )
            .get(),

          db.collection(
            'territorialMemberships'
          )
            .where(
              'parentUserId',
              '==',
              responsibleUid
            )
            .limit(
              500
            )
            .get(),

          db.collection(
            'persons'
          )
            .where(
              'accountUid',
              '==',
              responsibleUid
            )
            .limit(
              10
            )
            .get(),

          db.collection(
            'eventTransportAssignments'
          )
            .where(
              'eventId',
              '==',
              event.id
            )
            .limit(
              1000
            )
            .get()
        ]);


      const membershipMap =
        new Map();


      const addMembership =
        doc => {

          const data = {
            ...doc.data(),

            id:
              doc.id,

            membershipId:
              doc.id
          };


          if (
            data.active !==
              true ||
            data.campaignId !==
              allocation.campaignId
          ) {

            return;
          }


          membershipMap.set(
            doc.id,
            data
          );
        };


      descendantMembershipsSnapshot
        .docs
        .forEach(
          addMembership
        );


      directMembershipsSnapshot
        .docs
        .forEach(
          addMembership
        );


      // ================================================
      // MEMBRESIA DEL PROPIO RESPONSABLE
      // ================================================

      const responsiblePersons =
        responsiblePersonsSnapshot.docs
          .map(
            doc => ({
              ...doc.data(),

              id:
                doc.id,

              personId:
                doc.id
            })
          )
          .filter(
            person =>
              person.active ===
                true &&
              person.campaignId ===
                allocation.campaignId
          );


      for (
        const person of
        responsiblePersons
      ) {

        const snapshot =
          await db.collection(
            'territorialMemberships'
          )
            .where(
              'personId',
              '==',
              person.personId
            )
            .limit(
              20
            )
            .get();


        snapshot.docs.forEach(
          addMembership
        );
      }


      // ================================================
      // PERSON IDS
      // ================================================

      const personIds =
        new Set(
          Array.from(
            membershipMap.values()
          )
            .map(
              membership =>
                membership.personId
            )
            .filter(
              value =>
                typeof value ===
                  'string' &&
                Boolean(
                  value
                )
            )
        );


      for (
        const person of
        responsiblePersons
      ) {

        personIds.add(
          person.personId
        );
      }


      // ================================================
      // TODAS LAS MEMBRESIAS DE LOS CANDIDATOS
      //
      // IMPORTANTE:
      // createEventTransportPassengerAssignment exige
      // exactamente una membresía territorial activa
      // en la campaña.
      //
      // No basta con conocer solamente las membresías
      // encontradas dentro de la rama del responsable.
      // ================================================

      const allMembershipsById =
        new Map();


      const personIdList =
        Array.from(
          personIds
        );


      for (
        let offset = 0;
        offset < personIdList.length;
        offset += 30
      ) {

        const part =
          personIdList.slice(
            offset,
            offset + 30
          );


        if (!part.length) {

          continue;
        }


        const snapshot =
          await db.collection(
            'territorialMemberships'
          )
            .where(
              'personId',
              'in',
              part
            )
            .get();


        for (
          const doc of
          snapshot.docs
        ) {

          const data = {
            ...doc.data(),

            id:
              doc.id,

            membershipId:
              doc.id
          };


          if (
            data.active !==
              true ||
            data.campaignId !==
              allocation.campaignId
          ) {

            continue;
          }


          allMembershipsById.set(
            doc.id,
            data
          );
        }
      }


      // ================================================
      // PERSONAS
      // ================================================

      const personsById =
        new Map();


      for (
        const person of
        responsiblePersons
      ) {

        personsById.set(
          person.personId,
          person
        );
      }


      const refs =
        Array.from(
          personIds
        ).map(
          personId =>
            db.collection(
              'persons'
            ).doc(
              personId
            )
        );


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


          personsById.set(
            snapshot.id,
            {
              ...snapshot.data(),

              id:
                snapshot.id,

              personId:
                snapshot.id
            }
          );
        }
      }


      const assignments =
        eventAssignmentsSnapshot.docs
          .map(
            doc => ({
              ...doc.data(),

              id:
                doc.id
            })
          );


      const candidates =
        buildTransportPassengerCandidates({
          allocation,

          memberships:
            Array.from(
              allMembershipsById.values()
            ),

          persons:
            Array.from(
              personsById.values()
            ),

          assignments
        });


      return {
        success:
          true,

        allocationId:
          allocation.id,

        eventId:
          event.id,

        responsibleUserId:
          responsibleUid,

        total:
          candidates.length,

        candidates
      };
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
// BUILD-118C-3B3E-3G-B4A
// WORKSPACE OPERATIVO DE TRANSPORTE DEL EVENTO
//
// Lectura central para:
// - creador del evento;
// - transportManagerIds.
//
// No modifica datos.
// ======================================================

function transportWorkspaceIso(
  value
) {

  if (
    typeof value ===
      'string'
  ) {
    return value;
  }


  if (
    value &&
    typeof value.toDate ===
      'function'
  ) {

    return value
      .toDate()
      .toISOString();
  }


  if (
    value instanceof Date
  ) {
    return value.toISOString();
  }


  return '';
}


function buildEventTransportWorkspace({
  event,
  vehicles,
  allocations,
  requests,
  assignments
}) {

  const safeVehicles =
    Array.isArray(vehicles)
      ? vehicles.filter(
          item =>
            item &&
            item.active === true
        )
      : [];


  const safeAllocations =
    Array.isArray(allocations)
      ? allocations.filter(
          item =>
            item &&
            item.active === true
        )
      : [];


  const safeRequests =
    Array.isArray(requests)
      ? requests.filter(Boolean)
      : [];


  const safeAssignments =
    Array.isArray(assignments)
      ? assignments.filter(
          item =>
            item &&
            item.active === true
        )
      : [];


  const transportRequestedCount =
    safeRequests.filter(
      item =>
        item.needsTransport ===
          true
    ).length;


  const transportNotRequestedCount =
    safeRequests.filter(
      item =>
        item.needsTransport ===
          false
    ).length;


  const assignedPassengerCount =
    safeAssignments.filter(
      item =>
        item.status ===
          'assigned'
    ).length;


  const confirmedPassengerCount =
    safeAssignments.filter(
      item =>
        item.confirmationStatus ===
          'confirmed'
    ).length;


  const boardedCount =
    safeAssignments.filter(
      item =>
        item.boardingStatus ===
          'boarded'
    ).length;


  return {

    event: {

      id:
        event.id,

      title:
        event.title ||
        '',

      venue:
        event.venue ||
        '',

      locality:
        event.locality ||
        '',

      startsAt:
        event.startsAt ||
        ''
    },


    scope: {

      canManageTransport:
        true
    },


    summary: {

      vehicleCount:
        safeVehicles.length,

      allocationCount:
        safeAllocations.length,

      transportResponseCount:
        safeRequests.length,

      transportRequestedCount,

      transportNotRequestedCount,

      assignedPassengerCount,

      confirmedPassengerCount,

      boardedCount
    },


    vehicles:
      safeVehicles.map(
        vehicle => ({

          id:
            vehicle.id,

          eventId:
            vehicle.eventId,

          name:
            vehicle.name ||
            '',

          vehicleType:
            vehicle.vehicleType ||
            '',

          capacity:
            Number(
              vehicle.capacity
            ) || 0,

          seatCount:
            Number(
              vehicle.seatCount
            ) || 0,

          allocatedSeatCount:
            Number(
              vehicle
                .allocatedSeatCount
            ) || 0,

          availableSeatCount:
            Number(
              vehicle
                .availableSeatCount
            ) || 0,

          assignedSeatCount:
            Number(
              vehicle
                .assignedSeatCount
            ) || 0,

          occupiedCount:
            Number(
              vehicle.occupiedCount
            ) || 0,

          seatLayoutConfigured:
            vehicle.seatLayoutConfigured ===
              true,

          seatLayoutType:
            vehicle.seatLayoutType ||
            '',

          seatLayoutTemplate:
            vehicle.seatLayoutTemplate ||
            '',

          seatSideReference:
            vehicle.seatSideReference ||
            '',

          leftSideMeaning:
            vehicle.leftSideMeaning ||
            '',

          rightSideMeaning:
            vehicle.rightSideMeaning ||
            '',

          leftSeatCount:
            Number(
              vehicle.leftSeatCount
            ) || 0,

          rightSeatCount:
            Number(
              vehicle.rightSeatCount
            ) || 0,

          centerSeatCount:
            Number(
              vehicle.centerSeatCount
            ) || 0,


          sharingMode:
            vehicle.sharingMode ||
            '',

          origin:
            vehicle.origin ||
            '',

          destination:
            vehicle.destination ||
            '',

          departureAt:
            transportWorkspaceIso(
              vehicle.departureAt
            ),

          managedByUserId:
            vehicle
              .managedByUserId ||
            '',

          active:
            true
        })
      ),


    allocations:
      safeAllocations.map(
        allocation => ({

          id:
            allocation.id,

          eventId:
            allocation.eventId,

          vehicleId:
            allocation.vehicleId,

          allocationType:
            allocation
              .allocationType ||
            '',

          allocatedCapacity:
            Number(
              allocation
                .allocatedCapacity
            ) || 0,

          seatNumbers:
            Array.isArray(
              allocation.seatNumbers
            )
              ? allocation
                  .seatNumbers
              : [],

          zone:
            allocation.zone ||
            '',

          customZoneLabel:
            allocation
              .customZoneLabel ||
            '',

          allocatedToUserId:
            allocation
              .allocatedToUserId ||
            '',

          allocatedToName:
            allocation
              .allocatedToName ||
            '',

          allocatedToRole:
            allocation
              .allocatedToRole ||
            '',

          allocatedToStructureId:
            allocation
              .allocatedToStructureId ||
            '',

          allocatedToMunicipalityId:
            allocation
              .allocatedToMunicipalityId ||
            '',

          active:
            true
        })
      ),


    transportRequests:
      safeRequests.map(
        item => ({

          id:
            item.id,

          eventId:
            item.eventId,

          invitationId:
            item.invitationId ||
            '',

          personId:
            item.personId ||
            '',

          accountUid:
            item.accountUid ||
            null,

          needsTransport:
            item.needsTransport ===
              true,

          recordedByUserId:
            item
              .recordedByUserId ||
            '',

          recordedByRole:
            item
              .recordedByRole ||
            '',

          recordedMode:
            item.recordedMode ||
            '',

          source:
            item.source ||
            ''
        })
      ),


    assignments:
      safeAssignments.map(
        assignment => ({

          id:
            assignment.id,

          eventId:
            assignment.eventId,

          allocationId:
            assignment
              .allocationId,

          vehicleId:
            assignment.vehicleId,

          personId:
            assignment.personId,

          accountUid:
            assignment.accountUid ||
            null,

          personName:
            assignment.personName ||
            '',

          boardingPoint:
            assignment.boardingPoint ||
            '',

          scheduledBoardingAt:
            transportWorkspaceIso(
              assignment
                .scheduledBoardingAt
            ),

          scheduledBoardingAtMillis:
            Number(
              assignment
                .scheduledBoardingAtMillis
            ) || 0,

          seatId:
            assignment.seatId ||
            '',

          seatNumber:
            Number(
              assignment.seatNumber
            ) || 0,

          status:
            assignment.status ||
            '',

          confirmationStatus:
            assignment
              .confirmationStatus ||
            'pending',

          boardingStatus:
            assignment
              .boardingStatus ||
            'pending',

          active:
            true
        })
      )
  };
}


exports.getEventTransportWorkspace =
  onCall(
    OPTIONS,

    async request => {

      const eventId =
        validId(
          request.data
            ?.eventId,
          'Evento'
        );


      const db =
        getFirestore();


      return db.runTransaction(
        async tx => {

          const profile =
            await loadCaller(
              tx,
              db,
              request
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
            event.active !==
              true ||
            event.campaignId !==
              profile.campaignId
          ) {

            fail(
              'permission-denied',
              'El evento no está disponible para esta cuenta.'
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
              'No tienes autorización para administrar el transporte de este evento.'
            );
          }


          const vehiclesQuery =
            db.collection(
              'eventTransportVehicles'
            ).where(
              'eventId',
              '==',
              eventId
            );


          const allocationsQuery =
            db.collection(
              'eventTransportAllocations'
            ).where(
              'eventId',
              '==',
              eventId
            );


          const requestsQuery =
            db.collection(
              'eventTransportRequests'
            ).where(
              'eventId',
              '==',
              eventId
            );


          const assignmentsQuery =
            db.collection(
              'eventTransportAssignments'
            ).where(
              'eventId',
              '==',
              eventId
            );


          const [
            vehiclesSnapshot,
            allocationsSnapshot,
            requestsSnapshot,
            assignmentsSnapshot
          ] =
            await Promise.all([

              tx.get(
                vehiclesQuery
              ),

              tx.get(
                allocationsQuery
              ),

              tx.get(
                requestsQuery
              ),

              tx.get(
                assignmentsQuery
              )
            ]);


          const campaignId =
            profile.campaignId;


          const vehicles =
            vehiclesSnapshot.docs
              .map(
                doc => ({
                  ...doc.data(),
                  id:
                    doc.id
                })
              )
              .filter(
                item =>
                  item.campaignId ===
                    campaignId &&
                  item.eventId ===
                    eventId
              );


          const allocations =
            allocationsSnapshot.docs
              .map(
                doc => ({
                  ...doc.data(),
                  id:
                    doc.id
                })
              )
              .filter(
                item =>
                  item.campaignId ===
                    campaignId &&
                  item.eventId ===
                    eventId
              );


          const requests =
            requestsSnapshot.docs
              .map(
                doc => ({
                  ...doc.data(),
                  id:
                    doc.id
                })
              )
              .filter(
                item =>
                  item.campaignId ===
                    campaignId &&
                  item.eventId ===
                    eventId
              );


          const assignments =
            assignmentsSnapshot.docs
              .map(
                doc => ({
                  ...doc.data(),
                  id:
                    doc.id
                })
              )
              .filter(
                item =>
                  item.campaignId ===
                    campaignId &&
                  item.eventId ===
                    eventId
              );


          return {

            success:
              true,

            workspace:
              buildEventTransportWorkspace({
                event,
                vehicles,
                allocations,
                requests,
                assignments
              })
          };
        }
      );
    }
  );


// ======================================================
// TEST HELPERS
// ======================================================

exports._test = {
  optionalSeatNumber,
  resolveAutomaticAllocatedSeat,
  validBoardingPoint,
  validScheduledBoardingAt,
  canManageEventTransport,
  canAssignPassengers,
  personBelongsToAllocationBranch,
  buildTransportPassengerCandidates,
  seatCanReceivePassenger,
  resolveAllocatedSeat,
  assignmentIdFor,
  assignmentCanReactivate,
  assignmentCanRelease,
  releaseIdFor,
  assignmentCanConfirm,
  confirmationModeFor,
  confirmationIdFor,
  assignmentCanBoard,
  canRecordBoarding,
  boardingIdFor,
  vehicleBoardingCounters,
  assignmentCanMove,
  movementIdFor,
  buildAllocationManifest,
  buildEventTransportWorkspace
};
