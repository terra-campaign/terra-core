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
      'municipio.js'
    ),
    'utf8'
  );

const html =
  fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'municipio.html'
    ),
    'utf8'
  );


test(
  'admin detail requires explicit campaignId from URL',
  () => {

    assert.match(
      js,
      /urlParams\.get\("campaignId"\)/
    );

    assert.match(
      js,
      /currentUserProfile\.role === "admin"[\s\S]{0,900}!requestedCampaignId/
    );

    assert.match(
      js,
      /listAdminCampaigns/
    );
  }
);


test(
  'admin campaign is validated against authorized campaigns',
  () => {

    assert.match(
      js,
      /campaign\?\.campaignId ===[\s\S]{0,80}requestedCampaignId/
    );

    assert.match(
      js,
      /currentCampaignId =[\s\S]{0,80}requestedCampaignId/
    );
  }
);


test(
  'municipal coordinator keeps own profile campaign',
  () => {

    assert.match(
      js,
      /currentCampaignId =[\s\S]{0,160}currentUserProfile\.campaignId/
    );

    assert.match(
      js,
      /profile\.role === "coordinador_municipal" &&[\s\S]{0,80}!profile\.campaignId/
    );
  }
);


test(
  'municipality and admin queries use resolved currentCampaignId',
  () => {

    const queryArea =
      js.slice(
        js.indexOf(
          'async function loadMunicipality'
        )
      );

    assert.doesNotMatch(
      queryArea,
      /currentUserProfile\.campaignId/
    );

    const matches =
      js.match(
        /currentCampaignId/g
      ) || [];

    assert.ok(
      matches.length >= 8
    );
  }
);


test(
  'coordinator creation sends resolved campaignId',
  () => {

    const start =
      js.indexOf(
        'createMunicipalCoordinatorFunction({'
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
      /campaignId:\s*currentCampaignId/
    );
  }
);


test(
  'structure creation sends resolved campaignId',
  () => {

    const start =
      js.indexOf(
        'createStructureFunction({'
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
      /campaignId:\s*currentCampaignId/
    );
  }
);


test(
  'detail UI exposes resolved campaign context',
  () => {

    assert.match(
      html,
      /id="campaignContextMessage"/
    );

    assert.match(
      html,
      /municipio\.js\?v=004/
    );
  }
);



test(
  'admin back link preserves resolved campaign context',
  () => {

    assert.match(
      html,
      /id="municipalitiesBackLink"/
    );

    assert.match(
      js,
      /municipalitiesBackLink\.href[\s\S]{0,220}municipios\.html\?campaignId=/
    );
  }
);


test(
  'admin error return preserves resolved campaign context',
  () => {

    assert.match(
      js,
      /window\.location\.href =[\s\S]{0,320}municipios\.html\?campaignId=/
    );
  }
);
