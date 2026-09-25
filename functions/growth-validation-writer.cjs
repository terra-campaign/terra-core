'use strict';

const {
  onCall,
  HttpsError,
} = require(
  'firebase-functions/v2/https'
);

const {
  getFirestore,
  FieldValue,
} = require(
  'firebase-admin/firestore'
);

const {
  resolveCanonicalPersonForAccount,
} = require(
  './person-identity.cjs'
);

const {
  canonicalMembershipDocumentId,
} = require(
  './territorial-membership-id.cjs'
);

const {
  canonicalOnboardingFactDocumentId,
} = require(
  './onboarding-fact.cjs'
);

const {
  CATALOG_VERSION,
  SOURCE_TYPES,
} = require(
  './activity-catalog-v1.cjs'
);

const {
  buildMissionSourceId,
  buildAttendanceSourceId,
} = require(
  './contribution-source.cjs'
);

const {
  GROWTH_VALIDATION_SCHEMA_VERSION,
  GROWTH_MILESTONES,
  canonicalGrowthValidationDocumentId,
  assertGrowthValidationSetPolicy,
  validateGrowthMilestoneFact,
} = require(
  './growth-validation.cjs'
);


const OPTIONS = {
  region:
    'us-central1',

  timeoutSeconds:
    60,
};


function fail(
  code,
  message
) {

  throw new HttpsError(
    code,
    message
  );
}


function cleanId(
  value
) {

  return typeof value ===
    'string'
    ? value.trim()
    : '';
}


function validClientId(
  value,
  label
) {

  const result =
    cleanId(
      value
    );

  if (
    !result ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(
      result
    )
  ) {

    fail(
      'invalid-argument',
      label + ' inválido.'
    );
  }

  return result;
}


function requiredStoredId(
  value,
  label
) {

  const result =
    cleanId(
      value
    );

  if (
    !result ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(
      result
    )
  ) {

    fail(
      'failed-precondition',
      label + ' no está configurado correctamente.'
    );
  }

  return result;
}


function normalizeMilestone(
  value
) {

  const milestone =
    cleanId(
      value
    );

  if (
    !Object.values(
      GROWTH_MILESTONES
    ).includes(
      milestone
    )
  ) {

    fail(
      'invalid-argument',
      'Hito de crecimiento inválido.'
    );
  }

  return milestone;
}


function normalizeVerifiedSourceType(
  value
) {

  const sourceType =
    cleanId(
      value
    );

  if (
    sourceType !==
      SOURCE_TYPES
        .MISSION_VALIDATION &&
    sourceType !==
      SOURCE_TYPES
        .ATTENDANCE_RECORD
  ) {

    fail(
      'invalid-argument',
      'Fuente operacional verificable inválida.'
    );
  }

  return sourceType;
}


function profileFromSnapshot(
  snapshot
) {

  if (
    !snapshot ||
    !snapshot.exists
  ) {

    return null;
  }

  return {
    ...snapshot.data(),

    uid:
      snapshot.id,
  };
}


function personMatchesSubject({
  person,
  documentId,
  campaignId,
  personId,
}) {

  if (
    !person ||
    typeof person !==
      'object' ||
    person.active !==
      true
  ) {

    return false;
  }

  const expectedDocumentId =
    cleanId(
      personId
    );

  const storedPersonId =
    cleanId(
      person.personId
    ) ||
    cleanId(
      documentId
    );

  return (
    cleanId(
      documentId
    ) ===
      expectedDocumentId &&
    storedPersonId ===
      expectedDocumentId &&
    cleanId(
      person.campaignId
    ) ===
      cleanId(
        campaignId
      )
  );
}


function membershipMatchesSubject({
  membership,
  campaignId,
  personId,
}) {

  if (
    !membership ||
    typeof membership !==
      'object' ||
    membership.active !==
      true
  ) {

    return false;
  }

  return (
    cleanId(
      membership.campaignId
    ) ===
      cleanId(
        campaignId
      ) &&
    cleanId(
      membership.personId
    ) ===
      cleanId(
        personId
      )
  );
}


