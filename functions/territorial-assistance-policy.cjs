'use strict';

const {
  canonicalMembershipDocumentId,
} =
  require(
    './territorial-membership-id.cjs'
  );


function cleanId(
  value
) {

  return typeof value ===
    'string'
    ? value.trim()
    : '';
}


function membershipMatchesSubject({
  membership,
  membershipId,
  campaignId,
  personId,
}) {

  if (
    !membership ||
    membership.active !==
      true
  ) {

    return false;
  }

  const expectedId =
    canonicalMembershipDocumentId(
      campaignId,
      personId
    );

  return (
    cleanId(
      membershipId
    ) ===
      expectedId &&
    cleanId(
      membership.membershipId
    ) ===
      expectedId &&
    cleanId(
      membership.campaignId
    ) ===
      cleanId(
        campaignId
      ) &&
    cleanId(
      membership.personId
    ) ===
      cleanId(
        personId
      )
  );
}


function actorCanAssistTarget({
  actorPersonId,
  actorMembership,
  targetMembership,
  campaignId,
}) {

  const actor =
    cleanId(
      actorPersonId
    );

  const campaign =
    cleanId(
      campaignId
    );

  if (
    !actor ||
    !campaign ||
    !actorMembership ||
    !targetMembership ||
    targetMembership.active !==
      true
  ) {

    return false;
  }


  const actorMembershipId =
    canonicalMembershipDocumentId(
      campaign,
      actor
    );


  if (
    !membershipMatchesSubject({
      membership:
        actorMembership,

      membershipId:
        actorMembershipId,

      campaignId:
        campaign,

      personId:
        actor,
    })
  ) {

    return false;
  }


  if (
    cleanId(
      targetMembership
        .campaignId
    ) !==
      campaign
  ) {

    return false;
  }


  if (
    cleanId(
      targetMembership
        .parentPersonId
    ) ===
      actor
  ) {

    return true;
  }


  const ancestors =
    Array.isArray(
      targetMembership
        .ancestorPersonIds
    )
      ? targetMembership
          .ancestorPersonIds
          .map(
            cleanId
          )
          .filter(
            Boolean
          )
      : [];

  return ancestors.includes(
    actor
  );
}


exports.membershipMatchesSubject =
  membershipMatchesSubject;

exports.actorCanAssistTarget =
  actorCanAssistTarget;

exports._test = {
  cleanId,
  membershipMatchesSubject,
  actorCanAssistTarget,
};
