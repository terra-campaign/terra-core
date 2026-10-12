"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const target = path.resolve(
  __dirname,
  "mission-smart-assignment-read.cjs"
);

const db = { testDatabase: true };
let mode = "ok";
let received = null;
let calls = 0;

class TestHttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
  if (parent && parent.filename === target) {

    if (request === "firebase-functions/v2/https") {
      return {
        onCall: (options, handler) => handler,
        HttpsError: TestHttpsError
      };
    }

    if (request === "firebase-admin/firestore") {
      return { getFirestore: () => db };
    }

    if (
      request ===
      "./mission-smart-assignment-authenticated.cjs"
    ) {
      return {
        discoverSmartAssignmentPublicAuthenticated:
          async options => {
            calls++;
            received = options;

            if (mode === "denied") {
              throw new Error(
                "smart-assignment-permission-denied"
              );
            }

            if (mode === "failure") {
              throw new Error("private-internal-detail");
            }

            return {
              ok: true,
              activityCode: "OPERATIONAL_ACCOMPANIMENT",
              eligible: []
            };
          }
      };
    }
  }

  return originalLoad.apply(this, arguments);
};

let callable;

try {
  callable = require(target).getSmartAssignmentCandidates;
} finally {
  Module._load = originalLoad;
}

test("B8 callable exportada", () => {
  assert.equal(typeof callable, "function");
});

test("Rechaza usuario sin autenticacion", async () => {
  await assert.rejects(
    callable({
      auth: null,
      data: { activityCode: "TEST" }
    }),
    error => error.code === "unauthenticated"
  );

  assert.equal(calls, 0);
});

test("Rechaza actividad invalida", async () => {
  for (const data of [
    null,
    {},
    [],
    { activityCode: 123 },
    { activityCode: "   " },
    { activityCode: "X".repeat(101) }
  ]) {
    await assert.rejects(
      callable({ auth: { uid: "test" }, data }),
      error => error.code === "invalid-argument"
    );
  }

  assert.equal(calls, 0);
});

test("No confia en identidades del navegador", async () => {
  mode = "ok";

  const request = {
    auth: { uid: "jefe-autenticado" },
    data: {
      activityCode: "TEST",
      campaignId: "CAMPANA_AJENA",
      actorPersonId: "PERSONA_AJENA",
      maxCandidates: 999999
    }
  };

  const result = await callable(request);

  assert.equal(result.ok, true);
  assert.deepEqual(result.eligible, []);

  assert.strictEqual(received.request, request);
  assert.strictEqual(received.db, db);
  assert.equal(received.activityCode, "TEST");

  assert.deepEqual(
    Object.keys(received).sort(),
    ["activityCode", "db", "request"]
  );
});

test("Rechaza acceso sin permisos", async () => {
  mode = "denied";

  await assert.rejects(
    callable({
      auth: { uid: "usuario-no-autorizado" },
      data: { activityCode: "TEST" }
    }),
    error => error.code === "permission-denied"
  );
});

test("No revela errores internos al cliente", async () => {
  mode = "failure";

  const previousLog = console.error;
  console.error = () => {};

  try {
    await assert.rejects(
      callable({
        auth: { uid: "jefe-autenticado" },
        data: { activityCode: "TEST" }
      }),
      error =>
        error.code === "failed-precondition" &&
        !error.message.includes("private-internal-detail")
    );
  } finally {
    console.error = previousLog;
  }
});