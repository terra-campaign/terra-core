'use strict';

const {
  onCall,
  HttpsError
} = require(
  'firebase-functions/v2/https'
);

const {
  getFirestore,
  FieldValue
} = require(
  'firebase-admin/firestore'
);

const {
  createHash
} = require(
  'node:crypto'
);

const {
  evaluateTerritorialGrant,
  territorialRecordMetadata
} = require(
  './territorial-access.cjs'
);


const OPTIONS = {
  region: 'us-central1',
  timeoutSeconds: 60
};


function text(value) {
  return typeof value === 'string'
    ? value.trim()
    : '';
}


function normalizeOtherChoice(value) {

  return text(value)
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}


function normalizeChoiceKey(value) {

  return createHash('sha256')
    .update(
      value
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        )
        .toLowerCase()
    )
    .digest('hex')
    .slice(0, 24);
}


function validateInput(data = {}) {

  const response =
    text(data.response);

  const submissionId =
    text(data.submissionId);

  const visitResult =
    text(data.visitResult);

  let otherText =
    normalizeOtherChoice(
      data.otherText
    );

  if (
    !['yes', 'no', 'other'].includes(
      response
    )
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Respuesta de apoyo inválida.'
    );
  }

  if (
    !submissionId ||
    submissionId.length > 100
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Identificador de envío inválido.'
    );
  }

  if (
    visitResult !==
    'flyer_entregado'
  ) {
    throw new HttpsError(
      'failed-precondition',
      'La pregunta de apoyo solo aplica cuando hubo entrega directa del material.'
    );
  }

  if (
    response === 'other' &&
    otherText.length < 2
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Indique a quién declaró apoyar la persona.'
    );
  }

  if (
    response !== 'other'
  ) {
    otherText = '';
  }

  return {
    response,
    otherText,
    submissionId,
    visitResult
  };
}


async function getAuthorizedContext(
  db,
  uid
) {

  const [
    profileSnap,
    grantSnap
  ] = await Promise.all([
    db.doc(
      `usuarios/${uid}`
    ).get(),

    db.doc(
      `territorialAccessGrants/${uid}`
    ).get()
  ]);

  const profile =
    profileSnap.data();

  if (
    !profile ||
    profile.active !== true ||
    !text(profile.campaignId)
  ) {
    throw new HttpsError(
      'permission-denied',
      'Cuenta no habilitada.'
    );
  }

  if (!grantSnap.exists) {
    throw new HttpsError(
      'permission-denied',
      'No existe autorización territorial.'
    );
  }

  const grant =
    grantSnap.data();

  const evaluation =
    evaluateTerritorialGrant({
      grant,
      uid,
      campaignId:
        profile.campaignId,
      permission: 'write',
      nowMs: Date.now()
    });

  if (!evaluation.allowed) {
    throw new HttpsError(
      'permission-denied',
      'La autorización territorial no permite registrar esta respuesta.'
    );
  }

  const metadata =
    territorialRecordMetadata(
      grant
    );

  return {
    profile,
    grant,
    metadata
  };
}


exports.recordCandidateSupportResponse =
  onCall(
    OPTIONS,
    async (request) => {

      if (!request.auth) {
        throw new HttpsError(
          'unauthenticated',
          'Inicie sesión.'
        );
      }

      const input =
        validateInput(
          request.data
        );

      const db =
        getFirestore();

      const {
        profile,
        grant,
        metadata
      } =
        await getAuthorizedContext(
          db,
          request.auth.uid
        );

      const campaignId =
        text(profile.campaignId);

      const recordMode =
        text(metadata.recordMode) ||
        text(grant.mode);

      const statsId =
        `${campaignId}__${recordMode}`;

      const statsRef =
        db.doc(
          `candidateSupportStats/${statsId}`
        );

      const receiptRef =
        db.doc(
          `candidateSupportStats/${statsId}/receipts/${input.submissionId}`
        );

      const otherChoiceRef =
        input.response === 'other'
          ? db.doc(
              `candidateSupportStats/${statsId}/otherChoices/${normalizeChoiceKey(input.otherText)}`
            )
          : null;

      const result =
        await db.runTransaction(
          async (tx) => {

            const receiptSnap =
              await tx.get(
                receiptRef
              );

            if (
              receiptSnap.exists
            ) {
              return {
                duplicate: true
              };
            }

            const increments = {
              totalResponses:
                FieldValue.increment(1),

              updatedAt:
                FieldValue.serverTimestamp()
            };

            if (
              input.response === 'yes'
            ) {
              increments.yes =
                FieldValue.increment(1);
            }

            if (
              input.response === 'no'
            ) {
              increments.no =
                FieldValue.increment(1);
            }

            if (
              input.response === 'other'
            ) {
              increments.other =
                FieldValue.increment(1);
            }

            tx.set(
              statsRef,
              {
                campaignId,
                recordMode,
                ...increments
              },
              {
                merge: true
              }
            );

            if (otherChoiceRef) {

              tx.set(
                otherChoiceRef,
                {
                  label:
                    input.otherText,

                  count:
                    FieldValue.increment(1),

                  updatedAt:
                    FieldValue.serverTimestamp()
                },
                {
                  merge: true
                }
              );
            }

            tx.set(
              receiptRef,
              {
                campaignId,
                recordMode,

                createdAt:
                  FieldValue.serverTimestamp(),

                version: 1
              }
            );

            return {
              duplicate: false
            };
          }
        );

      return {
        ok: true,
        duplicate:
          result.duplicate === true
      };
    }
  );


exports._test = {
  validateInput,
  normalizeOtherChoice,
  normalizeChoiceKey
};
