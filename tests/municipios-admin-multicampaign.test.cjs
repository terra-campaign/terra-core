'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const js =
  fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'municipios.js'
    ),
    'utf8'
  );

const html =
  fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'municipios.html'
    ),
    'utf8'
  );


test(
  'admin municipalities loads explicit authorized campaigns',
  () => {

    assert.match(
      js,
      /listAdminCampaigns/
    );

    assert.match(
      js,
      /selectedAdminCampaignId/
    );

    assert.match(
      html,
      /id="adminCampaignSelect"/
    );
  }
);


test(
  'admin profile campaign is no longer required',
  () => {

    assert.doesNotMatch(
      js,
      /!profile\.campaignId/
    );

    assert.doesNotMatch(
      js,
      /currentUserProfile\.campaignId/
    );
  }
);


test(
  'municipality query uses selected admin campaign',
  () => {

    assert.match(
      js,
      /where\(\s*"campaignId",\s*"==",\s*selectedAdminCampaignId\s*\)/
    );
  }
);


test(
  'municipality creation sends explicit campaignId',
  () => {

    const start =
      js.indexOf(
        'createMunicipalityFunction({'
      );

    assert.notEqual(
      start,
      -1
    );

    const block =
      js.slice(
        start,
        start + 500
      );

    assert.match(
      block,
      /campaignId:\s*selectedAdminCampaignId/
    );
  }
);


test(
  'municipality detail link propagates campaignId',
  () => {

    assert.match(
      js,
      /municipio\.html\?id=\$\{encodeURIComponent\([\s\S]{0,250}&campaignId=\$\{encodeURIComponent\(/
    );
  }
);


test(
  'changing campaign refreshes municipality listener',
  () => {

    assert.match(
      js,
      /adminCampaignSelect[\s\S]{0,1200}addEventListener\([\s\S]{0,500}"change"[\s\S]{0,1600}listenMunicipalities\(\)/
    );
  }
);


test(
  'authorized campaign from URL is restored',
  () => {

    assert.match(
      js,
      /URLSearchParams\([\s\S]{0,160}campaignId/
    );

    assert.match(
      js,
      /requestedFromUrlIsAuthorized[\s\S]{0,700}requestedAdminCampaignId/
    );
  }
);


test(
  'campaign selector synchronizes URL',
  () => {

    assert.match(
      js,
      /function syncAdminCampaignUrl/
    );

    assert.match(
      js,
      /history\.replaceState/
    );

    assert.match(
      js,
      /syncAdminCampaignUrl\([\s\S]{0,100}selectedAdminCampaignId/
    );
  }
);


test(
  'municipios cache is bumped after navigation change',
  () => {

    assert.match(
      html,
      /municipios\.js\?v=005/
    );
  }
);
