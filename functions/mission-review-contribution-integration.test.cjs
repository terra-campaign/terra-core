"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const source =
  fs.readFileSync(
    "functions/mission-review.cjs",
    "utf8"
  )
    .replace(/\r\n/g, "\n");

test(
  "mission review uses the durable recovery processor instead of the direct contribution path",
  () => {
    assert.match(
      source,
      /contribution-reconciliation-recovery-processor\.cjs/
    );

    assert.match(
      source,
      /processMissionContributionRecovery/
    );

    assert.doesNotMatch(
      source,
      /resolveCanonicalPersonForAccount/
    );

    assert.doesNotMatch(
      source,
      /deriveMissionContributionCandidateSafely/
    );

    assert.doesNotMatch(
      source,
      /reconcileContributionLifecycle/
    );
  }
);

test(
  "mission review atomically creates durable recovery with the authoritative review revision",
  () => {
    assert.match(
      source,
      /buildMissionReviewRecoveryRecord/
    );

    assert.match(
      source,
      /projectMissionContributionRecoveryFacts/
    );

    assert.match(
      source,
      /createRecoveryRecordInTransaction/
    );

    assert.match(
      source,
      /mission-review:\$\{d\.evidenceId\}:revision:\$\{revision\}/
    );

    const transactionStart =
      source.indexOf(
        "const transactionResult = await db.runTransaction"
      );

    const recoveryCreate =
      source.indexOf(
        "createRecoveryRecordInTransaction",
        transactionStart
      );

    const processorCall =
      source.indexOf(
        "await processMissionContributionRecovery",
        transactionStart
      );

    assert.ok(
      transactionStart >= 0
    );

    assert.ok(
      recoveryCreate >
        transactionStart
    );

    assert.ok(
      processorCall >
        recoveryCreate
    );
  }
);

test(
  "mission recovery persists authoritative source facts and not contribution candidates",
  () => {
    assert.match(
      source,
      /previousReview/
    );

    assert.match(
      source,
      /currentReview/
    );

    assert.match(
      source,
      /subjectAccountUid/
    );

    assert.doesNotMatch(
      source,
      /buildMissionReviewRecoveryRecord\s*\(\s*\{[\s\S]*?candidate\s*:/
    );

    assert.doesNotMatch(
      source,
      /buildMissionReviewRecoveryRecord\s*\(\s*\{[\s\S]*?contributionCandidate\s*:/
    );

    assert.doesNotMatch(
      source,
      /buildMissionReviewRecoveryRecord\s*\(\s*\{[\s\S]*?canonicalIdentity\s*:/
    );

    assert.doesNotMatch(
      source,
      /buildMissionReviewRecoveryRecord\s*\(\s*\{[\s\S]*?subjectProfile\s*:/
    );
  }
);

test(
  "duplicate mission review request returns the existing revision without creating another recovery",
  () => {
    assert.match(
      source,
      /c\.r\?\.lastRequestId === d\.requestId && c\.r\?\.lastActor === request\.auth\.uid/
    );

    assert.match(
      source,
      /return\s*\{\s*revision\s*:\s*c\.r\.revision,\s*recoveryRecord\s*:\s*null\s*\};/
    );
  }
);

test(
  "new mission review revision returns its recovery record only to the server integration boundary",
  () => {
    assert.match(
      source,
      /return\s*\{\s*revision,\s*recoveryRecord\s*\};/
    );

    assert.match(
      source,
      /transactionResult\.recoveryRecord/
    );
  }
);

test(
  "mission review invokes durable recovery only after the authoritative transaction completes",
  () => {
    const transactionStart =
      source.indexOf(
        "const transactionResult = await db.runTransaction"
      );

    const recoveryCreate =
      source.indexOf(
        "createRecoveryRecordInTransaction",
        transactionStart
      );

    const processorCall =
      source.indexOf(
        "await processMissionContributionRecovery",
        transactionStart
      );

    assert.ok(
      transactionStart >= 0
    );

    assert.ok(
      recoveryCreate >
        transactionStart
    );

    assert.ok(
      processorCall >
        recoveryCreate
    );

    assert.match(
      source,
      /if\s*\(\s*transactionResult\.recoveryRecord\s*\)/
    );

    assert.match(
      source,
      /processMissionContributionRecovery\s*\(\s*\{[\s\S]*?db[\s\S]*?record\s*:\s*transactionResult\.recoveryRecord[\s\S]*?\}\s*\)/
    );
  }
);

test(
  "unexpected recovery processing failure is contained after the authoritative review commit",
  () => {
    const processorCall =
      source.indexOf(
        "await processMissionContributionRecovery"
      );

    const catchIndex =
      source.indexOf(
        "} catch (error) {",
        processorCall
      );

    assert.ok(
      processorCall >= 0
    );

    assert.ok(
      catchIndex >
        processorCall
    );

    assert.match(
      source,
      /MISSION_CONTRIBUTION_RECONCILIATION_UNEXPECTED_FAILURE/
    );
  }
);

test(
  "public decideMissionReview response remains revision only",
  () => {
    assert.match(
      source,
      /return\s*\{\s*revision:transactionResult\.revision\s*\};/
    );

    assert.doesNotMatch(
      source,
      /return\s*\{\s*revision:transactionResult\.revision\s*,[\s\S]*recoveryRecord/
    );
  }
);

test(
  "mission review integration does not directly write contribution ledger points or summaries",
  () => {
    assert.doesNotMatch(
      source,
      /contributionLedger|contributionCandidates/
    );

    assert.doesNotMatch(
      source,
      /pointsPosted\s*:\s*true/
    );

    assert.doesNotMatch(
      source,
      /runtimeScoringActivated\s*:\s*true/
    );

    assert.doesNotMatch(
      source,
      /performanceSummaryWritten\s*:\s*true/
    );

    assert.doesNotMatch(
      source,
      /reverseContributionLedgerEntry/
    );

    assert.doesNotMatch(
      source,
      /buildContributionLedgerId/
    );
  }
);

test(
  "mission review does not pass subject profile or canonical identity to the recovery processor",
  () => {
    const processorCall =
      source.match(
        /processMissionContributionRecovery\s*\(\s*\{[\s\S]*?\}\s*\)/
      );

    assert.ok(
      processorCall,
      "durable recovery processor invocation must exist"
    );

    assert.doesNotMatch(
      processorCall[0],
      /subjectProfile/
    );

    assert.doesNotMatch(
      processorCall[0],
      /canonicalIdentity/
    );

    assert.doesNotMatch(
      processorCall[0],
      /candidate/
    );
  }
);