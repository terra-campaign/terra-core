'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  canCreateGeneralMunicipalEvent,
  buildGeneralMunicipalEvent
} =
  require(
    './event-general.cjs'
  )._test;


// ======================================================
// RESPONSABLE DE ORGANIZACION
// ======================================================

const coordinator = {
  uid:
    'COORD-001',

  name:
    'Cristian',

  active:
    true,

  role:
    'coordinador_municipal',

  campaignId:
    'CAM-001',

  municipalityId:
    'MUN-001',

  municipalityName:
    'Compostela'
};


assert.equal(
  canCreateGeneralMunicipalEvent(
    coordinator
  ),
  true
);


// ======================================================
// ADMIN TECNICO NO OPERA
// ======================================================

assert.equal(
  canCreateGeneralMunicipalEvent({
    ...coordinator,
    role:
      'admin'
  }),
  false
);


// ======================================================
// LIDER PRINCIPAL SUPERVISA, NO OPERA ESTE CALLABLE
// ======================================================

assert.equal(
  canCreateGeneralMunicipalEvent({
    ...coordinator,
    role:
      'lider_principal'
  }),
  false
);


// ======================================================
// OTROS NIVELES NO CREAN EVENTO GENERAL MUNICIPAL
// ======================================================

for (
  const role of [
    'jefe_estructura',
    'integrante',
    'participante',
    'colaborador_base'
  ]
) {

  assert.equal(
    canCreateGeneralMunicipalEvent({
      ...coordinator,
      role
    }),
    false
  );
}


// ======================================================
// MUNICIPIO OBLIGATORIO
// ======================================================

assert.equal(
  canCreateGeneralMunicipalEvent({
    ...coordinator,
    municipalityId:
      ''
  }),
  false
);


// ======================================================
// CONTRATO DEL EVENTO
// ======================================================

const event =
  buildGeneralMunicipalEvent({
    profile:
      coordinator,

    eventId:
      'EVENT-001',

    title:
      'Evento general',

    description:
      'Prueba',

    venue:
      'Plaza',

    locality:
      'Compostela',

    startsAt:
      '2027-01-01T18:00:00.000Z',

    confirmationLeadMinutes:
      60
  });


assert.equal(
  event.scopeMode,
  'organizational'
);

assert.equal(
  event.scopeType,
  'municipality'
);

assert.equal(
  event.scopeMunicipalityId,
  'MUN-001'
);

assert.equal(
  event.operationalOwnerId,
  'COORD-001'
);

assert.equal(
  event.createdBy,
  'COORD-001'
);

assert.equal(
  event.createdByRole,
  'coordinador_municipal'
);

assert.deepEqual(
  event.transportManagerIds,
  [
    'COORD-001'
  ]
);

assert.equal(
  Object.prototype
    .hasOwnProperty.call(
      event,
      'assigneeIds'
    ),
  false
);


console.log(
  'OK: BUILD-118D1A general municipal event contract passed.'
);
