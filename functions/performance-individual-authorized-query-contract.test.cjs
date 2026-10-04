"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");


/*
============================================================
BUILD-132
CONTRATO DE CONSULTA AUTORIZADA

Este archivo define el contrato esperado.
NO modifica Firestore.
NO modifica reglas productivas.
NO activa scoring.

Escenarios:

1. La persona consulta su propio desempeño.
2. Un responsable consulta a un subordinado autorizado.
3. Una persona fuera del alcance jerárquico es rechazada.
============================================================
*/


function buildAuthorizationContext(
  overrides = {}
) {
  return {
    requesterPersonId:
      "PERSON-001",

    targetPersonId:
      "PERSON-001",

    requesterRole:
      "integrante",

    targetRole:
      "integrante",

    sameCampaign:
      true,

    directRelationship:
      false,

    authorizedDescendant:
      false,

    ...overrides,
  };
}


/*
============================================================
CONTRATO ESPERADO

La función todavía no existe en producción.

Por BUILD-132 primero definimos el comportamiento
mediante una función local de referencia.

Posteriormente esta lógica será trasladada al adaptador real.
============================================================
*/


function authorizeIndividualPerformanceQuery(
  context
) {

  if (
    !context ||
    typeof context !== "object"
  ) {
    throw new Error(
      "INVALID_AUTHORIZATION_CONTEXT"
    );
  }


  if (
    context.sameCampaign !== true
  ) {
    throw new Error(
      "CAMPAIGN_ACCESS_DENIED"
    );
  }


  if (
    context.requesterPersonId ===
    context.targetPersonId
  ) {
    return Object.freeze({
      authorized:
        true,

      reason:
        "SELF_QUERY",
    });
  }


  if (
    context.directRelationship ===
      true
  ) {
    return Object.freeze({
      authorized:
        true,

      reason:
        "DIRECT_SUBORDINATE",
    });
  }


  if (
    context.authorizedDescendant ===
      true
  ) {
    return Object.freeze({
      authorized:
        true,

      reason:
        "AUTHORIZED_DESCENDANT",
    });
  }


  throw new Error(
    "PERFORMANCE_QUERY_NOT_AUTHORIZED"
  );
}


/*
============================================================
1. PROPIA CONSULTA
============================================================
*/

test(
  "la persona puede consultar su propio desempeño",
  () => {

    const result =
      authorizeIndividualPerformanceQuery(
        buildAuthorizationContext({
          requesterPersonId:
            "PERSON-001",

          targetPersonId:
            "PERSON-001",
        })
      );

    assert.equal(
      result.authorized,
      true
    );

    assert.equal(
      result.reason,
      "SELF_QUERY"
    );
  }
);


/*
============================================================
2. SUBORDINADO DIRECTO
============================================================
*/

test(
  "un responsable puede consultar el desempeño de un subordinado directo",
  () => {

    const result =
      authorizeIndividualPerformanceQuery(
        buildAuthorizationContext({

          requesterPersonId:
            "PERSON-001",

          targetPersonId:
            "PERSON-002",

          requesterRole:
            "responsable_estructura",

          targetRole:
            "integrante",

          directRelationship:
            true,
        })
      );

    assert.equal(
      result.authorized,
      true
    );

    assert.equal(
      result.reason,
      "DIRECT_SUBORDINATE"
    );
  }
);


/*
============================================================
3. DESCENDIENTE AUTORIZADO
============================================================
*/

test(
  "una consulta de descendiente autorizado puede aprobarse",
  () => {

    const result =
      authorizeIndividualPerformanceQuery(
        buildAuthorizationContext({

          requesterPersonId:
            "PERSON-001",

          targetPersonId:
            "PERSON-003",

          requesterRole:
            "coordinador_municipal",

          targetRole:
            "participante",

          authorizedDescendant:
            true,
        })
      );

    assert.equal(
      result.authorized,
      true
    );

    assert.equal(
      result.reason,
      "AUTHORIZED_DESCENDANT"
    );
  }
);


/*
============================================================
4. PERSONA FUERA DEL ALCANCE
============================================================
*/

test(
  "una persona fuera del alcance jerárquico es rechazada",
  () => {

    assert.throws(
      () =>
        authorizeIndividualPerformanceQuery(
          buildAuthorizationContext({

            requesterPersonId:
              "PERSON-001",

            targetPersonId:
              "PERSON-099",

            directRelationship:
              false,

            authorizedDescendant:
              false,
          })
        ),

      /PERFORMANCE_QUERY_NOT_AUTHORIZED/
    );
  }
);


/*
============================================================
5. OTRA CAMPAÑA
============================================================
*/

test(
  "una persona de otra campaña es rechazada",
  () => {

    assert.throws(
      () =>
        authorizeIndividualPerformanceQuery(
          buildAuthorizationContext({

            requesterPersonId:
              "PERSON-001",

            targetPersonId:
              "PERSON-002",

            sameCampaign:
              false,

            directRelationship:
              true,
          })
        ),

      /CAMPAIGN_ACCESS_DENIED/
    );
  }
);


/*
============================================================
6. EL ACCESO NO CONCEDE MODIFICACION
============================================================
*/

test(
  "la autorización de consulta no concede permisos de modificación",
  () => {

    const result =
      authorizeIndividualPerformanceQuery(
        buildAuthorizationContext()
      );

    assert.equal(
      result.authorized,
      true
    );

    assert.equal(
      Object.hasOwn(
        result,
        "canModify"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        result,
        "canEdit"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        result,
        "canDelete"
      ),
      false
    );
  }
);


/*
============================================================
7. RESULTADO INMUTABLE
============================================================
*/

test(
  "el resultado de autorización es inmutable",
  () => {

    const result =
      authorizeIndividualPerformanceQuery(
        buildAuthorizationContext()
      );

    assert.ok(
      Object.isFrozen(result)
    );
  }
);
