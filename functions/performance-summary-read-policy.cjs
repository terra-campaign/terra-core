"use strict";

const {
  adminCanAccessCampaign
} =
  require(
    "./admin-campaign-access.cjs"
  );

const PERFORMANCE_SUMMARY_READ_POLICY_VERSION =
  "1.0.0";

const PERFORMANCE_SUMMARY_READ_POLICY_STATUS =
  "DEFINED_NOT_EXPOSED";

const PERFORMANCE_SUMMARY_READ_POLICY_SCOPE =
  "CANONICAL_PERSON_PERFORMANCE_READ";

const DIRECT_PARENT_ROLES =
  Object.freeze([
    "coordinador_municipal",
    "jefe_estructura",
    "integrante",
    "participante"
  ]);

function cleanId(
  value
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function validActiveMembership(
  membership,
  {
    campaignId,
    personId
  }
) {
  const canonicalCampaignId =
    cleanId(
      campaignId
    );

  const canonicalPersonId =
    cleanId(
      personId
    );

  if (
    !membership ||
    membership.active !== true ||
    cleanId(
      membership.campaignId
    ) !== canonicalCampaignId ||
    cleanId(
      membership.personId
    ) !== canonicalPersonId
  ) {
    return false;
  }

  return true;
}

function canReadPerformanceSummary({
  actorProfile,
  actorPersonId,
  actorMembership = null,
  targetPerson,
  targetMembership,
  adminAccessRecord = null
}) {
  const actorId =
    cleanId(
      actorPersonId
    );

  const targetId =
    cleanId(
      targetPerson?.personId
    );

  const campaignId =
    cleanId(
      targetPerson?.campaignId
    );

  if (
    !actorProfile ||
    actorProfile.active !== true ||
    !targetId ||
    !campaignId ||
    targetPerson.active !== true
  ) {
    return false;
  }

  if (
    !validActiveMembership(
      targetMembership,
      {
        campaignId,
        personId:
          targetId
      }
    )
  ) {
    return false;
  }

  // ----------------------------------------------------
  // ADMIN TECNICO
  //
  // No requiere identidad territorial propia.
  // Su autoridad proviene exclusivamente de
  // adminCampaignAccess explícito para la campaña.
  // ----------------------------------------------------
  if (
    actorProfile.role ===
    "admin"
  ) {
    return adminCanAccessCampaign({
      profile:
        actorProfile,

      adminUid:
        cleanId(
          actorProfile.uid
        ),

      campaignId,

      accessRecord:
        adminAccessRecord
    });
  }

  // ----------------------------------------------------
  // ACTOR TERRITORIAL
  //
  // Toda autoridad territorial debe provenir de una
  // membresía canónica activa de la misma campaña.
  // ----------------------------------------------------
  if (!actorId) {
    return false;
  }

  if (
    !validActiveMembership(
      actorMembership,
      {
        campaignId,
        personId:
          actorId
      }
    )
  ) {
    return false;
  }

  const actorRole =
    cleanId(
      actorMembership.role
    );

  if (
    !actorRole ||
    actorRole !==
      cleanId(
        actorProfile.role
      )
  ) {
    return false;
  }

  if (
    cleanId(
      actorProfile.campaignId
    ) !== campaignId
  ) {
    return false;
  }

  // Propio desempeño.
  if (
    actorId ===
    targetId
  ) {
    return true;
  }

  // Subordinado directo por relación canónica personId.
  if (
    DIRECT_PARENT_ROLES.includes(
      actorRole
    ) &&
    cleanId(
      targetMembership
        .parentPersonId
    ) === actorId
  ) {
    return true;
  }

  // Responsable de estructura:
  // puede consultar miembros activos de su misma
  // estructura canónica.
  if (
    actorRole ===
      "jefe_estructura" &&
    cleanId(
      actorMembership.structureId
    ) &&
    cleanId(
      targetMembership.structureId
    ) ===
      cleanId(
        actorMembership.structureId
      )
  ) {
    return true;
  }

  return false;
}

const PERFORMANCE_SUMMARY_READ_POLICY =
  Object.freeze({
    version:
      PERFORMANCE_SUMMARY_READ_POLICY_VERSION,

    status:
      PERFORMANCE_SUMMARY_READ_POLICY_STATUS,

    scope:
      PERFORMANCE_SUMMARY_READ_POLICY_SCOPE,

    identity:
      "personId",

    actorAuthority:
      "territorialMemberships",

    targetAuthority:
      "territorialMemberships",

    accountlessTargetSupported:
      true,

    technicalAdminNeedsTerritorialPerson:
      false,

    adminRequiresExplicitCampaignAccess:
      true,

    directParentRelation:
      "parentPersonId",

    generalizedDescendantRead:
      false,

    clientFirestoreReadAllowed:
      false,

    callableExposed:
      false,

    performanceSummaryPersistenceEnabled:
      false
  });

module.exports = {
  PERFORMANCE_SUMMARY_READ_POLICY_VERSION,
  PERFORMANCE_SUMMARY_READ_POLICY_STATUS,
  PERFORMANCE_SUMMARY_READ_POLICY_SCOPE,
  PERFORMANCE_SUMMARY_READ_POLICY,
  DIRECT_PARENT_ROLES,
  validActiveMembership,
  canReadPerformanceSummary
};