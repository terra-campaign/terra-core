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


function callableBlock(name) {

  const marker =
    `exports.${name} = onCall(`;

  const start =
    source.indexOf(marker);

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
  'index imports explicit admin campaign authorization',
  () => {

    assert.match(
      source,
      /adminCanAccessCampaign/
    );

    assert.match(
      source,
      /admin-campaign-access\.cjs/
    );
  }
);


test(
  'central campaign resolver requires explicit admin campaign access',
  () => {

    assert.match(
      source,
      /async function resolveAdministrativeCampaignContext/
    );

    assert.match(
      source,
      /adminCampaignAccess\/\$\{uid\}\/campaigns\/\$\{campaignId\}/
    );

    assert.match(
      source,
      /adminCanAccessCampaign\(\{/
    );

    assert.match(
      source,
      /campaign\.active !== true/
    );
  }
);


test(
  'createMunicipality no longer uses admin profile campaign',
  () => {

    const block =
      callableBlock(
        'createMunicipality'
      );

    assert.doesNotMatch(
      block,
      /adminProfile\.campaignId/
    );

    assert.match(
      block,
      /resolveAdministrativeCampaignContext/
    );
  }
);


test(
  'createMunicipalCoordinator supports admin explicit campaign and leader own campaign',
  () => {

    const block =
      callableBlock(
        'createMunicipalCoordinator'
      );

    assert.doesNotMatch(
      block,
      /const campaignId\s*=\s*adminProfile\.campaignId/
    );

    assert.match(
      block,
      /resolveAdministrativeCampaignContext/
    );

    assert.match(
      block,
      /allowPrincipalLeader:\s*true/
    );

    assert.match(
      block,
      /principalLeaderUid/
    );
  }
);


test(
  'new municipal coordinator belongs hierarchically to principal leader',
  () => {

    const block =
      callableBlock(
        'createMunicipalCoordinator'
      );

    assert.match(
      block,
      /parentUserId:\s*principalLeaderUid/
    );

    assert.match(
      block,
      /createdBy:\s*adminUid/
    );
  }
);


test(
  'createStructure uses explicit admin context while coordinator keeps own campaign',
  () => {

    const block =
      callableBlock(
        'createStructure'
      );

    assert.doesNotMatch(
      block,
      /const campaignId\s*=\s*creatorProfile\.campaignId/
    );

    assert.match(
      block,
      /resolveAdministrativeCampaignContext/
    );

    assert.match(
      block,
      /allowMunicipalCoordinator:\s*true/
    );
  }
);


test(
  'municipality IDs use one global collision-safe sequence',
  () => {

    const block =
      callableBlock(
        'createMunicipality'
      );

    assert.doesNotMatch(
      block,
      /`\$\{campaignId\}_MUNICIPIOS`/
    );

    assert.match(
      block,
      /"GLOBAL_MUNICIPIOS"/
    );

    assert.match(
      block,
      /existingMunicipalitySnapshot/
    );

    assert.match(
      block,
      /transaction\.get\(\s*municipalityReference\s*\)/
    );

    assert.match(
      block,
      /if\s*\(\s*!existingMunicipalitySnapshot\.exists\s*\)/
    );

    assert.match(
      block,
      /nextNumber \+= 1/
    );

    assert.match(
      block,
      /type:\s*"municipios_global"/
    );
  }
);
