"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canonicalMembershipDocumentId
} = require("./territorial-membership-id.cjs");

const {
  querySmartAssignmentDescendantMemberships: query
} = require("./mission-smart-assignment-firestore.cjs");

const campaignId = "CAM-B83";
const actorPersonId = "JEFE-B83";

const actorMembership = {
  membershipId: canonicalMembershipDocumentId(
    campaignId,
    actorPersonId
  ),
  campaignId,
  personId: actorPersonId,
  role: "jefe_estructura",
  active: true,
  municipalityId: "MUN-1",
  structureId: "EST-1"
};

function fakeDb({
  actor = actorMembership,
  descendants = [],
  snapshotSize
} = {}) {
  const calls = [];

  const db = {
    collection(name) {
      assert.equal(name, "territorialMemberships");

      return {
        doc(id) {
          calls.push(["doc", id]);

          return {
            async get() {
              return {
                id,
                exists: Boolean(actor),
                data: () => actor
              };
            }
          };
        },

        where(field, op, value) {
          calls.push(["where", field, op, value]);

          const chain = {
            where(nextField, nextOp, nextValue) {
              calls.push([
                "where",
                nextField,
                nextOp,
                nextValue
              ]);
              return chain;
            },

            limit(value) {
              calls.push(["limit", value]);
              return chain;
            },

            async get() {
              const docs = descendants.map((membership, i) => ({
                id: membership.membershipId || `DOC-${i}`,
                data: () => membership
              }));

              return {
                size: snapshotSize === undefined
                  ? docs.length
                  : snapshotSize,
                docs
              };
            }
          };

          return chain;
        }
      };
    }
  };

  return { db, calls };
}

const base = {
  campaignId,
  actorPersonId
};

test("Consulta valida y completa", async () => {
  const candidate = {
    personId: "INTEGRANTE-1",
    campaignId,
    active: true,
    role: "integrante",
    membershipId: canonicalMembershipDocumentId(
      campaignId,
      "INTEGRANTE-1"
    )
  };

  const {db, calls} = fakeDb({
    descendants: [candidate]
  });

  const result = await query({...base, db});

  assert.equal(result.complete, true);
  assert.equal(result.memberships.length, 1);
  assert.equal(result.actorMembership.personId, actorPersonId);

  assert.deepEqual(
    calls.filter(c => c[0] === "where"),
    [
      ["where", "campaignId", "==", campaignId],
      [
        "where",
        "ancestorPersonIds",
        "array-contains",
        actorPersonId
      ]
    ]
  );
});

test("Rechaza identidad de consulta invalida", async () => {
  const {db} = fakeDb();

  await assert.rejects(
    query({...base, db, actorPersonId: "../otro"}),
    /invalid-smart-assignment-query/
  );
});

test("Rechaza responsable inexistente", async () => {
  const {db} = fakeDb({actor: null});

  await assert.rejects(
    query({...base, db}),
    /invalid-actor-membership/
  );
});

test("Rechaza rol distinto de jefe", async () => {
  const {db} = fakeDb({
    actor: {...actorMembership, role: "integrante"}
  });

  await assert.rejects(
    query({...base, db}),
    /invalid-actor-membership/
  );
});

test("Rechaza responsable inactivo", async () => {
  const {db} = fakeDb({
    actor: {...actorMembership, active: false}
  });

  await assert.rejects(
    query({...base, db}),
    /invalid-actor-membership/
  );
});

test("Rechaza alcance territorial incompleto", async () => {
  const {db} = fakeDb({
    actor: {...actorMembership, structureId: null}
  });

  await assert.rejects(
    query({...base, db}),
    /invalid-actor-territorial-scope/
  );
});

test("Rechaza resultado truncado", async () => {
  const descendants = [
    {personId: "P1"},
    {personId: "P2"},
    {personId: "P3"}
  ];

  const {db, calls} = fakeDb({descendants});

  await assert.rejects(
    query({...base, db, maxCandidates: 2}),
    /incomplete-smart-assignment-candidate-set/
  );

  assert.ok(
    calls.some(c =>
      c[0] === "limit" && c[1] === 3
    )
  );
});

test("Rechaza metadatos inconsistentes de consulta", async () => {
  const {db} = fakeDb({
    descendants: [{personId: "P1"}],
    snapshotSize: 2
  });

  await assert.rejects(
    query({...base, db}),
    /incomplete-smart-assignment-candidate-set/
  );
});

test("Rechaza limite no permitido", async () => {
  const {db} = fakeDb();

  await assert.rejects(
    query({...base, db, maxCandidates: 1001}),
    /invalid-smart-assignment-query/
  );
});
