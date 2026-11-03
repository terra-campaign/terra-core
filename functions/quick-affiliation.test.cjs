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
    'colaborador_base'
  ),
  'apoyo_territorial'
);


assert.equal(
  test.nextAffiliationRole(
    'apoyo_territorial'
  ),
  null
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


assert.equal(
  test.roleLabel(
    'apoyo_territorial'
  ),
  'Apoyo territorial'
);



// BUILD-127: el Administrador requiere autorización explícita
// incluso si profile.campaignId coincide con la estructura.
const structureA = {
  id: 'S-A',
  campaignId: 'CAM-A'
};
const structureB = {
  id: 'S-B',
  campaignId: 'CAM-B'
};
const admin = {
  uid: 'admin-1',
  active: true,
  role: 'admin',
  campaignId: 'CAM-A'
};
const grantA = {
  adminUid: 'admin-1',
  campaignId: 'CAM-A',
  active: true
};
const grantB = {
  adminUid: 'admin-1',
  campaignId: 'CAM-B',
  active: true
};

assert.equal(
  test.canViewStructureMembers(admin, structureA),
  false,
  'Admin sin grant no debe ver su campaña heredada'
);
assert.equal(
  test.canViewStructureMembers(admin, structureA, grantA),
  true,
  'Admin con grant activo puede consultar su campaña'
);
assert.equal(
  test.canViewStructureMembers(admin, structureB, grantB),
  true,
  'Admin multicampaña puede consultar otra campaña autorizada'
);
assert.equal(
  test.canViewStructureMembers(
    {...admin, campaignId: undefined}, structureB, grantB
  ),
  true,
  'Admin no necesita campaignId heredado'
);
assert.equal(
  test.canViewStructureMembers(admin, structureB, grantA),
  false,
  'Grant para otra campaña no concede acceso'
);
assert.equal(
  test.canViewStructureMembers(
    admin, structureA, {...grantA, active: false}
  ),
  false,
  'Grant desactivado deniega acceso'
);
assert.equal(
  test.canViewStructureMembers(
    admin, structureA, {...grantA, adminUid: 'otro'}
  ),
  false,
  'Grant de otra cuenta deniega acceso'
);
assert.equal(
  test.canViewStructureMembers(
    {...admin, active: false}, structureA, grantA
  ),
  false,
  'Perfil administrativo desactivado deniega acceso'
);
const jefe = {
  active: true,
  role: 'jefe_estructura',
  campaignId: 'CAM-A',
  structureId: 'S-A'
};
assert.equal(test.canViewStructureMembers(jefe, structureA), true);
assert.equal(test.canViewStructureMembers(jefe, structureB), false);
assert.equal(
  test.canViewStructureMembers(
    {...jefe, role:'integrante'}, structureA
  ),
  false,
  'Un integrante no puede listar miembros de estructura'
);

console.log(
  'OK: BUILD-118C-3B3E-3A quick affiliation tests passed.'
);