function membershipIntroducerConsistent({
  membership,
  introducedByPersonId,
}) {

  if (
    !membership ||
    membership.introducedByPersonId == null ||
    membership.introducedByPersonId === ''
  ) {
    return true;
  }

  return (
    cleanId(
      membership.introducedByPersonId
    ) ===
    cleanId(
      introducedByPersonId
    )
  );
}


function actorCanValidateTarget({
  actorPersonId,
  actorMembership,
  targetPersonId,
  targetMembership,
  campaignId,
}) {

  const actor =
    cleanId(
      actorPersonId
    );

  const target =
    cleanId(
      targetPersonId
    );

  const campaign =
    cleanId(
      campaignId
    );

  if (
    !actor ||
    !target ||
    actor ===
      target ||
    !campaign
  ) {

    return false;
  }

  if (
    !membershipMatchesSubject({
      membership:
        actorMembership,

      campaignId:
        campaign,

      personId:
        actor,
    }) ||
    !membershipMatchesSubject({
      membership:
        targetMembership,

      campaignId:
        campaign,

      personId:
        target,
    })
  ) {

    return false;
  }

  if (
    cleanId(
      targetMembership
        .parentPersonId
    ) ===
      actor
  ) {

    return true;
  }

  const ancestors =
    Array.isArray(
      targetMembership
        .ancestorPersonIds
    )
      ? targetMembership
          .ancestorPersonIds
          .map(
            cleanId
          )
          .filter(
            Boolean
          )
      : [];

  return ancestors.includes(
    actor
  );
}


function missionVerifiedActivityProof({
  sourceDocumentId,
  review,
  evidence,
  mission,
  campaignId,
  subjectPersonId,
  canonicalSubjectPersonId,
}) {

  const reviewId =
    cleanId(
      sourceDocumentId
    );

  const campaign =
    cleanId(
      campaignId
    );

  const person =
    cleanId(
      subjectPersonId
    );

  const resolvedPerson =
    cleanId(
      canonicalSubjectPersonId
    );

  if (
    !reviewId ||
    !review ||
    !evidence ||
    !mission ||
    review.status !==
      'validated'
  ) {

    throw new Error(
      'GROWTH_MISSION_SOURCE_NOT_VALIDATED'
    );
  }

  const missionId =
    cleanId(
      review.missionId
    );

  const subjectUid =
    cleanId(
      review.subjectId
    );

  if (
    !missionId ||
    !subjectUid ||
    cleanId(
      review.campaignId
    ) !==
      campaign ||
    cleanId(
      review.evidenceId
    ) !==
      reviewId ||
    cleanId(
      evidence.campaignId
    ) !==
      campaign ||
    cleanId(
      evidence.missionId
    ) !==
      missionId ||
    cleanId(
      evidence.uploadedBy
    ) !==
      subjectUid ||
    cleanId(
      mission.campaignId
    ) !==
      campaign ||
    cleanId(
      mission.assignedTo
    ) !==
      subjectUid ||
    resolvedPerson !==
      person
  ) {

    throw new Error(
      'GROWTH_MISSION_SOURCE_SUBJECT_MISMATCH'
    );
  }

  return Object.freeze({
    verifiedActivitySourceType:
      SOURCE_TYPES
        .MISSION_VALIDATION,

    verifiedActivitySourceId:
      buildMissionSourceId({
        missionId,
        personId:
          person,
      }),

    verifiedActivitySourceDocumentId:
      reviewId,

    verifiedActivityMissionId:
      missionId,

    verifiedActivityOperationalValidatorUserId:
      cleanId(
        review.lastActor
      ) ||
      cleanId(
        review.reviewerId
      ) ||
      null,
  });
}


function canonicalEventAttendanceDocumentId(
  eventId,
  personId
) {

  return require('node:crypto')
    .createHash('sha256')
    .update(
      JSON.stringify([
        'event-attendance',
        eventId,
        personId,
      ])
    )
    .digest('hex');
}


