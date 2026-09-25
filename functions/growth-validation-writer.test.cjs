'use strict';

const test =
  require(
    'node:test'
  );

const assert =
  require(
    'node:assert/strict'
  );

const fs =
  require(
    'node:fs'
  );

const path =
  require(
    'node:path'
  );

const {
  CATALOG_VERSION,
  SOURCE_TYPES,
} = require(
  './activity-catalog-v1.cjs'
);

const {
  ONBOARDING_PROGRAM_VERSION,
  ONBOARDING_STATUSES,
  ONBOARDING_DELIVERY_MODES,
  ONBOARDING_CRITERIA,
  canonicalOnboardingFactDocumentId,
} = require(
  './onboarding-fact.cjs'
);

const {
  GROWTH_MILESTONES,
  canonicalGrowthValidationDocumentId,
  assertGrowthValidationSetPolicy,
  validateGrowthMilestoneFact,
} = require(
  './growth-validation.cjs'
);

const {
  buildMissionSourceId,
  buildAttendanceSourceId,
} = require(
  './contribution-source.cjs'
);

const {
  _test,
} = require(
  './growth-validation-writer.cjs'
);


const {
  personMatchesSubject,
  membershipMatchesSubject,
  membershipIntroducerConsistent,
  resolveHistoricalIntroducerPersonId,
  membershipLegacyIntroducerConsistent,
  actorCanValidateTarget,
  missionVerifiedActivityProof,
  canonicalEventAttendanceDocumentId,
  attendanceVerifiedActivityProof,
  buildGrowthValidationRecord,
  validateReusableExistingValidation,
} = _test;


function membership(
  personId,
  overrides = {}
) {

  return {
    active:
      true,

    campaignId:
      'CAM-001',

    personId,

    parentPersonId:
      null,

    ancestorPersonIds:
      [],

    ...overrides,
  };
}


function onboardingFact(
  personId =
    'PER-TARGET'
) {

  const criteria = {};

  for (
    const criterion of
    ONBOARDING_CRITERIA
  ) {

    criteria[criterion] =
      true;
  }

  return {
    id:
      canonicalOnboardingFactDocumentId({ campaignId: 'CAM-001', personId }),

    campaignId:
      'CAM-001',

    personId,

    completedByPersonId:
      personId,

    status:
      ONBOARDING_STATUSES
        .COMPLETED,

    deliveryMode:
      ONBOARDING_DELIVERY_MODES
        .SELF_SERVICE,

    programVersion:
      ONBOARDING_PROGRAM_VERSION,

    completedAt:
      '2026-09-24T00:00:00.000Z',

    criteria,
  };
}


function validationRecord({
  milestone,
  validator =
    'PER-VALIDATOR',
  proof = {},
}) {

  const validationId =
    canonicalGrowthValidationDocumentId({
      campaignId:
        'CAM-001',

      personId:
        'PER-TARGET',

      introducedByPersonId:
        'PER-INTRODUCER',

      milestone,
    });

  return buildGrowthValidationRecord({
    validationId,

    campaignId:
      'CAM-001',

    personId:
      'PER-TARGET',

    introducedByPersonId:
      'PER-INTRODUCER',

    milestone,

    validatedByPersonId:
      validator,

    validatedByUserId:
      'UID-VALIDATOR',

    validatedAt:
      '2026-09-24T01:00:00.000Z',

    proof,
  });
}


