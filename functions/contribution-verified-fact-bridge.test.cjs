"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  createHash,
} =
  require("node:crypto");

const {
  CATALOG_VERSION,
} =
  require("./activity-catalog-v1.cjs");

const {
  CANDIDATE_STATUSES,
} =
  require("./contribution-candidate.cjs");

const {
  BRIDGE_STATUSES,
  BRIDGE_STAGES,
  deriveMissionContributionCandidateSafely,
  deriveAttendanceContributionCandidateSafely,
} =
  require("./contribution-verified-fact-bridge.cjs");

function missionFact({
  activityCode =
    "TERRITORIAL_BRIGADE",

  activityCatalogVersion =
    CATALOG_VERSION,

  status =
    "validated",

  pendingAppeal =
    false,
} = {}) {
  const mission = {
    id:
      "MIS-BRIDGE-001",

    campaignId:
      "CAM-001",

    assignedTo:
      "UID-001",
  };

  if (activityCode != null) {
    mission.activityCode =
      activityCode;
  }

  if (
    activityCatalogVersion != null
  ) {
    mission.activityCatalogVersion =
      activityCatalogVersion;
  }

  return {
    db: {
      fake:
        true,
    },

    mission,

    evidence: {
      id:
        "EVID-BRIDGE-001",

      evidenceId:
        "EVID-BRIDGE-001",

      campaignId:
        "CAM-001",

      missionId:
        "MIS-BRIDGE-001",

      uploadedBy:
        "UID-001",

      assignedTo:
        "UID-001",
    },

    review: {
      campaignId:
        "CAM-001",

      missionId:
        "MIS-BRIDGE-001",

      evidenceId:
        "EVID-BRIDGE-001",

      subjectId:
        "UID-001",

      status,

      pendingAppeal,

      updatedAt:
        1000,
    },

    reviewId:
      "EVID-BRIDGE-001",

    subjectProfile: {
      uid:
        "UID-001",

      active:
        true,

      campaignId:
        "CAM-001",

      personId:
        "PER-001",
    },
  };
}

async function canonicalResolver(
  input
) {
  assert.equal(
    input.tx,
    null
  );

  assert.equal(
    input.accountUid,
    "UID-001"
  );

  assert.equal(
    input.campaignId,
    "CAM-001"
  );

  assert.equal(
    input.profile.personId,
    "PER-001"
  );

  return {
    personId:
      "PER-001",

    accountUid:
      "UID-001",

    person: {
      personId:
        "PER-001",

      accountUid:
        "UID-001",

      campaignId:
        "CAM-001",

      active:
        true,
    },
  };
}

function attendanceFact({
  activityCode =
    "EVENT_GENERAL_ATTENDANCE",

  activityCatalogVersion =
    CATALOG_VERSION,
} = {}) {
  const eventId =
    "EVT-BRIDGE-001";

  const personId =
    "PER-001";

  const attendanceId =
    createHash("sha256")
      .update(
        JSON.stringify([
          "event-attendance",
          eventId,
          personId,
        ])
      )
      .digest("hex");

  const event = {
    id:
      eventId,

    campaignId:
      "CAM-001",
  };

  if (activityCode != null) {
    event.activityCode =
      activityCode;
  }

  if (
    activityCatalogVersion != null
  ) {
    event.activityCatalogVersion =
      activityCatalogVersion;
  }

  return {
    attendanceId,

    event,

    attendance: {
      eventId,

      personId,

      accountUid:
        "UID-001",

      campaignId:
        "CAM-001",

      attended:
        true,

      validatedByUserId:
        "UID-VALIDATOR",

      checkedInAt:
        2000,
    },
  };
}

test(
  "validated classified mission derives candidate after canonical identity resolution",
  async () => {
    const result =
      await deriveMissionContributionCandidateSafely({
        ...missionFact(),

        resolveCanonicalIdentity:
          canonicalResolver,
      });

    assert.equal(
      result.status,
      BRIDGE_STATUSES.DERIVED
    );

    assert.equal(
      result.stage,
      BRIDGE_STAGES.CANDIDATE
    );

    assert.equal(
      result.candidate
        .candidateStatus,
      CANDIDATE_STATUSES
        .ELIGIBLE_DRAFT
    );

    assert.equal(
      result.candidate.personId,
      "PER-001"
    );

    assert.equal(
      result.candidate
        .runtimePostingEnabled,
      false
    );

    assert.equal(
      result.persisted,
      false
    );

    assert.equal(
      result.pointsPosted,
      false
    );
  }
);

test(
  "historical unclassified mission remains derivable without classification",
  async () => {
    const result =
      await deriveMissionContributionCandidateSafely({
        ...missionFact({
          activityCode:
            null,

          activityCatalogVersion:
            null,
        }),

        resolveCanonicalIdentity:
          canonicalResolver,
      });

    assert.equal(
      result.status,
      BRIDGE_STATUSES.DERIVED
    );

    assert.equal(
      result.candidate
        .candidateStatus,
      CANDIDATE_STATUSES
        .UNCLASSIFIED
    );

    assert.equal(
      result.candidate.points,
      null
    );
  }
);

