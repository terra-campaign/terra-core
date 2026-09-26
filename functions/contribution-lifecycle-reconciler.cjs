"use strict";

const {
  orchestrateContributionPosting,
} = require(
  "./contribution-posting-orchestrator.cjs"
);

const {
  reverseContributionLedgerEntry,
  reactivateContributionLedgerEntry,
  confirmActiveContributionLedgerEntry,
  assertLedgerMatchesCandidateSemanticIdentity,
} = require(
  "./contribution-ledger-reversal-writer.cjs"
);


const LIFECYCLE_RECONCILER_VERSION =
  "1.0.0-foundation";

const LIFECYCLE_ACTIONS =
  Object.freeze({
    NO_OP:"NO_OP",
    ACTIVATE:"ACTIVATE",
    REVERSE:"REVERSE",
  });

function isDerivedContribution(
  result
) {
  return !!(
    result &&
    result.status === "DERIVED" &&
    result.candidate &&
    result.candidate.ledgerDraft &&
    typeof result.candidate
      .ledgerDraft.ledgerId === "string" &&
    result.candidate
      .ledgerDraft.ledgerId.trim()
  );
}

function canonicalLedgerId(
  result
) {
  if (!isDerivedContribution(result)) {
    return null;
  }

  return result.candidate
    .ledgerDraft.ledgerId.trim();
}

function planContributionLifecycleTransition({
  previousContributionResult,
  currentContributionResult,
}) {
  const previousEligible =
    isDerivedContribution(
      previousContributionResult
    );

  const currentEligible =
    isDerivedContribution(
      currentContributionResult
    );

  if (
    previousEligible &&
    currentEligible
  ) {
    return Object.freeze({
      action:
        LIFECYCLE_ACTIONS.NO_OP,
      ledgerId:
        canonicalLedgerId(
          currentContributionResult
        ),
      reason:
        "ELIGIBLE_REMAINS_ELIGIBLE",
    });
  }

  if (
    !previousEligible &&
    !currentEligible
  ) {
    return Object.freeze({
      action:
        LIFECYCLE_ACTIONS.NO_OP,
      ledgerId:null,
      reason:
        "INELIGIBLE_REMAINS_INELIGIBLE",
    });
  }

  if (
    !previousEligible &&
    currentEligible
  ) {
    return Object.freeze({
      action:
        LIFECYCLE_ACTIONS.ACTIVATE,
      ledgerId:
        canonicalLedgerId(
          currentContributionResult
        ),
      candidate:
        currentContributionResult
          .candidate,
      reason:
        "CONTRIBUTION_BECAME_ELIGIBLE",
    });
  }

  return Object.freeze({
    action:
      LIFECYCLE_ACTIONS.REVERSE,
    ledgerId:
      canonicalLedgerId(
        previousContributionResult
      ),
    candidate:
      previousContributionResult
        .candidate,
    reason:
      "CONTRIBUTION_BECAME_INELIGIBLE",
  });
}


function resolveContributionActivationAction({
  ledgerExists,
  ledger,
}) {
  if (ledgerExists !== true) {
    return Object.freeze({
      action:"POST",
      reason:"CONTRIBUTION_LEDGER_NOT_FOUND",
    });
  }

  if (
    !ledger ||
    typeof ledger !== "object" ||
    Array.isArray(ledger)
  ) {
    throw new Error(
      "CONTRIBUTION_LEDGER_LIFECYCLE_STATE_INVALID"
    );
  }

  if (
    ledger.ledgerStatus === "REVERSED" &&
    ledger.runtimeScoringEnabled === false
  ) {
    return Object.freeze({
      action:"REACTIVATE",
      reason:"CONTRIBUTION_LEDGER_REVERSED",
    });
  }

  if (
    ledger.ledgerStatus === "POSTED" &&
    ledger.runtimeScoringEnabled === true
  ) {
    return Object.freeze({
      action:"ALREADY_ACTIVE",
      reason:"CONTRIBUTION_LEDGER_ALREADY_ACTIVE",
    });
  }

  throw new Error(
    "CONTRIBUTION_LEDGER_LIFECYCLE_STATE_INVALID"
  );
}


