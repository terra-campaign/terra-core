'use strict';

const {
  onCall,
  HttpsError,
} =
  require(
    'firebase-functions/v2/https'
  );

const {
  getFirestore,
  FieldValue,
} =
  require(
    'firebase-admin/firestore'
  );

const {
  resolveCanonicalPersonForAccount,
} =
  require(
    './person-identity.cjs'
  );

const {
  canonicalMembershipDocumentId,
} =
  require(
    './territorial-membership-id.cjs'
  );

const {
  ONBOARDING_PROGRAM_VERSION,
  ONBOARDING_STATUSES,
  ONBOARDING_DELIVERY_MODES,
  ONBOARDING_CRITERIA,
  canonicalOnboardingFactDocumentId,
  validateCompletedOnboardingFact,
} =
  require(
    './onboarding-fact.cjs'
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
    result.length >
      128 ||
    result.includes(
      '/'
    )
  ) {

    fail(
      'invalid-argument',
      `${label} no es válido.`
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
    result.length >
      128 ||
    result.includes(
      '/'
    )
  ) {

    fail(
      'failed-precondition',
      `${label} no tiene una identidad canónica válida.`
    );
  }

  return result;
}


function normalizeDeliveryMode(
  value
) {

  if (
    value !==
      ONBOARDING_DELIVERY_MODES
        .SELF_SERVICE &&
    value !==
      ONBOARDING_DELIVERY_MODES
        .ASSISTED
  ) {

    fail(
      'invalid-argument',
      'La modalidad de onboarding no es válida.'
    );
  }

  return value;
}


function canonicalCriteria(
  criteria
) {

  if (
    !criteria ||
    typeof criteria !==
      'object' ||
    Array.isArray(
      criteria
    )
  ) {

    fail(
      'invalid-argument',
      'Debe confirmar todos los criterios del onboarding.'
    );
  }

  const normalized =
    {};

  for (
    const criterion of
    ONBOARDING_CRITERIA
  ) {

    if (
      criteria[
        criterion
      ] !==
        true
    ) {

      fail(
        'invalid-argument',
        `Criterio de onboarding pendiente: ${criterion}.`
      );
    }

    normalized[
      criterion
    ] =
      true;
  }

  return normalized;
}


function resolveTargetPersonId({
  deliveryMode,
  actorPersonId,
  requestedPersonId,
}) {

  const actor =
    requiredStoredId(
      actorPersonId,
      'La persona autenticada'
    );

  const mode =
    normalizeDeliveryMode(
      deliveryMode
    );

  const requested =
    cleanId(
      requestedPersonId
    );

  if (
    mode ===
      ONBOARDING_DELIVERY_MODES
        .SELF_SERVICE
  ) {

    if (
      requested &&
      requested !==
        actor
    ) {

      fail(
        'invalid-argument',
        'SELF_SERVICE sólo puede completarse para la propia persona.'
      );
    }

    return actor;
  }


  const target =
    validClientId(
      requestedPersonId,
      'personId'
    );

  if (
    target ===
      actor
  ) {

    fail(
      'invalid-argument',
      'Para la propia persona debe utilizar SELF_SERVICE.'
    );
  }

  return target;
}


function personMatchesSubject({
  person,
  documentId,
  campaignId,
  personId,
}) {

  if (
    !person ||
    person.active !==
      true
  ) {

    return false;
  }

  if (
    cleanId(
      documentId
    ) !==
      cleanId(
        personId
      )
  ) {

    return false;
  }

  if (
    cleanId(
      person.campaignId
    ) !==
      cleanId(
        campaignId
      )
  ) {

    return false;
  }

  const storedPersonId =
    cleanId(
      person.personId
    );

  if (
    storedPersonId &&
    storedPersonId !==
      cleanId(
        personId
      )
  ) {

    return false;
  }

  return true;
}


