'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  canResolveGeneralMunicipalScope,
  buildGeneralMunicipalScopeMembers,
  scopeMemberId
} =
  require(
    './event-general-scope.cjs'
  )._test;


// ======================================================
// CONTEXTO
// ======================================================

const profile = {
  uid:
    'COORD-001',

  active:
    true,

  role:
    'coordinador_municipal',

  campaignId:
    'CAM-001',

  municipalityId:
    'MUN-001'
};


const event = {
  id:
    'EVENT-001',

  active:
    true,

  campaignId:
    'CAM-001',

  createdBy:
    'COORD-001',

  operationalOwnerId:
    'COORD-001',

  scopeMode:
    'organizational',

  scopeType:
    'municipality',

  scopeMunicipalityId:
    'MUN-001'
};


const scope = {
  id:
    'EVENT-001',

  active:
    true,

  campaignId:
    'CAM-001',

  scopeMode:
    'organizational',

  scopeType:
    'municipality',

  municipalityId:
    'MUN-001'
};


// ======================================================
// AUTORIZACION
// ======================================================

assert.equal(
  canResolveGeneralMunicipalScope({
    profile,
    event,
    scope
  }),
  true
);


assert.equal(
  canResolveGeneralMunicipalScope({
    profile: {
      ...profile,
      role:
        'admin'
    },
    event,
    scope
  }),
  false
);


assert.equal(
  canResolveGeneralMunicipalScope({
    profile: {
      ...profile,
      role:
        'lider_principal'
    },
    event,
    scope
  }),
  false
);


assert.equal(
  canResolveGeneralMunicipalScope({
    profile: {
      ...profile,
      municipalityId:
        'MUN-002'
    },
    event,
    scope
  }),
  false
);


// ======================================================
// PERSONAS DIGITALES + ACCOUNTLESS
// ======================================================

const memberships = [
  {
    id:
      'MEM-001',

    membershipId:
      'MEM-001',

    personId:
      'PER-001',

    accountUid:
      'UID-001',

    active:
      true,

    campaignId:
      'CAM-001',

    municipalityId:
      'MUN-001',

    municipalityName:
      'Compostela',

    structureId:
      'EST-001',

    role:
      'participante',

    parentUserId:
      'INT-001'
  },

  {
    id:
      'MEM-002',

    membershipId:
      'MEM-002',

    personId:
      'PER-002',

    accountUid:
      null,

    active:
      true,

    campaignId:
      'CAM-001',

    municipalityId:
      'MUN-001',

    municipalityName:
      'Compostela',

    structureId:
      'EST-001',

    role:
      'colaborador_base',

    parentUserId:
      'UID-001'
  },

  {
    id:
      'MEM-OTHER',

    membershipId:
      'MEM-OTHER',

    personId:
      'PER-OTHER',

    active:
      true,

    campaignId:
      'CAM-001',

    municipalityId:
      'MUN-002',

    role:
      'participante'
  }
];


const persons = [
  {
    personId:
      'PER-001',

    active:
      true,

    campaignId:
      'CAM-001',

    accountUid:
      'UID-001',

    name:
      'Persona Digital',

    locality:
      'Compostela'
  },

  {
    personId:
      'PER-002',

    active:
      true,

    campaignId:
      'CAM-001',

    accountUid:
      null,

    name:
      'Persona Sin Cuenta',

    locality:
      'Compostela'
  },

  {
    personId:
      'PER-OTHER',

    active:
      true,

    campaignId:
      'CAM-001',

    name:
      'Otro Municipio'
  }
];


const members =
  buildGeneralMunicipalScopeMembers({
    event,
    scope,
    memberships,
    persons
  });


assert.equal(
  members.length,
  2
);


const digital =
  members.find(
    member =>
      member.personId ===
      'PER-001'
  );


const accountless =
  members.find(
    member =>
      member.personId ===
      'PER-002'
  );


assert.equal(
  digital.hasDigitalAccount,
  true
);


assert.equal(
  digital.accountUid,
  'UID-001'
);


assert.equal(
  accountless.hasDigitalAccount,
  false
);


assert.equal(
  accountless.accountUid,
  null
);


assert.equal(
  accountless.role,
  'colaborador_base'
);


assert.equal(
  members.some(
    member =>
      member.personId ===
      'PER-OTHER'
  ),
  false
);


// ======================================================
// ID DETERMINISTA
// ======================================================

assert.equal(
  scopeMemberId(
    'EVENT-001',
    'PER-001'
  ),
  scopeMemberId(
    'EVENT-001',
    'PER-001'
  )
);


assert.notEqual(
  scopeMemberId(
    'EVENT-001',
    'PER-001'
  ),
  scopeMemberId(
    'EVENT-001',
    'PER-002'
  )
);


// ======================================================
// DUPLICIDAD DE MEMBRESIA ACTIVA
// ======================================================

assert.throws(
  () =>
    buildGeneralMunicipalScopeMembers({
      event,
      scope,

      memberships: [
        memberships[0],

        {
          ...memberships[0],

          id:
            'MEM-DUP',

          membershipId:
            'MEM-DUP'
        }
      ],

      persons
    }),

  /membresías territoriales activas/
);


// ======================================================
// PERSONA INACTIVA
// ======================================================

assert.throws(
  () =>
    buildGeneralMunicipalScopeMembers({
      event,
      scope,

      memberships: [
        memberships[0]
      ],

      persons: [
        {
          ...persons[0],

          active:
            false
        }
      ]
    }),

  /está inactiva/
);


console.log(
  'OK: BUILD-118D1B canonical general event scope passed.'
);