function attendanceVerifiedActivityProof({
  sourceDocumentId,
  attendance,
  campaignId,
  subjectPersonId,
}) {

  const attendanceId =
    cleanId(
      sourceDocumentId
    );

  const campaign =
    cleanId(
      campaignId
    );

  const person =
    cleanId(
      subjectPersonId
    );

  if (
    !attendanceId ||
    !attendance ||
    typeof attendance !==
      'object' ||
    attendance.attended !==
      true
  ) {

    throw new Error(
      'GROWTH_ATTENDANCE_SOURCE_NOT_VERIFIED'
    );
  }

  const eventId =
    cleanId(
      attendance.eventId
    );

  const validatorUid =
    cleanId(
      attendance.validatedByUserId
    );

  if (
    !eventId ||
    !validatorUid ||
    !attendance.checkedInAt ||
    cleanId(
      attendance.campaignId
    ) !==
      campaign ||
    cleanId(
      attendance.personId
    ) !==
      person
  ) {

    throw new Error(
      'GROWTH_ATTENDANCE_SOURCE_SUBJECT_MISMATCH'
    );
  }

  const canonicalAttendanceId =
    canonicalEventAttendanceDocumentId(
      eventId,
      person
    );

  if (
    attendanceId !==
      canonicalAttendanceId
  ) {

    throw new Error(
      'GROWTH_ATTENDANCE_SOURCE_DOCUMENT_ID_MISMATCH'
    );
  }


  return Object.freeze({
    verifiedActivitySourceType:
      SOURCE_TYPES
        .ATTENDANCE_RECORD,

    verifiedActivitySourceId:
      buildAttendanceSourceId({
        eventId,
        personId:
          person,
      }),

    verifiedActivitySourceDocumentId:
      attendanceId,

    verifiedActivityEventId:
      eventId,

    verifiedActivityOperationalValidatorUserId:
      validatorUid,
  });
}


function buildGrowthValidationRecord({
  validationId,
  campaignId,
  personId,
  introducedByPersonId,
  milestone,
  validatedByPersonId,
  validatedByUserId,
  validatedAt,
  proof,
}) {

  const record = {
    id:
      validationId,

    growthValidationId:
      validationId,

    schemaVersion:
      GROWTH_VALIDATION_SCHEMA_VERSION,

    activityCatalogVersion:
      CATALOG_VERSION,

    campaignId,
    personId,
    introducedByPersonId,

    milestone,

    status:
      'validated',

    validatedByPersonId,
    validatedByUserId,

    validatedAt,

    createdAt:
      validatedAt,

    runtimeScoringEnabled:
      false,

    contributionCandidatePersisted:
      false,

    contributionLedgerWritten:
      false,

    pointsPosted:
      false,
  };

  if (
    milestone ===
    GROWTH_MILESTONES
      .PERSON_MEMBERSHIP
  ) {

    Object.assign(
      record,
      {
        personUnique:
          true,

        membershipCorrect:
          true,

        personRef:
          proof.personRef,

        membershipRef:
          proof.membershipRef,
      }
    );
  }

  if (
    milestone ===
    GROWTH_MILESTONES
      .ONBOARDING
  ) {

    Object.assign(
      record,
      {
        onboardingFactId:
          proof.onboardingFactId,

        onboardingFact:
          proof.onboardingFact,
      }
    );
  }

  if (
    milestone ===
    GROWTH_MILESTONES
      .FIRST_VERIFIED_ACTIVITY
  ) {

    Object.assign(
      record,
      {
        firstVerifiedActivity:
          true,

        ...proof,
      }
    );
  }

  return record;
}


