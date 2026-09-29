'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  _test
} = require('./activity-preferences-writer.cjs');

const {
  cleanId,
  buildPreferenceUpdate,
  buildActivityPreferencesRead,
  validateSelfServiceSubject,
  buildMembershipPreferenceUpdate
} = _test;


test(
  'cleanId trims valid string identifiers',
  () => {

    assert.equal(
      cleanId('  CAM-004  '),
      'CAM-004'
    );

    assert.equal(
      cleanId(null),
      ''
    );
  }
);


test(
  'buildPreferenceUpdate creates canonical V1 preference payload',
  () => {

    const result =
      buildPreferenceUpdate({
        territorial_brigade: true,
        event_logistics: true
      });

    assert.deepEqual(
      result,
      {
        activityPreferences: {
          territorial_brigade: true,
          material_distribution: false,
          structure_growth: false,
          event_logistics: true,
          digital_activity: false,
          wall_painting: false,
          operational_accompaniment: false,
          other_configurable: false
        },
        preferencesVersion: 1
      }
    );
  }
);


test(
  'buildPreferenceUpdate permits no selected optional activities',
  () => {

    const result =
      buildPreferenceUpdate({});

    assert.deepEqual(
      result.activityPreferences,
      {
        territorial_brigade: false,
        material_distribution: false,
        structure_growth: false,
        event_logistics: false,
        digital_activity: false,
        wall_painting: false,
        operational_accompaniment: false,
        other_configurable: false
      }
    );

    assert.equal(
      result.preferencesVersion,
      1
    );
  }
);


test(
  'buildPreferenceUpdate ignores unknown legacy or client keys',
  () => {

    const result =
      buildPreferenceUpdate({
        eventos_mitines: true,
        invented_activity: true,
        digital_activity: true
      });

    assert.equal(
      result.activityPreferences.digital_activity,
      true
    );

    assert.equal(
      Object.hasOwn(
        result.activityPreferences,
        'eventos_mitines'
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        result.activityPreferences,
        'invented_activity'
      ),
      false
    );
  }
);


test(
  'buildPreferenceUpdate rejects invalid preference payloads',
  () => {

    assert.throws(
      () =>
        buildPreferenceUpdate(null),
      TypeError
    );

    assert.throws(
      () =>
        buildPreferenceUpdate([]),
      TypeError
    );
  }
);

test(
  'membership update preserves legacy eventos_mitines separately',
  () => {

    const updatedAt =
      Symbol('serverTimestamp');

    const result =
      buildMembershipPreferenceUpdate({
        membership: {
          activityPreferences: {
            eventos_mitines: true
          }
        },

        activityPreferences: {
          territorial_brigade: true,
          event_logistics: true
        },

        updatedAt
      });

    assert.equal(
      result.activityPreferences
        .territorial_brigade,
      true
    );

    assert.equal(
      result.activityPreferences
        .event_logistics,
      true
    );

    assert.equal(
      Object.hasOwn(
        result.activityPreferences,
        'eventos_mitines'
      ),
      false
    );

    assert.deepEqual(
      result.legacyActivityPreferences,
      {
        eventos_mitines: true
      }
    );

    assert.equal(
      result.preferencesVersion,
      1
    );

    assert.equal(
      result.updatedAt,
      updatedAt
    );
  }
);


test(
  'membership update does not invent legacy preferences when absent',
  () => {

    const result =
      buildMembershipPreferenceUpdate({
        membership: {
          activityPreferences: {
            territorial_brigade: false
          }
        },

        activityPreferences: {
          digital_activity: true
        },

        updatedAt:
          'SERVER_TIME'
      });

    assert.equal(
      result.activityPreferences
        .digital_activity,
      true
    );

    assert.equal(
      Object.hasOwn(
        result,
        'legacyActivityPreferences'
      ),
      false
    );

    assert.equal(
      result.updatedAt,
      'SERVER_TIME'
    );
  }
);


test(
  'membership update preserves legacy false without converting it into a canonical preference',
  () => {

    const result =
      buildMembershipPreferenceUpdate({
        membership: {
          activityPreferences: {
            eventos_mitines: false
          }
        },

        activityPreferences: {},

        updatedAt:
          'SERVER_TIME'
      });

    assert.deepEqual(
      result.legacyActivityPreferences,
      {
        eventos_mitines: false
      }
    );

    assert.equal(
      Object.values(
        result.activityPreferences
      ).some(Boolean),
      false
    );
  }
);

