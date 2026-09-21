'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const js =
  fs.readFileSync(
    'admin.js',
    'utf8'
  );

const html =
  fs.readFileSync(
    'admin.html',
    'utf8'
  );

const sw =
  fs.readFileSync(
    'service-worker.js',
    'utf8'
  );

test(
  'admin page exposes campaign selector',
  () => {

    assert.match(
      html,
      /id="adminCampaignContext"/
    );

    assert.match(
      html,
      /id="adminCampaignSelect"/
    );

    assert.match(
      html,
      /Solo lectura/
    );
  }
);

test(
  'admin loads authorized campaigns through callable',
  () => {

    assert.match(
      js,
      /listAdminCampaignsCall/
    );

    assert.match(
      js,
      /"listAdminCampaigns"/
    );

    assert.match(
      js,
      /loadAdminCampaignContext/
    );
  }
);

test(
  'technical admin bypasses territorial grant validation',
  () => {

    const start =
      js.indexOf(
        'async function validateTerritorialAccess()'
      );

    assert.notEqual(
      start,
      -1
    );

    const block =
      js.slice(
        start,
        start + 2200
      );

    const adminBranch =
      block.indexOf(
        'isTechnicalAdmin()'
      );

    const grantCall =
      block.indexOf(
        'getMyTerritorialAccessCall'
      );

    assert.notEqual(
      adminBranch,
      -1
    );

    assert.notEqual(
      grantCall,
      -1
    );

    assert.ok(
      adminBranch < grantCall
    );
  }
);

test(
  'admin visit query uses selected explicit campaign',
  () => {

    const start =
      js.indexOf(
        'function territorialVisitConstraints()'
      );

    assert.notEqual(
      start,
      -1
    );

    const block =
      js.slice(
        start,
        start + 2500
      );

    assert.match(
      block,
      /selectedAdminCampaignId/
    );

    assert.match(
      block,
      /where\([\s\S]*"campaignId"[\s\S]*selectedAdminCampaignId/
    );
  }
);

test(
  'admin supervisor access is read only',
  () => {

    const start =
      js.indexOf(
        'function adminSupervisorAccess'
      );

    assert.notEqual(
      start,
      -1
    );

    const block =
      js.slice(
        start,
        start + 700
      );

    assert.match(
      block,
      /read:\s*true/
    );

    assert.match(
      block,
      /write:\s*false/
    );

    assert.match(
      block,
      /grant:\s*null/
    );
  }
);

test(
  'admin does not load grant-backed candidate support stats',
  () => {

    assert.match(
      js,
      /if \(isTechnicalAdmin\(\)\) \{\s*clearCandidateSupportStats\(\)/
    );
  }
);

test(
  'frontend cache was bumped',
  () => {

    assert.match(
      html,
      /styles\.css\?v=build-123d4h-c16/
    );

    assert.match(
      html,
      /admin\.js\?v=build-123d4h-c16/
    );

    assert.match(
      sw,
      /terra-campaign-v1\.0\.2/
    );
  }
);