function validateReusableExistingValidation({
  validationId,
  validation,
  campaignId,
  personId,
  introducedByPersonId,
  milestone,
}) {

  if (
    !validation ||
    typeof validation !==
      'object'
  ) {

    throw new Error(
      'INVALID_EXISTING_GROWTH_VALIDATION'
    );
  }

  if (
    cleanId(
      validation.id ||
      validation.growthValidationId
    ) !==
      validationId ||
    cleanId(
      validation.campaignId
    ) !==
      campaignId ||
    cleanId(
      validation.personId
    ) !==
      personId ||
    cleanId(
      validation.introducedByPersonId
    ) !==
      introducedByPersonId ||
    cleanId(
      validation.milestone
    ) !==
      milestone ||
    validation.status !==
      'validated' ||
    cleanId(
      validation.activityCatalogVersion
    ) !==
      CATALOG_VERSION
  ) {

    throw new Error(
      'EXISTING_GROWTH_VALIDATION_CONTEXT_MISMATCH'
    );
  }

  validateGrowthMilestoneFact(
    validation
  );

  return validation;
}


function domainAssert(
  callback,
  publicMessage
) {

  try {

    return callback();

  } catch (error) {

    fail(
      'failed-precondition',
      publicMessage +
      ' [' +
      (
        error &&
        error.message
          ? error.message
          : 'DOMAIN_VALIDATION_FAILED'
      ) +
      ']'
    );
  }
}


