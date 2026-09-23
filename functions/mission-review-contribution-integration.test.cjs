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
  "both retry and new-review paths carry contribution context",
  () => {
    const occurrences =
      (
        source.match(
          /contributionFact:missionContributionFact/g
        ) ||
        []
      ).length;

    assert.equal(
      occurrences,
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
      /MISSION_CONTRIBUTION_BRIDGE_UNEXPECTED_FAILURE/
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