test(
  'self service subject accepts active canonical territorial membership',
  () => {

    const result =
      validateSelfServiceSubject({
        profile: {
          active: true,
          role: 'integrante',
          campaignId: 'CAM-004'
        },

        campaignId:
          'CAM-004',

        personId:
          'PERSON-001',

        membershipId:
          'MEM-001',

        membership: {
          membershipId: 'MEM-001',
          campaignId: 'CAM-004',
          personId: 'PERSON-001',
          active: true
        }
      });

    assert.deepEqual(
      result,
      {
        ok: true,
        campaignId: 'CAM-004',
        personId: 'PERSON-001',
        membershipId: 'MEM-001'
      }
    );
  }
);


test(
  'self service subject rejects inactive profile and technical admin',
  () => {

    assert.deepEqual(
      validateSelfServiceSubject({
        profile: {
          active: false,
          role: 'integrante',
          campaignId: 'CAM-004'
        },

        campaignId: 'CAM-004',
        personId: 'PERSON-001',
        membershipId: 'MEM-001',

        membership: {
          membershipId: 'MEM-001',
          campaignId: 'CAM-004',
          personId: 'PERSON-001',
          active: true
        }
      }),
      {
        ok: false,
        reason: 'inactive-profile'
      }
    );

    assert.deepEqual(
      validateSelfServiceSubject({
        profile: {
          active: true,
          role: 'admin',
          campaignId: 'CAM-004'
        },

        campaignId: 'CAM-004',
        personId: 'PERSON-001',
        membershipId: 'MEM-001',

        membership: {
          membershipId: 'MEM-001',
          campaignId: 'CAM-004',
          personId: 'PERSON-001',
          active: true
        }
      }),
      {
        ok: false,
        reason: 'technical-admin'
      }
    );
  }
);


test(
  'self service subject rejects campaign mismatch',
  () => {

    const result =
      validateSelfServiceSubject({
        profile: {
          active: true,
          role: 'integrante',
          campaignId: 'CAM-004'
        },

        campaignId:
          'CAM-999',

        personId:
          'PERSON-001',

        membershipId:
          'MEM-001',

        membership: {
          membershipId: 'MEM-001',
          campaignId: 'CAM-004',
          personId: 'PERSON-001',
          active: true
        }
      });

    assert.deepEqual(
      result,
      {
        ok: false,
        reason: 'campaign-mismatch'
      }
    );
  }
);


test(
  'self service subject rejects membership belonging to another person',
  () => {

    const result =
      validateSelfServiceSubject({
        profile: {
          active: true,
          role: 'integrante',
          campaignId: 'CAM-004'
        },

        campaignId:
          'CAM-004',

        personId:
          'PERSON-001',

        membershipId:
          'MEM-001',

        membership: {
          membershipId: 'MEM-001',
          campaignId: 'CAM-004',
          personId: 'PERSON-999',
          active: true
        }
      });

    assert.deepEqual(
      result,
      {
        ok: false,
        reason: 'membership-mismatch'
      }
    );
  }
);

test(
  'activity preferences read restores canonical matrix',
  () => {

    const result =
      buildActivityPreferencesRead({
        activityPreferences: {
          territorial_brigade: true,
          material_distribution: false,
          structure_growth: true,
          event_logistics: true,
          digital_activity: false,
          wall_painting: false,
          operational_accompaniment: false,
          other_configurable: false
        }
      });

    assert.deepEqual(
      result,
      {
        ok: true,
        activityPreferences: {
          territorial_brigade: true,
          material_distribution: false,
          structure_growth: true,
          event_logistics: true,
          digital_activity: false,
          wall_painting: false,
          operational_accompaniment: false,
          other_configurable: false
        },
        preferencesVersion: 1
      }
    );
  }
);


test(
  'activity preferences read excludes legacy and unknown keys',
  () => {

    const result =
      buildActivityPreferencesRead({
        activityPreferences: {
          eventos_mitines: true,
          unknown_activity: true,
          territorial_brigade: true
        },
        legacyActivityPreferences: {
          eventos_mitines: true
        }
      });

    assert.equal(
      result.activityPreferences.territorial_brigade,
      true
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        result.activityPreferences,
        'eventos_mitines'
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        result.activityPreferences,
        'unknown_activity'
      ),
      false
    );

    assert.equal(
      Object.keys(
        result.activityPreferences
      ).length,
      8
    );
  }
);