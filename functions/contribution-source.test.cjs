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
  buildGrowthSourceId,
  buildMissionContributionSource,
  buildAttendanceContributionSource,
  buildContributionLedgerId,
  buildDedupIdentity,
} =
  require("./contribution-source.cjs");

test(
  "mission source identity is mission plus canonical person",
  () => {
    assert.equal(
      buildMissionSourceId({
        missionId:
          "MIS-001",

        personId:
          "PER-001",
      }),
      "mission:MIS-001:person:PER-001"
    );

    assert.deepEqual(
      buildMissionContributionSource({
        missionId:
          "MIS-001",

        personId:
          "PER-001",
      }),
      {
        sourceType:
          SOURCE_TYPES
            .MISSION_VALIDATION,

        sourceId:
          "mission:MIS-001:person:PER-001",
      }
    );
  }
);

test(
  "attendance source identity is event plus canonical person",
  () => {
    assert.equal(
      buildAttendanceSourceId({
        eventId:
          "EVT-001",

        personId:
          "PER-001",
      }),
      "event-attendance:EVT-001:person:PER-001"
    );

    assert.deepEqual(
      buildAttendanceContributionSource({
        eventId:
          "EVT-001",

        personId:
          "PER-001",
      }),
      {
        sourceType:
          SOURCE_TYPES
            .ATTENDANCE_RECORD,

        sourceId:
          "event-attendance:EVT-001:person:PER-001",
      }
    );
  }
);

test(
  "growth source identity is deterministic",
  () => {
    assert.equal(
      buildGrowthSourceId({
        growthValidationId:
          "GROWTH-001",

        personId:
          "PER-001",
      }),
      "growth-validation:GROWTH-001:person:PER-001"
    );
  }
);

test(
  "ledger id is deterministic for source type source id and dimension",
  () => {
    const input = {
      sourceType:
        SOURCE_TYPES
          .ATTENDANCE_RECORD,

      sourceId:
        buildAttendanceSourceId({
          eventId:
            "EVT-001",

          personId:
            "PER-001",
        }),

      scoreDimension:
        SCORE_DIMENSIONS
          .ATTENDANCE,
    };

    const first =
      buildContributionLedgerId(
        input
      );

    const second =
      buildContributionLedgerId(
        input
      );

    assert.equal(
      first,
      second
    );

    assert.match(
      first,
      /^[a-f0-9]{64}$/
    );
  }
);

test(
  "changing dimension changes ledger identity",
  () => {
    const sourceId =
      buildMissionSourceId({
        missionId:
          "MIS-001",

        personId:
          "PER-001",
      });

    const territorial =
      buildContributionLedgerId({
        sourceType:
          SOURCE_TYPES
            .MISSION_VALIDATION,

        sourceId,

        scoreDimension:
          SCORE_DIMENSIONS
            .TERRITORIAL_ACTIVITY,
      });

    const logistics =
      buildContributionLedgerId({
        sourceType:
          SOURCE_TYPES
            .MISSION_VALIDATION,

        sourceId,

        scoreDimension:
          SCORE_DIMENSIONS
            .LOGISTICS,
      });

    assert.notEqual(
      territorial,
      logistics
    );
  }
);

test(
  "changing canonical person changes source and ledger identity",
  () => {
    const sourceA =
      buildAttendanceSourceId({
        eventId:
          "EVT-001",

        personId:
          "PER-A",
      });

    const sourceB =
      buildAttendanceSourceId({
        eventId:
          "EVT-001",

        personId:
          "PER-B",
      });

    assert.notEqual(
      sourceA,
      sourceB
    );

    const ledgerA =
      buildContributionLedgerId({
        sourceType:
          SOURCE_TYPES
            .ATTENDANCE_RECORD,

        sourceId:
          sourceA,

        scoreDimension:
          SCORE_DIMENSIONS
            .ATTENDANCE,
      });

    const ledgerB =
      buildContributionLedgerId({
        sourceType:
          SOURCE_TYPES
            .ATTENDANCE_RECORD,

        sourceId:
          sourceB,

        scoreDimension:
          SCORE_DIMENSIONS
            .ATTENDANCE,
      });

    assert.notEqual(
      ledgerA,
      ledgerB
    );
  }
);

test(
  "dedup identity exposes the complete canonical tuple",
  () => {
    const identity =
      buildDedupIdentity({
        sourceType:
          SOURCE_TYPES
            .MISSION_VALIDATION,

        sourceId:
          "mission:MIS-001:person:PER-001",

        scoreDimension:
          SCORE_DIMENSIONS
            .TERRITORIAL_ACTIVITY,
      });

    assert.equal(
      identity.sourceType,
      SOURCE_TYPES
        .MISSION_VALIDATION
    );

    assert.equal(
      identity.sourceId,
      "mission:MIS-001:person:PER-001"
    );

    assert.equal(
      identity.scoreDimension,
      SCORE_DIMENSIONS
        .TERRITORIAL_ACTIVITY
    );

    assert.match(
      identity.ledgerId,
      /^[a-f0-9]{64}$/
    );

    assert.ok(
      Object.isFrozen(
        identity
      )
    );
  }
);

test(
  "invalid identifiers cannot produce source or ledger identities",
  () => {
    assert.throws(
      () =>
        buildMissionSourceId({
          missionId:
            "",

          personId:
            "PER-001",
        }),
      /INVALID_MISSION_ID/
    );

    assert.throws(
      () =>
        buildAttendanceSourceId({
          eventId:
            "EVT-001",

          personId:
            "",
        }),
      /INVALID_PERSON_ID/
    );

    assert.throws(
      () =>
        buildContributionLedgerId({
          sourceType:
            "UNKNOWN",

          sourceId:
            "source",

          scoreDimension:
            SCORE_DIMENSIONS
              .ATTENDANCE,
        }),
      /INVALID_SOURCE_TYPE/
    );

    assert.throws(
      () =>
        buildContributionLedgerId({
          sourceType:
            SOURCE_TYPES
              .ATTENDANCE_RECORD,

          sourceId:
            "source",

          scoreDimension:
            "UNKNOWN",
        }),
      /INVALID_SCORE_DIMENSION/
    );
  }
);