test(
  'canonical person subject must be active and campaign-consistent',
  () => {

    assert.equal(
      personMatchesSubject({
        person: {
          active:
            true,

          campaignId:
            'CAM-001',

          personId:
            'PER-TARGET',
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
      personMatchesSubject({
        person: {
          active:
            false,

          campaignId:
            'CAM-001',
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
  'canonical membership must be active and match campaign/person',
  () => {

    assert.equal(
      membershipMatchesSubject({
        membership:
          membership(
            'PER-TARGET'
          ),

        campaignId:
          'CAM-001',

        personId:
          'PER-TARGET',
      }),

      true
    );

    assert.equal(
      membershipMatchesSubject({
        membership:
          membership(
            'PER-OTHER'
          ),

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
  'membership introducer cannot contradict canonical person history',
  () => {

    assert.equal(
      membershipIntroducerConsistent({
        membership:
          membership(
            'PER-TARGET',
            {
              introducedByPersonId:
                'PER-INTRODUCER',
            }
          ),

        introducedByPersonId:
          'PER-INTRODUCER',
      }),
      true
    );

    assert.equal(
      membershipIntroducerConsistent({
        membership:
          membership(
            'PER-TARGET',
            {
              introducedByPersonId:
                'PER-OTHER',
            }
          ),

        introducedByPersonId:
          'PER-INTRODUCER',
      }),
      false
    );

    assert.equal(
      membershipIntroducerConsistent({
        membership:
          membership(
            'PER-TARGET'
          ),

        introducedByPersonId:
          'PER-INTRODUCER',
      }),
      true
    );

    const source =
      fs.readFileSync(
        path.join(
          __dirname,
          'growth-validation-writer.cjs'
        ),
        'utf8'
      );

    assert.match(
      source,
      /membershipIntroducerConsistent\(\{\s*membership:\s*targetMembership,\s*introducedByPersonId,/s
    );
  }
);


test(
  'direct canonical introducer remains authoritative without legacy lookup',
  async () => {

    let readCount = 0;

    const result =
      await resolveHistoricalIntroducerPersonId({
        db: {},

        tx: {
          async get() {
            readCount += 1;
            throw new Error(
              'LEGACY_LOOKUP_MUST_NOT_RUN'
            );
          },
        },

        targetPerson: {
          introducedByPersonId:
            'PER-INTRODUCER',
          introducedByUserId:
            'UID-INTRODUCER',
        },

        campaignId:
          'CAM-001',
      });

    assert.equal(
      result.personId,
      'PER-INTRODUCER'
    );

    assert.equal(
      result.source,
      'introducedByPersonId'
    );

    assert.equal(
      readCount,
      0
    );
  }
);


test(
  'legacy introducer resolves server-side through canonical user mapping',
  async () => {

    const db = {
      collection(name) {
        assert.equal(
          name,
          'usuarios'
        );

        return {
          doc(id) {
            assert.equal(
              id,
              'UID-INTRODUCER'
            );

            return {
              path:
                'usuarios/' + id,
            };
          },
        };
      },
    };

    const tx = {
      async get(ref) {
        assert.equal(
          ref.path,
          'usuarios/UID-INTRODUCER'
        );

        return {
          exists:
            true,

          data() {
            return {
              campaignId:
                'CAM-001',
              personId:
                'PER-INTRODUCER',
            };
          },
        };
      },
    };

    const result =
      await resolveHistoricalIntroducerPersonId({
        db,
        tx,

        targetPerson: {
          introducedByUserId:
            'UID-INTRODUCER',
        },

        campaignId:
          'CAM-001',
      });

    assert.deepEqual(
      result,
      {
        personId:
          'PER-INTRODUCER',
        introducedByUserId:
          'UID-INTRODUCER',
        source:
          'introducedByUserId',
      }
    );

    assert.equal(
      membershipLegacyIntroducerConsistent({
        membership:
          membership(
            'PER-TARGET',
            {
              introducedByUserId:
                'UID-INTRODUCER',
            }
          ),
        introducedByUserId:
          'UID-INTRODUCER',
      }),
      true
    );

    assert.equal(
      membershipLegacyIntroducerConsistent({
        membership:
          membership(
            'PER-TARGET',
            {
              introducedByUserId:
                'UID-OTHER',
            }
          ),
        introducedByUserId:
          'UID-INTRODUCER',
      }),
      false
    );
  }
);


test(
  'legacy introducer mapping from another campaign is rejected',
  async () => {

    const db = {
      collection() {
        return {
          doc() {
            return {};
          },
        };
      },
    };

    const tx = {
      async get() {
        return {
          exists:
            true,

          data() {
            return {
              campaignId:
                'CAM-OTHER',
              personId:
                'PER-INTRODUCER',
            };
          },
        };
      },
    };

    await assert.rejects(
      () =>
        resolveHistoricalIntroducerPersonId({
          db,
          tx,
          targetPerson: {
            introducedByUserId:
              'UID-INTRODUCER',
          },
          campaignId:
            'CAM-001',
        }),
      /otra campaña/
    );
  }
);

test(
  'direct parent can validate target',
  () => {

    assert.equal(
      actorCanValidateTarget({
        actorPersonId:
          'PER-PARENT',

        actorMembership:
          membership(
            'PER-PARENT'
          ),

        targetPersonId:
          'PER-TARGET',

        targetMembership:
          membership(
            'PER-TARGET',
            {
              parentPersonId:
                'PER-PARENT',

              ancestorPersonIds:
                [
                  'PER-PARENT'
                ],
            }
          ),

        campaignId:
          'CAM-001',
      }),

      true
    );
  }
);


test(
  'active ancestor can validate target',
  () => {

    assert.equal(
      actorCanValidateTarget({
        actorPersonId:
          'PER-ANCESTOR',

        actorMembership:
          membership(
            'PER-ANCESTOR'
          ),

        targetPersonId:
          'PER-TARGET',

        targetMembership:
          membership(
            'PER-TARGET',
            {
              parentPersonId:
                'PER-PARENT',

              ancestorPersonIds:
                [
                  'PER-PARENT',
                  'PER-ANCESTOR'
                ],
            }
          ),

        campaignId:
          'CAM-001',
      }),

      true
    );
  }
);


test(
  'target cannot validate self and inactive actor cannot validate',
  () => {

    assert.equal(
      actorCanValidateTarget({
        actorPersonId:
          'PER-TARGET',

        actorMembership:
          membership(
            'PER-TARGET'
          ),

        targetPersonId:
          'PER-TARGET',

        targetMembership:
          membership(
            'PER-TARGET'
          ),

        campaignId:
          'CAM-001',
      }),

      false
    );

    assert.equal(
      actorCanValidateTarget({
        actorPersonId:
          'PER-PARENT',

        actorMembership:
          membership(
            'PER-PARENT',
            {
              active:
                false
            }
          ),

        targetPersonId:
          'PER-TARGET',

        targetMembership:
          membership(
            'PER-TARGET',
            {
              parentPersonId:
                'PER-PARENT'
            }
          ),

        campaignId:
          'CAM-001',
      }),

      false
    );
  }
);


test(
  'validated mission produces canonical first-activity source',
  () => {

    const proof =
      missionVerifiedActivityProof({
        sourceDocumentId:
          'EVID-001',

        review: {
          campaignId:
            'CAM-001',

          missionId:
            'MIS-001',

          evidenceId:
            'EVID-001',

          subjectId:
            'UID-TARGET',

          reviewerId:
            'UID-PARENT',

          lastActor:
            'UID-PARENT',

          status:
            'validated',
        },

        evidence: {
          campaignId:
            'CAM-001',

          missionId:
            'MIS-001',

          uploadedBy:
            'UID-TARGET',
        },

        mission: {
          campaignId:
            'CAM-001',

          assignedTo:
            'UID-TARGET',
        },

        campaignId:
          'CAM-001',

        subjectPersonId:
          'PER-TARGET',

        canonicalSubjectPersonId:
          'PER-TARGET',
      });

    assert.equal(
      proof.verifiedActivitySourceType,
      SOURCE_TYPES
        .MISSION_VALIDATION
    );

    assert.equal(
      proof.verifiedActivitySourceId,
      buildMissionSourceId({
        missionId:
          'MIS-001',

        personId:
          'PER-TARGET',
      })
    );
  }
);


test(
  'mission source rejects foreign canonical person',
  () => {

    assert.throws(
      () =>
        missionVerifiedActivityProof({
          sourceDocumentId:
            'EVID-001',

          review: {
            campaignId:
              'CAM-001',

            missionId:
              'MIS-001',

            evidenceId:
              'EVID-001',

            subjectId:
              'UID-TARGET',

            status:
              'validated',
          },

          evidence: {
            campaignId:
              'CAM-001',

            missionId:
              'MIS-001',

            uploadedBy:
              'UID-TARGET',
          },

          mission: {
            campaignId:
              'CAM-001',

            assignedTo:
              'UID-TARGET',
          },

          campaignId:
            'CAM-001',

          subjectPersonId:
            'PER-TARGET',

          canonicalSubjectPersonId:
            'PER-OTHER',
        }),

      /GROWTH_MISSION_SOURCE_SUBJECT_MISMATCH/
    );
  }
);


test(
  'real attendance produces canonical first-activity source',
  () => {

    const proof =
      attendanceVerifiedActivityProof({
        sourceDocumentId:
          canonicalEventAttendanceDocumentId(
            'EVT-001',
            'PER-TARGET'
          ),

        attendance: {
          campaignId:
            'CAM-001',

          eventId:
            'EVT-001',

          personId:
            'PER-TARGET',

          attended:
            true,

          checkedInAt:
            '2026-09-24T02:00:00.000Z',

          validatedByUserId:
            'UID-VALIDATOR',
        },

        campaignId:
          'CAM-001',

        subjectPersonId:
          'PER-TARGET',
      });

    assert.equal(
      proof.verifiedActivitySourceType,
      SOURCE_TYPES
        .ATTENDANCE_RECORD
    );

    assert.equal(
      proof.verifiedActivitySourceId,
      buildAttendanceSourceId({
        eventId:
          'EVT-001',

        personId:
          'PER-TARGET',
      })
    );
  }
);


test(
  'attendance document id must be canonical',
  () => {

    assert.throws(
      () =>
        attendanceVerifiedActivityProof({
          sourceDocumentId:
            'ATT-ARBITRARY',

          attendance: {
            campaignId:
              'CAM-001',

            eventId:
              'EVT-001',

            personId:
              'PER-TARGET',

            attended:
              true,

            checkedInAt:
              '2026-09-24T02:00:00.000Z',

            validatedByUserId:
              'UID-VALIDATOR',
          },

          campaignId:
            'CAM-001',

          subjectPersonId:
            'PER-TARGET',
        }),

      /GROWTH_ATTENDANCE_SOURCE_DOCUMENT_ID_MISMATCH/
    );
  }
);


test(
  'attendance without real attendance is rejected',
  () => {

    assert.throws(
      () =>
        attendanceVerifiedActivityProof({
          sourceDocumentId:
          canonicalEventAttendanceDocumentId(
            'EVT-001',
            'PER-TARGET'
          ),

          attendance: {
            campaignId:
              'CAM-001',

            eventId:
              'EVT-001',

            personId:
              'PER-TARGET',

            attended:
              false,

            checkedInAt:
              '2026-09-24T02:00:00.000Z',

            validatedByUserId:
              'UID-VALIDATOR',
          },

          campaignId:
            'CAM-001',

          subjectPersonId:
            'PER-TARGET',
        }),

      /GROWTH_ATTENDANCE_SOURCE_NOT_VERIFIED/
    );
  }
);


test(
  'person-membership growth record satisfies domain milestone',
  () => {

    const record =
      validationRecord({
        milestone:
          GROWTH_MILESTONES
            .PERSON_MEMBERSHIP,

        proof: {
          personRef:
            'persons/PER-TARGET',

          membershipRef:
            'territorialMemberships/MEM-001',
        },
      });

    const result =
      validateGrowthMilestoneFact(
        record
      );

    assert.equal(
      result.points,
      5
    );

    assert.equal(
      record.runtimeScoringEnabled,
      false
    );
  }
);


test(
  'onboarding growth record requires canonical onboarding fact',
  () => {

    const fact =
      onboardingFact();

    const record =
      validationRecord({
        milestone:
          GROWTH_MILESTONES
            .ONBOARDING,

        proof: {
          onboardingFactId:
            fact.id,

          onboardingFact:
            fact,
        },
      });

    const result =
      validateGrowthMilestoneFact(
        record
      );

    assert.equal(
      result.points,
      5
    );
  }
);


test(
  'full growth value cannot be entirely self approved by introducer',
  () => {

    const fact =
      onboardingFact();

    const missionProof = {
      firstVerifiedActivity:
        true,

      verifiedActivitySourceType:
        SOURCE_TYPES
          .MISSION_VALIDATION,

      verifiedActivitySourceId:
        buildMissionSourceId({
          missionId:
            'MIS-001',

          personId:
            'PER-TARGET',
        }),
    };

    const validations = [
      validationRecord({
        milestone:
          GROWTH_MILESTONES
            .PERSON_MEMBERSHIP,

        validator:
          'PER-INTRODUCER',

        proof: {
          personRef:
            'persons/PER-TARGET',

          membershipRef:
            'territorialMemberships/MEM-001',
        },
      }),

      validationRecord({
        milestone:
          GROWTH_MILESTONES
            .ONBOARDING,

        validator:
          'PER-INTRODUCER',

        proof: {
          onboardingFactId:
            fact.id,

          onboardingFact:
            fact,
        },
      }),

      {
        ...validationRecord({
          milestone:
            GROWTH_MILESTONES
              .FIRST_VERIFIED_ACTIVITY,

          validator:
            'PER-INTRODUCER',

          proof:
            missionProof,
        }),
      },
    ];

    assert.throws(
      () =>
        assertGrowthValidationSetPolicy(
          validations
        ),

      /GROWTH_FULL_VALUE_CANNOT_BE_SELF_APPROVED/
    );
  }
);


test(
  'existing canonical validation is reusable only in same context',
  () => {

    const record =
      validationRecord({
        milestone:
          GROWTH_MILESTONES
            .PERSON_MEMBERSHIP,

        proof: {
          personRef:
            'persons/PER-TARGET',

          membershipRef:
            'territorialMemberships/MEM-001',
        },
      });

    assert.equal(
      validateReusableExistingValidation({
        validationId:
          record.id,

        validation:
          record,

        campaignId:
          'CAM-001',

        personId:
          'PER-TARGET',

        introducedByPersonId:
          'PER-INTRODUCER',

        milestone:
          GROWTH_MILESTONES
            .PERSON_MEMBERSHIP,
      }),

      record
    );

    assert.throws(
      () =>
        validateReusableExistingValidation({
          validationId:
            record.id,

          validation:
            record,

          campaignId:
            'CAM-001',

          personId:
            'PER-OTHER',

          introducedByPersonId:
            'PER-INTRODUCER',

          milestone:
            GROWTH_MILESTONES
              .PERSON_MEMBERSHIP,
        }),

      /EXISTING_GROWTH_VALIDATION_CONTEXT_MISMATCH/
    );
  }
);


test(
  'writer has restricted write set and no scoring activation',
  () => {

    const source =
      fs.readFileSync(
        path.join(
          __dirname,
          'growth-validation-writer.cjs'
        ),
        'utf8'
      );

    const creates =
      source.match(
        /tx\.create\s*\(/g
      ) || [];

    assert.equal(
      creates.length,
      2
    );

    assert.match(
      source,
      /collection\(\s*'growthValidations'\s*\)/
    );

    assert.match(
      source,
      /collection\(\s*'logs'\s*\)/
    );

    assert.doesNotMatch(
      source,
      /tx\.set\s*\(/
    );

    assert.doesNotMatch(
      source,
      /tx\.update\s*\(/
    );

    assert.doesNotMatch(
      source,
      /collection\(\s*'contributionCandidates'\s*\)/
    );

    assert.doesNotMatch(
      source,
      /collection\(\s*'contributionLedger'\s*\)/
    );

    assert.doesNotMatch(
      source,
      /runtimeScoringEnabled\s*:\s*true/
    );

    assert.doesNotMatch(
      source,
      /pointsPosted\s*:\s*true/
    );
  }
);


test(
  'writer derives introducer server-side and does not trust client field',
  () => {

    const source =
      fs.readFileSync(
        path.join(
          __dirname,
          'growth-validation-writer.cjs'
        ),
        'utf8'
      );

    assert.match(
      source,
      /targetPerson\s*\.\s*introducedByPersonId/
    );

    assert.match(
      source,
      /targetPerson\s*\.\s*introducedByUserId/
    );

    assert.match(
      source,
      /db\.collection\(\s*'usuarios'\s*\)\.doc\(\s*introducedByUserId\s*\)/s
    );

    assert.match(
      source,
      /legacyIntroducerUser[\s\S]*?\.campaignId/
    );

    assert.doesNotMatch(
      source,
      /data\s*\.\s*introducedByPersonId/
    );

    assert.doesNotMatch(
      source,
      /request\s*\.\s*data\s*\??\.\s*introducedByPersonId/
    );

    assert.match(
      source,
      /resolveCanonicalPersonForAccount/
    );

    assert.match(
      source,
      /assertGrowthValidationSetPolicy/
    );
  }
);