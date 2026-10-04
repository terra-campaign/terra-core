"use strict";

const {
  buildPerformanceSummaryProjection,
} =
  require(
    "./performance-summary.cjs"
  );

const {
  listPublicScoringRules,
} =
  require(
    "./activity-scoring-public-adapter.cjs"
  );

const {
  listActivityDefinitions,
} =
  require(
    "./activity-catalog-v1.cjs"
  );


const DIMENSION_ORDER =
  Object.freeze([
    "Actividad territorial",
    "Asistencia",
    "Organización",
    "Logística",
    "Actividad digital",
  ]);


function requireToken(
  value,
  label
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      "INVALID_" + label
    );
  }

  return value.trim();
}


function buildRuleMap() {
  return new Map(
    listPublicScoringRules().map(
      rule => [
        rule.name,
        rule,
      ]
    )
  );
}


function findPublicRule(
  activityCode,
  ledgerEntry
) {
  const rules =
    listPublicScoringRules();

  const dimension =
    ledgerEntry.scoreDimension;

  const candidates =
    rules.filter(
      rule =>
        rule.dimension ===
        dimension
    );

  if (
    activityCode &&
    typeof activityCode ===
      "string"
  ) {
    const byName =
      candidates.find(
        rule =>
          rule.name ===
          activityCode
      );

    if (byName) {
      return byName;
    }
  }

  return (
    candidates.length === 1
      ? candidates[0]
      : null
  );
}


function buildIndividualPerformanceView({
  campaignId,
  personId,
  ledgerEntries,
  operationalPeriod,
  membership,
}) {
  const campaign =
    requireToken(
      campaignId,
      "CAMPAIGN_ID"
    );

  const person =
    requireToken(
      personId,
      "PERSON_ID"
    );

  if (
    !Array.isArray(
      ledgerEntries
    )
  ) {
    throw new Error(
      "INVALID_LEDGER_ENTRIES"
    );
  }

  const projection =
    buildPerformanceSummaryProjection({
      campaignId:
        campaign,

      personId:
        person,

      ledgerEntries,

      operationalPeriod,

      membership,
    });

  const historical =
    projection
      .contribution
      .historical;

  const dimensions =
    Object.freeze(
      DIMENSION_ORDER.map(
        name => {

          const rule =
            listPublicScoringRules()
              .find(
                candidate =>
                  candidate.dimension ===
                  name
              );

          const points =
            rule
              ? (
                  historical
                    .byDimension[
                      rule.dimensionCode
                    ] || 0
                )
              : 0;

          return Object.freeze({
            name,
            points,
          });
        }
      )
    );

  const activities =
    Object.freeze(
      ledgerEntries
        .filter(
          entry =>
            entry &&
            typeof entry ===
              "object" &&
            entry.ledgerStatus ===
              "POSTED" &&
            entry.runtimeScoringEnabled ===
              true &&
            entry.campaignId ===
              campaign &&
            entry.personId ===
              person
        )
        .map(
          entry => {
            const canonicalDefinition =
              listActivityDefinitions()
                .find(
                  definition =>
                    definition.code ===
                    entry.activityCode
                );

            const rule =
              canonicalDefinition
                ? listPublicScoringRules()
                    .find(
                      candidate =>
                        candidate.dimensionCode ===
                          canonicalDefinition.scoreDimension &&
                        candidate.points ===
                          canonicalDefinition.basePoints
                    )
                : (
                    listPublicScoringRules()
                      .find(
                        candidate =>
                          candidate.dimensionCode ===
                          entry.scoreDimension
                      )
                  );

            return Object.freeze({
              activity:
                rule
                  ? rule.name
                  : "Actividad registrada",

              points:
                entry.points,

              dimension:
                rule
                  ? rule.dimension
                  : entry.scoreDimension,

              occurredAt:
                entry.occurredAt,
            });
          }
        )
    );

  return Object.freeze({
    title:
      "Mi desempeño",

    campaignId:
      campaign,

    personId:
      person,

    totalPoints:
      historical.points,

    dimensions,

    activities,

    explanation:
      Object.freeze({
        title:
          "Cómo obtuve estos puntos",

        description:
          "Los puntos corresponden a actividades registradas y validadas que forman parte del desempeño operativo.",

        rules:
          listPublicScoringRules(),

        scoringStatus:
          "DEFINED_NOT_ACTIVATED",
      }),

    contributionCount:
      historical
        .contributionCount,

    generalPerformanceIndex:
      projection
        .generalPerformanceIndex,

    runtimeScoringActivated:
      projection
        .runtimeScoringActivated,
  });
}


module.exports = {
  DIMENSION_ORDER,
  buildIndividualPerformanceView,
};
