'use strict';

// ======================================================
// TERRA CAMPAIGN
// BUILD-118C-3B3E-3G-B1
//
// VEHICULOS DE TRANSPORTE POR EVENTO
// + CAPACIDAD CONFIGURABLE
// + ASIENTOS ADMINISTRABLES
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


const MAX_VEHICLE_CAPACITY =
  120;


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
// HASH ESTABLE
// ======================================================

function hash(
  ...parts
) {

  return createHash('sha256')
    .update(
      JSON.stringify(parts)
    )
    .digest('hex');
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


function validRequestId(value) {

  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(
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


function text(
  value,
  label,
  maxLength = 160
) {

  const normalized =
    typeof value === 'string'
      ? value.trim()
      : '';


  if (
    !normalized ||
    normalized.length >
      maxLength
  ) {

    fail(
      'invalid-argument',
      `${label} inválido.`
    );
  }


  return normalized;
}


function optionalText(
  value,
  maxLength = 240
) {

  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return '';
  }


  const normalized =
    typeof value === 'string'
      ? value.trim()
      : '';


  if (
    normalized.length >
      maxLength
  ) {

    fail(
      'invalid-argument',
      'Texto demasiado largo.'
    );
  }


  return normalized;
}


function vehicleCapacity(value) {

  const number =
    Number(value);


  if (
    !Number.isInteger(number) ||
    number < 1 ||
    number >
      MAX_VEHICLE_CAPACITY
  ) {

    fail(
      'invalid-argument',
      `La capacidad debe ser un entero entre 1 y ${MAX_VEHICLE_CAPACITY}.`
    );
  }


  return number;
}


function departureAt(value) {

  const normalized =
    text(
      value,
      'Hora de salida',
      80
    );


  const millis =
    Date.parse(
      normalized
    );


  if (
    !Number.isFinite(
      millis
    )
  ) {

    fail(
      'invalid-argument',
      'La hora de salida no es válida.'
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
// PERFIL
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
        .doc(
          request.auth.uid
        )
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
    uid:
      snapshot.id
  };
}


// ======================================================
// ALCANCE DE ADMINISTRACION DE TRANSPORTE
//
// event:
//   creador del evento maestro.
//
// branch:
//   usuario que recibió una invitación activa
//   y opera solamente su propia rama.
//
// colaborador_base:
//   destinatario terminal; solicita transporte,
//   pero no administra vehículos.
// ======================================================

function transportVehicleCreationScope(
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
    return null;
  }


  // El creador del evento administra
  // el inventario físico de transporte.
  if (
    event.createdBy ===
      profile.uid
  ) {

    return {
      type:
        'event_owner'
    };
  }


  // Preparado para responsables logísticos
  // explícitamente designados.
  //
  // Todavía no existe UI para asignarlos.
  if (
    Array.isArray(
      event.transportManagerIds
    ) &&
    event.transportManagerIds
      .includes(
        profile.uid
      )
  ) {

    return {
      type:
        'transport_manager'
    };
  }


  return null;
}


// ======================================================
// IMPORTANTE
//
// Una invitación al evento NO concede permiso
// para crear vehículos.
//
// Los responsables de ramas / integrantes
// solicitarán o recibirán CUPOS mediante
// eventTransportAllocations en BUILD 3G-B2.
// ======================================================


// ======================================================
// IDENTIFICADORES
// ======================================================

function vehicleIdFor(
  profileUid,
  eventId,
  requestId
) {

  return hash(
    profileUid,
    eventId,
    requestId,
    'event-transport-vehicle-v1'
  );
}


function seatIdFor(
  vehicleId,
  seatNumber
) {

  return hash(
    vehicleId,
    seatNumber,
    'event-transport-seat-v1'
  );
}


// ======================================================
// VISTA SEGURA
// ======================================================

function vehicleView(
  data
) {

  if (!data) {
    return null;
  }


  return {
    id:
      data.id || '',

    eventId:
      data.eventId || '',

    name:
      data.name || '',

    vehicleType:
      data.vehicleType || '',

    capacity:
      Number(data.capacity) ||
      0,

    seatCount:
      Number(data.seatCount) ||
      0,

    occupiedCount:
      Number(
        data.occupiedCount
      ) || 0,

    allocatedSeatCount:
      Number(
        data.allocatedSeatCount
      ) || 0,

    availableSeatCount:
      Number.isFinite(
        data.availableSeatCount
      )
        ? data.availableSeatCount
        : (
            Number(data.capacity) ||
            0
          ),

    sharingMode:
      data.sharingMode ||
      'allocatable',

    origin:
      data.origin || '',

    destination:
      data.destination || '',

    departureAt:
      data.departureAt || '',

    departureAtMillis:
      Number.isFinite(
        data.departureAtMillis
      )
        ? data.departureAtMillis
        : null,

    creationScopeType:
      data.creationScopeType ||
      '',

    managedByUserId:
      data.managedByUserId ||
      '',

    managedByName:
      data.managedByName ||
      '',

    managedByRole:
      data.managedByRole ||
      '',

    active:
      data.active === true,

    version:
      Number(data.version) ||
      1
  };
}


// ======================================================
// CREAR VEHICULO + ASIENTOS
// ======================================================

exports.createEventTransportVehicle =
  onCall(
    OPTIONS,

    async request => {

      const input =
        request.data || {};


      const eventId =
        validId(
          input.eventId
        );


      const requestId =
        validRequestId(
          input.requestId
        );


      const name =
        text(
          input.name,
          'Nombre de unidad',
          100
        );


      const vehicleType =
        text(
          input.vehicleType,
          'Tipo de vehículo',
          80
        );


      const capacity =
        vehicleCapacity(
          input.capacity
        );


      const origin =
        text(
          input.origin,
          'Punto de salida',
          180
        );


      const destination =
        optionalText(
          input.destination,
          180
        );


      const departure =
        departureAt(
          input.departureAt
        );


      const db =
        getFirestore();


      return db.runTransaction(
        async tx => {

          // ==============================================
          // PERFIL
          // ==============================================

          const profile =
            await caller(
              tx,
              db,
              request
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
            event.campaignId !==
              profile.campaignId ||
            event.active !== true
          ) {

            fail(
              'permission-denied',
              'El evento no está disponible para esta cuenta.'
            );
          }


          // ==============================================
          // AUTORIDAD PARA CREAR INVENTARIO FISICO
          // ==============================================

          const scope =
            transportVehicleCreationScope(
              profile,
              event
            );


          if (!scope) {

            fail(
              'permission-denied',
              'No tienes autorización para administrar transporte de este evento.'
            );
          }


          // ==============================================
          // IDENTIDAD IDEMPOTENTE DE VEHICULO
          // ==============================================

          const vehicleId =
            vehicleIdFor(
              profile.uid,
              eventId,
              requestId
            );


          const vehicleRef =
            db.collection(
              'eventTransportVehicles'
            ).doc(
              vehicleId
            );


          const existingVehicle =
            await tx.get(
              vehicleRef
            );


          const fingerprint =
            hash(
              eventId,
              name,
              vehicleType,
              capacity,
              origin,
              destination,
              departure.iso,

              // Contexto de autorización de creación.
              scope.type
            );


          if (
            existingVehicle.exists
          ) {

            const saved =
              existingVehicle.data();


            if (
              saved.campaignId !==
                profile.campaignId ||
              saved.managedByUserId !==
                profile.uid ||
              saved.requestFingerprint !==
                fingerprint
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

              vehicle:
                vehicleView(
                  saved
                )
            };
          }


          // ==============================================
          // VALIDAR SALIDA VS EVENTO
          // ==============================================

          const eventStartsAtMillis =
            Number.isFinite(
              event.startsAtMillis
            )
              ? event.startsAtMillis
              : Date.parse(
                  event.startsAt || ''
                );


          if (
            Number.isFinite(
              eventStartsAtMillis
            ) &&
            departure.millis >
              eventStartsAtMillis
          ) {

            fail(
              'invalid-argument',
              'La salida del transporte no puede ser posterior al inicio del evento.'
            );
          }


          // ==============================================
          // TODAS LAS LECTURAS TERMINARON.
          // A PARTIR DE AQUI SOLO ESCRITURAS.
          // ==============================================

          const serverNow =
            FieldValue
              .serverTimestamp();


          const vehicleRecord = {
            id:
              vehicleId,

            campaignId:
              profile.campaignId,

            eventId,

            requestId,

            requestFingerprint:
              fingerprint,

            name,

            vehicleType,

            capacity,

            seatCount:
              capacity,

            occupiedCount:
              0,

            // Lugares reservados a responsables/estructuras.
            // En B1 todavía todos nacen libres.
            allocatedSeatCount:
              0,

            availableSeatCount:
              capacity,

            // El vehículo puede dividirse entre varias
            // ramas, responsables o estructuras.
            sharingMode:
              'allocatable',

            origin,

            destination,

            departureAt:
              departure.iso,

            departureAtMillis:
              departure.millis,

            // Alcance bajo el cual se autorizó
            // la creación del vehículo.
            //
            // NO representa propiedad exclusiva
            // de sus asientos.
            creationScopeType:
              scope.type,

            managedByUserId:
              profile.uid,

            managedByName:
              profile.name ||
              '',

            managedByRole:
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
            vehicleRef,
            vehicleRecord
          );


          // ==============================================
          // ASIENTOS REALES
          // ==============================================

          for (
            let seatNumber = 1;
            seatNumber <=
              capacity;
            seatNumber += 1
          ) {

            const seatId =
              seatIdFor(
                vehicleId,
                seatNumber
              );


            tx.create(
              db.collection(
                'eventTransportSeats'
              ).doc(
                seatId
              ),
              {
                id:
                  seatId,

                campaignId:
                  profile.campaignId,

                eventId,

                vehicleId,

                seatNumber,

                seatLabel:
                  String(
                    seatNumber
                  ),

                status:
                  'free',

                personId:
                  null,

                accountUid:
                  null,

                // B1:
                // asiento físico libre.
                //
                // B2:
                // allocationId identificará el cupo
                // reservado para una rama/responsable.
                allocationId:
                  null,

                allocatedToUserId:
                  null,

                allocatedToRole:
                  null,

                allocatedToStructureId:
                  null,

                allocatedToMunicipalityId:
                  null,

                allocationZone:
                  null,

                // B3:
                // assignmentId identificará a la
                // PERSONA concreta que ocupará el asiento.
                assignmentId:
                  null,

                active:
                  true,

                version:
                  1,

                createdAt:
                  serverNow,

                updatedAt:
                  serverNow
              }
            );
          }


          // ==============================================
          // AUDITORIA
          // ==============================================

          tx.create(
            db.collection(
              'logs'
            ).doc(),
            {
              action:
                'EVENT_TRANSPORT_VEHICLE_CREATED',

              campaignId:
                profile.campaignId,

              eventId,

              vehicleId,

              vehicleName:
                name,

              vehicleType,

              capacity,

              creationScopeType:
                scope.type,

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

            vehicle:
              vehicleView(
                vehicleRecord
              )
          };
        }
      );
    }
  );


// ======================================================
// TEST HELPERS
// ======================================================

exports._test = {
  ALLOWED_ROLES,
  MAX_VEHICLE_CAPACITY,
  transportVehicleCreationScope,
  vehicleIdFor,
  seatIdFor
};
