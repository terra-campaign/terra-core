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

const MIN_PRODUCTION_SAMPLE = 5;


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
      'La pregunta de apoyo solo aplica cuando hubo contacto directo.'
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
  uid,
  permission
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
      permission,
      nowMs: Date.now()
    });


  if (!evaluation.allowed) {
    throw new HttpsError(
      'permission-denied',
      'La autorización territorial no permite esta operación.'
    );
  }


  const metadata =
    territorialRecordMetadata(
      grant
    );


  if (!metadata) {
    throw new HttpsError(
      'failed-precondition',
      'No fue posible determinar el contexto territorial.'
    );
  }


  return {
    profile,
    grant,
    metadata
  };
}


function safeIdPart(value) {

  return encodeURIComponent(
    text(value).slice(0, 120)
  );
}


function campaignStatsId(
  campaignId,
  recordMode
) {

  return (
    `${safeIdPart(campaignId)}` +
    `__${safeIdPart(recordMode)}`
  );
}


function municipalityStatsId(
  campaignId,
  recordMode,
  municipalityId
) {

  return (
    `${campaignStatsId(
      campaignId,
      recordMode
    )}` +
    `__municipality__` +
    `${safeIdPart(municipalityId)}`
  );
}


function structureStatsId(
  campaignId,
  recordMode,
  municipalityId,
  structureId
) {

  return (
    `${campaignStatsId(
      campaignId,
      recordMode
    )}` +
    `__structure__` +
    `${safeIdPart(municipalityId)}` +
    `__${safeIdPart(structureId)}`
  );
}


function brigadeStatsId(
  campaignId,
  recordMode,
  brigadeId
) {

  return (
    `${campaignStatsId(
      campaignId,
      recordMode
    )}` +
    `__brigade__` +
    `${safeIdPart(brigadeId)}`
  );
}


function writeScopeDescriptors({
  campaignId,
  recordMode,
  metadata
}) {

  const descriptors = [
    {
      statsId:
        campaignStatsId(
          campaignId,
          recordMode
        ),

      scopeType:
        'campaign',

      scopeId:
        campaignId
    }
  ];


  if (
    text(metadata.municipalityId)
  ) {

    descriptors.push({
      statsId:
        municipalityStatsId(
          campaignId,
          recordMode,
          metadata.municipalityId
        ),

      scopeType:
        'municipality',

      scopeId:
        text(
          metadata.municipalityId
        ),

      municipalityId:
        text(
          metadata.municipalityId
        )
    });
  }


  if (
    text(metadata.structureId)
  ) {

    descriptors.push({
      statsId:
        structureStatsId(
          campaignId,
          recordMode,
          metadata.municipalityId,
          metadata.structureId
        ),

      scopeType:
        'structure',

      scopeId:
        text(
          metadata.structureId
        ),

      municipalityId:
        text(
          metadata.municipalityId
        ),

      structureId:
        text(
          metadata.structureId
        )
    });
  }


  if (
    text(metadata.brigadeId)
  ) {

    descriptors.push({
      statsId:
        brigadeStatsId(
          campaignId,
          recordMode,
          metadata.brigadeId
        ),

      scopeType:
        'brigade',

      scopeId:
        text(
          metadata.brigadeId
        ),

      brigadeId:
        text(
          metadata.brigadeId
        )
    });
  }


  return descriptors;
}


function readScopeDescriptor({
  campaignId,
  recordMode,
  grant,
  metadata
}) {

  const scopeType =
    text(grant.scopeType);


  if (scopeType === 'campaign') {

    return {
      statsId:
        campaignStatsId(
          campaignId,
          recordMode
        ),

      scopeType,
      scopeId:
        campaignId
    };
  }


  if (
    scopeType === 'municipality'
  ) {

    return {
      statsId:
        municipalityStatsId(
          campaignId,
          recordMode,
          metadata.municipalityId
        ),

      scopeType,
      scopeId:
        text(
          metadata.municipalityId
        )
    };
  }


  if (
    scopeType === 'structure'
  ) {

    return {
      statsId:
        structureStatsId(
          campaignId,
          recordMode,
          metadata.municipalityId,
          metadata.structureId
        ),

      scopeType,
      scopeId:
        text(
          metadata.structureId
        )
    };
  }


  if (
    scopeType === 'brigade'
  ) {

    return {
      statsId:
        brigadeStatsId(
          campaignId,
          recordMode,
          metadata.brigadeId
        ),

      scopeType,
      scopeId:
        text(
          metadata.brigadeId
        )
    };
  }


  throw new HttpsError(
    'failed-precondition',
    'El alcance territorial no es válido.'
  );
}


