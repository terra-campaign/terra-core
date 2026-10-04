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
        0,
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


/* ============================================================
   1. CONTRATO PRINCIPAL
   ============================================================ */

test(
  "Mi desempeño expone el contrato publico principal",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.title,
      "Mi desempeño"
    );

    assert.equal(
      typeof result.campaignId,
      "string"
    );

    assert.equal(
      typeof result.personId,
      "string"
    );

    assert.equal(
      typeof result.totalPoints,
      "number"
    );

    assert.ok(
      Array.isArray(
        result.dimensions
      )
    );

    assert.ok(
      Array.isArray(
        result.activities
      )
    );

    assert.ok(
      result.explanation
    );

  }
);


/* ============================================================
   2. CINCO DIMENSIONES CANONICAS
   ============================================================ */

test(
  "Mi desempeño conserva las cinco dimensiones canonicas",
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

  }
);


/* ============================================================
   3. CADA DIMENSION TIENE PUNTOS
   ============================================================ */

test(
  "cada dimension publica su acumulado de puntos",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    for (
      const dimension of
      result.dimensions
    ) {

      assert.equal(
        typeof dimension.name,
        "string"
      );

      assert.equal(
        typeof dimension.points,
        "number"
      );

      assert.ok(
        dimension.points >= 0
      );

    }

  }
);


/* ============================================================
   4. ACTIVIDAD VISIBLE
   ============================================================ */

test(
  "cada actividad visible conserva actividad, puntos y dimension",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.activities.length,
      1
    );

    const activity =
      result.activities[0];

    assert.equal(
      activity.activity,
      "Brigada territorial"
    );

    assert.equal(
      activity.points,
      30
    );

    assert.equal(
      activity.dimension,
      "Actividad territorial"
    );

    assert.ok(
      activity.occurredAt
    );

  }
);


/* ============================================================
   5. EXPLICACION PUBLICA
   ============================================================ */

test(
  "Mi desempeño explica como se obtienen los puntos",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.explanation.title,
      "Cómo obtuve estos puntos"
    );

    assert.equal(
      typeof
        result.explanation.description,
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


/* ============================================================
   6. REGLAS PUBLICAS COMPLETAS
   ============================================================ */

test(
  "cada regla publica contiene informacion explicable",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

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
        typeof rule.pointMode,
        "string"
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

      assert.equal(
        rule.catalogVersion,
        "1.0.0"
      );

    }

  }
);


/* ============================================================
   7. ESTADO DE SCORING
   ============================================================ */

test(
  "el contrato publico no activa el scoring runtime",
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


/* ============================================================
   8. NO HAY CALIFICACION GENERAL ARTIFICIAL
   ============================================================ */

test(
  "el contrato no inventa una calificacion general",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.runtimeScoringActivated,
      false
    );

    assert.ok(
      !Object.prototype.hasOwnProperty.call(
        result,
        "rating"
      )
    );

    assert.ok(
      !Object.prototype.hasOwnProperty.call(
        result,
        "grade"
      )
    );

    assert.ok(
      !Object.prototype.hasOwnProperty.call(
        result,
        "qualification"
      )
    );

  }
);


/* ============================================================
   9. REVERSAL
   ============================================================ */

test(
  "una contribucion revertida desaparece del desempeño visible",
  () => {

    const result =
      build([

        ledgerEntry({
          ledgerStatus:
            "REVERSED",
        }),

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


/* ============================================================
   10. INMUTABILIDAD
   ============================================================ */

test(
  "la salida publica permanece congelada",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.ok(
      Object.isFrozen(result)
    );

    assert.ok(
      Object.isFrozen(
        result.dimensions
      )
    );

    assert.ok(
      Object.isFrozen(
        result.activities
      )
    );

    assert.ok(
      Object.isFrozen(
        result.explanation
      )
    );

  }
);
