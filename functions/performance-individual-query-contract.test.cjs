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
   1. IDENTIDAD DE LA CONSULTA
   ============================================================ */

test(
  "la consulta individual identifica campaña y persona",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.campaignId,
      "CAM-004"
    );

    assert.equal(
      result.personId,
      "PERSON-001"
    );

  }
);


/* ============================================================
   2. TOTAL
   ============================================================ */

test(
  "la consulta individual expone el total acumulado",
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


/* ============================================================
   3. DIMENSIONES
   ============================================================ */

test(
  "la consulta individual expone exactamente cinco dimensiones",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.dimensions.length,
      5
    );

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
   4. ACTIVIDAD
   ============================================================ */

test(
  "la consulta individual expone el historial visible de actividad",
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
   5. EXPLICACION
   ============================================================ */

test(
  "la consulta individual incluye explicación pública",
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
      typeof
        result.explanation.description,
      "string"
    );

    assert.equal(
      result.explanation.rules.length,
      9
    );

  }
);


/* ============================================================
   6. ESTADO DEL SCORING
   ============================================================ */

test(
  "la consulta individual no activa el scoring runtime",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.runtimeScoringActivated,
      false
    );

    assert.equal(
      result.explanation.scoringStatus,
      "DEFINED_NOT_ACTIVATED"
    );

  }
);


/* ============================================================
   7. NO CALIFICACION GENERAL ARTIFICIAL
   ============================================================ */

test(
  "la consulta no expone una calificación general inventada",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

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
   8. REVERSAL
   ============================================================ */

test(
  "una contribución revertida queda fuera de la consulta",
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
      result.contributionCount,
      0
    );

    assert.equal(
      result.activities.length,
      0
    );

  }
);


/* ============================================================
   9. INMUTABILIDAD
   ============================================================ */

test(
  "la consulta individual permanece inmutable",
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


/* ============================================================
   10. CONTRATO MINIMO DE CONSUMO
   ============================================================ */

test(
  "la consulta contiene todo lo necesario para una vista Mi desempeño",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.ok(
      typeof result.title ===
        "string"
    );

    assert.ok(
      typeof result.totalPoints ===
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

    assert.ok(
      typeof
        result.contributionCount ===
        "number"
    );

  }
);
