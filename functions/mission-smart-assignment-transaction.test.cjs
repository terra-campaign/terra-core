"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canonicalMembershipDocumentId
} = require("./territorial-membership-id.cjs");

const {
  discoverSmartAssignmentConsistently
} = require("./mission-smart-assignment-transaction.cjs");

const campaignId = "CAM-B83-TX";
const actorPersonId = "J";
const actorId = canonicalMembershipDocumentId(
  campaignId,
  actorPersonId
);

const actor = {
  campaignId,
  personId: actorPersonId,
  role: "jefe_estructura",
  parentPersonId: "C",
  ancestorPersonIds: ["C"],
  municipalityId: "MUN-1",
  structureId: "EST-1",
  active: true,
  accountUid: null
};

function simulatedFirestore() {
  const calls = {
    transactions: 0,
    transactionReads: [],
    directReads: 0,
    options: null
  };

  const actorRef = {
    kind: "actor",
    async get() {
      calls.directReads++;
      throw new Error("direct-read-forbidden");
    }
  };

  const queryRef = {
    kind: "descendants",
    where() { return this; },
    limit() { return this; },
    async get() {
      calls.directReads++;
      throw new Error("direct-read-forbidden");
    }
  };

  const db = {
    collection(name) {
      assert.equal(name, "territorialMemberships");

      return {
        doc(id) {
          assert.equal(id, actorId);
          return actorRef;
        },
        where() {
          return queryRef;
        }
      };
    },

    async runTransaction(callback, options) {
      calls.transactions++;
      calls.options = options;

      const tx = {
        async get(reference) {
          calls.transactionReads.push(reference.kind);

          if (reference === actorRef) {
            return {
              id: actorId,
              exists: true,
              data: () => actor
            };
          }

          if (reference === queryRef) {
            return {
              docs: [],
              size: 0
            };
          }

          throw new Error("unexpected-transaction-reference");
        }
      };

      return callback(tx);
    }
  };

  return {db, calls};
}

test("Ejecuta una transaccion de solo lectura", async () => {
  const {db, calls} = simulatedFirestore();

  const result = await discoverSmartAssignmentConsistently({
    db,
    campaignId,
    actorPersonId,
    activityCode: "MATERIAL_DISTRIBUTION"
  });

  assert.equal(result.ok, true);
  assert.equal(result.internalOnly, true);
  assert.deepEqual(result.eligible, []);

  assert.equal(calls.transactions, 1);
  assert.deepEqual(calls.options, {readOnly: true});
  assert.deepEqual(
    calls.transactionReads,
    ["actor", "descendants"]
  );
  assert.equal(calls.directReads, 0);
});

test("Rechaza Firestore sin runTransaction", async () => {
  await assert.rejects(
    discoverSmartAssignmentConsistently({
      db: {collection() {}},
      campaignId,
      actorPersonId,
      activityCode: "MATERIAL_DISTRIBUTION"
    }),
    /invalid-smart-assignment-transaction-db/
  );
});

test("Rechaza transaccion sin tx.get", async () => {
  const {db} = simulatedFirestore();

  db.runTransaction = async callback => callback({});

  await assert.rejects(
    discoverSmartAssignmentConsistently({
      db,
      campaignId,
      actorPersonId,
      activityCode: "MATERIAL_DISTRIBUTION"
    }),
    /invalid-smart-assignment-transaction/
  );
});

