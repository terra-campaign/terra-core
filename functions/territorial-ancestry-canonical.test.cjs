'use strict';

const test =
  require(
    'node:test'
  );

const assert =
  require(
    'node:assert/strict'
  );

const fs =
  require(
    'node:fs'
  );

const path =
  require(
    'node:path'
  );


function read(
  name
) {

  return fs.readFileSync(
    path.join(
      __dirname,
      name
    ),
    'utf8'
  );
}


const indexSource =
  read(
    'index.js'
  );


function callableBlock(
  name
) {

  const marker =
    `exports.${name} = onCall(`;

  const start =
    indexSource.indexOf(
      marker
    );

  assert.notEqual(
    start,
    -1,
    `${name} debe existir.`
  );

  let end =
    indexSource.indexOf(
      '\nexports.',
      start + marker.length
    );

  if (end < 0) {
    end =
      indexSource.length;
  }

  return indexSource.slice(
    start,
    end
  );
}


function requireCanonicalAncestry(
  source,
  label
) {

  assert.match(
    source,
    /\bparentPersonId\b/,
    `${label} debe conservar parentPersonId.`
  );

  assert.match(
    source,
    /\bintroducedByPersonId\b/,
    `${label} debe conservar introducedByPersonId.`
  );

  assert.match(
    source,
    /\bancestorUserIds\b/,
    `${label} debe conservar ancestorUserIds.`
  );

  assert.match(
    source,
    /\bancestorPersonIds\b/,
    `${label} debe conservar ancestorPersonIds.`
  );
}


test(
  'createMunicipalCoordinator persists dual territorial ancestry',
  () => {

    const block =
      callableBlock(
        'createMunicipalCoordinator'
      );

    requireCanonicalAncestry(
      block,
      'createMunicipalCoordinator'
    );

    assert.match(
      block,
      /principalLeaderUid/,
      'La ancestry UID debe derivarse del Líder Principal.'
    );

    assert.match(
      block,
      /principalLeaderPersonId/,
      'La ancestry person debe derivarse del Líder Principal.'
    );
  }
);


test(
  'createStructureChief creates full canonical identity and ancestry',
  () => {

    const block =
      callableBlock(
        'createStructureChief'
      );

    assert.match(
      block,
      /resolveCanonicalPersonForAccount/,
      'Debe resolver la persona canónica del Coordinador.'
    );

    assert.match(
      block,
      /canonicalMembershipDocumentId/,
      'Debe crear membershipId canónico.'
    );

    assert.match(
      block,
      /collection\(\s*["']persons["']\s*\)/,
      'Debe crear person.'
    );

    assert.match(
      block,
      /collection\(\s*["']territorialMemberships["']\s*\)/,
      'Debe crear territorialMembership.'
    );

    requireCanonicalAncestry(
      block,
      'createStructureChief'
    );

    assert.match(
      block,
      /\bpersonId\b/,
      'Debe enlazar personId.'
    );

    assert.match(
      block,
      /\bmembershipId\b/,
      'Debe enlazar membershipId.'
    );

    assert.match(
      block,
      /db\.batch\(\)/,
      'Las escrituras canónicas deben ser atómicas.'
    );

    assert.match(
      block,
      /batch\.create\(\s*personRef/,
      'La persona debe crearse dentro del batch.'
    );

    assert.match(
      block,
      /batch\.create\(\s*membershipRef/,
      'La membresía debe crearse dentro del batch.'
    );
  }
);


test(
  'createStructureMember persists full canonical ancestry',
  () => {

    const block =
      callableBlock(
        'createStructureMember'
      );

    assert.match(
      block,
      /resolveCanonicalPersonForAccount/,
      'Debe resolver la persona canónica del Jefe.'
    );

    requireCanonicalAncestry(
      block,
      'createStructureMember'
    );
  }
);


test(
  'createParticipant persists full canonical ancestry',
  () => {

    const block =
      callableBlock(
        'createParticipant'
      );

    assert.match(
      block,
      /resolveCanonicalPersonForAccount/,
      'Debe resolver la persona canónica del Integrante.'
    );

    requireCanonicalAncestry(
      block,
      'createParticipant'
    );
  }
);


test(
  'createBaseCollaborator persists ancestorPersonIds',
  () => {

    const source =
      read(
        'base-collaborator.cjs'
      );

    requireCanonicalAncestry(
      source,
      'createBaseCollaborator'
    );
  }
);


test(
  'createQuickAffiliation persists ancestorPersonIds',
  () => {

    const source =
      read(
        'quick-affiliation.cjs'
      );

    requireCanonicalAncestry(
      source,
      'createQuickAffiliation'
    );
  }
);


test(
  'completeDoorRegistrationHandoff persists ancestorPersonIds',
  () => {

    const source =
      read(
        'door-person-registration.cjs'
      );

    requireCanonicalAncestry(
      source,
      'completeDoorRegistrationHandoff'
    );
  }
);
