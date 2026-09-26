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
  "mission review imports canonical identity resolver and safe contribution bridge",
  () => {
    assert.match(
      source,
      /resolveCanonicalPersonForAccount/
    );

    assert.match(
      source,
      /deriveMissionContributionCandidateSafely/
    );
  }
);

test(
  "mission contribution fact is server internal and carries authoritative source objects",
  () => {
    assert.match(
      source,
      /function\s+missionContributionFact\s*\(c,review,evidenceId\)/
    );

    assert.match(
      source,
      /mission:\s*\{[\s\S]*\.\.\.c\.m,[\s\S]*id:\s*c\.e\.missionId/
    );

    assert.match(
      source,
      /evidence:\s*\{[\s\S]*\.\.\.c\.e,[\s\S]*id:\s*evidenceId,[\s\S]*evidenceId/
    );

    assert.match(
      source,
      /subjectProfile:\s*c\.subject/
    );
  }
);

test(
  "authoritative transaction is awaited before candidate bridge executes",
  () => {
    const transactionIndex =
      source.indexOf(
        "const transactionResult = await db.runTransaction"
      );

    const bridgeIndex =
      source.indexOf(
        "await deriveMissionContributionCandidateSafely"
      );

    assert.ok(
      transactionIndex >= 0
    );

    assert.ok(
      bridgeIndex >
        transactionIndex
    );

    const transactionCloseIndex =
      source.indexOf(
        "  });\n\n  // The authoritative review transaction has already committed."
      );

    assert.ok(
      transactionCloseIndex >
        transactionIndex
    );

    assert.ok(
      bridgeIndex >
        transactionCloseIndex
    );
  }
);

test(
  "both retry and new-review paths carry previous and current contribution context",
  () => {
    const previousOccurrences =
      (
        source.match(
          /previousContributionFact:missionContributionFact/g
        ) ||
        []
      ).length;

    const currentOccurrences =
      (
        source.match(
          /currentContributionFact:missionContributionFact/g
        ) ||
        []
      ).length;

    assert.equal(
      previousOccurrences,
      2
    );

    assert.equal(
      currentOccurrences,
      2
    );
  }
);

test(
  "unexpected bridge failure is contained after commit",
  () => {
    const bridgeCall =
      source.indexOf(
        "await deriveMissionContributionCandidateSafely"
      );

    const catchIndex =
      source.indexOf(
        "} catch (error) {",
        bridgeCall
      );

    assert.ok(
      bridgeCall >= 0
    );

    assert.ok(
      catchIndex >
        bridgeCall
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
      /return\s*\{[^}]*candidate[^}]*\};/
    );
  }
);

test(
  "mission review integration does not write contribution ledger or points",
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
  }
);

test(
  "mission review delegates contribution lifecycle transitions to the canonical reconciler",
  () => {
    assert.match(
      source,
      /reconcileContributionLifecycle/
    );

    assert.match(
      source,
      /previousContributionResult/
    );

    assert.match(
      source,
      /currentContributionResult/
    );

    assert.doesNotMatch(
      source,
      /reverseContributionLedgerEntry/
    );

    assert.doesNotMatch(
      source,
      /buildMissionSourceId/
    );

    assert.doesNotMatch(
      source,
      /buildContributionLedgerId/
    );
  }
);
test(
  "mission review preserves previous and current contribution facts for reconciliation",
  () => {
    assert.match(
      source,
      /previousContributionFact/
    );

    assert.match(
      source,
      /currentContributionFact/
    );

    assert.match(
      source,
      /missionContributionFact\s*\(\s*c\s*,\s*c\.r\s*,\s*d\.evidenceId\s*\)/
    );

    assert.match(
      source,
      /missionContributionFact\s*\(\s*c\s*,\s*r\s*,\s*d\.evidenceId\s*\)/
    );
  }
);

test(
  "mission review derives previous and current contribution eligibility",
  () => {
    const source =
      fs.readFileSync(
        __dirname + "/mission-review.cjs",
        "utf8"
      );

    assert.match(
      source,
      /previousContributionResult\s*=\s*[\s\S]*?deriveMissionContributionCandidateSafely/
    );

    assert.match(
      source,
      /transactionResult.previousContributionFact/
    );

    assert.match(
      source,
      /currentContributionResult\s*=\s*[\s\S]*?deriveMissionContributionCandidateSafely/
    );

    assert.match(
      source,
      /transactionResult.currentContributionFact/
    );
  }
);


test(
  "mission review passes the complete contribution transition to lifecycle reconciliation",
  () => {
    assert.match(
      source,
      /reconcileContributionLifecycle\s*\(\s*\{[\s\S]*?previousContributionResult[\s\S]*?currentContributionResult[\s\S]*?\}\s*\)/
    );

    assert.match(
      source,
      /operationId\s*:/
    );

    assert.match(
      source,
      /mission-review/
    );

    assert.match(
      source,
      /transactionResult\.revision/
    );

    assert.doesNotMatch(
      source,
      /previousContributionResult\.status === ['"]DERIVED['"]/
    );

    assert.doesNotMatch(
      source,
      /currentContributionResult\.status === ['"]DERIVED['"]/
    );
  }
);
