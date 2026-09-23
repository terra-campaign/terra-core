"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const source =
  fs.readFileSync(
    "functions/event-delegation.cjs",
    "utf8"
  )
    .replace(/\r\n/g, "\n");

function writer(
  exportName
) {
  const token =
    "exports." +
    exportName +
    " =";

  const start =
    source.indexOf(
      token
    );

  assert.notEqual(
    start,
    -1
  );

  const next =
    source.indexOf(
      "\nexports.",
      start + token.length
    );

  return source.slice(
    start,
    next >= 0
      ? next
      : source.length
  );
}

function count(
  text,
  regex
) {
  return (
    text.match(
      regex
    ) ||
    []
  ).length;
}

const door =
  writer(
    "recordDoorEventAttendance"
  );

const standard =
  writer(
    "recordEventAttendance"
  );

test(
  "attendance bridge is imported and centralized behind one post-commit helper",
  () => {
    assert.equal(
      count(
        source,
        /deriveAttendanceContributionCandidateSafely/g
      ),
      2
    );

    assert.match(
      source,
      /async function deriveAttendanceContributionAfterCommitSafely\s*\(/
    );
  }
);

test(
  "post-commit helper rereads authoritative event and attendance documents",
  () => {
    const start =
      source.indexOf(
        "async function deriveAttendanceContributionAfterCommitSafely"
      );

    assert.notEqual(
      start,
      -1
    );

    const next =
      source.indexOf(
        "\nfunction ",
        start + 1
      );

    const helper =
      source.slice(
        start,
        next
      );

    assert.match(
      helper,
      /Promise\.all/
    );

    assert.match(
      helper,
      /collection\(\s*'events'\s*\)/
    );

    assert.match(
      helper,
      /collection\(\s*'eventAttendance'\s*\)/
    );

    assert.match(
      helper,
      /\.\.\.attendanceSnapshot\.data\(\)/
    );

    assert.match(
      helper,
      /attendanceId:\s*attendanceSnapshot\.id/
    );

    assert.match(
      helper,
      /\.\.\.eventSnapshot\.data\(\)/
    );

    assert.match(
      helper,
      /id:\s*eventSnapshot\.id/
    );
  }
);

test(
  "door attendance commits before contribution derivation",
  () => {
    const transaction =
      door.indexOf(
        "const transactionResult = await db.runTransaction"
      );

    const bridge =
      door.indexOf(
        "await deriveAttendanceContributionAfterCommitSafely"
      );

    const publicReturn =
      door.indexOf(
        "return transactionResult;"
      );

    assert.ok(
      transaction >= 0
    );

    assert.ok(
      bridge >
        transaction
    );

    assert.ok(
      publicReturn >
        bridge
    );

    assert.doesNotMatch(
      door,
      /return db\.runTransaction\s*\(/
    );
  }
);

test(
  "standard attendance commits before contribution derivation",
  () => {
    const transaction =
      standard.indexOf(
        "const transactionResult = await db.runTransaction"
      );

    const bridge =
      standard.indexOf(
        "await deriveAttendanceContributionAfterCommitSafely"
      );

    const publicReturn =
      standard.indexOf(
        "return transactionResult;"
      );

    assert.ok(
      transaction >= 0
    );

    assert.ok(
      bridge >
        transaction
    );

    assert.ok(
      publicReturn >
        bridge
    );

    assert.doesNotMatch(
      standard,
      /return db\.runTransaction\s*\(/
    );
  }
);

test(
  "both writers carry internal fact on unchanged and newly-created attendance",
  () => {
    const factPattern =
      /__contributionFact:\s*\{\s*attendanceId,\s*eventId:\s*event\.id\s*\}/g;

    assert.equal(
      count(
        door,
        factPattern
      ),
      2
    );

    assert.equal(
      count(
        standard,
        factPattern
      ),
      2
    );
  }
);

test(
  "internal contribution metadata is removed before public response",
  () => {
    for (
      const block of [
        door,
        standard
      ]
    ) {
      const deleteIndex =
        block.indexOf(
          "delete transactionResult"
        );

      const bridgeIndex =
        block.indexOf(
          "await deriveAttendanceContributionAfterCommitSafely"
        );

      const returnIndex =
        block.indexOf(
          "return transactionResult;"
        );

      assert.ok(
        deleteIndex >= 0
      );

      assert.ok(
        bridgeIndex >
          deleteIndex
      );

      assert.ok(
        returnIndex >
          bridgeIndex
      );
    }
  }
);

test(
  "transient serverTimestamp attendance object is never passed directly to candidate bridge",
  () => {
    assert.match(
      door,
      /FieldValue\.serverTimestamp\(\)/
    );

    assert.match(
      standard,
      /FieldValue\.serverTimestamp\(\)/
    );

    assert.doesNotMatch(
      door,
      /deriveAttendanceContributionCandidateSafely\s*\(/
    );

    assert.doesNotMatch(
      standard,
      /deriveAttendanceContributionCandidateSafely\s*\(/
    );
  }
);

test(
  "bridge source misses and unexpected errors cannot roll back committed attendance",
  () => {
    const helperStart =
      source.indexOf(
        "async function deriveAttendanceContributionAfterCommitSafely"
      );

    const helperEnd =
      source.indexOf(
        "\nfunction ",
        helperStart + 1
      );

    const helper =
      source.slice(
        helperStart,
        helperEnd
      );

    assert.match(
      helper,
      /ATTENDANCE_CONTRIBUTION_BRIDGE_SOURCE_MISSING/
    );

    assert.match(
      helper,
      /ATTENDANCE_CONTRIBUTION_BRIDGE_UNEXPECTED_FAILURE/
    );

    assert.match(
      helper,
      /return null;/
    );
  }
);

test(
  "attendance integration does not persist candidates ledger points or activate runtime scoring",
  () => {
    assert.doesNotMatch(
      source,
      /contributionCandidates/
    );

    assert.doesNotMatch(
      source,
      /contributionLedger/
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
