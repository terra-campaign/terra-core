'use strict';

// ======================================================
// TERRA CAMPAIGN
// BUILD-118C-3B3A
// RESOLUCION NEUTRAL EN PUERTA
//
// Este modulo NO registra personas.
// Este modulo NO crea membresias.
// Este modulo NO toma asistencia.
//
// Resuelve:
// - municipio de residencia
// - compatibilidad con municipio receptor
// - posible invitador dentro de TERRA
//
// Regla:
// una estructura NO puede incorporar territorialmente
// a una persona residente de otro municipio.
// ======================================================

const {
  createHash
} =
  require(
    'node:crypto'
  );

const {
  onCall,
  HttpsError
} =
  require(
    'firebase-functions/v2/https'
  );

const {
  getFirestore
} =
  require(
    'firebase-admin/firestore'
  );


const OPTIONS = {
  region:
    'us-central1',

  timeoutSeconds:
    60
};


const ALLOWED_ROLES =
  new Set([
    'admin',
    'lider_principal',
    'coordinador_municipal',
    'jefe_estructura',
    'integrante',
    'participante'
  ]);


const INVITER_ROLES =
  new Set([
    'coordinador_municipal',
    'jefe_estructura',
    'integrante',
    'participante'
  ]);


// ======================================================
// HELPERS
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


function cleanText(
  value,
  maxLength = 160
) {

  return String(
    value || ''
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
    .slice(
      0,
      maxLength
    );
}


function normalizeText(
  value
) {

  return cleanText(
    value,
    300
  )
    .toLowerCase()
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9\s]/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


function validId(
  value
) {

  const id =
    String(
      value || ''
    ).trim();


  if (
    !id ||
    id.length > 128 ||
    id.includes('/')
  ) {
    return '';
  }


  return id;
}


function opaqueInviterRef(
  campaignId,
  uid
) {

  return createHash(
    'sha256'
  )
    .update(
      JSON.stringify([
        campaignId,
        uid,
        'door-inviter-v1'
      ])
    )
    .digest(
      'hex'
    );
}


function doorJurisdictionStatus(
  receiverMunicipalityId,
  residenceMunicipalityId
) {

  if (
    !receiverMunicipalityId ||
    !residenceMunicipalityId
  ) {
    return 'unresolved';
  }


  if (
    receiverMunicipalityId ===
      residenceMunicipalityId
  ) {
    return 'same_municipality';
  }


  return 'other_municipality';
}


function roleLabel(
  role
) {

  const labels = {

    coordinador_municipal:
      'Responsable de organización',

    jefe_estructura:
      'Responsable de estructura',

    integrante:
      'Integrante',

    participante:
      'Participante'
  };


  return (
    labels[role] ||
    role ||
    ''
  );
}


// ======================================================
// PERFIL AUTENTICADO
// ======================================================

async function readCaller(
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
    await db
      .collection(
        'usuarios'
      )
      .doc(
        request.auth.uid
      )
      .get();


  if (!snapshot.exists) {

    fail(
      'permission-denied',
      'Perfil no autorizado.'
    );
  }


  const profile = {
    ...snapshot.data(),

    uid:
      snapshot.id
  };


  if (
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


  return profile;
}


// ======================================================
// MUNICIPIO
// ======================================================

async function readMunicipality(
  db,
  campaignId,
  municipalityId
) {

  const id =
    validId(
      municipalityId
    );


  if (!id) {

    fail(
      'invalid-argument',
      'Selecciona un municipio válido.'
    );
  }


  const snapshot =
    await db
      .collection(
        'municipios'
      )
      .doc(
        id
      )
      .get();


  if (!snapshot.exists) {

    fail(
      'not-found',
      'El municipio seleccionado no existe.'
    );
  }


  const municipality =
    snapshot.data();


  if (
    municipality.campaignId !==
      campaignId
  ) {

    fail(
      'permission-denied',
      'El municipio pertenece a otra campaña.'
    );
  }


  if (
    municipality.active !== true
  ) {

    fail(
      'failed-precondition',
      'El municipio está desactivado.'
    );
  }


  return {
    id:
      snapshot.id,

    name:
      cleanText(
        municipality.name ||
        municipality.municipalityName ||
        snapshot.id,
        120
      )
  };
}


// ======================================================
// CONTEXTO DE PUERTA
//
// Devuelve catálogo de municipios de la campaña
// y municipio de quien está operando.
//
// No devuelve datos personales adicionales.
// ======================================================

exports.getDoorRegistrationContext =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const caller =
        await readCaller(
          db,
          request
        );


      const snapshot =
        await db
          .collection(
            'municipios'
          )
          .where(
            'campaignId',
            '==',
            caller.campaignId
          )
          .limit(
            100
          )
          .get();


      const municipalities =
        snapshot.docs
          .map(
            document => {

              const data =
                document.data();


              return {

                id:
                  document.id,

                name:
                  cleanText(
                    data.name ||
                    data.municipalityName ||
                    document.id,
                    120
                  ),

                active:
                  data.active === true
              };
            }
          )
          .filter(
            item =>
              item.active === true
          )
          .sort(
            (a, b) =>
              a.name.localeCompare(
                b.name,
                'es'
              )
          );


      const receiverMunicipalityId =
        validId(
          caller.municipalityId
        );


      return {

        success:
          true,

        receiver: {

          name:
            cleanText(
              caller.name,
              120
            ),

          role:
            caller.role,

          municipalityId:
            receiverMunicipalityId,

          municipalityName:
            cleanText(
              caller.municipalityName,
              120
            ),

          structureId:
            validId(
              caller.structureId
            ),

          structureName:
            cleanText(
              caller.structureName,
              120
            )
        },

        canResolveOwnMunicipality:
          Boolean(
            receiverMunicipalityId
          ),

        municipalities
      };
    }
  );


