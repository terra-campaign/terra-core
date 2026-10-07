'use strict';


// ======================================================
// TERRA CAMPAIGN V1
// INCORPORACIÓN ORIGINADA POR APOYO TERRITORIAL
//
// El Apoyo Territorial es terminal.
// NO es padre de las personas que incorpora.
//
// Puede originar:
//
// Integrante
//    -> Participante
//
// Colaborador de Base
//    -> Apoyo Territorial
//
// introducedByPersonId = Apoyo incorporador
// parentPersonId       = padre jerárquico seleccionado
// ======================================================


const UPWARD_ROLES_BY_INTRODUCER = {
  apoyo_territorial: [
    'participante',
    'apoyo_territorial'
  ]
};


const REQUIRED_PARENT_ROLE_BY_TARGET = {
  participante:
    'integrante',

  apoyo_territorial:
    'colaborador_base'
};


function allowedUpwardRolesFor(
  introducerRole
) {

  const roles =
    UPWARD_ROLES_BY_INTRODUCER[
      introducerRole
    ];

  return Array.isArray(roles)
    ? [...roles]
    : [];
}


function requiredParentRoleFor(
  targetRole
) {

  return (
    REQUIRED_PARENT_ROLE_BY_TARGET[
      targetRole
    ] ||
    null
  );
}


function requiresOwnDigitalAccount({
  introducerRole,
  targetRole
} = {}) {

  return (
    introducerRole ===
      'apoyo_territorial' &&
    allowedUpwardRolesFor(
      introducerRole
    ).includes(
      targetRole
    )
  );
}


function canCreateHierarchicalChild(
  role
) {

  return role !==
    'apoyo_territorial';
}


module.exports = {
  allowedUpwardRolesFor,
  requiredParentRoleFor,
  requiresOwnDigitalAccount,
  canCreateHierarchicalChild
};