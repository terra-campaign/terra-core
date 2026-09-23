"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  createHash,
} =
  require("node:crypto");

const {
  CANDIDATE_STATUSES,
  buildMissionContributionCandidate,
  buildAttendanceContributionCandidate,
} =
  require("./contribution-candidate.cjs");

function attendanceId(
  eventId,
  personId
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "event-attendance",
        eventId,
        personId,
      ])
    )
    .digest("hex");
}

function missionInput({
  activityCode = null,
} = {}) {
  const mission = {
    id:
      "MIS-001",

    campaignId:
      "CAM-001",

    assignedTo:
      "UID-001",

    title:
      "Brigadeo territorial",
  };

  if (activityCode) {
    mission.activityCode =
      activityCode;
  }

  return {
    mission,

    evidence: {
      id:
        "EVID-001",

      campaignId:
        "CAM-001",

      missionId:
        "MIS-001",

      uploadedBy:
        "UID-001",

      assignedTo:
        "UID-001",
    },

    review: {
      campaignId:
        "CAM-001",

      missionId:
        "MIS-001",

      evidenceId:
        "EVID-001",

      subjectId:
        "UID-001",

      status:
        "validated",

      pendingAppeal:
        false,

      updatedAt:
        1000,
    },

    reviewId:
      "EVID-001",

    canonicalIdentity: {
      personId:
        "PER-001",

      accountUid:
        "UID-001",
    },
  };
}

function attendanceInput({
  activityCode = null,
} = {}) {
  const eventId =
    "EVT-001";

  const personId =
    "PER-001";

  const event = {
    id:
      eventId,

    campaignId:
      "CAM-001",

    title:
      "Evento general",
  };

  if (activityCode) {
    event.activityCode =
      activityCode;
  }

  return {
    attendanceId:
      attendanceId(
        eventId,
        personId
      ),

    event,

    attendance: {
      campaignId:
        "CAM-001",

      eventId,

      personId,

      attended:
        true,

      validatedByUserId:
        "UID-VALIDATOR",

      checkedInAt:
        "2026-09-23T02:00:00.000Z",
    },
  };
}

test(
  "mission title never infers activity",
  () => {
    const candidate =
      buildMissionContributionCandidate({
        ...missionInput(),

        activityCode:
          "TERRITORIAL_BRIGADE",
      });

    assert.equal(
      candidate.candidateStatus,
      CANDIDATE_STATUSES
        .UNCLASSIFIED
    );

    assert.equal(
      candidate.activityCode,
      null
    );

    assert.equal(
      candidate.points,
      null
    );

    assert.equal(
      candidate.ledgerDraft,
      null
    );

    assert.equal(
      candidate.runtimePostingEnabled,
      false
    );
  }
);

test(
  "mission classification comes from mission activityCode",
  () => {
    const candidate =
      buildMissionContributionCandidate(
        missionInput({
          activityCode:
            "TERRITORIAL_BRIGADE",
        })
      );

    assert.equal(
      candidate.candidateStatus,
      CANDIDATE_STATUSES
        .ELIGIBLE_DRAFT
    );

    assert.equal(
      candidate.activityCode,
      "TERRITORIAL_BRIGADE"
    );

    assert.equal(
      candidate.points,
      30
    );

    assert.equal(
      candidate
        .ledgerDraft
        .ledgerStatus,
      "DRAFT_NOT_POSTABLE"
    );
  }
);

test(
  "mission canonical identity is authoritative",
  () => {
    const input =
      missionInput();

    input.personId =
      "PER-WRONG";

    input.accountUid =
      "UID-WRONG";

    const candidate =
      buildMissionContributionCandidate(
        input
      );

    assert.equal(
      candidate.personId,
      "PER-001"
    );

    assert.equal(
      candidate.sourceId,
      "mission:MIS-001:person:PER-001"
    );
  }
);

test(
  "mission requires canonical identity object",
  () => {
    const input =
      missionInput();

    delete input.canonicalIdentity;

    assert.throws(
      () =>
        buildMissionContributionCandidate(
          input
        ),
      /INVALID_CANONICAL_IDENTITY/
    );
  }
);

test(
  "canonical account must match mission assignment",
  () => {
    const input =
      missionInput();

    input.canonicalIdentity.accountUid =
      "UID-OTHER";

    assert.throws(
      () =>
        buildMissionContributionCandidate(
          input
        ),
      /MISSION_ASSIGNEE_MISMATCH/
    );
  }
);

test(
  "generic candidate builder rejects maximum-point rule",
  () => {
    const input =
      missionInput({
        activityCode:
          "ORGANIZATIONAL_GROWTH",
      });

    assert.throws(
      () =>
        buildMissionContributionCandidate(
          input
        ),
      /NON_FIXED_ACTIVITY_REQUIRES_SPECIALIZED_ADAPTER/
    );
  }
);

