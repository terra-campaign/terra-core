'use strict';

// ======================================================
// TERRA CAMPAIGN
// BUILD-123D4I-B2I
//
// ANCESTRY TERRITORIAL CANONICA
//
// OBJETIVO:
//
// Mantener en paralelo:
//
// ancestorUserIds
// ancestorPersonIds
//
// REGLA:
//
// El Administrador técnico NO forma parte de la
// jerarquía territorial.
//
// COMPATIBILIDAD:
//
// Los perfiles históricos utilizan:
//
// ancestorIds
//
// como cadena de UID.
//
// Si la cadena completa por personId todavía no existe,
// se permite únicamente el fallback del padre directo.
//
// Si las dos cadenas no quedan alineadas, se bloquea
// una nueva alta hasta completar la migración canónica.
// ======================================================

const {
  HttpsError
} =
  require(
    'firebase-functions/v2/https'
  );


function fail(
  code,
  message
) {

  throw new HttpsError(
    code,
    message
  );
}


function cleanId(
  value
) {

  return typeof value ===
    'string'
      ? value.trim()
      : '';
}


function uniqueIds(
  values
) {

  return values
    .map(
      cleanId
    )
    .filter(
      (
        value,
        index,
        list
      ) =>
        Boolean(value) &&
        list.indexOf(
          value
        ) ===
          index
    );
}


function inheritedIds(
  profile,
  arrayField,
  directField
) {

  const explicit =
    uniqueIds(
      Array.isArray(
        profile?.[
          arrayField
        ]
      )
        ? profile[
            arrayField
          ]
        : []
    );


  if (
    explicit.length
  ) {

    return explicit;
  }


  const direct =
    cleanId(
      profile?.[
        directField
      ]
    );


  return direct
    ? [
        direct
      ]
    : [];
}


function canonicalChildAncestry({
  parentUid,
  parentPersonId,
  parentProfile
}) {

  const canonicalParentUid =
    cleanId(
      parentUid
    );

  const canonicalParentPersonId =
    cleanId(
      parentPersonId
    );


  if (
    !canonicalParentUid ||
    !canonicalParentPersonId ||
    !parentProfile
  ) {

    fail(
      'failed-precondition',
      'El responsable territorial no tiene identidad canónica completa.'
    );
  }


  if (
    parentProfile.role ===
      'admin'
  ) {

    fail(
      'failed-precondition',
      'El Administrador técnico no puede ser padre territorial.'
    );
  }


  const profileUid =
    cleanId(
      parentProfile.uid
    );


  if (
    profileUid &&
    profileUid !==
      canonicalParentUid
  ) {

    fail(
      'failed-precondition',
      'La cuenta del responsable territorial es inconsistente.'
    );
  }


  const profilePersonId =
    cleanId(
      parentProfile.personId
    );


  if (
    profilePersonId &&
    profilePersonId !==
      canonicalParentPersonId
  ) {

    fail(
      'failed-precondition',
      'La persona del responsable territorial es inconsistente.'
    );
  }


  const inheritedAncestorUserIds =
    inheritedIds(
      parentProfile,
      'ancestorIds',
      'parentUserId'
    );


  const inheritedAncestorPersonIds =
    inheritedIds(
      parentProfile,
      'ancestorPersonIds',
      'parentPersonId'
    );


  const ancestorUserIds =
    uniqueIds([
      canonicalParentUid,
      ...inheritedAncestorUserIds
    ]);


  const ancestorPersonIds =
    uniqueIds([
      canonicalParentPersonId,
      ...inheritedAncestorPersonIds
    ]);


  if (
    ancestorUserIds.length !==
      ancestorPersonIds.length
  ) {

    fail(
      'failed-precondition',
      'La jerarquía superior requiere completar su ancestry canónica antes de crear subordinados.'
    );
  }


  return {

    parentUserId:
      canonicalParentUid,

    parentPersonId:
      canonicalParentPersonId,

    ancestorUserIds,

    ancestorPersonIds
  };
}


module.exports = {

  canonicalChildAncestry,

  _test: {
    cleanId,
    uniqueIds,
    inheritedIds
  }
};
