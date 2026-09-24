'use strict';

const test =
  require(
    'node:test'
  );

const assert =
  require(
    'node:assert/strict'
  );

const {
  ONBOARDING_PROGRAM_VERSION,
  ONBOARDING_STATUSES,
  ONBOARDING_DELIVERY_MODES,
  ONBOARDING_CRITERIA,
  canonicalOnboardingFactDocumentId,
} =
  require(
    './onboarding-fact.cjs'
  );

const {
  canonicalMembershipDocumentId,
} =
  require(
    './territorial-membership-id.cjs'
  );

const {
  _test,
} =
  require(
    './onboarding-fact-writer.cjs'
  );


function fullCriteria() {

  return Object.fromEntries(
    ONBOARDING_CRITERIA
      .map(
        criterion => [
          criterion,
          true,
        ]
      )
  );
}


function membership({
  campaignId =
    'CAM-001',

  personId =
    'PER-TARGET',

  parentPersonId =
    'PER-PARENT',

  ancestorPersonIds =
    [
      'PER-PARENT',
      'PER-GRANDPARENT',
    ],

  active =
    true,
} = {}) {

  return {
    membershipId:
      canonicalMembershipDocumentId(
        campaignId,
        personId
      ),

    campaignId,
    personId,
    parentPersonId,
    ancestorPersonIds,
    active,
  };
}


function actorMembership(
  personId,
  {
    campaignId =
      'CAM-001',

    active =
      true,
  } = {}
) {

  return membership({
    campaignId,
    personId,

    parentPersonId:
      'PER-UPPER',

    ancestorPersonIds:
      [
        'PER-UPPER',
      ],

    active,
  });
}


test(
  'writer canonicalizes all onboarding criteria',
  () => {

    const criteria =
      _test
        .canonicalCriteria(
          fullCriteria()
        );

    assert.deepEqual(
      criteria,
      fullCriteria()
    );
  }
);


test(
  'writer rejects incomplete onboarding criteria',
  () => {

    const criteria =
      fullCriteria();

    criteria.helpAvailable =
      false;

    assert.throws(
      () =>
        _test
          .canonicalCriteria(
            criteria
          ),
      /Criterio de onboarding pendiente/
    );
  }
);


test(
  'SELF_SERVICE resolves only to authenticated person',
  () => {

    assert.equal(
      _test
        .resolveTargetPersonId({
          deliveryMode:
            ONBOARDING_DELIVERY_MODES
              .SELF_SERVICE,

          actorPersonId:
            'PER-ACTOR',
        }),
      'PER-ACTOR'
    );
  }
);


test(
  'SELF_SERVICE rejects foreign target',
  () => {

    assert.throws(
      () =>
        _test
          .resolveTargetPersonId({
            deliveryMode:
              ONBOARDING_DELIVERY_MODES
                .SELF_SERVICE,

            actorPersonId:
              'PER-ACTOR',

            requestedPersonId:
              'PER-OTHER',
          }),
      /SELF_SERVICE/
    );
  }
);


test(
  'ASSISTED requires another target person',
  () => {

    assert.throws(
      () =>
        _test
          .resolveTargetPersonId({
            deliveryMode:
              ONBOARDING_DELIVERY_MODES
                .ASSISTED,

            actorPersonId:
              'PER-ACTOR',

            requestedPersonId:
              'PER-ACTOR',
          }),
      /SELF_SERVICE/
    );
  }
);


test(
  'direct parent can assist target onboarding',
  () => {

    assert.equal(
      _test
        .actorCanAssistTarget({
          actorPersonId:
            'PER-PARENT',

          actorMembership:
            actorMembership(
              'PER-PARENT'
            ),

          targetMembership:
            membership(),

          campaignId:
            'CAM-001',
        }),
      true
    );
  }
);


test(
  'territorial ancestor can assist target onboarding',
  () => {

    assert.equal(
      _test
        .actorCanAssistTarget({
          actorPersonId:
            'PER-GRANDPARENT',

          actorMembership:
            actorMembership(
              'PER-GRANDPARENT'
            ),

          targetMembership:
            membership(),

          campaignId:
            'CAM-001',
        }),
      true
    );
  }
);


test(
  'unrelated person cannot assist target onboarding',
  () => {

    assert.equal(
      _test
        .actorCanAssistTarget({
          actorPersonId:
            'PER-STRANGER',

          actorMembership:
            actorMembership(
              'PER-STRANGER'
            ),

          targetMembership:
            membership(),

          campaignId:
            'CAM-001',
        }),
      false
    );
  }
);


test(
  'inactive target membership cannot authorize assisted onboarding',
  () => {

    assert.equal(
      _test
        .actorCanAssistTarget({
          actorPersonId:
            'PER-PARENT',

          actorMembership:
            actorMembership(
              'PER-PARENT'
            ),

          targetMembership:
            membership({
              active:
                false,
            }),

          campaignId:
            'CAM-001',
        }),
      false
    );
  }
);


test(
  'inactive actor membership cannot authorize assisted onboarding',
  () => {

    assert.equal(
      _test
        .actorCanAssistTarget({
          actorPersonId:
            'PER-PARENT',

          actorMembership:
            actorMembership(
              'PER-PARENT',
              {
                active:
                  false,
              }
            ),

          targetMembership:
            membership(),

          campaignId:
            'CAM-001',
        }),
      false
    );
  }
);


