"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const ROOT =
  path.resolve(
    __dirname,
    ".."
  );

const html =
  fs.readFileSync(
    path.join(
      ROOT,
      "persona.html"
    ),
    "utf8"
  );

const js =
  fs.readFileSync(
    path.join(
      ROOT,
      "persona.js"
    ),
    "utf8"
  );

test(
  "persona exposes operational performance section",
  () => {

    for (
      const id of
      [
        "performanceContributionCount",
        "performancePoints",
        "performanceTerritorial",
        "performanceAttendance",
        "performanceOrganization",
        "performanceLogistics",
        "performanceDigital",
        "performanceStatus",
      ]
    ) {
      assert.match(
        html,
        new RegExp(
          `id="${id}"`
        )
      );
    }

    assert.match(
      html,
      /DESEMPEÑO OPERATIVO/
    );

    assert.match(
      html,
      /persona\.js\?v=build-124-b2b16-r2/
    );
  }
);

test(
  "persona consumes getPersonPerformanceSummary callable",
  () => {

    assert.match(
      js,
      /httpsCallable\(\s*functions,\s*"getPersonPerformanceSummary"\s*\)/
    );

    assert.match(
      js,
      /async function loadPersonPerformance\(personId\)/
    );

    assert.match(
      js,
      /void loadPersonPerformance\(\s*person\.personId\s*\)/
    );
  }
);

test(
  "performance identity never falls back from personId to uid",
  () => {

    assert.doesNotMatch(
      js,
      /loadPersonPerformance\(\s*uid\s*\)/
    );

    assert.doesNotMatch(
      js,
      /personId:\s*uid/
    );

    assert.match(
      js,
      /if \(!canonicalPersonId\)/
    );

    assert.match(
      js,
      /todavía no tiene identidad canónica de persona/
    );
  }
);

test(
  "inactive runtime scoring does not render zero as a performance grade",
  () => {

    assert.match(
      js,
      /summary\.runtimeScoringActivated !== true/
    );

    assert.match(
      js,
      /No se muestra una calificación ni un índice general/
    );

    assert.doesNotMatch(
      js,
      /generalPerformanceIndex\.value/
    );
  }
);

test(
  "performance UI renders only canonical operational dimensions",
  () => {

    for (
      const dimension of
      [
        "TERRITORIAL_ACTIVITY",
        "ATTENDANCE",
        "ORGANIZATION",
        "LOGISTICS",
        "DIGITAL_ACTIVITY",
      ]
    ) {
      assert.match(
        js,
        new RegExp(
          `dimensions\\.${dimension}`
        )
      );
    }
  }
);

test(
  "persona does not read protected performance collections directly",
  () => {

    assert.doesNotMatch(
      js,
      /contributionLedger/
    );

    assert.doesNotMatch(
      js,
      /collection\(\s*db,\s*["']persons["']/
    );

    assert.doesNotMatch(
      js,
      /collection\(\s*db,\s*["']territorialMemberships["']/
    );
  }
);

test(
  "performance UI remains read only and does not activate scoring",
  () => {

    assert.doesNotMatch(
      js,
      /runtimeScoringActivated\s*=\s*true/
    );

    assert.doesNotMatch(
      js,
      /runtimeScoringEnabled\s*=\s*true/
    );

    assert.doesNotMatch(
      js,
      /\bsetDoc\s*\(/
    );

    assert.doesNotMatch(
      js,
      /\bupdateDoc\s*\(/
    );

    assert.doesNotMatch(
      js,
      /\bdeleteDoc\s*\(/
    );
  }
);