"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  evaluateMembershipEligibility
} =
  require(
    "./performance-membership-eligibility.cjs"
  );


function membership(overrides = {}) {
  return {
    membershipId:
      "campaign-001_person-001",

    campaignId:
      "campaign-001",

    createdAt:
      "2026-01-15T10:00:00.000Z",

    ...overrides
  };
}


function period(overrides = {}) {
  return {
    periodId:
      "PERIOD-001",

    campaignId:
      "campaign-001",

    startDate:
      "2026-04-01",

    endDate:
      "2026-07-01",

    ...overrides
  };
}


test(
  "membership created before period is eligible",
  () => {

    const result =
      evaluateMembershipEligibility({
        membership:
          membership({
            createdAt:
              "2026-02-15T10:00:00.000Z"
          }),

        period:
          period()
      });

    assert.equal(
      result.eligible,
      true
    );

    assert.equal(
      result.reason,
      "MEMBERSHIP_WITHIN_PERIOD_SCOPE"
    );
  }
);


test(
  "membership created during period is eligible",
  () => {

    const result =
      evaluateMembershipEligibility({
        membership:
          membership({
            createdAt:
              "2026-05-15T10:00:00.000Z"
          }),

        period:
          period()
      });

    assert.equal(
      result.eligible,
      true
    );
  }
);


test(
  "membership created exactly at period end is not eligible",
  () => {

    const result =
      evaluateMembershipEligibility({
        membership:
          membership({
            createdAt:
              "2026-07-01T00:00:00.000Z"
          }),

        period:
          period()
      });

    assert.equal(
      result.eligible,
      false
    );

    assert.equal(
      result.reason,
      "MEMBERSHIP_CREATED_AFTER_PERIOD"
    );
  }
);


test(
  "membership created after period is not eligible",
  () => {

    const result =
      evaluateMembershipEligibility({
        membership:
          membership({
            createdAt:
              "2026-08-01T00:00:00.000Z"
          }),

        period:
          period()
      });

    assert.equal(
      result.eligible,
      false
    );
  }
);


test(
  "different campaign fails closed without being eligible",
  () => {

    const result =
      evaluateMembershipEligibility({
        membership:
          membership({
            campaignId:
              "campaign-OTHER"
          }),

        period:
          period()
      });

    assert.equal(
      result.eligible,
      false
    );

    assert.equal(
      result.reason,
      "CAMPAIGN_MISMATCH"
    );
  }
);


test(
  "missing membership createdAt fails closed",
  () => {

    assert.throws(
      () =>
        evaluateMembershipEligibility({
          membership:
            membership({
              createdAt:
                null
            }),

          period:
            period()
        }),

      /INVALID_MEMBERSHIP_CREATED_AT/
    );
  }
);


test(
  "missing membership identity fails closed",
  () => {

    assert.throws(
      () =>
        evaluateMembershipEligibility({
          membership:
            membership({
              membershipId:
                ""
            }),

          period:
            period()
        }),

      /INVALID_MEMBERSHIP_ID/
    );
  }
);


test(
  "invalid period fails closed",
  () => {

    assert.throws(
      () =>
        evaluateMembershipEligibility({
          membership:
            membership(),

          period:
            period({
              endDate:
                "2026-03-01"
            })
        }),

      /INVALID_OPERATIONAL_PERIOD/
    );
  }
);


test(
  "policy remains inactive",
  () => {

    const {
      PERFORMANCE_MEMBERSHIP_ELIGIBILITY_POLICY:
        policy
    } =
      require(
        "./performance-membership-eligibility.cjs"
      );

    assert.equal(
      policy.status,
      "DEFINED_NOT_ACTIVATED"
    );

    assert.equal(
      policy.scoringActivated,
      false
    );

    assert.equal(
      policy.persistenceEnabled,
      false
    );
  }
);