test("Transaccion multinivel sin lecturas externas", async () => {
  const memberships = [
    {...actor, membershipId: actorId},
    {
      ...actor,
      membershipId: canonicalMembershipDocumentId(campaignId, "I"),
      personId: "I",
      role: "integrante",
      parentPersonId: "J",
      ancestorPersonIds: ["J", "C"]
    },
    {
      ...actor,
      membershipId: canonicalMembershipDocumentId(campaignId, "P"),
      personId: "P",
      role: "participante",
      parentPersonId: "I",
      ancestorPersonIds: ["I", "J", "C"]
    }
  ];

  const byId = new Map(
    memberships.map(m => [m.membershipId, m])
  );

  const persons = new Map(
    ["I", "P"].map(id => [id, {
      personId: id,
      campaignId,
      name: "Persona " + id,
      active: true,
      accountUid: null
    }])
  );

  const calls = {
    transactions: 0,
    reads: [],
    directReads: 0,
    writes: 0
  };

  function reference(kind, id) {
    return {
      kind,
      id,
      async get() {
        calls.directReads++;
        throw new Error("direct-read-forbidden");
      }
    };
  }

  const db = {
    collection(name) {
      if (name === "persons") {
        return {
          doc(id) {
            return reference("person", id);
          }
        };
      }

      assert.equal(name, "territorialMemberships");

      return {
        doc(id) {
          return reference("membership", id);
        },
        where(field, op, value) {
          assert.equal(field, "campaignId");
          assert.equal(op, "==");
          assert.equal(value, campaignId);

          return {
            where(f, o, v) {
              assert.equal(f, "ancestorPersonIds");
              assert.equal(o, "array-contains");
              assert.equal(v, "J");
              return this;
            },
            limit(n) {
              assert.ok(n >= 3);
              return reference("query", "descendants");
            }
          };
        }
      };
    },

    async runTransaction(callback, options) {
      calls.transactions++;
      assert.deepEqual(options, {readOnly: true});

      return callback({
        async get(ref) {
          calls.reads.push(ref.kind);

          if (ref.kind === "query") {
            const docs = memberships.slice(1).map(m => ({
              id: m.membershipId,
              data: () => m
            }));
            return {docs, size: docs.length};
          }

          const records = ref.kind === "person" ? persons : byId;
          const value = records.get(ref.id);

          return {
            id: ref.id,
            exists: Boolean(value),
            data: () => value
          };
        },

        set() {
          calls.writes++;
          throw new Error("write-forbidden");
        },

        update() {
          calls.writes++;
          throw new Error("write-forbidden");
        },

        delete() {
          calls.writes++;
          throw new Error("write-forbidden");
        }
      });
    }
  };

  const result = await discoverSmartAssignmentConsistently({
    db,
    campaignId,
    actorPersonId,
    activityCode: "MATERIAL_DISTRIBUTION"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.eligible.map(p => p.personId),
    ["I", "P"]
  );

  assert.equal(calls.transactions, 1);
  assert.equal(calls.reads.length, 9);
  assert.equal(calls.reads.filter(k => k === "query").length, 1);
  assert.equal(calls.directReads, 0);
  assert.equal(calls.writes, 0);
});

test("Rechaza fallo de lectura sin devolver resultados parciales", async () => {
  const {db, calls} = simulatedFirestore();

  let writes = 0;

  db.runTransaction = async (callback, options) => {
    calls.transactions++;
    calls.options = options;

    return callback({
      async get(reference) {
        calls.transactionReads.push(reference.kind);

        if (reference.kind === "actor") {
          return {
            id: actorId,
            exists: true,
            data: () => actor
          };
        }

        if (reference.kind === "descendants") {
          throw new Error("simulated-firestore-query-failure");
        }

        throw new Error("unexpected-reference");
      },

      set() {
        writes++;
        throw new Error("write-forbidden");
      },

      update() {
        writes++;
        throw new Error("write-forbidden");
      },

      delete() {
        writes++;
        throw new Error("write-forbidden");
      }
    });
  };

  let returnedResult;

  await assert.rejects(
    async () => {
      returnedResult = await discoverSmartAssignmentConsistently({
        db,
        campaignId,
        actorPersonId,
        activityCode: "MATERIAL_DISTRIBUTION"
      });
    },
    /simulated-firestore-query-failure/
  );

  assert.equal(returnedResult, undefined);
  assert.equal(calls.transactions, 1);
  assert.deepEqual(calls.options, {readOnly: true});
  assert.deepEqual(
    calls.transactionReads,
    ["actor", "descendants"]
  );
  assert.equal(calls.directReads, 0);
  assert.equal(writes, 0);
});