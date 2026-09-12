'use strict';

// ======================================================
// TERRA CAMPAIGN
// BUILD-117B-1 — ACTIVIDAD REAL DEL PERFIL OPERATIVO
// ======================================================

const {
  onCall,
  HttpsError
} = require('firebase-functions/v2/https');

const {
  getFirestore
} = require('firebase-admin/firestore');


const OPTIONS = {
  region: 'us-central1',
  timeoutSeconds: 60
};


function fail(code, message) {
  throw new HttpsError(code, message);
}


function validDocumentId(value) {

  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    !value.includes('/')
  );
}


function profile(snapshot) {

  if (!snapshot.exists) {
    return null;
  }

  return {
    ...snapshot.data(),
    uid: snapshot.id
  };
}


// ======================================================
// AUTORIZACIÓN
//
// Mantiene el mismo alcance conceptual del perfil:
//
// - propia cuenta
// - admin de la misma campaña
// - jerarquía directa
// - responsable de estructura dentro de su estructura
// - compatibilidad con coordinador/brigadista legado
//
// No se concede al coordinador municipal acceso general
// a datos individuales de descendientes.
// ======================================================

function canReadTarget(caller, target) {

  if (!caller || !target) {
    return false;
  }

  if (caller.uid === target.uid) {
    return true;
  }

  if (
    caller.active !== true ||
    !caller.campaignId ||
    target.campaignId !== caller.campaignId
  ) {
    return false;
  }

  if (caller.role === 'admin') {
    return true;
  }

  // Modelo anterior:
  // coordinador -> brigadista
  if (
    caller.role === 'coordinador' &&
    target.role === 'brigadista' &&
    Array.isArray(caller.brigadeIds) &&
    caller.brigadeIds.includes(target.brigadeId)
  ) {
    return true;
  }

  // Subordinado directo.
  if (
    [
      'coordinador_municipal',
      'jefe_estructura',
      'integrante'
    ].includes(caller.role) &&
    target.parentUserId === caller.uid
  ) {
    return true;
  }

  // Responsable de estructura:
  // puede consultar integrantes y participantes
  // de su propia estructura.
  if (
    caller.role === 'jefe_estructura' &&
    typeof caller.structureId === 'string' &&
    caller.structureId &&
    target.structureId === caller.structureId
  ) {
    return true;
  }

  return false;
}


// ======================================================
// CÁLCULO PURO
// ======================================================

function buildSummary({
  targetUid,
  campaignId,
  missions,
  evidence,
  reviews
}) {

  const missionMap = new Map();

  for (const row of missions) {

    const mission = row.data;

    if (
      mission.campaignId !== campaignId ||
      mission.assignedTo !== targetUid ||
      mission.linkedVersion !== 1
    ) {
      continue;
    }

    missionMap.set(
      row.id,
      mission
    );
  }


  const evidenceMap = new Map();

  for (const row of evidence) {

    const report = row.data;

    if (
      report.campaignId !== campaignId ||
      report.uploadedBy !== targetUid ||
      !missionMap.has(report.missionId)
    ) {
      continue;
    }

    evidenceMap.set(
      row.id,
      report
    );
  }


  const completedMissionIds =
    new Set();


  for (const row of reviews) {

    const review = row.data;

    if (
      review.campaignId !== campaignId ||
      review.subjectId !== targetUid ||
      review.evidenceId !== row.id ||
      review.status !== 'validated' ||
      review.pendingAppeal === true
    ) {
      continue;
    }

    const report =
      evidenceMap.get(row.id);

    if (!report) {
      continue;
    }

    completedMissionIds.add(
      report.missionId
    );
  }


  return {
    assigned:
      missionMap.size,

    completed:
      completedMissionIds.size,

    evidence:
      evidenceMap.size
  };
}


// ======================================================
// CALLABLE
// ======================================================

exports.getPersonActivitySummary =
  onCall(
    OPTIONS,

    async (request) => {

      if (!request.auth) {
        fail(
          'unauthenticated',
          'Inicia sesión.'
        );
      }


      const targetUid =
        request.data?.uid;


      if (!validDocumentId(targetUid)) {
        fail(
          'invalid-argument',
          'Persona inválida.'
        );
      }


      const db =
        getFirestore();


      return db.runTransaction(
        async (tx) => {

          const callerSnapshot =
            await tx.get(
              db
                .collection('usuarios')
                .doc(request.auth.uid)
            );


          const targetSnapshot =
            request.auth.uid === targetUid
              ? callerSnapshot
              : await tx.get(
                  db
                    .collection('usuarios')
                    .doc(targetUid)
                );


          const caller =
            profile(callerSnapshot);

          const target =
            profile(targetSnapshot);


          if (!caller) {
            fail(
              'permission-denied',
              'Perfil no autorizado.'
            );
          }


          if (!target) {
            fail(
              'not-found',
              'La persona no existe.'
            );
          }


          if (
            !canReadTarget(
              caller,
              target
            )
          ) {
            fail(
              'permission-denied',
              'No tienes permiso para consultar la actividad de esta persona.'
            );
          }


          if (!target.campaignId) {
            fail(
              'failed-precondition',
              'La persona no tiene una campaña configurada.'
            );
          }


          // Consultas por un solo campo:
          // no requieren índices compuestos adicionales.

          const missionsSnapshot =
            await tx.get(
              db
                .collection('misiones')
                .where(
                  'assignedTo',
                  '==',
                  targetUid
                )
                .limit(5001)
            );


          const evidenceSnapshot =
            await tx.get(
              db
                .collection('missionEvidence')
                .where(
                  'uploadedBy',
                  '==',
                  targetUid
                )
                .limit(5001)
            );


          const reviewsSnapshot =
            await tx.get(
              db
                .collection('missionReviews')
                .where(
                  'subjectId',
                  '==',
                  targetUid
                )
                .limit(5001)
            );


          if (
            missionsSnapshot.size > 5000 ||
            evidenceSnapshot.size > 5000 ||
            reviewsSnapshot.size > 5000
          ) {
            fail(
              'resource-exhausted',
              'El historial de esta persona requiere paginación; no se mostrarán cifras parciales.'
            );
          }


          const result =
            buildSummary({

              targetUid,

              campaignId:
                target.campaignId,

              missions:
                missionsSnapshot.docs.map(
                  (doc) => ({
                    id: doc.id,
                    data: doc.data()
                  })
                ),

              evidence:
                evidenceSnapshot.docs.map(
                  (doc) => ({
                    id: doc.id,
                    data: doc.data()
                  })
                ),

              reviews:
                reviewsSnapshot.docs.map(
                  (doc) => ({
                    id: doc.id,
                    data: doc.data()
                  })
                )
            });


          return {
            ...result,
            calculatedAt:
              Date.now()
          };
        }
      );
    }
  );


// Solo para pruebas locales.
// No expone datos adicionales mediante Firebase.
exports._test = {
  validDocumentId,
  canReadTarget,
  buildSummary
};
