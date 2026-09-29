'use strict';

const ACTIVITY_PREFERENCES_VERSION = 1;

const ACTIVITY_PREFERENCE_KEYS = Object.freeze([
  'territorial_brigade',
  'material_distribution',
  'structure_growth',
  'event_logistics',
  'digital_activity',
  'wall_painting',
  'operational_accompaniment',
  'other_configurable'
]);

function normalizeActivityPreferences(input) {

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new TypeError(
      'activityPreferences debe ser un objeto.'
    );
  }

  const normalized = {};

  for (const key of ACTIVITY_PREFERENCE_KEYS) {
    normalized[key] = input[key] === true;
  }

  return normalized;
}

function hasSelectedActivity(preferences) {

  return ACTIVITY_PREFERENCE_KEYS.some(
    (key) => preferences[key] === true
  );
}

function membershipMatchesSubject({
  membership,
  membershipId,
  campaignId,
  personId
}) {

  if (
    !membership ||
    typeof membership !== 'object' ||
    membership.active !== true
  ) {
    return false;
  }

  return (
    membership.membershipId === membershipId &&
    membership.campaignId === campaignId &&
    membership.personId === personId
  );
}

module.exports = {
  ACTIVITY_PREFERENCES_VERSION,
  ACTIVITY_PREFERENCE_KEYS,
  normalizeActivityPreferences,
  hasSelectedActivity,
  membershipMatchesSubject
};