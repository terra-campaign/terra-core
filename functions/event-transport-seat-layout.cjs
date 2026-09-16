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


// ======================================================
// REFERENCIA FISICA OFICIAL DE TERRA
//
// Mirando hacia el frente desde el interior del vehículo:
//
// left  = lado del chofer
// right = lado del copiloto / pasajero
// center = zona central, cuando exista
// ======================================================

const SEAT_SIDE_REFERENCE =
  'forward_facing_from_inside';

const LEFT_SIDE_MEANING =
  'driver_side';

const RIGHT_SIDE_MEANING =
  'passenger_side';


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
  label
) {

  if (
    typeof value !== 'string' ||
    !value.length ||
    value.length > 128 ||
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
    typeof value !== 'string' ||
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


function normalizeSeatNumbers(
  value,
  label
) {

  if (
    value === undefined ||
    value === null
  ) {
    return [];
  }


  if (
    !Array.isArray(
      value
    )
  ) {

    fail(
      'invalid-argument',
      `${label} debe ser una lista.`
    );
  }


  const numbers =
    value.map(
      item =>
        Number(
          item
        )
    );


  if (
    numbers.some(
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
      `${label} contiene asientos inválidos.`
    );
  }


  if (
    new Set(
      numbers
    ).size !==
      numbers.length
  ) {

    fail(
      'invalid-argument',
      `${label} contiene asientos repetidos.`
    );
  }


  return [
    ...numbers
  ].sort(
    (a, b) =>
      a - b
  );
}


// ======================================================
// VALIDAR MAPA COMPLETO
// ======================================================

function validateSeatSideLayout({
  capacity,
  leftSeatNumbers,
  rightSeatNumbers,
  centerSeatNumbers
}) {

  if (
    !Number.isInteger(
      capacity
    ) ||
    capacity < 1
  ) {

    fail(
      'invalid-argument',
      'Capacidad inválida.'
    );
  }


  const left =
    normalizeSeatNumbers(
      leftSeatNumbers,
      'Lado izquierdo'
    );


  const right =
    normalizeSeatNumbers(
      rightSeatNumbers,
      'Lado derecho'
    );


  const center =
    normalizeSeatNumbers(
      centerSeatNumbers,
      'Zona central'
    );


  const all = [
    ...left,
    ...right,
    ...center
  ];


  if (
    all.length !==
      capacity
  ) {

    fail(
      'invalid-argument',
      `El mapa debe clasificar exactamente los ${capacity} asientos del vehículo.`
    );
  }


  if (
    new Set(
      all
    ).size !==
      all.length
  ) {

    fail(
      'invalid-argument',
      'Un asiento no puede pertenecer a dos lados al mismo tiempo.'
    );
  }


  const expected =
    Array.from(
      {
        length:
          capacity
      },
      (
        _,
        index
      ) =>
        index + 1
    );


  const sorted = [
    ...all
  ].sort(
    (a, b) =>
      a - b
  );


  if (
    JSON.stringify(
      sorted
    ) !==
    JSON.stringify(
      expected
    )
  ) {

    fail(
      'invalid-argument',
      'El mapa debe incluir todos los números de asiento del vehículo una sola vez.'
    );
  }


  const sideBySeat =
    new Map();


  for (
    const number of left
  ) {

    sideBySeat.set(
      number,
      'left'
    );
  }


  for (
    const number of right
  ) {

    sideBySeat.set(
      number,
      'right'
    );
  }


  for (
    const number of center
  ) {

    sideBySeat.set(
      number,
      'center'
    );
  }


  return {
    left,
    right,
    center,
    sideBySeat
  };
}


// ======================================================
// AUTORIDAD LOGISTICA
// ======================================================

function canConfigureSeatLayout(
  profile,
  event
) {

  if (
    !profile ||
    !event ||
    profile.active !== true ||
    !profile.uid ||
    !profile.campaignId ||
    event.active !== true ||
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
    profile.active !== true ||
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
// CONFIGURAR MAPA FISICO
// ======================================================

exports.configureEventTransportSeatLayout =
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


      const requestId =
        validRequestId(
          input.requestId
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
            vehicle.active !== true ||
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
            !canConfigureSeatLayout(
              profile,
              event
            )
          ) {

            fail(
              'permission-denied',
              'No tienes autorización para configurar esta unidad.'
            );
          }


          // ==============================================
          // MAPA
          // ==============================================

          const layout =
            validateSeatSideLayout({
              capacity:
                vehicle.capacity,

              leftSeatNumbers:
                input.leftSeatNumbers,

              rightSeatNumbers:
                input.rightSeatNumbers,

              centerSeatNumbers:
                input.centerSeatNumbers
            });


          const fingerprint =
            hash(
              vehicleId,
              layout.left,
              layout.right,
              layout.center
            );


          // ==============================================
          // IDEMPOTENCIA
          // ==============================================

          if (
            vehicle.seatLayoutRequestId ===
              requestId
          ) {

            if (
              vehicle.seatLayoutFingerprint !==
                fingerprint
            ) {

              fail(
                'already-exists',
                'Este identificador de operación ya fue usado con otro mapa.'
              );
            }


            return {
              success:
                true,

              idempotent:
                true,

              layout: {
                vehicleId,

                seatSideReference:
                  SEAT_SIDE_REFERENCE,

                leftSideMeaning:
                  LEFT_SIDE_MEANING,

                rightSideMeaning:
                  RIGHT_SIDE_MEANING,

                leftSeatNumbers:
                  layout.left,

                rightSeatNumbers:
                  layout.right,

                centerSeatNumbers:
                  layout.center
              }
            };
          }


          // ==============================================
          // ASIENTOS
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
            seatsSnapshot.docs
              .map(
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
              'La cantidad de asientos no coincide con la capacidad del vehículo.'
            );
          }


          // ==============================================
          // NO RECONFIGURAR DESPUES DE REPARTIR
          // ==============================================

          const hasOperationalUse =
            Number(
              vehicle.allocatedSeatCount
            ) > 0 ||
            Number(
              vehicle.occupiedCount
            ) > 0 ||
            seats.some(
              seat =>
                Boolean(
                  seat.allocationId
                ) ||
                Boolean(
                  seat.assignmentId
                ) ||
                Boolean(
                  seat.personId
                )
            );


          if (
            hasOperationalUse
          ) {

            fail(
              'failed-precondition',
              'El mapa de asientos debe configurarse antes de repartir cupos o asignar pasajeros.'
            );
          }


          // ==============================================
          // TODAS LAS LECTURAS TERMINARON
          // ==============================================

          const serverNow =
            FieldValue
              .serverTimestamp();


          for (
            const seat of
            seats
          ) {

            const side =
              layout.sideBySeat
                .get(
                  seat.seatNumber
                );


            tx.update(
              seat.ref,
              {
                physicalSide:
                  side,

                updatedAt:
                  serverNow,

                version:
                  (
                    Number(
                      seat.version
                    ) ||
                    1
                  ) + 1
              }
            );
          }


          tx.update(
            vehicleRef,
            {
              seatLayoutConfigured:
                true,

              seatLayoutType:
                'side_map',

              seatSideReference:
                SEAT_SIDE_REFERENCE,

              leftSideMeaning:
                LEFT_SIDE_MEANING,

              rightSideMeaning:
                RIGHT_SIDE_MEANING,

              leftSeatCount:
                layout.left.length,

              rightSeatCount:
                layout.right.length,

              centerSeatCount:
                layout.center.length,

              seatLayoutRequestId:
                requestId,

              seatLayoutFingerprint:
                fingerprint,

              seatLayoutVersion:
                (
                  Number(
                    vehicle.seatLayoutVersion
                  ) ||
                  0
                ) + 1,

              updatedAt:
                serverNow,

              version:
                (
                  Number(
                    vehicle.version
                  ) ||
                  1
                ) + 1
            }
          );


          tx.create(
            db.collection(
              'logs'
            ).doc(),
            {
              action:
                'EVENT_TRANSPORT_SEAT_LAYOUT_CONFIGURED',

              campaignId:
                profile.campaignId,

              eventId:
                event.id,

              vehicleId,

              seatSideReference:
                SEAT_SIDE_REFERENCE,

              leftSideMeaning:
                LEFT_SIDE_MEANING,

              rightSideMeaning:
                RIGHT_SIDE_MEANING,

              leftSeatNumbers:
                layout.left,

              rightSeatNumbers:
                layout.right,

              centerSeatNumbers:
                layout.center,

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

            layout: {
              vehicleId,

              capacity:
                vehicle.capacity,

              seatSideReference:
                SEAT_SIDE_REFERENCE,

              leftSideMeaning:
                LEFT_SIDE_MEANING,

              rightSideMeaning:
                RIGHT_SIDE_MEANING,

              leftSeatNumbers:
                layout.left,

              rightSeatNumbers:
                layout.right,

              centerSeatNumbers:
                layout.center
            }
          };
        }
      );
    }
  );


exports._test = {
  SEAT_SIDE_REFERENCE,
  LEFT_SIDE_MEANING,
  RIGHT_SIDE_MEANING,
  validateSeatSideLayout,
  canConfigureSeatLayout
};