function membershipMatchesSubject({
  membership,
  membershipId,
  campaignId,
  personId,
}) {

  if (
    !membership ||
    membership.active !==
      true
  ) {

    return false;
  }

  const expectedId =
    canonicalMembershipDocumentId(
      campaignId,
      personId
    );

  return (
    cleanId(
      membershipId
    ) ===
      expectedId &&
    cleanId(
      membership.membershipId
    ) ===
      expectedId &&
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


function actorCanAssistTarget({
  actorPersonId,
  actorMembership,
  targetMembership,
  campaignId,
}) {

  const actor =
    cleanId(
      actorPersonId
    );

  const campaign =
    cleanId(
      campaignId
    );

  if (
    !actor ||
    !campaign ||
    !actorMembership ||
    !targetMembership ||
    targetMembership.active !==
      true
  ) {

    return false;
  }


  const actorMembershipId =
    canonicalMembershipDocumentId(
      campaign,
      actor
    );


  // La ancestry hist?rica del objetivo no basta.
  // Quien asiste debe conservar una membres?a
  // territorial can?nica y activa en la campa?a.
  if (
    !membershipMatchesSubject({
      membership:
        actorMembership,

      membershipId:
        actorMembershipId,

      campaignId:
        campaign,

      personId:
        actor,
    })
  ) {

    return false;
  }


  if (
    cleanId(
      targetMembership
        .campaignId
    ) !==
      campaign
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


function buildAuthoritativeOnboardingFact({
  campaignId,
  personId,
  completedByPersonId,
  deliveryMode,
  criteria,
  completedAt,
}) {

  const canonicalCampaignId =
    requiredStoredId(
      campaignId,
      'La campaña'
    );

  const canonicalPersonId =
    requiredStoredId(
      personId,
      'La persona'
    );

  const canonicalActorPersonId =
    requiredStoredId(
      completedByPersonId,
      'La persona que completa el onboarding'
    );

  const mode =
    normalizeDeliveryMode(
      deliveryMode
    );

  const normalizedCriteria =
    canonicalCriteria(
      criteria
    );

  if (
    completedAt ===
      null ||
    completedAt ===
      undefined
  ) {

    fail(
      'internal',
      'No fue posible establecer la fecha autoritativa del onboarding.'
    );
  }

  const onboardingFactId =
    canonicalOnboardingFactDocumentId({
      campaignId:
        canonicalCampaignId,

      personId:
        canonicalPersonId,
    });

  const fact = {
    id:
      onboardingFactId,

    campaignId:
      canonicalCampaignId,

    personId:
      canonicalPersonId,

    completedByPersonId:
      canonicalActorPersonId,

    status:
      ONBOARDING_STATUSES
        .COMPLETED,

    deliveryMode:
      mode,

    programVersion:
      ONBOARDING_PROGRAM_VERSION,

    completedAt,

    criteria:
      normalizedCriteria,
  };

  return validateCompletedOnboardingFact({
    onboardingFactId,
    onboardingFact:
      fact,
  });
}


function validateReusableExistingFact({
  onboardingFactId,
  onboardingFact,
  campaignId,
  personId,
}) {

  let validated;

  try {

    validated =
      validateCompletedOnboardingFact({
        onboardingFactId,
        onboardingFact,
      });

  } catch (
    error
  ) {

    fail(
      'failed-precondition',
      'El OnboardingFact existente no cumple el contrato canónico.'
    );
  }

  if (
    validated.campaignId !==
      campaignId ||
    validated.personId !==
      personId
  ) {

    fail(
      'failed-precondition',
      'El OnboardingFact existente no pertenece al sujeto esperado.'
    );
  }

  return validated;
}


exports.completeOnboarding =
  onCall(
    OPTIONS,

    async request => {

      if (
        !request.auth
      ) {

        fail(
          'unauthenticated',
          'Debe iniciar sesión.'
        );
      }

      const db =
        getFirestore();

      const actorUid =
        request.auth.uid;

      try {

        return await db
          .runTransaction(
            async tx => {

              const actorProfileRef =
                db.doc(
                  'usuarios/' +
                  actorUid
                );

              const actorProfileSnapshot =
                await tx.get(
                  actorProfileRef
                );

              if (
                !actorProfileSnapshot
                  .exists
              ) {

                fail(
                  'permission-denied',
                  'La cuenta no tiene perfil territorial autorizado.'
                );
              }

              const actorProfile =
                actorProfileSnapshot
                  .data();

              if (
                !actorProfile ||
                actorProfile.active !==
                  true
              ) {

                fail(
                  'permission-denied',
                  'La cuenta territorial no está activa.'
                );
              }


              // El Admin técnico no pertenece a la
              // jerarquía territorial y no completa
              // onboarding en nombre de miembros.
              if (
                actorProfile.role ===
                  'admin'
              ) {

                fail(
                  'permission-denied',
                  'El Administrador técnico no puede completar onboarding territorial.'
                );
              }


              // La campaña se deriva exclusivamente
              // del perfil territorial autenticado.
              const campaignId =
                requiredStoredId(
                  actorProfile
                    .campaignId,
                  'La campaña de la cuenta'
                );


              // La identidad de quien ejecuta la
              // operación se resuelve del backend.
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
                actorIdentity
                  .personId;

              const data =
                request.data ||
                {};

              const deliveryMode =
                normalizeDeliveryMode(
                  data.deliveryMode
                );

              const targetPersonId =
                resolveTargetPersonId({
                  deliveryMode,

                  actorPersonId,

                  requestedPersonId:
                    data.personId,
                });


              const targetPersonRef =
                db.doc(
                  'persons/' +
                  targetPersonId
                );

              let targetPerson;

              if (
                targetPersonId ===
                  actorPersonId
              ) {

                targetPerson =
                  actorIdentity
                    .person;

              } else {

                const targetPersonSnapshot =
                  await tx.get(
                    targetPersonRef
                  );

                if (
                  !targetPersonSnapshot
                    .exists
                ) {

                  fail(
                    'failed-precondition',
                    'La persona objetivo no existe.'
                  );
                }

                targetPerson =
                  targetPersonSnapshot
                    .data();
              }


              if (
                !personMatchesSubject({
                  person:
                    targetPerson,

                  documentId:
                    targetPersonId,

                  campaignId,

                  personId:
                    targetPersonId,
                })
              ) {

                fail(
                  'failed-precondition',
                  'La persona objetivo no tiene identidad territorial activa válida.'
                );
              }


              const membershipId =
                canonicalMembershipDocumentId(
                  campaignId,
                  targetPersonId
                );

              const membershipRef =
                db
                  .collection(
                    'territorialMemberships'
                  )
                  .doc(
                    membershipId
                  );

              const membershipSnapshot =
                await tx.get(
                  membershipRef
                );

              if (
                !membershipSnapshot
                  .exists
              ) {

                fail(
                  'failed-precondition',
                  'La persona objetivo no tiene membresía territorial canónica.'
                );
              }

              const membership =
                membershipSnapshot
                  .data();

              if (
                !membershipMatchesSubject({
                  membership,

                  membershipId,

                  campaignId,

                  personId:
                    targetPersonId,
                })
              ) {

                fail(
                  'failed-precondition',
                  'La membresía territorial de la persona objetivo no es válida.'
                );
              }


              if (
                deliveryMode ===
                  ONBOARDING_DELIVERY_MODES
                    .ASSISTED
              ) {

                const actorMembershipId =
                  canonicalMembershipDocumentId(
                    campaignId,
                    actorPersonId
                  );

                const actorMembershipRef =
                  db
                    .collection(
                      'territorialMemberships'
                    )
                    .doc(
                      actorMembershipId
                    );

                const actorMembershipSnapshot =
                  await tx.get(
                    actorMembershipRef
                  );

                if (
                  !actorMembershipSnapshot
                    .exists
                ) {

                  fail(
                    'permission-denied',
                    'No tiene una membres?a territorial activa para completar onboarding asistido.'
                  );
                }

                const actorMembership =
                  actorMembershipSnapshot
                    .data();


                if (
                  !actorCanAssistTarget({
                    actorPersonId,

                    actorMembership,

                    targetMembership:
                      membership,

                    campaignId,
                  })
                ) {

                  fail(
                    'permission-denied',
                    'No tiene autoridad territorial activa para completar este onboarding.'
                  );
                }
              }


              const onboardingFactId =
                canonicalOnboardingFactDocumentId({
                  campaignId,

                  personId:
                    targetPersonId,
                });

              const onboardingFactRef =
                db
                  .collection(
                    'onboardingFacts'
                  )
                  .doc(
                    onboardingFactId
                  );

              const existingFactSnapshot =
                await tx.get(
                  onboardingFactRef
                );


              // Idempotencia:
              // un hecho ya completado no se vuelve a
              // escribir, no cambia completedAt y no
              // genera una segunda auditoría.
              if (
                existingFactSnapshot
                  .exists
              ) {

                const existingFact =
                  validateReusableExistingFact({
                    onboardingFactId,

                    onboardingFact:
                      existingFactSnapshot
                        .data(),

                    campaignId,

                    personId:
                      targetPersonId,
                  });

                return {
                  ok:
                    true,

                  onboardingFactId:
                    existingFact.id,

                  campaignId:
                    existingFact
                      .campaignId,

                  personId:
                    existingFact
                      .personId,

                  completedByPersonId:
                    existingFact
                      .completedByPersonId,

                  deliveryMode:
                    existingFact
                      .deliveryMode,

                  programVersion:
                    existingFact
                      .programVersion,

                  alreadyCompleted:
                    true,

                  runtimeScoringEnabled:
                    false,
                };
              }


              // Los criterios son la única evidencia
              // declarativa aceptada del cliente.
              // Identidad, campaña, actor, estado,
              // versión, ID y tiempo son server-side.
              const criteria =
                canonicalCriteria(
                  data.criteria
                );

              const completedAt =
                FieldValue
                  .serverTimestamp();

              const canonicalFact =
                buildAuthoritativeOnboardingFact({
                  campaignId,

                  personId:
                    targetPersonId,

                  completedByPersonId:
                    actorPersonId,

                  deliveryMode,

                  criteria,

                  completedAt,
                });


              const persistedFact = {
                ...canonicalFact,

                completedByUserId:
                  actorUid,

                createdAt:
                  completedAt,
              };


              const auditRef =
                db
                  .collection(
                    'logs'
                  )
                  .doc();


              const auditRecord = {
                action:
                  'COMPLETE_ONBOARDING',

                campaignId,

                personId:
                  targetPersonId,

                onboardingFactId,

                completedByUserId:
                  actorUid,

                completedByPersonId:
                  actorPersonId,

                deliveryMode,

                programVersion:
                  ONBOARDING_PROGRAM_VERSION,

                createdAt:
                  completedAt,

                runtimeScoringEnabled:
                  false,
              };


              tx.create(
                onboardingFactRef,
                persistedFact
              );

              tx.create(
                auditRef,
                auditRecord
              );


              return {
                ok:
                  true,

                onboardingFactId,

                campaignId,

                personId:
                  targetPersonId,

                completedByPersonId:
                  actorPersonId,

                deliveryMode,

                programVersion:
                  ONBOARDING_PROGRAM_VERSION,

                alreadyCompleted:
                  false,

                runtimeScoringEnabled:
                  false,
              };
            }
          );

      } catch (
        error
      ) {

        if (
          error instanceof
            HttpsError
        ) {

          throw error;
        }

        console.error(
          'Error al completar onboarding:',
          error
        );

        fail(
          'internal',
          'No fue posible completar el onboarding.'
        );
      }
    }
  );


exports._test = {
  cleanId,
  canonicalCriteria,
  normalizeDeliveryMode,
  resolveTargetPersonId,
  personMatchesSubject,
  membershipMatchesSubject,
  actorCanAssistTarget,
  buildAuthoritativeOnboardingFact,
  validateReusableExistingFact,
};
