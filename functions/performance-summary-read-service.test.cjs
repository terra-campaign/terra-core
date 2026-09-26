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
  canonicalMembershipDocumentId
} =
  require(
    "./territorial-membership-id.cjs"
  );

const {
  PERFORMANCE_SUMMARY_READ_SERVICE_VERSION,
  PERFORMANCE_SUMMARY_READ_SERVICE_STATUS,
  PERFORMANCE_SUMMARY_READ_SERVICE_SCOPE,
  PERFORMANCE_SUMMARY_READ_SERVICE_POLICY,
  _test
} =
  require(
    "./performance-summary-read-service.cjs"
  );

const {
  normalizeTargetPerson,
  readAuthorizedPerformanceSummaryCore
} =
  _test;

function snapshot(
  id,
  data,
  exists = true
) {
  return {
    id,
    exists,

    data() {
      return data;
    }
  };
}

function createDb(
  records
) {
  const reads = [];

  function reference(
    path
  ) {
    return {
      async get() {
        reads.push(
          path
        );

        if (
          Object.prototype.hasOwnProperty.call(
            records,
            path
          )
        ) {
          return records[path];
        }

        return snapshot(
          path.split("/").at(-1),
          null,
          false
        );
      }
    };
  }

  return {
    reads,

    db: {
      collection(
        collectionName
      ) {
        return {
          doc(
            documentId
          ) {
            return reference(
              `${collectionName}/${documentId}`
            );
          }
        };
      },

      doc(
        path
      ) {
        return reference(
          path
        );
      }
    }
  };
}

function baseProjection({
  campaignId,
  personId,
  periodStart,
  periodEnd
}) {
  return Object.freeze({
    schemaVersion:
      "1.0.0",

    status:
      "DEFINED_NOT_ACTIVATED",

    campaignId,
    personId,

    period: {
      start:
        periodStart,
      end:
        periodEnd
    },

    contribution: {},
    generalPerformanceIndex:
      null
  });
}

function createDependencies({
  authorized = true,
  actorPersonId =
    "PER-ACTOR",
  ledgerEntries = [],
  counters = null
} = {}) {
  const state =
    counters ||
    {
      identity:
        0,
      policy:
        0,
      ledger:
        0,
      projection:
        0
    };

  return {
    state,

    dependencies: {
      async resolveCanonicalPersonForAccount() {
        state.identity++;

        return {
          personId:
            actorPersonId
        };
      },

      canReadPerformanceSummary() {
        state.policy++;

        return authorized;
      },

      async readPersonContributionLedger({
        campaignId,
        personId
      }) {
        state.ledger++;

        return {
          campaignId,
          personId,
          ledgerEntries,
          sourceDocumentCount:
            ledgerEntries.length,
          returnedDocumentCount:
            ledgerEntries.length,
          paginationRequired:
            false
        };
      },

      buildPerformanceSummaryProjection({
        campaignId,
        personId,
        ledgerEntries:
          receivedLedgerEntries,
        periodStart,
        periodEnd
      }) {
        state.projection++;

        assert.strictEqual(
          receivedLedgerEntries,
          ledgerEntries
        );

        return baseProjection({
          campaignId,
          personId,
          periodStart,
          periodEnd
        });
      }
    }
  };
}

function targetMembership({
  campaignId,
  personId,
  parentPersonId =
    "PER-ACTOR",
  role =
    "colaborador_base",
  structureId =
    "EST-001"
}) {
  const membershipId =
    canonicalMembershipDocumentId(
      campaignId,
      personId
    );

  return {
    membershipId,

    data: {
      membershipId,
      campaignId,
      personId,
      active:
        true,
      role,
      parentPersonId,
      structureId
    }
  };
}

function actorMembership({
  campaignId,
  personId,
  role =
    "participante",
  structureId =
    "EST-001"
}) {
  const membershipId =
    canonicalMembershipDocumentId(
      campaignId,
      personId
    );

  return {
    membershipId,

    data: {
      membershipId,
      campaignId,
      personId,
      active:
        true,
      role,
      structureId
    }
  };
}

test(
  "service contract remains backend-only and unexposed",
  () => {
    assert.equal(
      PERFORMANCE_SUMMARY_READ_SERVICE_VERSION,
      "1.0.0"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_SERVICE_STATUS,
      "DEFINED_NOT_EXPOSED"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_SERVICE_SCOPE,
      "AUTHORIZED_PERSON_PERFORMANCE_SUMMARY_READ"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_SERVICE_POLICY
        .targetIdentity,
      "persons_document_id"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_SERVICE_POLICY
        .accountlessTargetSupported,
      true
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_SERVICE_POLICY
        .callableExposed,
      false
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_SERVICE_POLICY
        .performanceSummaryPersistenceEnabled,
      false
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_SERVICE_POLICY
        .scoringActivation,
      false
    );

    assert.equal(
      PERFORMANCE_SUMMARY_READ_SERVICE_POLICY
        .writeCapability,
      false
    );

    assert.equal(
      Object.isFrozen(
        PERFORMANCE_SUMMARY_READ_SERVICE_POLICY
      ),
      true
    );
  }
);