test(
  "mission review must be validated and final",
  () => {
    const rejected =
      missionInput();

    rejected.review.status =
      "rejected";

    assert.throws(
      () =>
        buildMissionContributionCandidate(
          rejected
        ),
      /MISSION_NOT_VALIDATED/
    );

    const appealed =
      missionInput();

    appealed.review.pendingAppeal =
      true;

    assert.throws(
      () =>
        buildMissionContributionCandidate(
          appealed
        ),
      /MISSION_PENDING_APPEAL/
    );
  }
);

test(
  "mission evidence campaign must match mission campaign",
  () => {
    const input =
      missionInput();

    input.evidence.campaignId =
      "CAM-OTHER";

    assert.throws(
      () =>
        buildMissionContributionCandidate(
          input
        ),
      /MISSION_EVIDENCE_CAMPAIGN_MISMATCH/
    );
  }
);

test(
  "mission review campaign must match mission campaign",
  () => {
    const input =
      missionInput();

    input.review.campaignId =
      "CAM-OTHER";

    assert.throws(
      () =>
        buildMissionContributionCandidate(
          input
        ),
      /MISSION_REVIEW_CAMPAIGN_MISMATCH/
    );
  }
);

test(
  "mission operational account must match assignment evidence and review",
  () => {
    const assignment =
      missionInput();

    assignment.mission.assignedTo =
      "UID-OTHER";

    assert.throws(
      () =>
        buildMissionContributionCandidate(
          assignment
        ),
      /MISSION_ASSIGNEE_MISMATCH/
    );

    const evidence =
      missionInput();

    evidence.evidence.uploadedBy =
      "UID-OTHER";

    assert.throws(
      () =>
        buildMissionContributionCandidate(
          evidence
        ),
      /MISSION_EVIDENCE_SUBJECT_MISMATCH/
    );

    const review =
      missionInput();

    review.review.subjectId =
      "UID-OTHER";

    assert.throws(
      () =>
        buildMissionContributionCandidate(
          review
        ),
      /MISSION_REVIEW_SUBJECT_MISMATCH/
    );
  }
);

test(
  "mission review document id must equal evidence id",
  () => {
    const input =
      missionInput();

    input.reviewId =
      "OTHER-REVIEW-ID";

    assert.throws(
      () =>
        buildMissionContributionCandidate(
          input
        ),
      /MISSION_REVIEW_DOCUMENT_ID_MISMATCH/
    );
  }
);

test(
  "event title never infers attendance activity",
  () => {
    const candidate =
      buildAttendanceContributionCandidate({
        ...attendanceInput(),

        activityCode:
          "EVENT_GENERAL_ATTENDANCE",
      });

    assert.equal(
      candidate.candidateStatus,
      CANDIDATE_STATUSES
        .UNCLASSIFIED
    );

    assert.equal(
      candidate.activityCode,
      null
    );

    assert.equal(
      candidate.points,
      null
    );
  }
);

test(
  "attendance classification comes from event activityCode",
  () => {
    const candidate =
      buildAttendanceContributionCandidate(
        attendanceInput({
          activityCode:
            "EVENT_GENERAL_ATTENDANCE",
        })
      );

    assert.equal(
      candidate.candidateStatus,
      CANDIDATE_STATUSES
        .ELIGIBLE_DRAFT
    );

    assert.equal(
      candidate.activityCode,
      "EVENT_GENERAL_ATTENDANCE"
    );

    assert.equal(
      candidate.points,
      30
    );

    assert.equal(
      candidate
        .ledgerDraft
        .ledgerStatus,
      "DRAFT_NOT_POSTABLE"
    );
  }
);

test(
  "attendance event relation and campaign are enforced",
  () => {
    const relation =
      attendanceInput();

    relation.event.id =
      "EVT-OTHER";

    assert.throws(
      () =>
        buildAttendanceContributionCandidate(
          relation
        ),
      /ATTENDANCE_EVENT_MISMATCH/
    );

    const campaign =
      attendanceInput();

    campaign.event.campaignId =
      "CAM-OTHER";

    assert.throws(
      () =>
        buildAttendanceContributionCandidate(
          campaign
        ),
      /ATTENDANCE_EVENT_CAMPAIGN_MISMATCH/
    );
  }
);

test(
  "attendance identity must be canonical",
  () => {
    const input =
      attendanceInput();

    input.attendanceId =
      "legacy-id";

    assert.throws(
      () =>
        buildAttendanceContributionCandidate(
          input
        ),
      /ATTENDANCE_ID_NOT_CANONICAL/
    );
  }
);

test(
  "attendance person comes from canonical attendance fact",
  () => {
    const input =
      attendanceInput();

    input.personId =
      "PER-WRONG";

    const candidate =
      buildAttendanceContributionCandidate(
        input
      );

    assert.equal(
      candidate.personId,
      "PER-001"
    );

    assert.equal(
      candidate.sourceId,
      "event-attendance:EVT-001:person:PER-001"
    );
  }
);

test(
  "attendance requires nonblank canonical personId",
  () => {
    const input =
      attendanceInput();

    input.attendance.personId =
      " ";

    assert.throws(
      () =>
        buildAttendanceContributionCandidate(
          input
        ),
      /INVALID_PERSON_ID/
    );
  }
);
