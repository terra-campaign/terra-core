"use strict";

const {
  canonicalMembershipDocumentId
} =
  require(
    "./territorial-membership-id.cjs"
  );

const {
  resolveCanonicalPersonForAccount
} =
  require(
    "./person-identity.cjs"
  );

const {
  adminCampaignAccessDocumentPath
} =
  require(
    "./admin-campaign-access.cjs"
  );

const {
  canReadPerformanceSummary
} =
  require(
    "./performance-summary-read-policy.cjs"
  );

const {
  readPersonContributionLedger
} =
  require(
    "./performance-summary-ledger-reader.cjs"
  );

const {
  buildPerformanceSummaryProjection
} =
  require(
    "./performance-summary.cjs"
  );

const PERFORMANCE_SUMMARY_READ_SERVICE_VERSION =
  "1.0.0";

const PERFORMANCE_SUMMARY_READ_SERVICE_STATUS =
  "DEFINED_NOT_EXPOSED";

const PERFORMANCE_SUMMARY_READ_SERVICE_SCOPE =
  "AUTHORIZED_PERSON_PERFORMANCE_SUMMARY_READ";

function requireToken(
  value,
  fieldName
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      "INVALID_" +
      fieldName
    );
  }

  const token =
    value.trim();

  if (
    token.length > 128 ||
    token.includes("/")
  ) {
    throw new Error(
      "INVALID_" +
      fieldName
    );
  }

  return token;
}

function requireDatabase(
  db
) {
  if (
    !db ||
    typeof db.collection !==
      "function" ||
    typeof db.doc !==
      "function"
  ) {
    throw new Error(
      "INVALID_PERFORMANCE_SUMMARY_DATABASE"
    );
  }

  return db;
}

async function readSnapshot(
  reference,
  errorCode
) {
  if (
    !reference ||
    typeof reference.get !==
      "function"
  ) {
    throw new Error(
      errorCode +
      "_REFERENCE_INVALID"
    );
  }

  const snapshot =
    await reference.get();

  if (!snapshot) {
    throw new Error(
      errorCode +
      "_SNAPSHOT_INVALID"
    );
  }

  return snapshot;
}

function snapshotObject(
  snapshot,
  errorCode
) {
  if (
    !snapshot ||
    snapshot.exists !== true
  ) {
    return null;
  }

  if (
    typeof snapshot.data !==
      "function"
  ) {
    throw new Error(
      errorCode +
      "_DATA_READER_INVALID"
    );
  }

  const data =
    snapshot.data();

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error(
      errorCode +
      "_DATA_INVALID"
    );
  }

  return data;
}

function normalizeActorProfile({
  snapshot,
  actorUid
}) {
  const uid =
    requireToken(
      actorUid,
      "ACTOR_UID"
    );

  const data =
    snapshotObject(
      snapshot,
      "ACTOR_PROFILE"
    );

  if (!data) {
    throw new Error(
      "ACTOR_PROFILE_NOT_FOUND"
    );
  }

  const embeddedUid =
    typeof data.uid === "string"
      ? data.uid.trim()
      : "";

  if (
    embeddedUid &&
    embeddedUid !== uid
  ) {
    throw new Error(
      "ACTOR_PROFILE_UID_MISMATCH"
    );
  }

  if (
    snapshot.id &&
    snapshot.id !== uid
  ) {
    throw new Error(
      "ACTOR_PROFILE_DOCUMENT_ID_MISMATCH"
    );
  }

  return Object.freeze({
    ...data,
    uid
  });
}

function normalizeTargetPerson({
  snapshot,
  targetPersonId
}) {
  const personId =
    requireToken(
      targetPersonId,
      "TARGET_PERSON_ID"
    );

  const data =
    snapshotObject(
      snapshot,
      "TARGET_PERSON"
    );

  if (!data) {
    throw new Error(
      "TARGET_PERSON_NOT_FOUND"
    );
  }

  if (
    snapshot.id &&
    snapshot.id !== personId
  ) {
    throw new Error(
      "TARGET_PERSON_DOCUMENT_ID_MISMATCH"
    );
  }

  const embeddedPersonId =
    typeof data.personId ===
      "string"
      ? data.personId.trim()
      : "";

  const legacyId =
    typeof data.id ===
      "string"
      ? data.id.trim()
      : "";

  if (
    embeddedPersonId &&
    embeddedPersonId !== personId
  ) {
    throw new Error(
      "TARGET_PERSON_ID_MISMATCH"
    );
  }

  if (
    legacyId &&
    legacyId !== personId
  ) {
    throw new Error(
      "TARGET_PERSON_LEGACY_ID_MISMATCH"
    );
  }

  const campaignId =
    requireToken(
      data.campaignId,
      "TARGET_CAMPAIGN_ID"
    );

  return Object.freeze({
    ...data,
    personId,
    campaignId
  });
}