test(
  "accountless target derives canonical personId from document id",
  () => {
    const result =
      normalizeTargetPerson({
        targetPersonId:
          "PER-TARGET",

        snapshot:
          snapshot(
            "PER-TARGET",
            {
              id:
                "PER-TARGET",
              campaignId:
                "CAM-001",
              accountUid:
                null,
              active:
                true
            }
          )
      });

    assert.equal(
      result.personId,
      "PER-TARGET"
    );

    assert.equal(
      result.accountUid,
      null
    );
  }
);

test(
  "target person embedded identity contradiction fails closed",
  () => {
    assert.throws(
      () =>
        normalizeTargetPerson({
          targetPersonId:
            "PER-TARGET",

          snapshot:
            snapshot(
              "PER-TARGET",
              {
                personId:
                  "PER-OTHER",
                campaignId:
                  "CAM-001",
                active:
                  true
              }
            )
        }),
      /TARGET_PERSON_ID_MISMATCH/
    );

    assert.throws(
      () =>
        normalizeTargetPerson({
          targetPersonId:
            "PER-TARGET",

          snapshot:
            snapshot(
              "PER-TARGET",
              {
                id:
                  "PER-OTHER",
                campaignId:
                  "CAM-001",
                active:
                  true
              }
            )
        }),
      /TARGET_PERSON_LEGACY_ID_MISMATCH/
    );
  }
);

test(
  "technical admin uses explicit campaign access and skips territorial identity",
  async () => {
    const campaignId =
      "CAM-001";

    const personId =
      "PER-TARGET";

    const target =
      targetMembership({
        campaignId,
        personId
      });

    const accessPath =
      "adminCampaignAccess/ADMIN-1/campaigns/CAM-001";

    const {
      db,
      reads
    } =
      createDb({
        "usuarios/ADMIN-1":
          snapshot(
            "ADMIN-1",
            {
              uid:
                "ADMIN-1",
              role:
                "admin",
              active:
                true
            }
          ),

        "persons/PER-TARGET":
          snapshot(
            "PER-TARGET",
            {
              id:
                "PER-TARGET",
              campaignId,
              accountUid:
                null,
              active:
                true
            }
          ),

        [`territorialMemberships/${target.membershipId}`]:
          snapshot(
            target.membershipId,
            target.data
          ),

        [accessPath]:
          snapshot(
            "CAM-001",
            {
              adminUid:
                "ADMIN-1",
              campaignId,
              active:
                true
            }
          )
      });

    const counters = {
      identity:
        0,
      policy:
        0,
      ledger:
        0,
      projection:
        0
    };

    const {
      dependencies
    } =
      createDependencies({
        counters
      });

    dependencies
      .canReadPerformanceSummary =
      ({
        actorProfile,
        actorPersonId,
        actorMembership,
        adminAccessRecord,
        targetPerson
      }) => {
        counters.policy++;

        assert.equal(
          actorProfile.role,
          "admin"
        );

        assert.equal(
          actorPersonId,
          null
        );

        assert.equal(
          actorMembership,
          null
        );

        assert.equal(
          adminAccessRecord.active,
          true
        );

        assert.equal(
          targetPerson.personId,
          personId
        );

        return true;
      };

    const result =
      await readAuthorizedPerformanceSummaryCore({
        db,
        actorUid:
          "ADMIN-1",
        targetPersonId:
          personId,
        dependencies
      });

    assert.equal(
      counters.identity,
      0
    );

    assert.equal(
      counters.policy,
      1
    );

    assert.equal(
      counters.ledger,
      1
    );

    assert.equal(
      counters.projection,
      1
    );

    assert.equal(
      reads.includes(
        accessPath
      ),
      true
    );

    assert.equal(
      result.authorization,
      "GRANTED"
    );

    assert.equal(
      result.personId,
      personId
    );
  }
);

