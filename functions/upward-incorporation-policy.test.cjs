'use strict';

const assert =
  require('node:assert/strict');

const {
  allowedUpwardRolesFor,
  requiredParentRoleFor,
  requiresOwnDigitalAccount,
  canCreateHierarchicalChild
} =
  require('./upward-incorporation-policy.cjs');


// ======================================================
// APOYO TERRITORIAL
// INCORPORACIÓN ASCENDENTE V1
//
// Sergio NO crea hijos propios.
// Puede originar:
// - Participante bajo un Integrante.
// - Apoyo Territorial bajo un Colaborador de Base.
// ======================================================

assert.deepEqual(
  allowedUpwardRolesFor('apoyo_territorial'),
  [
    'participante',
    'apoyo_territorial'
  ],
  'Apoyo Territorial solo puede originar Participante o Apoyo Territorial en este flujo.'
);


// ======================================================
// PADRE JERÁRQUICO VÁLIDO
// ======================================================

assert.equal(
  requiredParentRoleFor('participante'),
  'integrante',
  'El Participante incorporado debe quedar bajo un Integrante.'
);

assert.equal(
  requiredParentRoleFor('apoyo_territorial'),
  'colaborador_base',
  'El Apoyo Territorial incorporado debe quedar bajo un Colaborador de Base.'
);


// ======================================================
// CUENTA DIGITAL OBLIGATORIA
// ======================================================

assert.equal(
  requiresOwnDigitalAccount({
    introducerRole: 'apoyo_territorial',
    targetRole: 'participante'
  }),
  true
);

assert.equal(
  requiresOwnDigitalAccount({
    introducerRole: 'apoyo_territorial',
    targetRole: 'apoyo_territorial'
  }),
  true
);


// ======================================================
// SERGIO SIGUE SIENDO TERMINAL
// ======================================================

assert.equal(
  canCreateHierarchicalChild('apoyo_territorial'),
  false,
  'Apoyo Territorial no crea hijos jerárquicos propios.'
);


// ======================================================
// NO PUEDE COLOCAR HIJO AL JEFE DE ESTRUCTURA
// NI CREAR OTROS NIVELES DESDE ESTE FLUJO
// ======================================================

for (const forbiddenRole of [
  'integrante',
  'colaborador_base',
  'jefe_estructura',
  'coordinador_municipal',
  'lider_principal'
]) {
  assert.equal(
    allowedUpwardRolesFor('apoyo_territorial')
      .includes(forbiddenRole),
    false,
    `Rol no permitido desde Apoyo Territorial: ${forbiddenRole}`
  );
}

console.log(
  'OK: política corregida: Apoyo incorpora bajo Integrante o Colaborador de Base.'
);