async function reconcileContributionLifecycleCore({
  db,
  actorUid,
  operationId,
  previousContributionResult,
  currentContributionResult,
  runtime,
}) {
  if (
    !runtime ||
    typeof runtime !== "object"
  ) {
    throw new Error(
      "LIFECYCLE_RUNTIME_REQUIRED"
    );
  }

  const transition =
    planContributionLifecycleTransition({
      previousContributionResult,
      currentContributionResult,
    });

  if (
    transition.action ===
    LIFECYCLE_ACTIONS.NO_OP
  ) {
    return Object.freeze({
      action:"NO_OP",
      ledgerId:
        transition.ledgerId || null,
      reason:
        transition.reason,
    });
  }

  if (
    transition.action ===
    LIFECYCLE_ACTIONS.REVERSE
  ) {
    if (
      typeof runtime.reverseContribution !==
      "function"
    ) {
      throw new Error(
        "LIFECYCLE_REVERSE_WRITER_REQUIRED"
      );
    }

    const result =
      await runtime.reverseContribution({
        db,
        actorUid,
        ledgerId:
          transition.ledgerId,
        reason:
          "CONTRIBUTION_BECAME_INELIGIBLE",
        operationId,
      });

    return Object.freeze({
      action:"REVERSE",
      ledgerId:
        transition.ledgerId,
      result,
    });
  }

  if (
    transition.action !==
    LIFECYCLE_ACTIONS.ACTIVATE
  ) {
    throw new Error(
      "LIFECYCLE_ACTION_UNSUPPORTED"
    );
  }

  if (
    typeof runtime.readLedger !==
    "function"
  ) {
    throw new Error(
      "LIFECYCLE_LEDGER_READER_REQUIRED"
    );
  }

  const ledgerState =
    await runtime.readLedger({
      db,
      ledgerId:
        transition.ledgerId,
    });

  if (
    !ledgerState ||
    typeof ledgerState !== "object"
  ) {
    throw new Error(
      "LIFECYCLE_LEDGER_STATE_REQUIRED"
    );
  }

  const activation =
    resolveContributionActivationAction({
      ledgerExists:
        ledgerState.exists === true,
      ledger:
        ledgerState.ledger || null,
    });

  if (activation.action === "POST") {
    if (
      typeof runtime.postContribution !==
      "function"
    ) {
      throw new Error(
        "LIFECYCLE_POST_WRITER_REQUIRED"
      );
    }

    const result =
      await runtime.postContribution({
        db,
        actorUid,
        candidate:
          transition.candidate,
      });

    return Object.freeze({
      action:"POST",
      ledgerId:
        transition.ledgerId,
      result,
    });
  }

  if (
    activation.action ===
    "REACTIVATE"
  ) {
    if (
      typeof runtime
        .reactivateContribution !==
      "function"
    ) {
      throw new Error(
        "LIFECYCLE_REACTIVATION_WRITER_REQUIRED"
      );
    }

    const result =
      await runtime
        .reactivateContribution({
          db,
          actorUid,
          ledgerId:
            transition.ledgerId,
          operationId,
          candidate:
            transition.candidate,
        });

    return Object.freeze({
      action:"REACTIVATE",
      ledgerId:
        transition.ledgerId,
      result,
    });
  }

  if (
    activation.action ===
    "ALREADY_ACTIVE"
  ) {
    if (
      typeof runtime.confirmActiveContribution !==
        "function"
    ) {
      throw new Error(
        "LIFECYCLE_ACTIVE_CONFIRMATION_REQUIRED"
      );
    }

    await runtime.confirmActiveContribution({
      db,
      actorUid,
      ledgerId:
        transition.ledgerId,
      candidate:
        transition.candidate,
    });

    return Object.freeze({
      action:"ALREADY_ACTIVE",
      ledgerId:
        transition.ledgerId,
      reason:
        activation.reason,
    });
  }

  throw new Error(
    "LIFECYCLE_ACTIVATION_ACTION_UNSUPPORTED"
  );
}


async function readContributionLedgerState({
  db,
  ledgerId,
}) {
  if (!db || typeof db.collection !== "function") {
    throw new Error("LIFECYCLE_DATABASE_REQUIRED");
  }

  if (
    typeof ledgerId !== "string" ||
    !ledgerId.trim()
  ) {
    throw new Error("LIFECYCLE_LEDGER_ID_REQUIRED");
  }

  const snapshot =
    await db
      .collection("contributionLedger")
      .doc(ledgerId.trim())
      .get();

  if (!snapshot || snapshot.exists !== true) {
    return Object.freeze({
      exists:false,
      ledger:null,
    });
  }

  const ledger =
    typeof snapshot.data === "function"
      ? snapshot.data()
      : null;

  if (!ledger || typeof ledger !== "object") {
    throw new Error("LIFECYCLE_LEDGER_DATA_INVALID");
  }

  return Object.freeze({
    exists:true,
    ledger,
  });
}

async function reconcileContributionLifecycle({
  db,
  actorUid,
  operationId,
  previousContributionResult,
  currentContributionResult,
}) {
  return reconcileContributionLifecycleCore({
    db,
    actorUid,
    operationId,
    previousContributionResult,
    currentContributionResult,

    runtime:Object.freeze({
      readLedger:
        readContributionLedgerState,

      postContribution:
        orchestrateContributionPosting,

      reverseContribution:
        reverseContributionLedgerEntry,

      reactivateContribution:
        reactivateContributionLedgerEntry,

      confirmActiveContribution:
        confirmActiveContributionLedgerEntry,
    }),
  });
}


module.exports = {
  LIFECYCLE_RECONCILER_VERSION,
  LIFECYCLE_ACTIONS,
  planContributionLifecycleTransition,
  resolveContributionActivationAction,
  reconcileContributionLifecycle,

  _test:
    Object.freeze({
      reconcileContributionLifecycleCore,
    }),
};
