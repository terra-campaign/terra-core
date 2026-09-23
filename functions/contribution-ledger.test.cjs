"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  SOURCE_TYPES,
  SCORE_DIMENSIONS,
} =
  require("./activity-catalog-v1.cjs");

const {
  buildMissionSourceId,
  buildAttendanceSourceId,
} =
  require("./contribution-source.cjs");

const {
  LEDGER_SCHEMA_VERSION,
  LEDGER_STATUSES,
  buildContributionLedgerDraft,
  buildPostableContribution,
  buildReversalDraft,
} =
  require("./contribution-ledger.cjs");

test(
  "ledger draft stores canonical source and rule snapshot",
  () => {
    const sourceId =
      buildAttendanceSourceId({
        eventId:
          "EVT-001",

        personId:
          "PER-001",
      });

    const draft =
      buildContributionLedgerDraft({
        campaignId:
          "CAM-001",

        personId:
          "PER-001",

        activityCode:
          "EVENT_GENERAL_ATTENDANCE",

        sourceType:
          SOURCE_TYPES
            .ATTENDANCE_RECORD,

        sourceId,

        scoreDimension:
          SCORE_DIMENSIONS
            .ATTENDANCE,

        points:
          30,

        occurredAt:
          "2026-09-23T00:00:00.000Z",

        evidenceRef:
          "eventAttendance/ATT-001",
      });

    assert.equal(
      draft.schemaVersion,
      LEDGER_SCHEMA_VERSION
    );

    assert.equal(
      draft.ledgerStatus,
      LEDGER_STATUSES
        .DRAFT_NOT_POSTABLE
    );

    assert.equal(
      draft.points,
      30
    );

    assert.equal(
      draft.scoreSourceType,
      SOURCE_TYPES
        .ATTENDANCE_RECORD
    );

    assert.equal(
      draft.scoreSourceId,
      sourceId
    );

    assert.equal(
      draft.scoreRuleVersion,
      "1.0.0"
    );

    assert.equal(
      draft.ruleSnapshot
        .basePoints,
      30
    );

    assert.equal(
      draft.ruleSnapshot
        .runtimeScoringEnabled,
      false
    );

    assert.deepEqual(
      draft.ruleSnapshot
        .criteria,
      [
        "ATTENDANCE_TRUE",
        "CANONICAL_ATTENDANCE_ID",
        "CANONICAL_PERSON_RESOLVED",
      ]
    );

    assert.ok(
      Object.isFrozen(
        draft.ruleSnapshot
          .criteria
      )
    );

    assert.match(
      draft.ledgerId,
      /^[a-f0-9]{64}$/
    );

    assert.ok(
      Object.isFrozen(
        draft
      )
    );

    assert.ok(
      Object.isFrozen(
        draft.ruleSnapshot
      )
    );
  }
);

test(
  "same source and dimension produce same ledger id",
  () => {
    const sourceId =
      buildMissionSourceId({
        missionId:
          "MIS-001",

        personId:
          "PER-001",
      });

    const input = {
      campaignId:
        "CAM-001",

      personId:
        "PER-001",

      activityCode:
        "TERRITORIAL_BRIGADE",

      sourceType:
        SOURCE_TYPES
          .MISSION_VALIDATION,

      sourceId,

      scoreDimension:
        SCORE_DIMENSIONS
          .TERRITORIAL_ACTIVITY,

      points:
        30,
    };

    const first =
      buildContributionLedgerDraft(
        input
      );

    const second =
      buildContributionLedgerDraft(
        input
      );

    assert.equal(
      first.ledgerId,
      second.ledgerId
    );
  }
);

test(
  "attendance activity rejects mission source",
  () => {
    const missionSource =
      buildMissionSourceId({
        missionId:
          "MIS-001",

        personId:
          "PER-001",
      });

    assert.throws(
      () =>
        buildContributionLedgerDraft({
          campaignId:
            "CAM-001",

          personId:
            "PER-001",

          activityCode:
            "EVENT_GENERAL_ATTENDANCE",

          sourceType:
            SOURCE_TYPES
              .MISSION_VALIDATION,

          sourceId:
            missionSource,

          scoreDimension:
            SCORE_DIMENSIONS
              .ATTENDANCE,

          points:
            30,
        }),
      /RULE_SOURCE_TYPE_MISMATCH/
    );
  }
);

test(
  "canonical source shape is enforced",
  () => {
    assert.throws(
      () =>
        buildContributionLedgerDraft({
          campaignId:
            "CAM-001",

          personId:
            "PER-001",

          activityCode:
            "EVENT_GENERAL_ATTENDANCE",

          sourceType:
            SOURCE_TYPES
              .ATTENDANCE_RECORD,

          sourceId:
            "not-an-attendance-source",

          scoreDimension:
            SCORE_DIMENSIONS
              .ATTENDANCE,

          points:
            30,
        }),
      /INVALID_ATTENDANCE_SOURCE_ID/
    );
  }
);

test(
  "ledger rejects source identity belonging to another person",
  () => {
    const sourceId =
      buildAttendanceSourceId({
        eventId:
          "EVT-001",

        personId:
          "PER-B",
      });

    assert.throws(
      () =>
        buildContributionLedgerDraft({
          campaignId:
            "CAM-001",

          personId:
            "PER-A",

          activityCode:
            "EVENT_GENERAL_ATTENDANCE",

          sourceType:
            SOURCE_TYPES
              .ATTENDANCE_RECORD,

          sourceId,

          scoreDimension:
            SCORE_DIMENSIONS
              .ATTENDANCE,

          points:
            30,
        }),
      /SOURCE_PERSON_MISMATCH/
    );
  }
);

test(
  "runtime posting is blocked while V1 rules are inactive",
  () => {
    const sourceId =
      buildAttendanceSourceId({
        eventId:
          "EVT-001",

        personId:
          "PER-001",
      });

    assert.throws(
      () =>
        buildPostableContribution({
          campaignId:
            "CAM-001",

          personId:
            "PER-001",

          activityCode:
            "EVENT_GENERAL_ATTENDANCE",

          sourceType:
            SOURCE_TYPES
              .ATTENDANCE_RECORD,

          sourceId,

          scoreDimension:
            SCORE_DIMENSIONS
              .ATTENDANCE,

          points:
            30,
        }),
      /CONTRIBUTION_RULE_NOT_ACTIVE/
    );
  }
);

test(
  "reversal is represented as a separate auditable draft",
  () => {
    const reversal =
      buildReversalDraft({
        originalLedgerId:
          "abc123",

        campaignId:
          "CAM-001",

        personId:
          "PER-001",

        points:
          30,

        reason:
          "INVALID_VALIDATION",

        operationId:
          "REV-001",
      });

    assert.equal(
      reversal.entryType,
      "REVERSAL"
    );

    assert.equal(
      reversal.originalLedgerId,
      "abc123"
    );

    assert.equal(
      reversal.deltaPoints,
      -30
    );

    assert.equal(
      reversal.ledgerStatus,
      LEDGER_STATUSES
        .DRAFT_NOT_POSTABLE
    );

    assert.equal(
      reversal.runtimeScoringEnabled,
      false
    );

    assert.match(
      reversal.ledgerId,
      /^[a-f0-9]{64}$/
    );
  }
);
