"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  discoverSmartAssignmentAuthenticated
} = require("./mission-smart-assignment-authenticated.cjs");

const request = {
  auth: {uid: "UID-JEFE"}
};

const activityCode = "MATERIAL_DISTRIBUTION";

function fakeDb(profile, exists = true) {
  const calls = {
    transactions: 0,
    reads: 0,
    options: null,
    otherCollections: 0
  };

  const db = {
    collection(name) {
      if (name !== "usuarios") {
        calls.otherCollections++;
        throw new Error("unauthorized-discovery-reached");
      }

      return {
        doc(id) {
          assert.equal(id, "UID-JEFE");
          return {kind: "profile"};
        }
      };
    },

    async runTransaction(callback, options) {
      calls.transactions++;
      calls.options = options;

      return callback({
        async get(ref) {
          assert.equal(ref.kind, "profile");
          calls.reads++;

          return {
            id: "UID-JEFE",
            exists,
            data: () => profile
          };
        }
      });
    }
  };

  return {db, calls};
}

const validProfile = {
  uid: "UID-JEFE",
  personId: "PERSONA-JEFE",
  campaignId: "CAM-B83",
  role: "jefe_estructura",
  active: true
};

test("Rechaza solicitud sin sesion", async () => {
  const {db, calls} = fakeDb(validProfile);

  await assert.rejects(
    discoverSmartAssignmentAuthenticated({
      db,
      request: {},
      activityCode
    }),
    /smart-assignment-unauthenticated/
  );

  assert.equal(calls.transactions, 0);
});

test("Rechaza UID invalido", async () => {
  const {db, calls} = fakeDb(validProfile);

  await assert.rejects(
    discoverSmartAssignmentAuthenticated({
      db,
      request: {auth: {uid: "otro/usuario"}},
      activityCode
    }),
    /smart-assignment-unauthenticated/
  );

  assert.equal(calls.transactions, 0);
});

test("Rechaza perfil inexistente", async () => {
  const {db, calls} = fakeDb(null, false);

  await assert.rejects(
    discoverSmartAssignmentAuthenticated({
      db,
      request,
      activityCode
    }),
    /smart-assignment-profile-not-found/
  );

  assert.equal(calls.transactions, 1);
  assert.equal(calls.reads, 1);
  assert.equal(calls.otherCollections, 0);
});

test("Rechaza rol diferente de jefe", async () => {
  const {db, calls} = fakeDb({
    ...validProfile,
    role: "integrante"
  });

  await assert.rejects(
    discoverSmartAssignmentAuthenticated({
      db,
      request,
      activityCode
    }),
    /smart-assignment-permission-denied/
  );

  assert.equal(calls.otherCollections, 0);
});

test("Rechaza perfil inactivo", async () => {
  const {db, calls} = fakeDb({
    ...validProfile,
    active: false
  });

  await assert.rejects(
    discoverSmartAssignmentAuthenticated({
      db,
      request,
      activityCode
    }),
    /smart-assignment-permission-denied/
  );

  assert.equal(calls.otherCollections, 0);
});

test("Rechaza campaña inconsistente", async () => {
  const {db, calls} = fakeDb({
    ...validProfile,
    campaignId: ""
  });

  await assert.rejects(
    discoverSmartAssignmentAuthenticated({
      db,
      request,
      activityCode
    }),
    /smart-assignment-permission-denied/
  );

  assert.equal(calls.otherCollections, 0);
});

test("Rechaza UID contradictorio en perfil", async () => {
  const {db, calls} = fakeDb({
    ...validProfile,
    uid: "OTRO-UID"
  });

  await assert.rejects(
    discoverSmartAssignmentAuthenticated({
      db,
      request,
      activityCode
    }),
    /smart-assignment-permission-denied/
  );

  assert.equal(calls.otherCollections, 0);
});

test("Rechaza transaccion sin tx.get", async () => {
  const {db} = fakeDb(validProfile);

  db.runTransaction = async callback => callback({});

  await assert.rejects(
    discoverSmartAssignmentAuthenticated({
      db,
      request,
      activityCode
    }),
    /invalid-smart-assignment-tx/
  );
});

test("Rechaza Firestore sin transacciones", async () => {
  await assert.rejects(
    discoverSmartAssignmentAuthenticated({
      db: {collection() {}},
      request,
      activityCode
    }),
    /invalid-smart-assignment-db/
  );
});

