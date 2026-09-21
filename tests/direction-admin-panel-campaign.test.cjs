'use strict';

const {
  test
} = require(
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

const js =
  fs.readFileSync(
    'direccion.js',
    'utf8'
  );

const html =
  fs.readFileSync(
    'direccion.html',
    'utf8'
  );


test(
  'admin direction has separate visible campaign selector',
  () => {

    assert.match(
      html,
      /id="panelCampaignControl" hidden/
    );

    assert.match(
      html,
      /id="panelCampaignId"/
    );

    assert.match(
      html,
      /id="campaignId"/
    );
  }
);


test(
  'panel and leader assignment use different selectors',
  () => {

    assert.match(
      js,
      /const assignmentSelect=\$\('campaignId'\)/
    );

    assert.match(
      js,
      /const panelSelect=\$\('panelCampaignId'\)/
    );
  }
);


test(
  'admin panel request sends selected campaignId',
  () => {

    assert.match(
      js,
      /currentRole==='admin' && currentPanelCampaignId/
    );

    assert.match(
      js,
      /\? \{campaignId:currentPanelCampaignId\}/
    );

    assert.match(
      js,
      /fetchPanel\(payload\)/
    );
  }
);


test(
  'changing visible campaign refreshes panel',
  () => {

    assert.match(
      js,
      /\$\('panelCampaignId'\)\.onchange=async/
    );

    assert.match(
      js,
      /currentPanelCampaignId=campaignId/
    );

    assert.match(
      js,
      /await refresh\(\)/
    );
  }
);


test(
  'leader assignment keeps independent campaign payload',
  () => {

    assert.match(
      js,
      /await assign\(\{campaignId,uid:/
    );

    assert.doesNotMatch(
      js,
      /await assign\(\{campaignId:currentPanelCampaignId/
    );
  }
);


test(
  'visible campaign control is admin only',
  () => {

    assert.match(
      js,
      /\$\('panelCampaignControl'\)\.hidden=p\.role!=='admin'/
    );
  }
);


console.log(
  'OK: BUILD-123D4G-E3B admin visible campaign selector contract passed.'
);
