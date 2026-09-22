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
      'index.js'
    ),
    'utf8'
  );

function callableBlock(
  name
) {

  const marker =
    `exports.${name} = onCall(`;

  const start =
    source.indexOf(
      marker
    );

  assert.notEqual(
    start,
    -1,
    `${name} debe existir.`
  );

  let end =
    source.indexOf(
      '\nexports.',
      start + marker.length
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
  'createMunicipalCoordinator creates canonical child of principal leader',
  () => {

    const block =
      callableBlock(
        'createMunicipalCoordinator'
      );

    assert.match(
      source,
      /person-identity\.cjs/,
      'index.js debe importar el resolver de identidad canónica.'
    );

    assert.match(
      block,
      /resolveCanonicalPersonForAccount/,
      'Debe resolver la persona canónica del Líder Principal.'
    );

    assert.match(
      block,
      /accountUid:\s*principalLeaderUid/,
      'La identidad del padre debe resolverse por UID del Líder Principal.'
    );

    assert.match(
      block,
      /const\s+principalLeaderPersonId\s*=\s*principalLeaderIdentity\.personId/,
      'Debe conservar personId del Líder Principal.'
    );

    assert.match(
      block,
      /collection\(\s*["']persons["']\s*\)/,
      'Debe crear persons/{personId} para el Coordinador.'
    );

    assert.match(
      block,
      /canonicalMembershipDocumentId\(\s*campaignId,\s*personId\s*\)/,
      'Debe generar membershipId canónico.'
    );

    assert.match(
      block,
      /collection\(\s*["']territorialMemberships["']\s*\)/,
      'Debe crear la membresía territorial del Coordinador.'
    );

    assert.match(
      block,
      /parentUserId:\s*principalLeaderUid/,
      'El padre UID debe ser el Líder Principal.'
    );

    const parentPersonMatches =
      block.match(
        /parentPersonId:\s*principalLeaderPersonId/g
      ) || [];

    assert.ok(
      parentPersonMatches.length >= 2,
      'Perfil y membresía deben conservar parentPersonId del Líder.'
    );

    assert.match(
      block,
      /introducedByUserId:\s*principalLeaderUid/,
      'La incorporación territorial debe atribuirse al Líder Principal.'
    );

    assert.match(
      block,
      /introducedByPersonId:\s*principalLeaderPersonId/,
      'La incorporación territorial debe conservar personId del Líder.'
    );

    assert.match(
      block,
      /userProfile\.personId\s*=\s*personId/,
      'El perfil debe enlazarse a personId.'
    );

    assert.match(
      block,
      /userProfile\.membershipId\s*=\s*membershipId/,
      'El perfil debe enlazarse a membershipId.'
    );

    assert.match(
      block,
      /db\.batch\(\)/,
      'Las escrituras Firestore deben prepararse en batch.'
    );

    assert.match(
      block,
      /batch\.create\(\s*personRef/,
      'La persona debe escribirse en el batch.'
    );

    assert.match(
      block,
      /batch\.create\(\s*membershipRef/,
      'La membresía debe escribirse en el batch.'
    );

    assert.match(
      block,
      /await\s+batch\.commit\(\)/,
      'El alta canónica debe confirmar el batch atómico.'
    );

    assert.doesNotMatch(
      block,
      /await\s+db\s*\.\s*collection\(\s*["']usuarios["']\s*\)[\s\S]{0,180}\.set\(\s*userProfile\s*\)/,
      'El perfil no debe escribirse por separado fuera del batch.'
    );

    assert.doesNotMatch(
      block,
      /\.collection\(\s*["']logs["']\s*\)\s*\.add\(/,
      'El log tampoco debe escribirse fuera del batch.'
    );
  }
);
