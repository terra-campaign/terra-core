'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const test =
  require(
    './quick-affiliation.cjs'
  )._test;


assert.equal(
  test.nextAffiliationRole(
    'jefe_estructura'
  ),
  'integrante'
);


assert.equal(
  test.nextAffiliationRole(
    'integrante'
  ),
  'participante'
);


assert.equal(
  test.nextAffiliationRole(
    'participante'
  ),
  'colaborador_base'
);


assert.equal(
  test.nextAffiliationRole(
    'coordinador_municipal'
  ),
  null
);


assert.equal(
  test.normalizePhone(
    '+52 322 100 6736'
  ),
  '3221006736'
);


assert.equal(
  test.roleLabel(
    'colaborador_base'
  ),
  'Colaborador de base'
);


console.log(
  'OK: BUILD-118C-3B3E-3A quick affiliation tests passed.'
);
