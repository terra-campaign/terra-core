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



// CONTRATO PERSON-CENTRIC GET STRUCTURE MEMBERS

const fs =
  require(
    'node:fs'
  );

const path =
  require(
    'node:path'
  );

const source =
  fs.readFileSync(
    path.join(
      __dirname,
      'quick-affiliation.cjs'
    ),
    'utf8'
  );

const structureMembersStart =
  source.indexOf(
    'exports.getStructureMembers ='
  );

const structureMembersEnd =
  source.indexOf(
    'exports.getMyQuickAffiliations =',
    structureMembersStart
  );

assert.notEqual(
  structureMembersStart,
  -1,
  'Debe existir getStructureMembers.'
);

assert.notEqual(
  structureMembersEnd,
  -1,
  'Debe existir el límite posterior de getStructureMembers.'
);

const structureMembersBlock =
  source.slice(
    structureMembersStart,
    structureMembersEnd
  );


for (
  const expected of [
    'personId:',
    'membershipId:',
    'accountUid:',
    'hasDigitalAccount:'
  ]
) {

  assert.ok(
    structureMembersBlock.includes(
      expected
    ),
    `Falta contrato person-centric en getStructureMembers: ${expected}`
  );
}


assert.match(
  structureMembersBlock,
  /members\.push\(\{[\s\S]*personId:[\s\S]*membershipId:[\s\S]*accountUid:[\s\S]*hasDigitalAccount:/,
  'getStructureMembers debe devolver identidad canónica y estado de cuenta digital.'
);


console.log(
  'OK: BUILD-118C-3B3E-3B canonical structure members authorization tests passed.'
);