test(
  'actor membership from another campaign cannot authorize assisted onboarding',
  () => {

    assert.equal(
      _test
        .actorCanAssistTarget({
          actorPersonId:
            'PER-PARENT',

          actorMembership:
            actorMembership(
              'PER-PARENT',
              {
                campaignId:
                  'CAM-OTHER',
              }
            ),

          targetMembership:
            membership(),

          campaignId:
            'CAM-001',
        }),
      false
    );
  }
);


test(
  'membership must match canonical campaign and person',
  () => {

    const m =
      membership();

    assert.equal(
      _test
        .membershipMatchesSubject({
          membership:
            m,

          membershipId:
            m.membershipId,

          campaignId:
            'CAM-001',

          personId:
            'PER-TARGET',
        }),
      true
    );

    assert.equal(
      _test
        .membershipMatchesSubject({
          membership:
            m,

          membershipId:
            m.membershipId,

          campaignId:
            'CAM-002',

          personId:
            'PER-TARGET',
        }),
      false
    );
  }
);


test(
  'person must be active and belong to target campaign',
  () => {

    assert.equal(
      _test
        .personMatchesSubject({
          person: {
            personId:
              'PER-TARGET',

            campaignId:
              'CAM-001',

            active:
              true,
          },

          documentId:
            'PER-TARGET',

          campaignId:
            'CAM-001',

          personId:
            'PER-TARGET',
        }),
      true
    );

    assert.equal(
      _test
        .personMatchesSubject({
          person: {
            personId:
              'PER-TARGET',

            campaignId:
              'CAM-OTHER',

            active:
              true,
          },

          documentId:
            'PER-TARGET',

          campaignId:
            'CAM-001',

          personId:
            'PER-TARGET',
        }),
      false
    );
  }
);


test(
  'authoritative writer builds canonical self-service fact',
  () => {

    const completedAt =
      new Date(
        '2026-09-24T08:00:00.000Z'
      );

    const fact =
      _test
        .buildAuthoritativeOnboardingFact({
          campaignId:
            'CAM-001',

          personId:
            'PER-ACTOR',

          completedByPersonId:
            'PER-ACTOR',

          deliveryMode:
            ONBOARDING_DELIVERY_MODES
              .SELF_SERVICE,

          criteria:
            fullCriteria(),

          completedAt,
        });

    assert.equal(
      fact.id,
      canonicalOnboardingFactDocumentId({
        campaignId:
          'CAM-001',

        personId:
          'PER-ACTOR',
      })
    );

    assert.equal(
      fact.completedByPersonId,
      'PER-ACTOR'
    );

    assert.equal(
      fact.status,
      ONBOARDING_STATUSES
        .COMPLETED
    );

    assert.equal(
      fact.programVersion,
      ONBOARDING_PROGRAM_VERSION
    );

    assert.equal(
      fact.completedAt,
      completedAt
    );

    assert.equal(
      fact.runtimeScoringEnabled,
      false
    );
  }
);


test(
  'authoritative writer builds assisted fact with server actor',
  () => {

    const fact =
      _test
        .buildAuthoritativeOnboardingFact({
          campaignId:
            'CAM-001',

          personId:
            'PER-TARGET',

          completedByPersonId:
            'PER-PARENT',

          deliveryMode:
            ONBOARDING_DELIVERY_MODES
              .ASSISTED,

          criteria:
            fullCriteria(),

          completedAt:
            123456,
        });

    assert.equal(
      fact.personId,
      'PER-TARGET'
    );

    assert.equal(
      fact.completedByPersonId,
      'PER-PARENT'
    );

    assert.equal(
      fact.deliveryMode,
      ONBOARDING_DELIVERY_MODES
        .ASSISTED
    );
  }
);


test(
  'existing canonical fact is reusable without changing completedAt',
  () => {

    const completedAt =
      {
        seconds:
          100,

        nanoseconds:
          0,
      };

    const existing =
      _test
        .buildAuthoritativeOnboardingFact({
          campaignId:
            'CAM-001',

          personId:
            'PER-TARGET',

          completedByPersonId:
            'PER-PARENT',

          deliveryMode:
            ONBOARDING_DELIVERY_MODES
              .ASSISTED,

          criteria:
            fullCriteria(),

          completedAt,
        });

    const reused =
      _test
        .validateReusableExistingFact({
          onboardingFactId:
            existing.id,

          onboardingFact:
            existing,

          campaignId:
            'CAM-001',

          personId:
            'PER-TARGET',
        });

    assert.equal(
      reused.completedAt,
      completedAt
    );

    assert.equal(
      reused.programVersion,
      ONBOARDING_PROGRAM_VERSION
    );
  }
);


test(
  'existing onboarding fact from another subject is rejected',
  () => {

    const existing =
      _test
        .buildAuthoritativeOnboardingFact({
          campaignId:
            'CAM-001',

          personId:
            'PER-OTHER',

          completedByPersonId:
            'PER-PARENT',

          deliveryMode:
            ONBOARDING_DELIVERY_MODES
              .ASSISTED,

          criteria:
            fullCriteria(),

          completedAt:
            123,
        });

    assert.throws(
      () =>
        _test
          .validateReusableExistingFact({
            onboardingFactId:
              existing.id,

            onboardingFact:
              existing,

            campaignId:
              'CAM-001',

            personId:
              'PER-TARGET',
          }),
      /sujeto esperado/
    );
  }
);
