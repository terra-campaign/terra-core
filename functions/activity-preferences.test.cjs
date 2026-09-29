'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ACTIVITY_PREFERENCES_VERSION,
  ACTIVITY_PREFERENCE_KEYS,
  normalizeActivityPreferences,
  hasSelectedActivity,
  membershipMatchesSubject
} = require('./activity-preferences.cjs');


test(
  'activity preferences exposes the canonical V1 matrix',
  () => {

    assert.equal(
      ACTIVITY_PREFERENCES_VERSION,
      1
    );

    assert.deepEqual(
      ACTIVITY_PREFERENCE_KEYS,
      [
        'territorial_brigade',
        'material_distribution',
        'structure_growth',
        'event_logistics',
        'digital_activity',
        'wall_painting',
        'operational_accompaniment',
        'other_configurable'
      ]
    );
  }
);


test(
  'activity preferences normalizes canonical selections',
  () => {

    const result =
      normalizeActivityPreferences({
        territorial_brigade: true,
        event_logistics: true,
        digital_activity: false,
        unknown_activity: true
      });

    assert.deepEqual(
      result,
      {
        territorial_brigade: true,
        material_distribution: false,
        structure_growth: false,
        event_logistics: true,
        digital_activity: false,
        wall_painting: false,
        operational_accompaniment: false,
        other_configurable: false
      }
    );
  }
);


test(
  'activity preferences rejects invalid input',
  () => {

    assert.throws(
      () =>
        normalizeActivityPreferences(null),
      TypeError
    );

    assert.throws(
      () =>
        normalizeActivityPreferences([]),
      TypeError
    );
  }
);


test(
  'activity preferences detects whether at least one activity is selected',
  () => {

    const none =
      normalizeActivityPreferences({});

    const some =
      normalizeActivityPreferences({
        material_distribution: true
      });

    assert.equal(
      hasSelectedActivity(none),
      false
    );

    assert.equal(
      hasSelectedActivity(some),
      true
    );
  }
);

test(
  'membership matches its canonical territorial subject',
  () => {

    const result =
      membershipMatchesSubject({
        membership: {
          membershipId: 'MEM-001',
          campaignId: 'CAM-004',
          personId: 'PERSON-001',
          active: true
        },
        membershipId: 'MEM-001',
        campaignId: 'CAM-004',
        personId: 'PERSON-001'
      });

    assert.equal(
      result,
      true
    );
  }
);


test(
  'membership rejects a different campaign or person',
  () => {

    const membership = {
      membershipId: 'MEM-001',
      campaignId: 'CAM-004',
      personId: 'PERSON-001',
      active: true
    };

    assert.equal(
      membershipMatchesSubject({
        membership,
        membershipId: 'MEM-001',
        campaignId: 'CAM-999',
        personId: 'PERSON-001'
      }),
      false
    );

    assert.equal(
      membershipMatchesSubject({
        membership,
        membershipId: 'MEM-001',
        campaignId: 'CAM-004',
        personId: 'PERSON-999'
      }),
      false
    );
  }
);


test(
  'membership rejects inactive or missing membership',
  () => {

    assert.equal(
      membershipMatchesSubject({
        membership: {
          membershipId: 'MEM-001',
          campaignId: 'CAM-004',
          personId: 'PERSON-001',
          active: false
        },
        membershipId: 'MEM-001',
        campaignId: 'CAM-004',
        personId: 'PERSON-001'
      }),
      false
    );

    assert.equal(
      membershipMatchesSubject({
        membership: null,
        membershipId: 'MEM-001',
        campaignId: 'CAM-004',
        personId: 'PERSON-001'
      }),
      false
    );
  }
);