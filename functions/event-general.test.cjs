'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  canCreateGeneralMunicipalEvent,
  canManageEventArchive,
  buildGeneralMunicipalEvent,
  eventRecordMode
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

    endsAt:
      '2027-01-01T20:00:00.000Z',

    confirmationLeadMinutes:
      60
  });


assert.equal(
  event.endsAt,
  '2027-01-01T20:00:00.000Z'
);

assert.equal(
  event.endsAtMillis,
  Date.parse(
    '2027-01-01T20:00:00.000Z'
  )
);

assert.ok(
  event.endsAtMillis >
    event.startsAtMillis
);


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


// ======================================================
// BUILD-118D1F2
// ARCHIVADO / RESTAURACION
// ======================================================

assert.equal(
  event.archived,
  false
);

assert.equal(
  event.archivedAt,
  null
);

assert.equal(
  event.archivedBy,
  ''
);

assert.equal(
  event.archivedByName,
  ''
);


assert.equal(
  canManageEventArchive(
    coordinator,
    event
  ),
  true
);


assert.equal(
  canManageEventArchive(
    {
      ...coordinator,
      municipalityId:
        'MUN-002'
    },
    event
  ),
  false
);


assert.equal(
  canManageEventArchive(
    {
      ...coordinator,
      campaignId:
        'CAM-002'
    },
    event
  ),
  false
);


assert.equal(
  canManageEventArchive(
    {
      ...coordinator,
      uid:
        'COORD-002'
    },
    event
  ),
  false
);


assert.equal(
  canManageEventArchive(
    {
      ...coordinator,
      role:
        'admin'
    },
    event
  ),
  false
);


assert.equal(
  canManageEventArchive(
    {
      ...coordinator,
      role:
        'lider_principal'
    },
    event
  ),
  false
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


// ======================================================
// COMPATIBILIDAD TEMPORAL CON FRONTEND D1E
// ======================================================

const legacyEvent =
  buildGeneralMunicipalEvent({
    profile:
      coordinator,

    eventId:
      'EVENT-LEGACY-001',

    title:
      'Evento compatible D1E',

    description:
      'Sin hora de término',

    venue:
      'Plaza',

    locality:
      'Compostela',

    startsAt:
      '2027-01-02T18:00:00.000Z',

    confirmationLeadMinutes:
      60
  });


assert.equal(
  legacyEvent.endsAt,
  ''
);

assert.equal(
  legacyEvent.endsAtMillis,
  null
);


// ======================================================
// BUILD-118D1F1 recordMode
// ======================================================

assert.equal(
  legacyEvent.recordMode,
  'production'
);


const testEvent =
  buildGeneralMunicipalEvent({
    profile:
      coordinator,

    eventId:
      'EVENT-TEST-001',

    title:
      'Evento de prueba',

    description:
      'Validación recordMode',

    venue:
      'Plaza',

    locality:
      'Compostela',

    startsAt:
      '2027-01-03T18:00:00.000Z',

    endsAt:
      '2027-01-03T20:00:00.000Z',

    recordMode:
      'test',

    confirmationLeadMinutes:
      60
  });


assert.equal(
  testEvent.recordMode,
  'test'
);


assert.equal(
  eventRecordMode(),
  'production'
);


assert.equal(
  eventRecordMode(
    'test'
  ),
  'test'
);


assert.throws(
  () =>
    eventRecordMode(
      'development'
    ),
  /modo del evento no es válido/i
);


console.log(
  'OK: BUILD-118D1F1 event record mode contract passed.'
);

console.log(
  'OK: BUILD-118D1F2 event archive authorization contract passed.'
);