test(
  "territorial actor resolves canonical identity and deterministic membership",
  async () => {
    const campaignId =
      "CAM-001";

    const actorPersonId =
      "PER-ACTOR";

    const targetPersonId =
      "PER-TARGET";

    const target =
      targetMembership({
        campaignId,
        personId:
          targetPersonId,
        parentPersonId:
          actorPersonId
      });

    const actor =
      actorMembership({
        campaignId,
        personId:
          actorPersonId,
        role:
          "participante"
      });

    const {
      db,
      reads
    } =
      createDb({
        "usuarios/USER-1":
          snapshot(
            "USER-1",
            {
              uid:
                "USER-1",
              role:
                "participante",
              active:
                true,
              campaignId
            }
          ),

        "persons/PER-TARGET":
          snapshot(
            targetPersonId,
            {
              id:
                targetPersonId,
              campaignId,
              active:
                true,
              accountUid:
                null
            }
          ),

        [`territorialMemberships/${target.membershipId}`]:
          snapshot(
            target.membershipId,
            target.data
          ),

        [`territorialMemberships/${actor.membershipId}`]:
          snapshot(
            actor.membershipId,
            actor.data
          )
      });

    const counters = {
      identity:
        0,
      policy:
        0,
      ledger:
        0,
      projection:
        0
    };

    const {
      dependencies
    } =
      createDependencies({
        actorPersonId,
        counters
      });

    dependencies
      .canReadPerformanceSummary =
      ({
        actorProfile,
        actorPersonId:
          resolvedActorPersonId,
        actorMembership:
          resolvedActorMembership,
        targetMembership:
          resolvedTargetMembership
      }) => {
        counters.policy++;

        assert.equal(
          actorProfile.role,
          "participante"
        );

        assert.equal(
          resolvedActorPersonId,
          actorPersonId
        );

        assert.equal(
          resolvedActorMembership.personId,
          actorPersonId
        );

        assert.equal(
          resolvedTargetMembership.parentPersonId,
          actorPersonId
        );

        return true;
      };

    const result =
      await readAuthorizedPerformanceSummaryCore({
        db,
        actorUid:
          "USER-1",
        targetPersonId,
        dependencies
      });

    assert.equal(
      counters.identity,
      1
    );

    assert.equal(
      counters.ledger,
      1
    );

    assert.equal(
      reads.includes(
        `territorialMemberships/${actor.membershipId}`
      ),
      true
    );

    assert.equal(
      result.personId,
      targetPersonId
    );
  }
);

test(
  "authorization denial prevents ledger read and projection",
  async () => {
    const campaignId =
      "CAM-001";

    const actorPersonId =
      "PER-ACTOR";

    const targetPersonId =
      "PER-TARGET";

    const target =
      targetMembership({
        campaignId,
        personId:
          targetPersonId
      });

    const actor =
      actorMembership({
        campaignId,
        personId:
          actorPersonId
      });

    const {
      db
    } =
      createDb({
        "usuarios/USER-1":
          snapshot(
            "USER-1",
            {
              uid:
                "USER-1",
              role:
                "participante",
              active:
                true,
              campaignId
            }
          ),

        "persons/PER-TARGET":
          snapshot(
            targetPersonId,
            {
              id:
                targetPersonId,
              campaignId,
              active:
                true
            }
          ),

        [`territorialMemberships/${target.membershipId}`]:
          snapshot(
            target.membershipId,
            target.data
          ),

        [`territorialMemberships/${actor.membershipId}`]:
          snapshot(
            actor.membershipId,
            actor.data
          )
      });

    const {
      dependencies,
      state
    } =
      createDependencies({
        authorized:
          false,
        actorPersonId
      });

    await assert.rejects(
      () =>
        readAuthorizedPerformanceSummaryCore({
          db,
          actorUid:
            "USER-1",
          targetPersonId,
          dependencies
        }),
      /PERFORMANCE_SUMMARY_READ_FORBIDDEN/
    );

    assert.equal(
      state.policy,
      1
    );

    assert.equal(
      state.ledger,
      0
    );

    assert.equal(
      state.projection,
      0
    );
  }
);

test(
  "missing target membership fails closed before ledger read",
  async () => {
    const campaignId =
      "CAM-001";

    const actorPersonId =
      "PER-ACTOR";

    const actor =
      actorMembership({
        campaignId,
        personId:
          actorPersonId
      });

    const {
      db
    } =
      createDb({
        "usuarios/USER-1":
          snapshot(
            "USER-1",
            {
              uid:
                "USER-1",
              role:
                "participante",
              active:
                true,
              campaignId
            }
          ),

        "persons/PER-TARGET":
          snapshot(
            "PER-TARGET",
            {
              id:
                "PER-TARGET",
              campaignId,
              active:
                true
            }
          ),

        [`territorialMemberships/${actor.membershipId}`]:
          snapshot(
            actor.membershipId,
            actor.data
          )
      });

    const {
      dependencies,
      state
    } =
      createDependencies({
        actorPersonId
      });

    dependencies
      .canReadPerformanceSummary =
      ({
        targetMembership
      }) => {
        state.policy++;

        return Boolean(
          targetMembership
        );
      };

    await assert.rejects(
      () =>
        readAuthorizedPerformanceSummaryCore({
          db,
          actorUid:
            "USER-1",
          targetPersonId:
            "PER-TARGET",
          dependencies
        }),
      /PERFORMANCE_SUMMARY_READ_FORBIDDEN/
    );

    assert.equal(
      state.ledger,
      0
    );

    assert.equal(
      state.projection,
      0
    );
  }
);

