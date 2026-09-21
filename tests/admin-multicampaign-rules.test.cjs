'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const firestore =
  fs.readFileSync(
    'firestore.rules',
    'utf8'
  );

const storage =
  fs.readFileSync(
    'storage.rules',
    'utf8'
  );

test(
  'firestore defines explicit admin campaign access',
  () => {

    assert.match(
      firestore,
      /function adminCampaignAccessPath\(campaignId\)/
    );

    assert.match(
      firestore,
      /adminCampaignAccess\/\$\(request\.auth\.uid\)\/campaigns\/\$\(campaignId\)/
    );

    assert.match(
      firestore,
      /function adminHasCampaignAccess\(campaignId\)/
    );
  }
);

test(
  'visitas get/list allows explicit admin campaign access',
  () => {

    const start =
      firestore.indexOf(
        'match /visitas/{visitaId}'
      );

    assert.notEqual(
      start,
      -1
    );

    const block =
      firestore.slice(
        start,
        start + 1200
      );

    assert.match(
      block,
      /allow get, list: if[\s\S]*territorialReadAllowed\(resource\.data\)[\s\S]*adminHasCampaignAccess\([\s\S]*resource\.data\.campaignId/
    );
  }
);

test(
  'visitas creation remains territorial-grant only',
  () => {

    const start =
      firestore.indexOf(
        'match /visitas/{visitaId}'
      );

    const block =
      firestore.slice(
        start,
        start + 1200
      );

    assert.match(
      block,
      /allow create: if[\s\S]*territorialCreateAllowed\(request\.resource\.data\)/
    );

    const createPart =
      block.slice(
        block.indexOf('allow create: if'),
        block.indexOf('allow get, list: if')
      );

    assert.doesNotMatch(
      createPart,
      /adminHasCampaignAccess/
    );
  }
);

test(
  'storage defines explicit admin campaign access',
  () => {

    assert.match(
      storage,
      /function adminCampaignAccessPath\(campaignId\)/
    );

    assert.match(
      storage,
      /function adminHasCampaignAccess\(campaignId\)/
    );

    assert.match(
      storage,
      /firestore\.exists/
    );
  }
);

test(
  'visit evidence read evaluates explicit admin access before territorial grant',
  () => {

    const start =
      storage.indexOf(
        'function territorialStorageReadAllowed'
      );

    assert.notEqual(
      start,
      -1
    );

    const block =
      storage.slice(
        start,
        start + 1100
      );

    const adminIndex =
      block.indexOf(
        'adminHasCampaignAccess(campaignId)'
      );

    const territorialIndex =
      block.indexOf(
        'territorialPermission("read")'
      );

    assert.notEqual(
      adminIndex,
      -1
    );

    assert.notEqual(
      territorialIndex,
      -1
    );

    assert.ok(
      adminIndex < territorialIndex,
      'Admin access must be evaluated first to stay within the Storage Rules two-document Firestore access limit.'
    );
  }
);

test(
  'visit evidence creation remains territorial-grant only',
  () => {

    const start =
      storage.indexOf(
        'match /visitas/{campaignId}/{visitId}/{fileName}'
      );

    assert.notEqual(
      start,
      -1
    );

    const block =
      storage.slice(
        start,
        start + 1100
      );

    assert.match(
      block,
      /allow create: if[\s\S]*territorialStorageCreateAllowed/
    );

    const createPart =
      block.slice(
        block.indexOf('allow create: if'),
        block.indexOf('allow update, delete')
      );

    assert.doesNotMatch(
      createPart,
      /adminHasCampaignAccess/
    );
  }
);
