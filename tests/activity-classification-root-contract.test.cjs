"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

function read(file) {
  return fs
    .readFileSync(
      file,
      "utf8"
    )
    .replace(/\r\n/g, "\n");
}

test(
  "mission root guard occurs after historical receipt return",
  () => {
    const source =
      read(
        "functions/mission-delegation.cjs"
      );

    const retry =
      source.indexOf(
        "return receipt.data().result;"
      );

    const guard =
      source.indexOf(
        "if (!parentId && !activityClassification)"
      );

    const parent =
      source.indexOf(
        "if (parentId) {",
        guard
      );

    assert.ok(
      retry >= 0
    );

    assert.ok(
      guard > retry
    );

    assert.ok(
      parent > guard
    );
  }
);

test(
  "general event guard occurs after historical receipt return",
  () => {
    const source =
      read(
        "functions/event-general.cjs"
      );

    const retry =
      source.indexOf(
        "return saved.result;"
      );

    const guard =
      source.indexOf(
        "if (!activityClassification)",
        retry
      );

    const eventRef =
      source.indexOf(
        "const eventRef =",
        guard
      );

    assert.ok(
      retry >= 0
    );

    assert.ok(
      guard > retry
    );

    assert.ok(
      eventRef > guard
    );
  }
);

test(
  "event invitation guard only applies to root after historical retry",
  () => {
    const source =
      read(
        "functions/event-delegation.cjs"
      );

    const parent =
      source.indexOf(
        "const parentInvitationId ="
      );

    const retry =
      source.indexOf(
        "return saved.result;",
        parent
      );

    const guard =
      source.indexOf(
        "!parentInvitationId &&",
        retry
      );

    const flow =
      source.indexOf(
        "let eventId;",
        guard
      );

    assert.ok(
      parent >= 0
    );

    assert.ok(
      retry > parent
    );

    assert.ok(
      guard > retry
    );

    assert.ok(
      flow > guard
    );

    const guardBlock =
      source.slice(
        guard,
        flow
      );

    assert.match(
      guardBlock,
      /!activityClassification/
    );
  }
);

test(
  "classification parser stays tolerant for historical records",
  () => {
    const {
      classifyMissionActivity,
      classifyEventAttendanceActivity,
    } =
      require(
        "../functions/activity-classification.cjs"
      );

    assert.equal(
      classifyMissionActivity(
        null
      ),
      null
    );

    assert.equal(
      classifyEventAttendanceActivity(
        ""
      ),
      null
    );
  }
);

test(
  "generic growth classification is still excluded",
  () => {
    const {
      classifyMissionActivity,
      classifyEventAttendanceActivity,
    } =
      require(
        "../functions/activity-classification.cjs"
      );

    assert.throws(
      () =>
        classifyMissionActivity(
          "ORGANIZATIONAL_GROWTH"
        )
    );

    assert.throws(
      () =>
        classifyEventAttendanceActivity(
          "ORGANIZATIONAL_GROWTH"
        )
    );
  }
);

test(
  "contract phase introduces no scoring or posting",
  () => {
    const runtime =
      [
        read(
          "functions/mission-delegation.cjs"
        ),
        read(
          "functions/event-general.cjs"
        ),
        read(
          "functions/event-delegation.cjs"
        ),
      ].join("\n");

    assert.doesNotMatch(
      runtime,
      /contribution-ledger|buildContributionCandidate|assertRuleCanPost/
    );

    assert.doesNotMatch(
      runtime,
      /status\s*:\s*["']POSTED["']/
    );
  }
);