test(
  "target membership identity contradiction fails closed",
  async () => {
    const campaignId =
      "CAM-001";

    const targetPersonId =
      "PER-TARGET";

    const targetMembershipId =
      canonicalMembershipDocumentId(
        campaignId,
        targetPersonId
      );

    const {
      db
    } =
      createDb({
        "usuarios/ADMIN-1":
          snapshot(
            "ADMIN-1",
            {
              uid:
                "ADMIN-1",
              role:
                "admin",
              active:
                true
            }
          ),

        "persons/PER-TARGET":
          snapshot(
            targetPersonId,
            {
              id:
                targetPersonId,
              campaignId,
              active:
                true
            }
          ),

        [`territorialMemberships/${targetMembershipId}`]:
          snapshot(
            targetMembershipId,
            {
              membershipId:
                targetMembershipId,
              campaignId,
              personId:
                "PER-OTHER",
              active:
                true
            }
          )
      });

    const {
      dependencies,
      state
    } =
      createDependencies();

    await assert.rejects(
      () =>
        readAuthorizedPerformanceSummaryCore({
          db,
          actorUid:
            "ADMIN-1",
          targetPersonId,
          dependencies
        }),
      /TERRITORIAL_MEMBERSHIP_IDENTITY_MISMATCH/
    );

    assert.equal(
      state.ledger,
      0
    );
  }
);

test(
  "invalid ledger reader identity cannot reach projection",
  async () => {
    const campaignId =
      "CAM-001";

    const targetPersonId =
      "PER-TARGET";

    const target =
      targetMembership({
        campaignId,
        personId:
          targetPersonId
      });

    const {
      db
    } =
      createDb({
        "usuarios/ADMIN-1":
          snapshot(
            "ADMIN-1",
            {
              uid:
                "ADMIN-1",
              role:
                "admin",
              active:
                true
            }
          ),

        "persons/PER-TARGET":
          snapshot(
            targetPersonId,
            {
              id:
                targetPersonId,
              campaignId,
              active:
                true
            }
          ),

        [`territorialMemberships/${target.membershipId}`]:
          snapshot(
            target.membershipId,
            target.data
          ),

        "adminCampaignAccess/ADMIN-1/campaigns/CAM-001":
          snapshot(
            campaignId,
            {
              adminUid:
                "ADMIN-1",
              campaignId,
              active:
                true
            }
          )
      });

    const {
      dependencies,
      state
    } =
      createDependencies();

    dependencies
      .readPersonContributionLedger =
      async () => {
        state.ledger++;

        return {
          campaignId:
            "CAM-OTHER",
          personId:
            targetPersonId,
          ledgerEntries: []
        };
      };

    await assert.rejects(
      () =>
        readAuthorizedPerformanceSummaryCore({
          db,
          actorUid:
            "ADMIN-1",
          targetPersonId,
          dependencies
        }),
      /INVALID_PERFORMANCE_LEDGER_READ_RESULT/
    );

    assert.equal(
      state.projection,
      0
    );
  }
);

test(
  "projection identity contradiction fails closed",
  async () => {
    const campaignId =
      "CAM-001";

    const targetPersonId =
      "PER-TARGET";

    const target =
      targetMembership({
        campaignId,
        personId:
          targetPersonId
      });

    const {
      db
    } =
      createDb({
        "usuarios/ADMIN-1":
          snapshot(
            "ADMIN-1",
            {
              uid:
                "ADMIN-1",
              role:
                "admin",
              active:
                true
            }
          ),

        "persons/PER-TARGET":
          snapshot(
            targetPersonId,
            {
              id:
                targetPersonId,
              campaignId,
              active:
                true
            }
          ),

        [`territorialMemberships/${target.membershipId}`]:
          snapshot(
            target.membershipId,
            target.data
          ),

        "adminCampaignAccess/ADMIN-1/campaigns/CAM-001":
          snapshot(
            campaignId,
            {
              adminUid:
                "ADMIN-1",
              campaignId,
              active:
                true
            }
          )
      });

    const {
      dependencies
    } =
      createDependencies();

    dependencies
      .buildPerformanceSummaryProjection =
      () => ({
        campaignId:
          "CAM-OTHER",
        personId:
          targetPersonId
      });

    await assert.rejects(
      () =>
        readAuthorizedPerformanceSummaryCore({
          db,
          actorUid:
            "ADMIN-1",
          targetPersonId,
          dependencies
        }),
      /INVALID_PERFORMANCE_SUMMARY_PROJECTION/
    );
  }
);

