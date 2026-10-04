"use strict";

const {
  listActivityDefinitions,
} =
  require(
    "./activity-catalog-v1.cjs"
  );


const DIMENSION_LABELS =
  Object.freeze({

    TERRITORIAL_ACTIVITY:
      "Actividad territorial",

    ATTENDANCE:
      "Asistencia",

    ORGANIZATION:
      "Organización",

    LOGISTICS:
      "Logística",

    DIGITAL_ACTIVITY:
      "Actividad digital",

  });


const SOURCE_LABELS =
  Object.freeze({

    MISSION_VALIDATION:
      "Misión validada",

    ATTENDANCE_RECORD:
      "Registro de asistencia",

    GROWTH_VALIDATION:
      "Validación de crecimiento",

  });


const VALIDATION_LABELS =
  Object.freeze({

    HUMAN_MISSION_REVIEW:
      "Revisión de misión",

    INTERNAL_ATTENDANCE:
      "Registro interno de asistencia",

    GROWTH_VALIDATION:
      "Validación de crecimiento",

  });


const ACTIVITY_LABELS =
  Object.freeze({

    TERRITORIAL_BRIGADE:
      "Brigada territorial",

    EVENT_GENERAL_ATTENDANCE:
      "Asistencia a evento",

    LOCAL_MEETING_ATTENDANCE:
      "Asistencia a reunión local",

    OPERATIONAL_ACCOMPANIMENT:
      "Acompañamiento operativo",

    ORGANIZATIONAL_GROWTH:
      "Crecimiento organizacional",

    WALL_PAINTING:
      "Pintura de bardas",

    EVENT_SUPPORT_LOGISTICS:
      "Apoyo logístico de evento",

    MATERIAL_DISTRIBUTION:
      "Distribución de material",

    DIGITAL_ACTIVITY:
      "Actividad digital",

  });


function requireLabel(
  map,
  key,
  label
) {

  const value =
    map[key];

  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {

    throw new Error(
      "MISSING_PUBLIC_" +
      label +
      ":" +
      key
    );

  }

  return value;

}


function toPublicActivityDefinition(
  definition
) {

  if (
    !definition ||
    typeof definition !==
      "object"
  ) {

    throw new Error(
      "INVALID_ACTIVITY_DEFINITION"
    );

  }


  const code =
    definition.code;


  const activityName =
    requireLabel(
      ACTIVITY_LABELS,
      code,
      "ACTIVITY_LABEL"
    );


  const dimension =
    requireLabel(
      DIMENSION_LABELS,
      definition.scoreDimension,
      "DIMENSION_LABEL"
    );


  const source =
    requireLabel(
      SOURCE_LABELS,
      definition.sourceType,
      "SOURCE_LABEL"
    );


  const validation =
    requireLabel(
      VALIDATION_LABELS,
      definition.validationMode,
      "VALIDATION_LABEL"
    );


  if (
    !Number.isInteger(
      definition.basePoints
    ) ||
    definition.basePoints <= 0
  ) {

    throw new Error(
      "INVALID_PUBLIC_ACTIVITY_POINTS:" +
      code
    );

  }


  return Object.freeze({
    name:
      activityName,

    points:
      definition.basePoints,

    pointMode:
      definition.pointMode,

    dimension,

    dimensionCode:
      definition.scoreDimension,

    source,

    validation,

    catalogVersion:
      definition.catalogVersion,

  });

}


function listPublicScoringRules() {

  return Object.freeze(
    listActivityDefinitions().map(
      toPublicActivityDefinition
    )
  );

}


function getPublicScoringExplanation() {

  const rules =
    listPublicScoringRules();


  return Object.freeze({

    title:
      "Cómo se obtiene tu puntaje",

    description:
      "Tu puntaje se construye a partir de actividades registradas y validadas. Cada actividad tiene un valor establecido y pertenece a una dimensión de desempeño.",

    dimensions: Object.freeze(
      [
        "Actividad territorial",
        "Asistencia",
        "Organización",
        "Logística",
        "Actividad digital",
      ]
    ),

    rules,

    scoringStatus:
      "DEFINED_NOT_ACTIVATED",

  });

}


module.exports = {

  listPublicScoringRules,

  getPublicScoringExplanation,

};