exports.completeGrowthValidation =
  onCall(
    OPTIONS,

    async request => {

      if (!request.auth) {

        fail(
          'unauthenticated',
          'Inicia sesión.'
        );
      }

      const data =
        request.data ||
        {};

      const requestedPersonId =
        validClientId(
          data.personId,
          'Persona'
        );

      const milestone =
        normalizeMilestone(
          data.milestone
        );

      let requestedSourceType =
        null;

      let requestedSourceDocumentId =
        null;

      if (
        milestone ===
        GROWTH_MILESTONES
          .FIRST_VERIFIED_ACTIVITY
      ) {

        requestedSourceType =
          normalizeVerifiedSourceType(
            data.sourceType
          );

        requestedSourceDocumentId =
          validClientId(
            data.sourceDocumentId,
            'Documento fuente'
          );
      }

      const db =
        getFirestore();

      try {

        return await db.runTransaction(
          async tx => {

            const actorUid =
              request.auth.uid;

            const actorProfile =
              profileFromSnapshot(
                await tx.get(
                  db.collection(
                    'usuarios'
                  ).doc(
                    actorUid
                  )
                )
              );

            if (
              !actorProfile ||
              actorProfile.active !==
                true ||
              !actorProfile.campaignId
            ) {

              fail(
                'permission-denied',
                'Perfil territorial no autorizado.'
              );
            }

            if (
              actorProfile.role ===
              'admin'
            ) {

              fail(
                'permission-denied',
                'El Administrador técnico no valida crecimiento territorial.'
              );
            }

            const campaignId =
              requiredStoredId(
                actorProfile.campaignId,
                'La campaña'
              );

            const actorIdentity =
              await resolveCanonicalPersonForAccount({
                db,
                tx,

                accountUid:
                  actorUid,

                profile:
                  actorProfile,

                campaignId,
              });

            const actorPersonId =
              requiredStoredId(
                actorIdentity.personId,
                'La persona del validador'
              );

            const targetPersonRef =
              db.collection(
                'persons'
              ).doc(
                requestedPersonId
              );

            const targetPersonSnapshot =
              await tx.get(
                targetPersonRef
              );

            if (
              !targetPersonSnapshot.exists
            ) {

              fail(
                'not-found',
                'La persona no existe.'
              );
            }

            const targetPerson = {
              ...targetPersonSnapshot.data(),

              id:
                targetPersonSnapshot.id,
            };

            if (
              !personMatchesSubject({
                person:
                  targetPerson,

                documentId:
                  targetPersonSnapshot.id,

                campaignId,

                personId:
                  requestedPersonId,
              })
            ) {

              fail(
                'failed-precondition',
                'La persona no pertenece activamente a la campaña.'
              );
            }

            const introducedByPersonId =
              requiredStoredId(
                targetPerson
                  .introducedByPersonId,
                'El incorporador histórico'
              );

            if (
              introducedByPersonId ===
              requestedPersonId
            ) {

              fail(
                'failed-precondition',
                'La persona no puede figurar como su propio incorporador.'
              );
            }

            const introducerSnapshot =
              await tx.get(
                db.collection(
                  'persons'
                ).doc(
                  introducedByPersonId
                )
              );

            if (
              !introducerSnapshot.exists ||
              cleanId(
                introducerSnapshot
                  .data()
                  ?.campaignId
              ) !==
                campaignId
            ) {

              fail(
                'failed-precondition',
                'El incorporador histórico no puede verificarse en esta campaña.'
              );
            }

            const actorMembershipId =
              canonicalMembershipDocumentId(
                campaignId,
                actorPersonId
              );

            const targetMembershipId =
              canonicalMembershipDocumentId(
                campaignId,
                requestedPersonId
              );

            const [
              actorMembershipSnapshot,
              targetMembershipSnapshot,
            ] = await Promise.all([
              tx.get(
                db.collection(
                  'territorialMemberships'
                ).doc(
                  actorMembershipId
                )
              ),

              tx.get(
                db.collection(
                  'territorialMemberships'
                ).doc(
                  targetMembershipId
                )
              ),
            ]);

            const actorMembership =
              actorMembershipSnapshot.exists
                ? actorMembershipSnapshot.data()
                : null;

            const targetMembership =
              targetMembershipSnapshot.exists
                ? targetMembershipSnapshot.data()
                : null;

            if (
              !membershipIntroducerConsistent({
                membership:
                  targetMembership,

                introducedByPersonId,
              })
            ) {

              fail(
                'failed-precondition',
                'La membresía territorial contradice al incorporador histórico.'
              );
            }

            if (
              !actorCanValidateTarget({
                actorPersonId,
                actorMembership,

                targetPersonId:
                  requestedPersonId,

                targetMembership,
                campaignId,
              })
            ) {

              fail(
                'permission-denied',
                'No tienes autoridad territorial sobre esta persona.'
              );
            }

            const validationId =
              canonicalGrowthValidationDocumentId({
                campaignId,

                personId:
                  requestedPersonId,

                introducedByPersonId,

                milestone,
              });

            const validationRef =
              db.collection(
                'growthValidations'
              ).doc(
                validationId
              );

            const milestoneRefs =
              Object.values(
                GROWTH_MILESTONES
              ).map(
                currentMilestone => {

                  const id =
                    canonicalGrowthValidationDocumentId({
                      campaignId,

                      personId:
                        requestedPersonId,

                      introducedByPersonId,

                      milestone:
                        currentMilestone,
                    });

                  return {
                    id,
                    milestone:
                      currentMilestone,

                    ref:
                      db.collection(
                        'growthValidations'
                      ).doc(
                        id
                      ),
                  };
                }
              );

            const existingSnapshots =
              [];

            for (
              const item of
              milestoneRefs
            ) {

              existingSnapshots.push({
                ...item,

                snapshot:
                  await tx.get(
                    item.ref
                  ),
              });
            }

            const existingValidations =
              [];

            let currentExisting =
              null;

            for (
              const item of
              existingSnapshots
            ) {

              if (
                !item.snapshot.exists
              ) {

                continue;
              }

              const existing =
                item.snapshot.data();

              const reusable =
                domainAssert(
                  () =>
                    validateReusableExistingValidation({
                      validationId:
                        item.id,

                      validation:
                        existing,

                      campaignId,

                      personId:
                        requestedPersonId,

                      introducedByPersonId,

                      milestone:
                        item.milestone,
                    }),

                  'Existe una validación de crecimiento inconsistente.'
                );

              existingValidations.push(
                reusable
              );

              if (
                item.id ===
                validationId
              ) {

                currentExisting =
                  reusable;
              }
            }

            if (currentExisting) {

              domainAssert(
                () =>
                  assertGrowthValidationSetPolicy(
                    existingValidations
                  ),

                'El conjunto de validaciones de crecimiento no cumple la política vigente.'
              );

              return {
                ok:
                  true,

                alreadyValidated:
                  true,

                growthValidationId:
                  validationId,

                campaignId,

                personId:
                  requestedPersonId,

                introducedByPersonId,

                milestone,

                validatedByPersonId:
                  currentExisting
                    .validatedByPersonId,

                runtimeScoringEnabled:
                  false,

                contributionCandidatePersisted:
                  false,

                contributionLedgerWritten:
                  false,

                pointsPosted:
                  false,
              };
            }

            let proof =
              null;

            if (
              milestone ===
              GROWTH_MILESTONES
                .PERSON_MEMBERSHIP
            ) {

              if (
                !membershipMatchesSubject({
                  membership:
                    targetMembership,

                  campaignId,

                  personId:
                    requestedPersonId,
                })
              ) {

                fail(
                  'failed-precondition',
                  'La membresía territorial canónica no está activa o no coincide.'
                );
              }

              proof = {
                personRef:
                  'persons/' +
                  requestedPersonId,

                membershipRef:
                  'territorialMemberships/' +
                  targetMembershipId,
              };
            }

            if (
              milestone ===
              GROWTH_MILESTONES
                .ONBOARDING
            ) {

              const onboardingFactId =
                canonicalOnboardingFactDocumentId({ campaignId, personId: requestedPersonId });

              const onboardingSnapshot =
                await tx.get(
                  db.collection(
                    'onboardingFacts'
                  ).doc(
                    onboardingFactId
                  )
                );

              if (
                !onboardingSnapshot.exists
              ) {

                fail(
                  'failed-precondition',
                  'La persona todavía no tiene onboarding canónico completado.'
                );
              }

              proof = {
                onboardingFactId,

                onboardingFact: {
                  ...onboardingSnapshot.data(),

                  id:
                    onboardingFactId,
                },
              };
            }

            if (
              milestone ===
              GROWTH_MILESTONES
                .FIRST_VERIFIED_ACTIVITY
            ) {

              if (
                requestedSourceType ===
                SOURCE_TYPES
                  .MISSION_VALIDATION
              ) {

                const reviewSnapshot =
                  await tx.get(
                    db.collection(
                      'missionReviews'
                    ).doc(
                      requestedSourceDocumentId
                    )
                  );

                const evidenceSnapshot =
                  await tx.get(
                    db.collection(
                      'missionEvidence'
                    ).doc(
                      requestedSourceDocumentId
                    )
                  );

                if (
                  !reviewSnapshot.exists ||
                  !evidenceSnapshot.exists
                ) {

                  fail(
                    'failed-precondition',
                    'La validación de misión seleccionada no existe.'
                  );
                }

                const review =
                  reviewSnapshot.data();

                const evidence =
                  evidenceSnapshot.data();

                const missionId =
                  requiredStoredId(
                    review.missionId,
                    'La misión validada'
                  );

                const subjectUid =
                  requiredStoredId(
                    review.subjectId,
                    'La cuenta de la persona de la misión'
                  );

                const missionSnapshot =
                  await tx.get(
                    db.collection(
                      'misiones'
                    ).doc(
                      missionId
                    )
                  );

                const subjectProfile =
                  profileFromSnapshot(
                    await tx.get(
                      db.collection(
                        'usuarios'
                      ).doc(
                        subjectUid
                      )
                    )
                  );

                if (
                  !missionSnapshot.exists ||
                  !subjectProfile
                ) {

                  fail(
                    'failed-precondition',
                    'La fuente de misión no puede reconstruirse de forma autoritativa.'
                  );
                }

                const canonicalSubject =
                  await resolveCanonicalPersonForAccount({
                    db,
                    tx,

                    accountUid:
                      subjectUid,

                    profile:
                      subjectProfile,

                    campaignId,
                  });

                proof =
                  domainAssert(
                    () =>
                      missionVerifiedActivityProof({
                        sourceDocumentId:
                          requestedSourceDocumentId,

                        review,
                        evidence,

                        mission:
                          missionSnapshot.data(),

                        campaignId,

                        subjectPersonId:
                          requestedPersonId,

                        canonicalSubjectPersonId:
                          canonicalSubject.personId,
                      }),

                    'La misión no acredita la primera actividad de esta persona.'
                  );
              }

              if (
                requestedSourceType ===
                SOURCE_TYPES
                  .ATTENDANCE_RECORD
              ) {

                const attendanceSnapshot =
                  await tx.get(
                    db.collection(
                      'eventAttendance'
                    ).doc(
                      requestedSourceDocumentId
                    )
                  );

                if (
                  !attendanceSnapshot.exists
                ) {

                  fail(
                    'failed-precondition',
                    'La asistencia seleccionada no existe.'
                  );
                }

                proof =
                  domainAssert(
                    () =>
                      attendanceVerifiedActivityProof({
                        sourceDocumentId:
                          requestedSourceDocumentId,

                        attendance:
                          attendanceSnapshot.data(),

                        campaignId,

                        subjectPersonId:
                          requestedPersonId,
                      }),

                    'La asistencia no acredita la primera actividad de esta persona.'
                  );
              }
            }

            const serverNow =
              FieldValue
                .serverTimestamp();

            const validationRecord =
              buildGrowthValidationRecord({
                validationId,
                campaignId,

                personId:
                  requestedPersonId,

                introducedByPersonId,

                milestone,

                validatedByPersonId:
                  actorPersonId,

                validatedByUserId:
                  actorUid,

                validatedAt:
                  serverNow,

                proof,
              });

            domainAssert(
              () =>
                validateGrowthMilestoneFact(
                  validationRecord
                ),

              'La validación de crecimiento no cumple el contrato del dominio.'
            );

            domainAssert(
              () =>
                assertGrowthValidationSetPolicy([
                  ...existingValidations,
                  validationRecord,
                ]),

              'La validación no puede completar crecimiento mediante autoaprobación total.'
            );

            const auditRef =
              db.collection(
                'logs'
              ).doc();

            const auditRecord = {
              action:
                'VALIDATE_GROWTH_MILESTONE',

              growthValidationId:
                validationId,

              campaignId,

              personId:
                requestedPersonId,

              introducedByPersonId,

              milestone,

              validatedByPersonId:
                actorPersonId,

              validatedByUserId:
                actorUid,

              sourceType:
                proof
                  ?.verifiedActivitySourceType ||
                null,

              sourceId:
                proof
                  ?.verifiedActivitySourceId ||
                null,

              sourceDocumentId:
                proof
                  ?.verifiedActivitySourceDocumentId ||
                null,

              runtimeScoringEnabled:
                false,

              contributionCandidatePersisted:
                false,

              contributionLedgerWritten:
                false,

              pointsPosted:
                false,

              createdAt:
                serverNow,
            };

            tx.create(
              validationRef,
              validationRecord
            );

            tx.create(
              auditRef,
              auditRecord
            );

            return {
              ok:
                true,

              alreadyValidated:
                false,

              growthValidationId:
                validationId,

              campaignId,

              personId:
                requestedPersonId,

              introducedByPersonId,

              milestone,

              validatedByPersonId:
                actorPersonId,

              runtimeScoringEnabled:
                false,

              contributionCandidatePersisted:
                false,

              contributionLedgerWritten:
                false,

              pointsPosted:
                false,
            };
          }
        );

      } catch (error) {

        if (
          error instanceof
          HttpsError
        ) {

          throw error;
        }

        console.error(
          'COMPLETE_GROWTH_VALIDATION_UNEXPECTED_FAILURE',
          {
            uid:
              request.auth.uid,

            personId:
              requestedPersonId,

            milestone,

            error:
              error &&
              error.message
                ? error.message
                : String(
                    error
                  ),
          }
        );

        fail(
          'internal',
          'No fue posible completar la validación de crecimiento.'
        );
      }
    }
  );


exports._test = {
  cleanId,
  personMatchesSubject,
  membershipMatchesSubject,
  membershipIntroducerConsistent,
  actorCanValidateTarget,
  missionVerifiedActivityProof,
  canonicalEventAttendanceDocumentId,
  attendanceVerifiedActivityProof,
  buildGrowthValidationRecord,
  validateReusableExistingValidation,
};