function canonicalIdentityDb(personAccountUid = "UID-JEFE") {
  const calls = {
    transactions: 0,
    options: null,
    reads: [],
    directReads: 0
  };

  const membershipId = require("./territorial-membership-id.cjs")
    .canonicalMembershipDocumentId("CAM-B83", "PERSONA-JEFE");

  const person = {
    personId: "PERSONA-JEFE",
    campaignId: "CAM-B83",
    active: true,
    accountUid: personAccountUid
  };

  const membership = {
    personId: "PERSONA-JEFE",
    campaignId: "CAM-B83",
    role: "jefe_estructura",
    parentPersonId: "COORDINADOR",
    ancestorPersonIds: ["COORDINADOR"],
    municipalityId: "MUN-1",
    structureId: "EST-1",
    active: true,
    accountUid: "UID-JEFE"
  };

  const makeRef = (collection, id) => ({
    collection,
    id,
    async get() {
      calls.directReads++;
      throw new Error("direct-read-forbidden");
    }
  });

  const db = {
    collection(name) {
      if (name === "usuarios" || name === "persons") {
        return {
          doc(id) {
            return makeRef(name, id);
          }
        };
      }

      assert.equal(name, "territorialMemberships");

      return {
        doc(id) {
          return makeRef(name, id);
        },
        where(field, operator, value) {
          assert.equal(field, "campaignId");
          assert.equal(operator, "==");
          assert.equal(value, "CAM-B83");

          return {
            where(f, op, v) {
              assert.equal(f, "ancestorPersonIds");
              assert.equal(op, "array-contains");
              assert.equal(v, "PERSONA-JEFE");
              return this;
            },
            limit() {
              return makeRef("query", "descendants");
            }
          };
        }
      };
    },

    async runTransaction(callback, options) {
      calls.transactions++;
      calls.options = options;

      return callback({
        async get(ref) {
          calls.reads.push(ref.collection);

          if (ref.collection === "usuarios") {
            assert.equal(ref.id, "UID-JEFE");
            return {
              id: ref.id,
              exists: true,
              data: () => validProfile
            };
          }

          if (ref.collection === "persons") {
            assert.equal(ref.id, "PERSONA-JEFE");
            return {
              id: ref.id,
              exists: true,
              data: () => person
            };
          }

          if (ref.collection === "territorialMemberships") {
            assert.equal(ref.id, membershipId);
            return {
              id: ref.id,
              exists: true,
              data: () => membership
            };
          }

          if (ref.collection === "query") {
            return {docs: [], size: 0};
          }

          throw new Error("unexpected-transaction-reference");
        }
      });
    }
  };

  return {db, calls};
}

test("Resuelve identidad canonica sin confiar en request.data", async () => {
  const {db, calls} = canonicalIdentityDb();

  const result = await discoverSmartAssignmentAuthenticated({
    db,
    request: {
      auth: {uid: "UID-JEFE"},
      data: {
        actorPersonId: "PERSONA-SUPLANTADA",
        campaignId: "OTRA-CAMPANA"
      }
    },
    activityCode
  });

  assert.equal(result.ok, true);
  assert.equal(result.internalOnly, true);
  assert.deepEqual(result.eligible, []);

  assert.equal(calls.transactions, 1);
  assert.deepEqual(calls.options, {readOnly: true});
  assert.deepEqual(calls.reads, [
    "usuarios",
    "persons",
    "territorialMemberships",
    "query"
  ]);
  assert.equal(calls.directReads, 0);
});

test("Rechaza persona vinculada a otra cuenta", async () => {
  const {db, calls} = canonicalIdentityDb("UID-INTRUSO");

  await assert.rejects(
    discoverSmartAssignmentAuthenticated({
      db,
      request,
      activityCode
    })
  );

  assert.equal(calls.transactions, 1);
  assert.deepEqual(calls.reads, [
    "usuarios",
    "persons"
  ]);
  assert.equal(calls.directReads, 0);
});

function legacyIdentityDb(duplicate = false) {
  const calls = {reads: [], transactions: 0, direct: 0};

  const profile = {...validProfile};
  delete profile.personId;

  const membershipId =
    require("./territorial-membership-id.cjs")
      .canonicalMembershipDocumentId("CAM-B83", "PERSONA-JEFE");

  const person = {
    personId: "PERSONA-JEFE",
    accountUid: "UID-JEFE",
    campaignId: "CAM-B83",
    active: true
  };

  const membership = {
    personId: "PERSONA-JEFE",
    campaignId: "CAM-B83",
    role: "jefe_estructura",
    parentPersonId: "COORDINADOR",
    ancestorPersonIds: ["COORDINADOR"],
    municipalityId: "MUN-1",
    structureId: "EST-1",
    active: true,
    accountUid: "UID-JEFE"
  };

  const ref = (kind, id) => ({
    kind, id,
    async get() {
      calls.direct++;
      throw new Error("direct-read-forbidden");
    }
  });

  const db = {
    collection(name) {
      if (name === "usuarios") {
        return {doc: id => ref("profile", id)};
      }

      if (name === "persons") {
        return {
          where(field, op, value) {
            assert.deepEqual(
              [field, op, value],
              ["accountUid", "==", "UID-JEFE"]
            );
            return {
              limit(n) {
                assert.equal(n, 3);
                return ref("legacy-query", "persons");
              }
            };
          }
        };
      }

      assert.equal(name, "territorialMemberships");

      return {
        doc: id => ref("membership", id),
        where() {
          return {
            where() {return this;},
            limit() {return ref("descendants", "query");}
          };
        }
      };
    },

    async runTransaction(callback, options) {
      calls.transactions++;
      assert.deepEqual(options, {readOnly: true});

      return callback({
        async get(r) {
          calls.reads.push(r.kind);

          if (r.kind === "profile") {
            return {
              id: r.id,
              exists: true,
              data: () => profile
            };
          }

          if (r.kind === "legacy-query") {
            const docs = [
              {
                id: "PERSONA-JEFE",
                exists: true,
                data: () => person
              }
            ];

            if (duplicate) {
              docs.push({
                id: "PERSONA-OTRA",
                exists: true,
                data: () => ({
                  ...person,
                  personId: "PERSONA-OTRA"
                })
              });
            }

            return {docs, size: docs.length};
          }

          if (r.kind === "membership") {
            assert.equal(r.id, membershipId);
            return {
              id: r.id,
              exists: true,
              data: () => membership
            };
          }

          if (r.kind === "descendants") {
            return {docs: [], size: 0};
          }

          throw new Error("unexpected-reference");
        }
      });
    }
  };

  return {db, calls};
}

