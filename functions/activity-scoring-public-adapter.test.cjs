"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  listPublicScoringRules,
  getPublicScoringExplanation,
} =
  require(
    "./activity-scoring-public-adapter.cjs"
  );


test(
  "public adapter exposes all official scoring rules",
  () => {

    const rules =
      listPublicScoringRules();

    assert.equal(
      rules.length,
      9
    );

  }
);


test(
  "public adapter exposes user-readable explanation fields",
  () => {

    const rules =
      listPublicScoringRules();

    for (
      const rule of rules
    ) {

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

    }

  }
);


test(
  "public adapter preserves official point values",
  () => {

    const rules =
      listPublicScoringRules();

    const points =
      Object.fromEntries(
        rules.map(
          rule => [
            rule.name,
            rule.points
          ]
        )
      );

    assert.equal(
      points[
        "Brigada territorial"
      ],
      30
    );

    assert.equal(
      points[
        "Asistencia a evento"
      ],
      30
    );

    assert.equal(
      points[
        "Asistencia a reunión local"
      ],
      22
    );

    assert.equal(
      points[
        "Acompañamiento operativo"
      ],
      20
    );

    assert.equal(
      points[
        "Crecimiento organizacional"
      ],
      18
    );

    assert.equal(
      points[
        "Pintura de bardas"
      ],
      16
    );

    assert.equal(
      points[
        "Apoyo logístico de evento"
      ],
      14
    );

    assert.equal(
      points[
        "Distribución de material"
      ],
      12
    );

    assert.equal(
      points[
        "Actividad digital"
      ],
      6
    );

  }
);


test(
  "public adapter exposes the five user-facing dimensions",
  () => {

    const rules =
      listPublicScoringRules();

    const dimensions =
      new Set(
        rules.map(
          rule =>
            rule.dimension
        )
      );

    assert.deepEqual(
      [
        ...dimensions
      ].sort(),

      [
        "Actividad digital",
        "Actividad territorial",
        "Asistencia",
        "Logística",
        "Organización",
      ].sort()
    );

  }
);


test(
  "public explanation contains the scoring logic",
  () => {

    const explanation =
      getPublicScoringExplanation();

    assert.equal(
      explanation.title,
      "Cómo se obtiene tu puntaje"
    );

    assert.ok(
      explanation.description.includes(
        "actividades"
      )
    );

    assert.equal(
      explanation.rules.length,
      9
    );

    assert.equal(
      explanation.dimensions.length,
      5
    );

  }
);


test(
  "public adapter does not expose internal identifiers",
  () => {

    const rules =
      listPublicScoringRules();

    for (
      const rule of rules
    ) {

      assert.equal(
        Object.hasOwn(
          rule,
          "code"
        ),
        false
      );

      assert.equal(
        Object.hasOwn(
          rule,
          "sourceType"
        ),
        false
      );

      assert.equal(
        Object.hasOwn(
          rule,
          "validationMode"
        ),
        false
      );

    }

  }
);


test(
  "public adapter remains definition-only",
  () => {

    const explanation =
      getPublicScoringExplanation();

    assert.equal(
      explanation.scoringStatus,
      "DEFINED_NOT_ACTIVATED"
    );

  }
);