function percent(
  value,
  total
) {

  if (!total) {
    return 0;
  }

  return Math.round(
    (
      (value / total) *
      100
    ) * 10
  ) / 10;
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
          request.auth.uid,
          'write'
        );


      const campaignId =
        text(
          profile.campaignId
        );


      const recordMode =
        text(
          metadata.recordMode
        ) ||
        text(
          grant.mode
        );


      const campaignIdForReceipt =
        campaignStatsId(
          campaignId,
          recordMode
        );


      const receiptRef =
        db.doc(
          `candidateSupportStats/${campaignIdForReceipt}/receipts/${input.submissionId}`
        );


      const descriptors =
        writeScopeDescriptors({
          campaignId,
          recordMode,
          metadata
        });


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


            for (
              const descriptor
              of descriptors
            ) {

              const statsRef =
                db.doc(
                  `candidateSupportStats/${descriptor.statsId}`
                );


              const increments = {

                campaignId,
                recordMode,

                scopeType:
                  descriptor.scopeType,

                scopeId:
                  descriptor.scopeId,

                totalResponses:
                  FieldValue.increment(1),

                updatedAt:
                  FieldValue.serverTimestamp()
              };


              if (
                descriptor.municipalityId
              ) {
                increments.municipalityId =
                  descriptor.municipalityId;
              }


              if (
                descriptor.structureId
              ) {
                increments.structureId =
                  descriptor.structureId;
              }


              if (
                descriptor.brigadeId
              ) {
                increments.brigadeId =
                  descriptor.brigadeId;
              }


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
                increments,
                {
                  merge: true
                }
              );


              if (
                input.response ===
                'other'
              ) {

                const otherChoiceRef =
                  statsRef
                    .collection(
                      'otherChoices'
                    )
                    .doc(
                      normalizeChoiceKey(
                        input.otherText
                      )
                    );


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


exports.getCandidateSupportStats =
  onCall(
    OPTIONS,
    async (request) => {

      if (!request.auth) {

        throw new HttpsError(
          'unauthenticated',
          'Inicie sesión.'
        );
      }


      const db =
        getFirestore();


      const {
        profile,
        grant,
        metadata
      } =
        await getAuthorizedContext(
          db,
          request.auth.uid,
          'read'
        );


      const campaignId =
        text(
          profile.campaignId
        );


      const recordMode =
        text(
          metadata.recordMode
        ) ||
        text(
          grant.mode
        );


      const descriptor =
        readScopeDescriptor({
          campaignId,
          recordMode,
          grant,
          metadata
        });


      const statsRef =
        db.doc(
          `candidateSupportStats/${descriptor.statsId}`
        );


      const statsSnap =
        await statsRef.get();


      const stats =
        statsSnap.exists
          ? statsSnap.data()
          : {};


      const totalResponses =
        Number(
          stats.totalResponses || 0
        );


      const yes =
        Number(
          stats.yes || 0
        );


      const no =
        Number(
          stats.no || 0
        );


      const other =
        Number(
          stats.other || 0
        );


      const displayAllowed =
        recordMode === 'demo' ||
        totalResponses >=
          MIN_PRODUCTION_SAMPLE;


      let otherChoices = [];


      if (
        displayAllowed &&
        other > 0
      ) {

        const choicesSnap =
          await statsRef
            .collection(
              'otherChoices'
            )
            .orderBy(
              'count',
              'desc'
            )
            .limit(10)
            .get();


        otherChoices =
          choicesSnap.docs.map(
            (doc) => {

              const value =
                doc.data();

              return {
                label:
                  text(
                    value.label
                  ),

                count:
                  Number(
                    value.count || 0
                  )
              };
            }
          );
      }


      if (!displayAllowed) {

        return {
          ok: true,

          displayAllowed: false,

          minimumSampleSize:
            MIN_PRODUCTION_SAMPLE,

          recordMode,

          scopeType:
            descriptor.scopeType,

          scopeId:
            descriptor.scopeId
        };
      }


      return {
        ok: true,

        displayAllowed: true,

        minimumSampleSize:
          MIN_PRODUCTION_SAMPLE,

        recordMode,

        scopeType:
          descriptor.scopeType,

        scopeId:
          descriptor.scopeId,

        totalResponses,

        yes,
        no,
        other,

        yesPercent:
          percent(
            yes,
            totalResponses
          ),

        noPercent:
          percent(
            no,
            totalResponses
          ),

        otherPercent:
          percent(
            other,
            totalResponses
          ),

        otherChoices
      };
    }
  );


exports._test = {

  validateInput,
  normalizeOtherChoice,
  normalizeChoiceKey,

  campaignStatsId,
  municipalityStatsId,
  structureStatsId,
  brigadeStatsId,

  writeScopeDescriptors,
  readScopeDescriptor,

  percent
};