function normalizeMembership({
  snapshot,
  expectedMembershipId,
  campaignId,
  personId
}) {
  if (
    !snapshot ||
    snapshot.exists !== true
  ) {
    return null;
  }

  const data =
    snapshotObject(
      snapshot,
      "TERRITORIAL_MEMBERSHIP"
    );

  const membershipId =
    requireToken(
      expectedMembershipId,
      "MEMBERSHIP_ID"
    );

  if (
    snapshot.id &&
    snapshot.id !== membershipId
  ) {
    throw new Error(
      "TERRITORIAL_MEMBERSHIP_DOCUMENT_ID_MISMATCH"
    );
  }

  const embeddedMembershipId =
    typeof data.membershipId ===
      "string"
      ? data.membershipId.trim()
      : "";

  if (
    embeddedMembershipId &&
    embeddedMembershipId !==
      membershipId
  ) {
    throw new Error(
      "TERRITORIAL_MEMBERSHIP_ID_MISMATCH"
    );
  }

  if (
    data.campaignId !== campaignId ||
    data.personId !== personId
  ) {
    throw new Error(
      "TERRITORIAL_MEMBERSHIP_IDENTITY_MISMATCH"
    );
  }

  return Object.freeze({
    ...data,
    membershipId
  });
}

function normalizeAdminAccessRecord(
  snapshot
) {
  if (
    !snapshot ||
    snapshot.exists !== true
  ) {
    return null;
  }

  return Object.freeze({
    ...snapshotObject(
      snapshot,
      "ADMIN_ACCESS"
    )
  });
}

function assertLedgerReadResult({
  result,
  campaignId,
  personId
}) {
  if (
    !result ||
    typeof result !== "object" ||
    result.campaignId !==
      campaignId ||
    result.personId !==
      personId ||
    !Array.isArray(
      result.ledgerEntries
    )
  ) {
    throw new Error(
      "INVALID_PERFORMANCE_LEDGER_READ_RESULT"
    );
  }

  return result;
}

function assertProjectionIdentity({
  projection,
  campaignId,
  personId
}) {
  if (
    !projection ||
    typeof projection !==
      "object" ||
    projection.campaignId !==
      campaignId ||
    projection.personId !==
      personId
  ) {
    throw new Error(
      "INVALID_PERFORMANCE_SUMMARY_PROJECTION"
    );
  }

  return projection;
}

function freezeResult({
  campaignId,
  personId,
  ledgerRead,
  projection
}) {
  return Object.freeze({
    schemaVersion:
      PERFORMANCE_SUMMARY_READ_SERVICE_VERSION,

    status:
      PERFORMANCE_SUMMARY_READ_SERVICE_STATUS,

    scope:
      PERFORMANCE_SUMMARY_READ_SERVICE_SCOPE,

    authorization:
      "GRANTED",

    campaignId,
    personId,

    ledger: Object.freeze({
      sourceDocumentCount:
        Number.isInteger(
          ledgerRead.sourceDocumentCount
        )
          ? ledgerRead.sourceDocumentCount
          : ledgerRead.ledgerEntries.length,

      returnedDocumentCount:
        Number.isInteger(
          ledgerRead.returnedDocumentCount
        )
          ? ledgerRead.returnedDocumentCount
          : ledgerRead.ledgerEntries.length,

      paginationRequired:
        ledgerRead.paginationRequired ===
        true
    }),

    summary:
      projection
  });
}

const DEFAULT_DEPENDENCIES =
  Object.freeze({
    resolveCanonicalPersonForAccount,
    canReadPerformanceSummary,
    readPersonContributionLedger,
    buildPerformanceSummaryProjection
  });

function requireDependencies(
  dependencies
) {
  const checked =
    dependencies ||
    DEFAULT_DEPENDENCIES;

  for (
    const name of
    [
      "resolveCanonicalPersonForAccount",
      "canReadPerformanceSummary",
      "readPersonContributionLedger",
      "buildPerformanceSummaryProjection"
    ]
  ) {
    if (
      typeof checked[name] !==
      "function"
    ) {
      throw new Error(
        "INVALID_READ_SERVICE_DEPENDENCY_" +
        name
      );
    }
  }

  return checked;
}

