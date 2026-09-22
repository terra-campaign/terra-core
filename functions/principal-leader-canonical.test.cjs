'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const source =
  fs.readFileSync(
    path.join(
      __dirname,
      'leader-panel.cjs'
    ),
    'utf8'
  );

function assignmentBlock() {

  const start =
    source.indexOf(
      'exports.assignPrincipalLeader=onCall'
    );

  assert.notEqual(
    start,
    -1,
    'Debe existir assignPrincipalLeader.'
  );

  let end =
    source.indexOf(
      'function panelCampaignId',
      start
    );

  if (end < 0) {
    end =
      source.length;
  }

  return source.slice(
    start,
    end
  );
}

test(
  'assignPrincipalLeader creates canonical root identity and membership',
  () => {

    const block =
      assignmentBlock();

    assert.match(
      source,
      /territorial-membership-id\.cjs/,
      'leader-panel debe importar canonicalMembershipDocumentId.'
    );

    assert.match(
      block,
      /collection\(\s*['"]persons['"]\s*\)/,
      'Debe crear persons/{personId}.'
    );

    assert.match(
      block,
      /collection\(\s*['"]territorialMemberships['"]\s*\)/,
      'Debe crear territorialMemberships/{membershipId}.'
    );

    assert.match(
      block,
      /canonicalMembershipDocumentId\(\s*campaignId,\s*personId\s*\)/,
      'La membresía debe usar el ID canónico campaignId + personId.'
    );

    assert.match(
      block,
      /personId/,
      'El perfil del Líder debe enlazarse a personId.'
    );

    assert.match(
      block,
      /membershipId/,
      'El perfil del Líder debe enlazarse a membershipId.'
    );

    assert.match(
      block,
      /role:\s*['"]lider_principal['"]/,
      'La membresía raíz debe conservar el rol lider_principal.'
    );

    assert.match(
      block,
      /tx\.create\(\s*personRef/,
      'La persona debe crearse dentro de la transacción.'
    );

    assert.match(
      block,
      /tx\.create\(\s*membershipRef/,
      'La membresía debe crearse dentro de la transacción.'
    );

    assert.doesNotMatch(
      block,
      /parentUserId\s*:/,
      'El Líder Principal es raíz territorial y no debe tener parentUserId.'
    );

    assert.doesNotMatch(
      block,
      /parentPersonId\s*:/,
      'El Líder Principal es raíz territorial y no debe tener parentPersonId.'
    );
  }
);