// ======================================================
// BUSCAR A QUIEN INVITO A LA PERSONA
//
// REGLA CRITICA:
// si la persona vive en otro municipio,
// NO se permite buscar invitador para apropiacion local.
//
// La búsqueda solo muestra usuarios activos del
// MISMO municipio de residencia/receptor.
// ======================================================

exports.searchDoorInviterCandidates =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const caller =
        await readCaller(
          db,
          request
        );


      const receiverMunicipalityId =
        validId(
          caller.municipalityId
        );


      if (!receiverMunicipalityId) {

        fail(
          'failed-precondition',
          'Tu perfil no tiene un municipio territorial asignado para operar este registro.'
        );
      }


      const data =
        request.data || {};


      const residenceMunicipality =
        await readMunicipality(
          db,
          caller.campaignId,
          data.residenceMunicipalityId
        );


      const jurisdictionStatus =
        doorJurisdictionStatus(
          receiverMunicipalityId,
          residenceMunicipality.id
        );


      // ==================================================
      // OTRO MUNICIPIO
      // ==================================================

      if (
        jurisdictionStatus ===
          'other_municipality'
      ) {

        return {

          success:
            true,

          jurisdictionStatus,

          canRegisterHere:
            false,

          receiverMunicipalityId,

          receiverMunicipalityName:
            cleanText(
              caller.municipalityName,
              120
            ),

          residenceMunicipalityId:
            residenceMunicipality.id,

          residenceMunicipalityName:
            residenceMunicipality.name,

          candidates:
            [],

          message:
            `La persona vive en ${residenceMunicipality.name}. Esta estructura no puede incorporarla territorialmente.`
        };
      }


      // ==================================================
      // MISMO MUNICIPIO
      // ==================================================

      const query =
        normalizeText(
          data.inviterName
        );


      if (
        query.length < 4
      ) {

        fail(
          'invalid-argument',
          'Escribe al menos 4 caracteres del nombre de quien la invitó.'
        );
      }


      // Se consulta por campaña y se filtra en backend.
      // Evita exigir nuevo índice compuesto en este BUILD.
      const snapshot =
        await db
          .collection(
            'usuarios'
          )
          .where(
            'campaignId',
            '==',
            caller.campaignId
          )
          .limit(
            1001
          )
          .get();


      if (
        snapshot.size > 1000
      ) {

        fail(
          'resource-exhausted',
          'La campaña requiere un índice escalable antes de continuar esta búsqueda.'
        );
      }


      const candidates = [];


      for (
        const document of
        snapshot.docs
      ) {

        const person =
          document.data();


        if (
          person.active !== true ||
          person.municipalityId !==
            receiverMunicipalityId ||
          !INVITER_ROLES.has(
            person.role
          )
        ) {
          continue;
        }


        const normalizedName =
          normalizeText(
            person.name
          );


        if (
          !normalizedName ||
          !normalizedName.includes(
            query
          )
        ) {
          continue;
        }


        candidates.push({

          inviterRef:
            opaqueInviterRef(
              caller.campaignId,
              document.id
            ),

          name:
            cleanText(
              person.name,
              120
            ),

          role:
            person.role,

          roleLabel:
            roleLabel(
              person.role
            ),

          locality:
            cleanText(
              person.locality,
              120
            ),

          structureName:
            cleanText(
              person.structureName,
              120
            ),

          hasStructure:
            Boolean(
              validId(
                person.structureId
              )
            )
        });
      }


      candidates.sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            'es'
          )
      );


      return {

        success:
          true,

        jurisdictionStatus:
          'same_municipality',

        canRegisterHere:
          true,

        receiverMunicipalityId,

        receiverMunicipalityName:
          cleanText(
            caller.municipalityName,
            120
          ),

        residenceMunicipalityId:
          residenceMunicipality.id,

        residenceMunicipalityName:
          residenceMunicipality.name,

        candidates:
          candidates.slice(
            0,
            20
          ),

        totalCandidates:
          candidates.length,

        limited:
          candidates.length > 20,

        message:
          candidates.length
            ? 'Selecciona a la persona que el asistente identifica como quien lo invitó.'
            : 'No encontramos a esa persona dentro de este municipio.'
      };
    }
  );


// ======================================================
// HELPERS PARA PRUEBAS
// ======================================================

exports._test = {
  cleanText,
  normalizeText,
  validId,
  opaqueInviterRef,
  doorJurisdictionStatus,
  roleLabel
};