async function readAuthorizedPerformanceSummaryCore({
  db,
  actorUid,
  targetPersonId,
  periodStart = null,
  periodEnd = null,
  dependencies =
    DEFAULT_DEPENDENCIES
}) {
  const database =
    requireDatabase(
      db
    );

  const uid =
    requireToken(
      actorUid,
      "ACTOR_UID"
    );

  const requestedPersonId =
    requireToken(
      targetPersonId,
      "TARGET_PERSON_ID"
    );

  const deps =
    requireDependencies(
      dependencies
    );

  const actorProfileSnapshot =
    await readSnapshot(
      database
        .collection(
          "usuarios"
        )
        .doc(
          uid
        ),
      "ACTOR_PROFILE"
    );

  const targetPersonSnapshot =
    await readSnapshot(
      database
        .collection(
          "persons"
        )
        .doc(
          requestedPersonId
        ),
      "TARGET_PERSON"
    );

  const actorProfile =
    normalizeActorProfile({
      snapshot:
        actorProfileSnapshot,
      actorUid:
        uid
    });

  const targetPerson =
    normalizeTargetPerson({
      snapshot:
        targetPersonSnapshot,
      targetPersonId:
        requestedPersonId
    });

  const campaignId =
    targetPerson.campaignId;

  const personId =
    targetPerson.personId;

  const targetMembershipId =
    canonicalMembershipDocumentId(
      campaignId,
      personId
    );

  const targetMembershipSnapshot =
    await readSnapshot(
      database
        .collection(
          "territorialMemberships"
        )
        .doc(
          targetMembershipId
        ),
      "TARGET_MEMBERSHIP"
    );

  const targetMembership =
    normalizeMembership({
      snapshot:
        targetMembershipSnapshot,
      expectedMembershipId:
        targetMembershipId,
      campaignId,
      personId
    });

  let actorPersonId = null;
  let actorMembership = null;
  let adminAccessRecord = null;

  if (
    actorProfile.role ===
    "admin"
  ) {
    const accessPath =
      adminCampaignAccessDocumentPath(
        uid,
        campaignId
      );

    const accessSnapshot =
      await readSnapshot(
        database.doc(
          accessPath
        ),
        "ADMIN_ACCESS"
      );

    adminAccessRecord =
      normalizeAdminAccessRecord(
        accessSnapshot
      );
  }
  else {
    const identity =
      await deps
        .resolveCanonicalPersonForAccount({
          db:
            database,
          accountUid:
            uid,
          profile:
            actorProfile,
          campaignId
        });

    actorPersonId =
      requireToken(
        identity &&
          identity.personId,
        "ACTOR_PERSON_ID"
      );

    const actorMembershipId =
      canonicalMembershipDocumentId(
        campaignId,
        actorPersonId
      );

    const actorMembershipSnapshot =
      await readSnapshot(
        database
          .collection(
            "territorialMemberships"
          )
          .doc(
            actorMembershipId
          ),
        "ACTOR_MEMBERSHIP"
      );

    actorMembership =
      normalizeMembership({
        snapshot:
          actorMembershipSnapshot,
        expectedMembershipId:
          actorMembershipId,
        campaignId,
        personId:
          actorPersonId
      });
  }

  const authorized =
    deps.canReadPerformanceSummary({
      actorProfile,
      actorPersonId,
      actorMembership,
      targetPerson,
      targetMembership,
      adminAccessRecord
    });

  if (authorized !== true) {
    throw new Error(
      "PERFORMANCE_SUMMARY_READ_FORBIDDEN"
    );
  }

  const ledgerRead =
    assertLedgerReadResult({
      result:
        await deps
          .readPersonContributionLedger({
            db:
              database,
            campaignId,
            personId
          }),

      campaignId,
      personId
    });

  const projection =
    assertProjectionIdentity({
      projection:
        deps
          .buildPerformanceSummaryProjection({
            campaignId,
            personId,
            ledgerEntries:
              ledgerRead.ledgerEntries,
            periodStart,
            periodEnd
          }),

      campaignId,
      personId
    });

  return freezeResult({
    campaignId,
    personId,
    ledgerRead,
    projection
  });
}

async function readAuthorizedPerformanceSummary({
  db,
  actorUid,
  targetPersonId,
  periodStart = null,
  periodEnd = null
}) {
  return readAuthorizedPerformanceSummaryCore({
    db,
    actorUid,
    targetPersonId,
    periodStart,
    periodEnd,
    dependencies:
      DEFAULT_DEPENDENCIES
  });
}

const PERFORMANCE_SUMMARY_READ_SERVICE_POLICY =
  Object.freeze({
    version:
      PERFORMANCE_SUMMARY_READ_SERVICE_VERSION,

    status:
      PERFORMANCE_SUMMARY_READ_SERVICE_STATUS,

    scope:
      PERFORMANCE_SUMMARY_READ_SERVICE_SCOPE,

    targetIdentity:
      "persons_document_id",

    accountlessTargetSupported:
      true,

    membershipIdentity:
      "canonical_campaign_person_hash",

    authorization:
      "performance-summary-read-policy.cjs",

    ledgerSource:
      "performance-summary-ledger-reader.cjs",

    projection:
      "performance-summary.cjs",

    technicalAdminAccess:
      "explicit_adminCampaignAccess",

    generalizedDescendantRead:
      false,

    callableExposed:
      false,

    clientFirestoreReadAllowed:
      false,

    performanceSummaryPersistenceEnabled:
      false,

    scoringActivation:
      false,

    writeCapability:
      false
  });

module.exports = {
  PERFORMANCE_SUMMARY_READ_SERVICE_VERSION,
  PERFORMANCE_SUMMARY_READ_SERVICE_STATUS,
  PERFORMANCE_SUMMARY_READ_SERVICE_SCOPE,
  PERFORMANCE_SUMMARY_READ_SERVICE_POLICY,
  readAuthorizedPerformanceSummary,

  _test: {
    normalizeActorProfile,
    normalizeTargetPerson,
    normalizeMembership,
    assertLedgerReadResult,
    assertProjectionIdentity,
    readAuthorizedPerformanceSummaryCore
  }
};