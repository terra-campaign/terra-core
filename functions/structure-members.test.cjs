'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const test =
  require(
    './quick-affiliation.cjs'
  )._test;


const structure = {
  id:
    'EST-001',

  campaignId:
    'CAM-001'
};


assert.equal(
  test.canViewStructureMembers(
    {
      active:
        true,

      campaignId:
        'CAM-001',

      role:
        'admin'
    },
    structure
  ),
  true
);


assert.equal(
  test.canViewStructureMembers(
    {
      active:
        true,

      campaignId:
        'CAM-001',

      role:
        'jefe_estructura',

      structureId:
        'EST-001'
    },
    structure
  ),
  true
);


assert.equal(
  test.canViewStructureMembers(
    {
      active:
        true,

      campaignId:
        'CAM-001',

      role:
        'jefe_estructura',

      structureId:
        'EST-999'
    },
    structure
  ),
  false
);


assert.equal(
  test.canViewStructureMembers(
    {
      active:
        true,

      campaignId:
        'CAM-001',

      municipalityId:
        'MUN-001',

      role:
        'coordinador_municipal'
    },
    structure
  ),
  false
);


assert.equal(
  test.canViewStructureMembers(
    {
      active:
        true,

      campaignId:
        'CAM-999',

      role:
        'admin'
    },
    structure
  ),
  false
);


console.log(
  'OK: BUILD-118C-3B3E-3B canonical structure members authorization tests passed.'
);