test(
  "rejected mission is not eligible and does not resolve identity",
  async () => {
    let resolverCalls =
      0;

    const result =
      await deriveMissionContributionCandidateSafely({
        ...missionFact({
          status:
            "rejected",
        }),

        resolveCanonicalIdentity:
          async () => {
            resolverCalls++;

            throw new Error(
              "SHOULD_NOT_RUN"
            );
          },
      });

    assert.equal(
      resolverCalls,
      0
    );

    assert.equal(
      result.status,
      BRIDGE_STATUSES
        .NOT_ELIGIBLE
    );

    assert.equal(
      result.reasonCode,
      "MISSION_NOT_VALIDATED"
    );

    assert.equal(
      result.candidate,
      null
    );
  }
);

test(
  "pending appeal is not eligible and does not resolve identity",
  async () => {
    let resolverCalls =
      0;

    const result =
      await deriveMissionContributionCandidateSafely({
        ...missionFact({
          pendingAppeal:
            true,
        }),

        resolveCanonicalIdentity:
          async () => {
            resolverCalls++;

            throw new Error(
              "SHOULD_NOT_RUN"
            );
          },
      });

    assert.equal(
      resolverCalls,
      0
    );

    assert.equal(
      result.status,
      BRIDGE_STATUSES
        .NOT_ELIGIBLE
    );

    assert.equal(
      result.reasonCode,
      "MISSION_PENDING_APPEAL"
    );
  }
);

test(
  "identity resolver failure is contained by bridge",
  async () => {
    const result =
      await deriveMissionContributionCandidateSafely({
        ...missionFact(),

        resolveCanonicalIdentity:
          async () => {
            throw new Error(
              "SIMULATED_IDENTITY_FAILURE"
            );
          },
      });

    assert.equal(
      result.status,
      BRIDGE_STATUSES.ERROR
    );

    assert.equal(
      result.stage,
      BRIDGE_STAGES.IDENTITY
    );

    assert.equal(
      result.reasonCode,
      "SIMULATED_IDENTITY_FAILURE"
    );

    assert.equal(
      result.candidate,
      null
    );
  }
);

test(
  "mission candidate failure is contained by bridge",
  async () => {
    const result =
      await deriveMissionContributionCandidateSafely({
        ...missionFact({
          activityCatalogVersion:
            "0.9.0",
        }),

        resolveCanonicalIdentity:
          canonicalResolver,
      });

    assert.equal(
      result.status,
      BRIDGE_STATUSES.ERROR
    );

    assert.equal(
      result.stage,
      BRIDGE_STAGES.CANDIDATE
    );

    assert.equal(
      result.reasonCode,
      "ACTIVITY_CATALOG_VERSION_MISMATCH"
    );

    assert.equal(
      result.candidate,
      null
    );
  }
);

test(
  "classified attendance derives candidate without identity lookup",
  () => {
    const result =
      deriveAttendanceContributionCandidateSafely(
        attendanceFact()
      );

    assert.equal(
      result.status,
      BRIDGE_STATUSES.DERIVED
    );

    assert.equal(
      result.candidate
        .candidateStatus,
      CANDIDATE_STATUSES
        .ELIGIBLE_DRAFT
    );

    assert.equal(
      result.candidate.personId,
      "PER-001"
    );

    assert.equal(
      result.candidate
        .runtimePostingEnabled,
      false
    );

    assert.equal(
      result.persisted,
      false
    );

    assert.equal(
      result.ledgerWritten,
      false
    );

    assert.equal(
      result.pointsPosted,
      false
    );
  }
);

test(
  "historical unclassified attendance remains derivable",
  () => {
    const result =
      deriveAttendanceContributionCandidateSafely(
        attendanceFact({
          activityCode:
            null,

          activityCatalogVersion:
            null,
        })
      );

    assert.equal(
      result.status,
      BRIDGE_STATUSES.DERIVED
    );

    assert.equal(
      result.candidate
        .candidateStatus,
      CANDIDATE_STATUSES
        .UNCLASSIFIED
    );

    assert.equal(
      result.candidate.points,
      null
    );
  }
);

test(
  "attendance candidate failure is contained by bridge",
  () => {
    const input =
      attendanceFact();

    input.attendanceId =
      "legacy-attendance-id";

    const result =
      deriveAttendanceContributionCandidateSafely(
        input
      );

    assert.equal(
      result.status,
      BRIDGE_STATUSES.ERROR
    );

    assert.equal(
      result.stage,
      BRIDGE_STAGES.CANDIDATE
    );

    assert.equal(
      result.reasonCode,
      "ATTENDANCE_ID_NOT_CANONICAL"
    );

    assert.equal(
      result.candidate,
      null
    );
  }
);

test(
  "bridge result explicitly declares all runtime mutations disabled",
  async () => {
    const mission =
      await deriveMissionContributionCandidateSafely({
        ...missionFact(),

        resolveCanonicalIdentity:
          canonicalResolver,
      });

    const attendance =
      deriveAttendanceContributionCandidateSafely(
        attendanceFact()
      );

    for (
      const result of [
        mission,
        attendance
      ]
    ) {
      assert.equal(
        result.persisted,
        false
      );

      assert.equal(
        result.ledgerWritten,
        false
      );

      assert.equal(
        result.pointsPosted,
        false
      );

      assert.equal(
        result.runtimeScoringActivated,
        false
      );
    }
  }
);
