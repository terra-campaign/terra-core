"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");

const {
  canonicalMembershipDocumentId
} = require("./territorial-membership-id.cjs");

const {
  discoverSmartAssignmentPublicAuthenticated
} = require("./mission-smart-assignment-authenticated.cjs");

const campaignId = "CAM-B83";
const actorPersonId = "J";
const accountUid = "UID-JEFE";
const activityCode = "MATERIAL_DISTRIBUTION";

function membership(personId, role, parentPersonId, ancestors) {
  return {
    membershipId: canonicalMembershipDocumentId(campaignId, personId),
    personId,
    campaignId,
    role,
    parentPersonId,
    ancestorPersonIds: ancestors,
    municipalityId: "MUN-1",
    structureId: "EST-1",
    active: true,
    accountUid: personId === actorPersonId ? accountUid : null
  };
}

const members = [
  membership("J", "jefe_estructura", "C", ["C"]),
  membership("I", "integrante", "J", ["J", "C"]),
  membership("P", "participante", "I", ["I", "J", "C"]),
  membership("B", "colaborador_base", "P", ["P", "I", "J", "C"]),
  membership("A", "apoyo_territorial", "B", ["B", "P", "I", "J", "C"])
];

function fakeDb() {
  const calls = {
    transactions: 0,
    options: [],
    reads: [],
    directReads: 0
  };

  const memberships = new Map(
    members.map(m => [m.membershipId, m])
  );

  const persons = new Map(
    members.map(m => [
      m.personId,
      {
        personId: m.personId,
        campaignId,
        name: "Persona " + m.personId,
        active: true,
        accountUid: m.personId === actorPersonId ? accountUid : null
      }
    ])
  );

  const profile = {
    uid: accountUid,
    personId: actorPersonId,
    campaignId,
    role: "jefe_estructura",
    active: true
  };

  function documentRef(collection, id) {
    return {
      kind: "document",
      collection,
      id,
      async get() {
        calls.directReads++;
        throw new Error("direct-read-forbidden");
      }
    };
  }

  const db = {
    collection(name) {
      if (["usuarios", "persons", "territorialMemberships"].includes(name)) {
        const output = {
          doc(id) {
            return documentRef(name, id);
          }
        };

        if (name === "territorialMemberships") {
          output.where = (field, operator, value) => {
            const filters = [[field, operator, value]];
            const query = {
              kind: "query",
              collection: name,
              maximum: null,
              filters,
              where(f, op, v) {
                filters.push([f, op, v]);
                return this;
              },
              limit(n) {
                this.maximum = n;
                return this;
              },
              async get() {
                calls.directReads++;
                throw new Error("direct-query-forbidden");
              }
            };
            return query;
          };
        }

        return output;
      }

      throw new Error("unexpected-collection-" + name);
    },

    async runTransaction(callback, options) {
      calls.transactions++;
      calls.options.push(options);

      return callback({
        async get(ref) {
          calls.reads.push(ref.collection);

          if (ref.kind === "query") {
            let matching = [...memberships.values()];

            for (const [field, op, value] of ref.filters) {
              matching = matching.filter(m => {
                if (op === "==") return m[field] === value;
                if (op === "array-contains") {
                  return Array.isArray(m[field]) &&
                    m[field].includes(value);
                }
                return false;
              });
            }

            if (ref.maximum != null) {
              matching = matching.slice(0, ref.maximum);
            }

            const docs = matching.map(m => ({
              id: m.membershipId,
              data: () => m
            }));

            return {docs, size: docs.length};
          }

          let value;

          if (ref.collection === "usuarios") {
            value = ref.id === accountUid ? profile : null;
          } else if (ref.collection === "persons") {
            value = persons.get(ref.id);
          } else if (ref.collection === "territorialMemberships") {
            value = memberships.get(ref.id);
          } else {
            throw new Error("unexpected-reference");
          }

          return {
            id: ref.id,
            exists: Boolean(value),
            data: () => value
          };
        }
      });
    }
  };

  return {db, calls};
}

function authenticatedRequest(data = {}) {
  return {
    auth: {uid: accountUid},
    data
  };
}

function expectedRef(personId) {
  return createHash("sha256")
    .update(JSON.stringify([
      "mission-assignee",
      campaignId,
      actorPersonId,
      personId
    ]))
    .digest("hex");
}

test("Descubre y publica cuatro niveles sin filtrar identidades", async () => {
  const {db, calls} = fakeDb();

  const result = await discoverSmartAssignmentPublicAuthenticated({
    db,
    request: authenticatedRequest({
      campaignId: "CAMPANA-AJENA",
      actorPersonId: "PERSONA-AJENA",
      uid: "UID-FALSO"
    }),
    activityCode
  });

  assert.equal(result.ok, true);
  assert.equal(result.activityCode, activityCode);
  assert.equal(result.eligible.length, 4);

  assert.deepEqual(
    Object.keys(result).sort(),
    ["activityCode", "eligible", "ok"]
  );

  const expected = new Map([
    ["integrante", "I"],
    ["participante", "P"],
    ["colaborador_base", "B"],
    ["apoyo_territorial", "A"]
  ]);

  assert.deepEqual(
    new Set(result.eligible.map(c => c.role)),
    new Set(expected.keys())
  );

  for (const candidate of result.eligible) {
    const personId = expected.get(candidate.role);

    assert.equal(candidate.assigneeRef, expectedRef(personId));
    assert.equal(candidate.name, "Persona " + personId);
    assert.equal(candidate.hasDigitalAccount, false);

    assert.deepEqual(
      Object.keys(candidate).sort(),
      [
        "assigneeRef",
        "hasDigitalAccount",
        "municipalityId",
        "name",
        "preferenceSelected",
        "role",
        "structureId"
      ].sort()
    );

    for (const privateKey of [
      "personId",
      "accountUid",
      "uid",
      "ancestorPersonIds",
      "parentPersonId"
    ]) {
      assert.equal(Object.hasOwn(candidate, privateKey), false);
    }
  }

  assert.equal(calls.transactions, 1);
  assert.deepEqual(calls.options, [{readOnly: true}]);
  assert.equal(calls.directReads, 0);
});

test("Identidad manipulada no altera referencias publicas", async () => {
  const first = fakeDb();
  const second = fakeDb();

  const valid = await discoverSmartAssignmentPublicAuthenticated({
    db: first.db,
    request: authenticatedRequest(),
    activityCode
  });

  const manipulated = await discoverSmartAssignmentPublicAuthenticated({
    db: second.db,
    request: authenticatedRequest({
      campaignId: "OTRA-CAMPANA",
      actorPersonId: "OTRO-JEFE",
      uid: "OTRA-CUENTA"
    }),
    activityCode
  });

  assert.deepEqual(manipulated, valid);
});

test("Sin sesion rechaza antes de abrir transaccion", async () => {
  const {db, calls} = fakeDb();

  await assert.rejects(
    discoverSmartAssignmentPublicAuthenticated({
      db,
      request: {
        data: {
          uid: accountUid,
          campaignId,
          actorPersonId
        }
      },
      activityCode
    }),
    /smart-assignment-unauthenticated/
  );

  assert.equal(calls.transactions, 0);
});