"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  TIMING_RESULTS,
  timestampMillis,
  evaluateMissionContributionTiming: check,
} = require("./mission-contribution-timing.cjs");
const START = Date.parse("2026-10-20T19:00:00Z");
const EVIDENCE = Date.parse("2026-10-16T19:25:08Z");

test("historical mission without startAt retains old behavior", () => {
  assert.deepEqual(check({mission:{},evidence:{},now:START}),
    {eligible:true,reasonCode:TIMING_RESULTS.LEGACY_ALLOWED});
});
test("19D case remains ineligible after start, because evidence was uploaded early", () => {
  assert.deepEqual(check({mission:{startAt:START}, evidence:{createdAt:EVIDENCE}, now:START+10_000}),
    {eligible:false,reasonCode:TIMING_RESULTS.EVIDENCE_BEFORE_MISSION_START});
});
test("future mission cannot be validated even with forged future evidence date", () => {
  assert.equal(check({mission:{startAt:START},evidence:{createdAt:START},now:EVIDENCE}).reasonCode,
    TIMING_RESULTS.MISSION_NOT_STARTED);
});
test("on-time evidence after mission start is eligible", () => {
  assert.equal(check({mission:{startAt:START},evidence:{createdAt:START},now:START}).eligible,true);
  assert.equal(check({mission:{startAt:new Date(START).toISOString()},evidence:{createdAt:START+1},now:START+2}).eligible,true);
});
test("Firestore Timestamp/Date sources are compared in milliseconds", () => {
  assert.equal(timestampMillis({seconds:Math.floor(START/1000),nanoseconds:0}),START);
  assert.equal(timestampMillis({toMillis:()=>START}),START);
  assert.equal(timestampMillis(new Date(START)),START);
  assert.equal(timestampMillis(Math.floor(START/1000)),START);
  assert.equal(timestampMillis(String(Math.floor(START/1000))),START);
  assert.equal(check({mission:{startAt:{_seconds:Math.floor(START/1000),_nanoseconds:0}},
    evidence:{createdAt:{toMillis:()=>START+1}},now:START+3}).eligible,true);
});
test("present but invalid timing never falls back to legacy", () => {
  assert.equal(check({mission:{startAt:""},evidence:{createdAt:START},now:START}).reasonCode,
    TIMING_RESULTS.INVALID_START_AT);
  assert.equal(check({mission:{startAt:"2026-10-20"},evidence:{createdAt:START},now:START}).eligible,false);
  assert.equal(check({mission:{startAt:START},evidence:{},now:START}).reasonCode,
    TIMING_RESULTS.INVALID_EVIDENCE_CREATED_AT);
});
test("review callable guards validated action, not rejection/correction", () => {
  const source = fs.readFileSync(path.join(__dirname,"mission-review.cjs"),"utf8");
  assert.match(source,/d\.action !== 'request' && d\.status === 'validated'/);
  assert.match(source,/evaluateMissionContributionTiming\(\{mission:c\.m,evidence:c\.e,now\}\)/);
  const checkPosition = source.indexOf("evaluateMissionContributionTiming({mission:c.m");
  const writePosition = source.indexOf("createRecoveryRecordInTransaction({",checkPosition);
  assert.ok(checkPosition >= 0 && writePosition > checkPosition,
    "timing check must run before writing the recovery and decision");
});
test("recovery projections preserve authoritative mission startAt", () => {
  const {projectMissionContributionRecoveryFacts} = require("./contribution-reconciliation-recovery.cjs");
  const facts = projectMissionContributionRecoveryFacts({
    mission:{id:"M",campaignId:"C",assignedTo:"U",startAt:START,secret:"not-projected"},
    evidence:{id:"E",campaignId:"C",missionId:"M",uploadedBy:"U",createdAt:EVIDENCE},
    currentReview:{campaignId:"C",missionId:"M",evidenceId:"E",subjectId:"U",status:"validated"},
    previousReview:null,reviewId:"E",
  });
  assert.equal(facts.mission.startAt,START);
  assert.equal(facts.mission.secret,undefined);
  assert.equal(facts.evidence.createdAt,EVIDENCE);
});

test("bridge blocks posting before identity resolution, but can derive an earlier historical review for explicit reversal",async () => {
  const filename = path.join(__dirname,"contribution-verified-fact-bridge.cjs");
  const source = fs.readFileSync(filename,"utf8");
  let candidateCalls = 0;
  const module = {exports:{}};
  vm.runInNewContext(source,{
    module,exports:module.exports,require(specifier){
      if (specifier === "./mission-contribution-timing.cjs") return require(specifier);
      if (specifier === "./contribution-candidate.cjs") return {
        buildMissionContributionCandidate:()=>{candidateCalls++;return {marker:"candidate"};},
        buildAttendanceContributionCandidate:()=>({marker:"attendance"}),
      };
      throw Error("Unexpected dependency: "+specifier);
    },Object,Error,
  },{filename});
  const bridge = module.exports;
  let identityCalls = 0;
  const input = {
    db:{},mission:{startAt:START},evidence:{createdAt:EVIDENCE},
    review:{status:"validated",pendingAppeal:false},reviewId:"E",subjectProfile:{},
    resolveCanonicalIdentity:async()=>{identityCalls++;return {personId:"P"};},
  };
  const early = await bridge.deriveMissionContributionCandidateSafely(input);
  assert.equal(early.status,"NOT_ELIGIBLE");
  assert.equal(early.reasonCode,TIMING_RESULTS.EVIDENCE_BEFORE_MISSION_START);
  assert.equal(identityCalls,0);
  assert.equal(candidateCalls,0);
  const historical = await bridge.deriveMissionContributionCandidateSafely({
    ...input,ignoreTemporalEligibility:true,
  });
  assert.equal(historical.status,"DERIVED");
  assert.equal(identityCalls,1);
  assert.equal(candidateCalls,1);
});

test("processor bypass is restricted to previous contribution only", () => {
  const source=fs.readFileSync(path.join(__dirname,"contribution-reconciliation-recovery-processor.cjs"),"utf8");
  assert.match(source,/record\.previousReviewFact[\s\S]*?ignoreTemporalEligibility:true/);
  assert.equal((source.match(/ignoreTemporalEligibility:true/g)||[]).length,1);
  assert.match(source,/ignoreTemporalEligibility = false/);
});