test(
  "period boundaries are forwarded unchanged to canonical projection",
  async () => {
    const campaignId =
      "CAM-001";

    const targetPersonId =
      "PER-TARGET";

    const target =
      targetMembership({
        campaignId,
        personId:
          targetPersonId
      });

    const {
      db
    } =
      createDb({
        "usuarios/ADMIN-1":
          snapshot(
            "ADMIN-1",
            {
              uid:
                "ADMIN-1",
              role:
                "admin",
              active:
                true
            }
          ),

        "persons/PER-TARGET":
          snapshot(
            targetPersonId,
            {
              id:
                targetPersonId,
              campaignId,
              active:
                true
            }
          ),

        [`territorialMemberships/${target.membershipId}`]:
          snapshot(
            target.membershipId,
            target.data
          ),

        "adminCampaignAccess/ADMIN-1/campaigns/CAM-001":
          snapshot(
            campaignId,
            {
              adminUid:
                "ADMIN-1",
              campaignId,
              active:
                true
            }
          )
      });

    const {
      dependencies
    } =
      createDependencies();

    const periodStart =
      "2026-09-01T00:00:00.000Z";

    const periodEnd =
      "2026-10-01T00:00:00.000Z";

    const result =
      await readAuthorizedPerformanceSummaryCore({
        db,
        actorUid:
          "ADMIN-1",
        targetPersonId,
        periodStart,
        periodEnd,
        dependencies
      });

    assert.equal(
      result.summary.period.start,
      periodStart
    );

    assert.equal(
      result.summary.period.end,
      periodEnd
    );
  }
);

test(
  "missing actor profile fails before authorization and ledger access",
  async () => {
    const {
      db
    } =
      createDb({
        "persons/PER-TARGET":
          snapshot(
            "PER-TARGET",
            {
              id:
                "PER-TARGET",
              campaignId:
                "CAM-001",
              active:
                true
            }
          )
      });

    const {
      dependencies,
      state
    } =
      createDependencies();

    await assert.rejects(
      () =>
        readAuthorizedPerformanceSummaryCore({
          db,
          actorUid:
            "USER-MISSING",
          targetPersonId:
            "PER-TARGET",
          dependencies
        }),
      /ACTOR_PROFILE_NOT_FOUND/
    );

    assert.equal(
      state.policy,
      0
    );

    assert.equal(
      state.ledger,
      0
    );
  }
);

test(
  "service result exposes summary metadata but no actor authority internals",
  async () => {
    const campaignId =
      "CAM-001";

    const targetPersonId =
      "PER-TARGET";

    const target =
      targetMembership({
        campaignId,
        personId:
          targetPersonId
      });

    const {
      db
    } =
      createDb({
        "usuarios/ADMIN-1":
          snapshot(
            "ADMIN-1",
            {
              uid:
                "ADMIN-1",
              role:
                "admin",
              active:
                true
            }
          ),

        "persons/PER-TARGET":
          snapshot(
            targetPersonId,
            {
              id:
                targetPersonId,
              campaignId,
              active:
                true
            }
          ),

        [`territorialMemberships/${target.membershipId}`]:
          snapshot(
            target.membershipId,
            target.data
          ),

        "adminCampaignAccess/ADMIN-1/campaigns/CAM-001":
          snapshot(
            campaignId,
            {
              adminUid:
                "ADMIN-1",
              campaignId,
              active:
                true
            }
          )
      });

    const {
      dependencies
    } =
      createDependencies();

    const result =
      await readAuthorizedPerformanceSummaryCore({
        db,
        actorUid:
          "ADMIN-1",
        targetPersonId,
        dependencies
      });

    assert.equal(
      Object.isFrozen(
        result
      ),
      true
    );

    assert.equal(
      result.authorization,
      "GRANTED"
    );

    assert.equal(
      "actorProfile" in result,
      false
    );

    assert.equal(
      "actorMembership" in result,
      false
    );

    assert.equal(
      "adminAccessRecord" in result,
      false
    );
  }
);