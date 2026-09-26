"use strict";

const test =
  require(
    "node:test"
  );

const assert =
  require(
    "node:assert/strict"
  );

const {
  PERFORMANCE_SUMMARY_READ_POLICY_VERSION,
  PERFORMANCE_SUMMARY_READ_POLICY_STATUS,
  PERFORMANCE_SUMMARY_READ_POLICY_SCOPE,
  PERFORMANCE_SUMMARY_READ_POLICY,
  validActiveMembership,
  canReadPerformanceSummary
} =
  require(
    "./performance-summary-read-policy.cjs"
  );

function actor(
  overrides = {}
) {
  return {
    uid:
      "UID-ACTOR",

    role:
      "integrante",

    active:
      true,

    campaignId:
      "CAM-001",

    structureId:
      "EST-001",

    ...overrides
  };
}

function actorMembership(
  overrides = {}
) {
  return {
    membershipId:
      "MEM-ACTOR",

    personId:
      "PER-ACTOR",

    campaignId:
      "CAM-001",

    role:
      "integrante",

    active:
      true,

    structureId:
      "EST-001",

    parentPersonId:
      "PER-SUPERIOR",

    ancestorPersonIds: [
      "PER-SUPERIOR"
    ],

    ...overrides
  };
}

function targetPerson(
  overrides = {}
) {
  return {
    personId:
      "PER-TARGET",

    campaignId:
      "CAM-001",

    active:
      true,

    accountUid:
      null,

    ...overrides
  };
}

function targetMembership(
  overrides = {}
) {
  return {
    membershipId:
      "MEM-TARGET",

    personId:
      "PER-TARGET",

    campaignId:
      "CAM-001",

    role:
      "participante",

    active:
      true,

    structureId:
      "EST-001",

    parentPersonId:
      "PER-ACTOR",

    ancestorPersonIds: [
      "PER-ACTOR"
    ],

    ...overrides
  };
}

test(
  "read policy is versioned and remains unexposed",
  () => {
    assert.equal(
      PERFORMANCE_SUMMARY_READ_POLICY_VERSION,
      "1.0.0"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_POLICY_STATUS,
      "DEFINED_NOT_EXPOSED"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_POLICY_SCOPE,
      "CANONICAL_PERSON_PERFORMANCE_READ"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_POLICY
        .actorAuthority,
      "territorialMemberships"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_POLICY
        .targetAuthority,
      "territorialMemberships"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_POLICY
        .callableExposed,
      false
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_POLICY
        .clientFirestoreReadAllowed,
      false
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_POLICY
        .performanceSummaryPersistenceEnabled,
      false
    );
  }
);

test(
  "active canonical membership requires matching campaign and person",
  () => {
    assert.equal(
      validActiveMembership(
        targetMembership(),
        {
          campaignId:
            "CAM-001",
          personId:
            "PER-TARGET"
        }
      ),
      true
    );

    assert.equal(
      validActiveMembership(
        targetMembership({
          active:
            false
        }),
        {
          campaignId:
            "CAM-001",
          personId:
            "PER-TARGET"
        }
      ),
      false
    );

    assert.equal(
      validActiveMembership(
        targetMembership({
          campaignId:
            "CAM-002"
        }),
        {
          campaignId:
            "CAM-001",
          personId:
            "PER-TARGET"
        }
      ),
      false
    );
  }
);

test(
  "territorial person may read own performance only with canonical actor membership",
  () => {
    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor(),

        actorPersonId:
          "PER-TARGET",

        actorMembership:
          actorMembership({
            personId:
              "PER-TARGET"
          }),

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership()
      }),
      true
    );

    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor(),

        actorPersonId:
          "PER-TARGET",

        actorMembership:
          null,

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership()
      }),
      false
    );
  }
);

test(
  "direct canonical parent may read accountless subordinate",
  () => {
    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor({
            role:
              "participante"
          }),

        actorPersonId:
          "PER-ACTOR",

        actorMembership:
          actorMembership({
            role:
              "participante"
          }),

        targetPerson:
          targetPerson({
            accountUid:
              null
          }),

        targetMembership:
          targetMembership({
            role:
              "colaborador_base",
            parentPersonId:
              "PER-ACTOR"
          })
      }),
      true
    );
  }
);

test(
  "territorial actor without active canonical membership is denied",
  () => {
    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor(),

        actorPersonId:
          "PER-ACTOR",

        actorMembership:
          null,

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership()
      }),
      false
    );

    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor(),

        actorPersonId:
          "PER-ACTOR",

        actorMembership:
          actorMembership({
            active:
              false
          }),

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership()
      }),
      false
    );
  }
);

