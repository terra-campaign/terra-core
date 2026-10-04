"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildIndividualPerformanceView,
} =
  require("./performance-individual-public-adapter.cjs");


function ledgerEntry(overrides = {}) {
  return {
    contributionId:
      "CONTRIB-001",

    campaignId:
      "CAM-004",

    personId:
      "PERSON-001",

    ledgerStatus:
      "POSTED",

    runtimeScoringEnabled:
      true,

    activityCode:
      "TERRITORIAL_BRIGADE",

    scoreDimension:
      "TERRITORIAL_ACTIVITY",

    points:
      30,

    occurredAt: {
      seconds:
        1771113600,

      nanoseconds:
        0
    },

    ...overrides,
  };
}


function build(entries) {
  return buildIndividualPerformanceView({

    campaignId:
      "CAM-004",

    personId:
      "PERSON-001",

    ledgerEntries:
      entries,

    operationalPeriod: {
      version:
        "1.0.0",

      status:
        "DEFINED_NOT_ACTIVATED",

      scope:
        "OPERATIONAL_PERFORMANCE_PERIOD",

      campaignId:
        "CAM-004",

      periodId:
        "PERIOD-001",

      startDate:
        "2026-01-01",

      endDate:
        "2026-04-01",
    },

    membership: {
      membershipId:
        "MEM-001",

      personId:
        "PERSON-001",

      campaignId:
        "CAM-004",

      createdAt:
        "2026-02-01T00:00:00.000Z",
    },
  });
}


test(
  "vista publica expone la explicacion de puntuacion",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.ok(
      result.explanation
    );

    assert.equal(
      result.explanation.title,
      "Cómo obtuve estos puntos"
    );

    assert.equal(
      typeof result.explanation.description,
      "string"
    );

    assert.ok(
      Array.isArray(
        result.explanation.rules
      )
    );

    assert.equal(
      result.explanation.rules.length,
      9
    );
  }
);


test(
  "vista publica expone el puntaje acumulado",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.totalPoints,
      30
    );

    assert.equal(
      result.contributionCount,
      1
    );
  }
);


test(
  "vista publica expone las cinco dimensiones",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.deepEqual(
      result.dimensions.map(
        dimension =>
          dimension.name
      ),
      [
        "Actividad territorial",
        "Asistencia",
        "Organización",
        "Logística",
        "Actividad digital",
      ]
    );

    assert.equal(
      result.dimensions[0].points,
      30
    );
  }
);


test(
  "actividad registrada conserva nombre publico y puntaje",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.activities.length,
      1
    );

    assert.equal(
      result.activities[0].activity,
      "Brigada territorial"
    );

    assert.equal(
      result.activities[0].points,
      30
    );

    assert.equal(
      result.activities[0].dimension,
      "Actividad territorial"
    );
  }
);


test(
  "catalogo publico contiene las nueve reglas",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.explanation.rules.length,
      9
    );

    for (
      const rule of
      result.explanation.rules
    ) {

      assert.equal(
        Object.hasOwn(
          rule,
          "code"
        ),
        false
      );

      assert.equal(
        typeof rule.name,
        "string"
      );

      assert.equal(
        typeof rule.points,
        "number"
      );

      assert.equal(
        typeof rule.dimension,
        "string"
      );

      assert.equal(
        typeof rule.source,
        "string"
      );

      assert.equal(
        typeof rule.validation,
        "string"
      );
    }
  }
);


test(
  "estado del scoring sigue sin activarse",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.explanation.scoringStatus,
      "DEFINED_NOT_ACTIVATED"
    );

    assert.equal(
      result.runtimeScoringActivated,
      false
    );
  }
);


test(
  "actividad revertida no genera puntos ni actividad visible",
  () => {

    const result =
      build([
        ledgerEntry({
          ledgerStatus:
            "REVERSED"
        })
      ]);

    assert.equal(
      result.totalPoints,
      0
    );

    assert.equal(
      result.activities.length,
      0
    );
  }
);
