'use strict';

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const html =
  fs.readFileSync(
    'direccion.html',
    'utf8'
  );

const js =
  fs.readFileSync(
    'direccion.js',
    'utf8'
  );

const test =
  require('node:test');

test(
  'admin direction declares createCampaign callable',
  () => {
    assert.match(
      js,
      /httpsCallable\(functions,'createCampaign'\)/
    );
  }
);

test(
  'admin direction contains separate create campaign form',
  () => {
    assert.match(
      html,
      /id="createCampaignForm"/
    );

    assert.match(
      html,
      /id="newCampaignId"/
    );

    assert.match(
      html,
      /id="newCampaignName"/
    );

    assert.match(
      html,
      /id="createCampaignStatus"/
    );
  }
);

test(
  'create campaign sends explicit campaignId and name',
  () => {
    assert.match(
      js,
      /await createCampaign\(\{\s*campaignId,\s*name\s*\}\)/
    );
  }
);

test(
  'frontend validates canonical campaign id format',
  () => {
    assert.match(
      js,
      /\/\^CAM-\[0-9\]\{3,6\}\$\//
    );
  }
);

test(
  'new campaign becomes assignment target',
  () => {
    assert.match(
      js,
      /assignmentCampaignId:createdCampaignId/
    );
  }
);

test(
  'creating campaign preserves visible campaign',
  () => {
    assert.match(
      js,
      /const visibleCampaignId=currentPanelCampaignId/
    );

    assert.match(
      js,
      /panelCampaignId:visibleCampaignId/
    );
  }
);

test(
  'campaign creation does not call panel refresh automatically',
  () => {
    const handler =
      js.match(
        /\$\('createCampaignForm'\)\.onsubmit=async e=>\{([\s\S]*?)\n\};/
      );

    assert.ok(
      handler,
      'No se encontro handler createCampaignForm.'
    );

    assert.doesNotMatch(
      handler[1],
      /await refresh\(\)/
    );
  }
);

test(
  'frontend cache version is H3',
  () => {
    assert.match(
      html,
      /direccion\.js\?v=build-123d4g-h3/
    );
  }
);

console.log(
  'OK: BUILD-123D4G-H3 create campaign frontend contract passed.'
);
