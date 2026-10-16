"use strict";

// 19E: server-side eligibility of mission fulfilment evidence.
// The absence of startAt is grandfathered for historical missions;
// a present but malformed startAt fails closed.
const TIMING_RESULTS = Object.freeze({
  LEGACY_ALLOWED: "LEGACY_ALLOWED",
  ELIGIBLE: "ELIGIBLE",
  MISSION_NOT_STARTED: "MISSION_NOT_STARTED",
  EVIDENCE_BEFORE_MISSION_START: "EVIDENCE_BEFORE_MISSION_START",
  INVALID_START_AT: "INVALID_START_AT",
  INVALID_EVIDENCE_CREATED_AT: "INVALID_EVIDENCE_CREATED_AT",
});

function timestampMillis(value) {
  if (value instanceof Date) {
    const result = value.getTime();
    return Number.isFinite(result) && result > 0 ? result : null;
  }
  if (value && typeof value === "object") {
    if (typeof value.toMillis === "function") {
      try {
        return timestampMillis(value.toMillis());
      } catch { return null; }
    }
    const seconds = value.seconds ?? value._seconds;
    const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
    if (Number.isInteger(seconds) && seconds > 0 &&
        Number.isInteger(nanos) && nanos >= 0 && nanos < 1e9) {
      const result = seconds * 1000 + Math.floor(nanos / 1e6);
      return Number.isSafeInteger(result) ? result : null;
    }
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    // Support the 10-digit Unix-seconds encoding used by older writers.
    if (value >= 946684800 && value < 1e11) return value * 1000;
    return value >= 1e11 ? value : null;
  }
  if (typeof value === "string" && /^\d{10}$|^\d{13}$/.test(value)) {
    return timestampMillis(Number(value));
  }
  if (typeof value === "string" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/i.test(value)) {
    const result = Date.parse(value);
    return Number.isFinite(result) && result > 0 ? result : null;
  }
  return null;
}

function evaluateMissionContributionTiming({ mission, evidence, now = Date.now() }) {
  if (!mission || typeof mission !== "object" ||
      !evidence || typeof evidence !== "object") {
    return Object.freeze({eligible:false, reasonCode:TIMING_RESULTS.INVALID_START_AT});
  }
  // Legacy missions without startAt keep their pre-19E treatment.
  if (mission.startAt == null) {
    return Object.freeze({eligible:true, reasonCode:TIMING_RESULTS.LEGACY_ALLOWED});
  }
  const start = timestampMillis(mission.startAt);
  if (start === null) {
    return Object.freeze({eligible:false, reasonCode:TIMING_RESULTS.INVALID_START_AT});
  }
  const created = timestampMillis(evidence.createdAt);
  if (created === null) {
    return Object.freeze({eligible:false, reasonCode:TIMING_RESULTS.INVALID_EVIDENCE_CREATED_AT});
  }
  if (created < start) {
    return Object.freeze({eligible:false, reasonCode:TIMING_RESULTS.EVIDENCE_BEFORE_MISSION_START});
  }
  const current = timestampMillis(now);
  if (current === null) {
    return Object.freeze({eligible:false, reasonCode:TIMING_RESULTS.INVALID_START_AT});
  }
  if (current < start) {
    return Object.freeze({eligible:false, reasonCode:TIMING_RESULTS.MISSION_NOT_STARTED});
  }
  return Object.freeze({eligible:true, reasonCode:TIMING_RESULTS.ELIGIBLE});
}

module.exports = {TIMING_RESULTS, timestampMillis, evaluateMissionContributionTiming};
