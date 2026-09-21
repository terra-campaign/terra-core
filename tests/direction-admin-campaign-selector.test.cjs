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
  'direction admin declares authorized campaign callable',
  () => {

    assert.match(
      js,
      /httpsCallable\(functions,'listAdminCampaigns'\)/
    );
  }
);


test(
  'direction admin loads campaigns only for admin role',
  () => {

    assert.match(
      js,
      /if\(p\.role==='admin'\)\{const available=await loadAdminCampaigns\(\)/
    );
  }
);


test(
  'leader assignment sends explicit campaignId',
  () => {

    assert.match(
      js,
      /await assign\(\{campaignId,uid:/
    );
  }
);


test(
  'assignment refuses empty campaign selection',
  () => {

    assert.match(
      js,
      /if\(!campaignId\)/
    );
  }
);


test(
  'direction form contains required campaign selector',
  () => {

    assert.match(
      html,
      /<select id="campaignId" required disabled>/
    );

    assert.match(
      html,
      /id="campaignStatus"/
    );
  }
);


test(
  'frontend does not read adminCampaignAccess directly',
  () => {

    assert.doesNotMatch(
      js,
      /adminCampaignAccess/
    );

    assert.doesNotMatch(
      html,
      /adminCampaignAccess/
    );
  }
);


console.log(
  'OK: BUILD-123D4G-D2 admin campaign selector frontend contract passed.'
);
