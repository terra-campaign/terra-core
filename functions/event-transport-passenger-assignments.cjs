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
          // ==============================================

          const fingerprint =
            hash(
              allocation.id,
              seatNumber,
              personId
            );


          if (
            existingAssignmentSnapshot
              .exists
          ) {

            const existing =
              existingAssignmentSnapshot
                .data();


            if (
              existing.active ===
                true &&
              existing.requestFingerprint ===
                fingerprint
            ) {

              return {
                success:
                  true,

                idempotent:
                  true,

                assignment:
                  assignmentView({
                    ...existing,
                    id:
                      assignmentId
                  })
              };
            }


            fail(
              'already-exists',
              'La persona ya tiene un asiento asignado para este evento.'
            );
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

            version:
              1,

            createdAt:
              serverNow,

            updatedAt:
              serverNow
          };


          // ==============================================
          // CREAR PASSENGER ASSIGNMENT
          // ==============================================

          tx.create(
            assignmentRef,
            assignmentRecord
          );


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
                'EVENT_TRANSPORT_PASSENGER_ASSIGNED',

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
  buildAllocationManifest
};
