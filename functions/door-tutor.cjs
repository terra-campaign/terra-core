'use strict';

// ======================================================
// TERRA CAMPAIGN
// BUILD-118C-3B3C
// RESOLUCION SEGURA DE TUTOR EN PUERTA
//
// NO registra persona.
// NO crea membresia.
// NO asigna tutor.
// NO toma asistencia.
//
// A partir del invitador ya confirmado:
// - valida municipio
// - reconstruye rama territorial
// - devuelve exclusivamente tutores legitimos
//
// COLABORADOR DE BASE -> tutor = PARTICIPANTE
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


const ALLOWED_CALLER_ROLES =
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


function validOpaqueRef(
  value
) {

  return /^[a-f0-9]{64}$/.test(
    String(
      value || ''
    ).trim()
  );
}


// Debe coincidir exactamente con BUILD-118C-3B3A.
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


function opaqueTutorRef(
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
        'door-tutor-v1'
      ])
    )
    .digest(
      'hex'
    );
}


function tutorResolutionMode(
  inviterRole
) {

  switch (
    inviterRole
  ) {

    case 'participante':
      return 'inviter_is_tutor';

    case 'integrante':
      return 'direct_participants';

    case 'jefe_estructura':
      return 'structure_participants';

    case 'coordinador_municipal':
      return 'pending_structure_assignment';

    default:
      return 'unsupported';
  }
}


// ======================================================
// POLITICA DE TUTOR
// ======================================================