test("Resuelve cuenta legacy mediante accountUid", async () => {
  const {db, calls} = legacyIdentityDb();

  const result = await discoverSmartAssignmentAuthenticated({
    db,
    request,
    activityCode
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.eligible, []);
  assert.equal(calls.transactions, 1);
  assert.deepEqual(calls.reads, [
    "profile",
    "legacy-query",
    "membership",
    "descendants"
  ]);
  assert.equal(calls.direct, 0);
});

test("Rechaza identidad legacy duplicada", async () => {
  const {db, calls} = legacyIdentityDb(true);

  await assert.rejects(
    discoverSmartAssignmentAuthenticated({
      db,
      request,
      activityCode
    })
  );

  assert.deepEqual(calls.reads, [
    "profile",
    "legacy-query"
  ]);
  assert.equal(calls.direct, 0);
});

// ======================================================
// B8.3-T5W - TESTS PUBLICOS AUTENTICADOS
// ======================================================

test("Salida publica autenticada ignora identidades del cliente", async () => {
  const {
    discoverSmartAssignmentPublicAuthenticated
  } = require("./mission-smart-assignment-authenticated.cjs");

  const {db, calls} = canonicalIdentityDb();

  const result = await discoverSmartAssignmentPublicAuthenticated({
    db,
    request: {
      auth: {uid: "UID-JEFE"},
      data: {
        campaignId: "CAMPANA-SUPLANTADA",
        actorPersonId: "PERSONA-SUPLANTADA",
        uid: "OTRO-USUARIO"
      }
    },
    activityCode
  });

  assert.equal(result.ok, true);
  assert.equal(result.activityCode, activityCode);
  assert.deepEqual(result.eligible, []);
  assert.equal(calls.transactions, 1);
  assert.deepEqual(calls.options, {readOnly: true});
  assert.deepEqual(calls.reads, [
    "usuarios",
    "persons",
    "territorialMemberships",
    "query"
  ]);
  assert.equal(calls.directReads, 0);
});

test("Salida publica no filtra propiedades internas", async () => {
  const {
    discoverSmartAssignmentPublicAuthenticated
  } = require("./mission-smart-assignment-authenticated.cjs");

  const {db} = canonicalIdentityDb();

  const result = await discoverSmartAssignmentPublicAuthenticated({
    db,
    request,
    activityCode
  });

  assert.deepEqual(
    Object.keys(result).sort(),
    ["activityCode", "eligible", "ok"]
  );

  for (const campo of [
    "internalOnly",
    "personId",
    "accountUid",
    "actorPersonId",
    "campaignId"
  ]) {
    assert.equal(Object.hasOwn(result, campo), false);
  }
});

test("Salida publica rechaza solicitud sin sesion", async () => {
  const {
    discoverSmartAssignmentPublicAuthenticated
  } = require("./mission-smart-assignment-authenticated.cjs");

  const {db, calls} = fakeDb(validProfile);

  await assert.rejects(
    discoverSmartAssignmentPublicAuthenticated({
      db,
      request: {data: {uid: "UID-JEFE"}},
      activityCode
    }),
    /smart-assignment-unauthenticated/
  );

  assert.equal(calls.transactions, 0);
});

test("Salida publica rechaza perfil sin rol autorizado", async () => {
  const {
    discoverSmartAssignmentPublicAuthenticated
  } = require("./mission-smart-assignment-authenticated.cjs");

  const {db, calls} = fakeDb({
    ...validProfile,
    role: "participante"
  });

  await assert.rejects(
    discoverSmartAssignmentPublicAuthenticated({
      db,
      request,
      activityCode
    }),
    /smart-assignment-permission-denied/
  );

  assert.equal(calls.transactions, 1);
  assert.deepEqual(calls.options, {readOnly: true});
  assert.equal(calls.otherCollections, 0);
});
