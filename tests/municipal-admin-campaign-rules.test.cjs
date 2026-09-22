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
      '..',
      'firestore.rules'
    ),
    'utf8'
  );


function matchBlock(
  startMarker,
  endMarker
) {

  const start =
    source.indexOf(
      startMarker
    );

  assert.notEqual(
    start,
    -1,
    `No se encontró ${startMarker}`
  );

  const end =
    source.indexOf(
      endMarker,
      start + startMarker.length
    );

  assert.notEqual(
    end,
    -1,
    `No se encontró ${endMarker}`
  );

  return source.slice(
    start,
    end
  );
}


test(
  'municipios uses explicit admin campaign access',
  () => {

    const block =
      matchBlock(
        'match /municipios/{municipalityId}',
        'match /estructuras/{structureDocId}'
      );

    assert.match(
      block,
      /adminHasCampaignAccess\(\s*resource\.data\.campaignId\s*\)/
    );

    assert.doesNotMatch(
      block,
      /roleIs\("admin"\)[\s\S]{0,120}profile\(\)\.campaignId/
    );

    assert.match(
      block,
      /roleIs\("coordinador_municipal"\)/
    );
  }
);


test(
  'estructuras uses explicit admin campaign access',
  () => {

    const block =
      matchBlock(
        'match /estructuras/{structureDocId}',
        'match /usuarios/{userId}'
      );

    assert.match(
      block,
      /adminHasCampaignAccess\(\s*resource\.data\.campaignId\s*\)/
    );

    assert.doesNotMatch(
      block,
      /roleIs\("admin"\)[\s\S]{0,120}profile\(\)\.campaignId/
    );

    assert.match(
      block,
      /roleIs\("coordinador_municipal"\)/
    );

    assert.match(
      block,
      /roleIs\("jefe_estructura"\)/
    );
  }
);


test(
  'usuarios uses explicit admin campaign access',
  () => {

    const block =
      matchBlock(
        'match /usuarios/{userId}',
        '// =====================================================\n    // VISITAS'
      );

    assert.match(
      block,
      /adminHasCampaignAccess\(\s*resource\.data\.campaignId\s*\)/
    );

    assert.doesNotMatch(
      block,
      /roleIs\("admin"\)[\s\S]{0,120}profile\(\)\.campaignId/
    );

    assert.match(
      block,
      /resource\.data\.parentUserId/
    );
  }
);


test(
  'write policy remains backend-only for municipal resources',
  () => {

    const municipios =
      matchBlock(
        'match /municipios/{municipalityId}',
        'match /estructuras/{structureDocId}'
      );

    const estructuras =
      matchBlock(
        'match /estructuras/{structureDocId}',
        'match /usuarios/{userId}'
      );

    assert.match(
      municipios,
      /allow create, update, delete:\s*if false/
    );

    assert.match(
      estructuras,
      /allow create, update, delete:\s*if false/
    );
  }
);