test(
  "actor profile and canonical membership role must agree",
  () => {
    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor({
            role:
              "integrante"
          }),

        actorPersonId:
          "PER-ACTOR",

        actorMembership:
          actorMembership({
            role:
              "participante"
          }),

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership()
      }),
      false
    );
  }
);

test(
  "municipal coordinator does not gain generalized descendant access",
  () => {
    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor({
            role:
              "coordinador_municipal"
          }),

        actorPersonId:
          "PER-COORD",

        actorMembership:
          actorMembership({
            personId:
              "PER-COORD",
            role:
              "coordinador_municipal"
          }),

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership({
            parentPersonId:
              "PER-JEFE",
            ancestorPersonIds: [
              "PER-JEFE",
              "PER-COORD"
            ]
          })
      }),
      false
    );
  }
);

test(
  "municipal coordinator may read direct subordinate only",
  () => {
    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor({
            role:
              "coordinador_municipal"
          }),

        actorPersonId:
          "PER-COORD",

        actorMembership:
          actorMembership({
            personId:
              "PER-COORD",
            role:
              "coordinador_municipal"
          }),

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership({
            parentPersonId:
              "PER-COORD"
          })
      }),
      true
    );
  }
);

test(
  "structure chief may read active member inside same canonical structure",
  () => {
    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor({
            role:
              "jefe_estructura",
            structureId:
              "EST-LEGACY"
          }),

        actorPersonId:
          "PER-JEFE",

        actorMembership:
          actorMembership({
            personId:
              "PER-JEFE",
            role:
              "jefe_estructura",
            structureId:
              "EST-001"
          }),

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership({
            parentPersonId:
              "PER-OTRO",
            structureId:
              "EST-001"
          })
      }),
      true
    );
  }
);

test(
  "structure chief cannot read another canonical structure",
  () => {
    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor({
            role:
              "jefe_estructura"
          }),

        actorPersonId:
          "PER-JEFE",

        actorMembership:
          actorMembership({
            personId:
              "PER-JEFE",
            role:
              "jefe_estructura",
            structureId:
              "EST-001"
          }),

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership({
            parentPersonId:
              "PER-OTRO",
            structureId:
              "EST-999"
          })
      }),
      false
    );
  }
);

test(
  "technical admin needs explicit campaign access but no territorial person",
  () => {
    const adminProfile =
      actor({
        uid:
          "ADMIN-1",
        role:
          "admin",
        campaignId:
          "LEGACY-CAMPAIGN"
      });

    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          adminProfile,

        actorPersonId:
          "",

        actorMembership:
          null,

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership(),

        adminAccessRecord:
          null
      }),
      false
    );

    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          adminProfile,

        actorPersonId:
          "",

        actorMembership:
          null,

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership(),

        adminAccessRecord: {
          adminUid:
            "ADMIN-1",

          campaignId:
            "CAM-001",

          active:
            true
        }
      }),
      true
    );
  }
);

test(
  "foreign campaign target is denied to territorial actor",
  () => {
    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor({
            campaignId:
              "CAM-001"
          }),

        actorPersonId:
          "PER-ACTOR",

        actorMembership:
          actorMembership({
            campaignId:
              "CAM-001"
          }),

        targetPerson:
          targetPerson({
            campaignId:
              "CAM-002"
          }),

        targetMembership:
          targetMembership({
            campaignId:
              "CAM-002"
          })
      }),
      false
    );
  }
);

test(
  "inactive or inconsistent target authority fails closed",
  () => {
    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor(),

        actorPersonId:
          "PER-ACTOR",

        actorMembership:
          actorMembership(),

        targetPerson:
          targetPerson({
            active:
              false
          }),

        targetMembership:
          targetMembership()
      }),
      false
    );

    assert.equal(
      canReadPerformanceSummary({
        actorProfile:
          actor(),

        actorPersonId:
          "PER-ACTOR",

        actorMembership:
          actorMembership(),

        targetPerson:
          targetPerson(),

        targetMembership:
          targetMembership({
            personId:
              "PER-OTHER"
          })
      }),
      false
    );
  }
);

test(
  "policy object is immutable",
  () => {
    assert.equal(
      Object.isFrozen(
        PERFORMANCE_SUMMARY_READ_POLICY
      ),
      true
    );
  }
);