function tutorCandidateAllowed(
  inviter,
  candidate
) {

  if (
    !inviter ||
    !candidate ||
    inviter.active !== true ||
    candidate.active !== true ||
    !inviter.uid ||
    !candidate.uid ||
    inviter.campaignId !==
      candidate.campaignId ||
    inviter.municipalityId !==
      candidate.municipalityId ||
    candidate.role !==
      'participante'
  ) {

    return false;
  }


  // --------------------------------------------------
  // PARTICIPANTE
  // él mismo es tutor.
  // --------------------------------------------------

  if (
    inviter.role ===
      'participante'
  ) {

    return (
      inviter.uid ===
      candidate.uid
    );
  }


  // --------------------------------------------------
  // INTEGRANTE
  // solo sus participantes directos.
  // --------------------------------------------------

  if (
    inviter.role ===
      'integrante'
  ) {

    return Boolean(
      inviter.structureId &&
      candidate.structureId ===
        inviter.structureId &&
      candidate.parentUserId ===
        inviter.uid
    );
  }


  // --------------------------------------------------
  // RESPONSABLE DE ESTRUCTURA
  // participantes de SU estructura.
  // --------------------------------------------------

  if (
    inviter.role ===
      'jefe_estructura'
  ) {

    return Boolean(
      inviter.structureId &&
      candidate.structureId ===
        inviter.structureId
    );
  }


  // --------------------------------------------------
  // RESPONSABLE DE ORGANIZACION
  // no puede repartir una persona desde puerta
  // entre estructuras del municipio.
  // --------------------------------------------------

  return false;
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
    !ALLOWED_CALLER_ROLES.has(
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
// CALLABLE
// ======================================================

exports.getDoorTutorCandidates =
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


      const data =
        request.data || {};


      const residenceMunicipalityId =
        validId(
          data.residenceMunicipalityId
        );


      const inviterRef =
        String(
          data.inviterRef || ''
        ).trim();


      if (
        !residenceMunicipalityId
      ) {

        fail(
          'invalid-argument',
          'Selecciona el municipio de residencia.'
        );
      }


      if (
        !validOpaqueRef(
          inviterRef
        )
      ) {

        fail(
          'invalid-argument',
          'La referencia del invitador no es válida.'
        );
      }


      const receiverMunicipalityId =
        validId(
          caller.municipalityId
        );


      if (
        !receiverMunicipalityId
      ) {

        fail(
          'failed-precondition',
          'Tu perfil no tiene municipio territorial asignado.'
        );
      }


      // ==================================================
      // JURISDICCION DURA
      // ==================================================

      if (
        residenceMunicipalityId !==
          receiverMunicipalityId
      ) {

        fail(
          'permission-denied',
          'La persona pertenece a otro municipio. No puede asignarse tutor desde esta estructura.'
        );
      }


      // ==================================================
      // USUARIOS DE CAMPAÑA
      //
      // Temporal hasta índice escalable.
      // ==================================================

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
          'La campaña requiere un índice escalable antes de resolver tutores.'
        );
      }


      const users =
        snapshot.docs.map(
          document => ({
            ...document.data(),

            uid:
              document.id
          })
        );


      // ==================================================
      // RESOLVER REFERENCIA OPACA DEL INVITADOR
      // ==================================================

      const inviter =
        users.find(
          user =>
            opaqueInviterRef(
              caller.campaignId,
              user.uid
            ) ===
              inviterRef
        );


      if (!inviter) {

        fail(
          'not-found',
          'No fue posible resolver a la persona que aparece como invitador.'
        );
      }


      if (
        inviter.active !== true ||
        inviter.campaignId !==
          caller.campaignId ||
        inviter.municipalityId !==
          residenceMunicipalityId ||
        !INVITER_ROLES.has(
          inviter.role
        )
      ) {

        fail(
          'failed-precondition',
          'La referencia del invitador ya no es territorialmente válida.'
        );
      }


      const mode =
        tutorResolutionMode(
          inviter.role
        );


      // ==================================================
      // COORDINADOR MUNICIPAL
      //
      // No repartimos la persona desde la puerta entre
      // estructuras distintas.
      // ==================================================

      if (
        mode ===
          'pending_structure_assignment'
      ) {

        return {

          success:
            true,

          mode,

          requiresBranchResolution:
            true,

          canSelectTutor:
            false,

          inviter: {

            name:
              cleanText(
                inviter.name,
                120
              ),

            role:
              inviter.role,

            municipalityName:
              cleanText(
                inviter.municipalityName,
                120
              )
          },

          candidates:
            [],

          message:
            'La referencia pertenece al Responsable de organización. Primero debe definirse la estructura territorial; la recepción no puede escogerla.'
        };
      }


      // ==================================================
      // ESTRUCTURA REQUERIDA
      // ==================================================

      if (
        (
          inviter.role ===
            'integrante' ||
          inviter.role ===
            'jefe_estructura'
        ) &&
        !validId(
          inviter.structureId
        )
      ) {

        fail(
          'failed-precondition',
          'El invitador no tiene una estructura territorial válida.'
        );
      }


      // ==================================================
      // TUTORES LEGITIMOS
      // ==================================================

      const candidates =
        users
          .filter(
            candidate =>
              tutorCandidateAllowed(
                inviter,
                candidate
              )
          )
          .map(
            candidate => ({

              tutorRef:
                opaqueTutorRef(
                  caller.campaignId,
                  candidate.uid
                ),

              name:
                cleanText(
                  candidate.name,
                  120
                ),

              role:
                'participante',

              locality:
                cleanText(
                  candidate.locality,
                  120
                ),

              structureName:
                cleanText(
                  candidate.structureName,
                  120
                ),

              relation:
                inviter.role ===
                  'participante'
                  ? 'inviter_self'
                  : (
                      inviter.role ===
                        'integrante'
                        ? 'direct_participant'
                        : 'same_structure'
                    )
            })
          );


      candidates.sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            'es'
          )
      );


      const deterministic =
        (
          mode ===
            'inviter_is_tutor' &&
          candidates.length === 1
        );


      let message = '';


      if (deterministic) {

        message =
          'La persona que invitó al asistente es Participante y puede fungir directamente como tutor.';

      } else if (
        candidates.length === 1
      ) {

        message =
          'Existe un tutor territorial válido dentro de la rama del invitador.';

      } else if (
        candidates.length > 1
      ) {

        message =
          'Hay varios tutores válidos dentro de la misma rama. La recepción no debe escoger por conveniencia; confirma el tutor con el invitador o responsable de esa rama.';

      } else {

        message =
          'No existe todavía un Participante válido que pueda fungir como tutor dentro de esta rama.';
      }


      return {

        success:
          true,

        mode,

        requiresBranchResolution:
          false,

        canSelectTutor:
          candidates.length > 0,

        deterministic,

        inviter: {

          name:
            cleanText(
              inviter.name,
              120
            ),

          role:
            inviter.role,

          locality:
            cleanText(
              inviter.locality,
              120
            ),

          structureName:
            cleanText(
              inviter.structureName,
              120
            )
        },

        candidates:
          candidates.slice(
            0,
            50
          ),

        totalCandidates:
          candidates.length,

        limited:
          candidates.length > 50,

        message
      };
    }
  );


// ======================================================
// HELPERS PARA PRUEBAS
// ======================================================

exports._test = {
  validId,
  validOpaqueRef,
  opaqueInviterRef,
  opaqueTutorRef,
  tutorResolutionMode,
  tutorCandidateAllowed
};
