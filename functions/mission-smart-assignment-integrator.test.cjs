"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {canonicalMembershipDocumentId} =
  require("./territorial-membership-id.cjs");

const {discoverSmartAssignmentFromFirestore: discover} =
  require("./mission-smart-assignment-integrator.cjs");

const campaignId = "CAM-B83";

function member(id, role, parent, ancestors) {
  return {
    membershipId: canonicalMembershipDocumentId(campaignId, id),
    personId: id,
    campaignId,
    role,
    parentPersonId: parent,
    ancestorPersonIds: ancestors,
    municipalityId: "MUN-1",
    structureId: "EST-1",
    active: true,
    accountUid: null
  };
}

const memberships = [
  member("J", "jefe_estructura", "C", ["C"]),
  member("I", "integrante", "J", ["J", "C"]),
  member("P", "participante", "I", ["I", "J", "C"]),
  member("B", "colaborador_base", "P", ["P", "I", "J", "C"]),
  member("A", "apoyo_territorial", "B", ["B", "P", "I", "J", "C"])
];

function fakeDb(inactivePerson = null) {
  const membershipMap = new Map(
    memberships.map(m => [m.membershipId, m])
  );

  const persons = new Map(
    memberships.map(m => [
      m.personId,
      {
        personId: m.personId,
        campaignId,
        name: "Persona " + m.personId,
        active: m.personId !== inactivePerson,
        accountUid: null
      }
    ])
  );

  return {
    collection(name) {
      const records =
        name === "territorialMemberships"
          ? membershipMap
          : name === "persons"
            ? persons
            : null;

      assert.ok(records, "Coleccion inesperada");

      const read = id => ({
        async get() {
          const value = records.get(id);
          return {
            id,
            exists: Boolean(value),
            data: () => value
          };
        }
      });

      if (name === "persons") {
        return {doc: read};
      }

      return {
        doc: read,
        where(field, op, value) {
          const filters = [[field, op, value]];

          const query = {
            where(f, o, v) {
              filters.push([f, o, v]);
              return query;
            },
            limit(value) {
              query.maximum = value;
              return query;
            },
            async get() {
              let results = [...membershipMap.values()];

              for (const [field, op, value] of filters) {
                results = results.filter(m =>
                  op === "=="
                    ? m[field] === value
                    : op === "array-contains" &&
                      Array.isArray(m[field]) &&
                      m[field].includes(value)
                );
              }

              const docs = results
                .slice(0, query.maximum)
                .map(m => ({
                  id: m.membershipId,
                  data: () => m
                }));

              return {docs, size: docs.length};
            }
          };

          return query;
        }
      };
    }
  };
}

const options = {
  campaignId,
  actorPersonId: "J",
  activityCode: "MATERIAL_DISTRIBUTION"
};

test("Descubre cuatro niveles descendientes", async () => {
  const result = await discover({
    ...options,
    db: fakeDb()
  });

  assert.equal(result.ok, true);
  assert.equal(result.internalOnly, true);
  assert.equal(result.eligible.length, 4);
});

test("Excluye persona inactiva", async () => {
  const result = await discover({
    ...options,
    db: fakeDb("P")
  });

  assert.equal(result.eligible.length, 3);
  assert.ok(
    result.eligible.every(person => person.personId !== "P")
  );
});

test("Rechaza consulta truncada", async () => {
  await assert.rejects(
    discover({
      ...options,
      db: fakeDb(),
      maxCandidates: 2
    }),
    /incomplete-smart-assignment-candidate-set/
  );
});

test("Rechaza persona de otra campana", async () => {
  const db = fakeDb();
  const originalCollection = db.collection.bind(db);

  db.collection = name => {
    const collection = originalCollection(name);

    if (name !== "persons") return collection;

    return {
      doc(id) {
        const reference = collection.doc(id);

        return {
          async get() {
            const snapshot = await reference.get();

            if (id !== "P") return snapshot;

            return {
              ...snapshot,
              data: () => ({
                ...snapshot.data(),
                campaignId: "CAM-EXTERNA"
              })
            };
          }
        };
      }
    };
  };

  const result = await discover({...options, db});

  assert.equal(result.ok, true);
  assert.equal(result.eligible.length, 3);
  assert.ok(result.eligible.every(p => p.personId !== "P"));
});

test("Rechaza persona inactiva en integracion", async () => {
  const result = await discover({
    ...options,
    db: fakeDb("A")
  });

  assert.equal(result.ok, true);
  assert.equal(result.eligible.length, 3);
  assert.ok(result.eligible.every(p => p.personId !== "A"));
});

test("Rechaza membresia con identidad canonica contradictoria", async () => {
  const db = fakeDb();
  const originalCollection = db.collection.bind(db);

  db.collection = name => {
    const collection = originalCollection(name);

    if (name !== "territorialMemberships") {
      return collection;
    }

    return {
      ...collection,
      doc(id) {
        const reference = collection.doc(id);

        return {
          async get() {
            const snapshot = await reference.get();

            if (
              id !== canonicalMembershipDocumentId(
                campaignId,
                "P"
              )
            ) {
              return snapshot;
            }

            return {
              ...snapshot,
              data: () => ({
                ...snapshot.data(),
                personId: "PERSONA-DIFERENTE"
              })
            };
          }
        };
      }
    };
  };

  const result = await discover({...options, db});

  assert.equal(result.ok, true);
  assert.equal(result.eligible.length, 1);
  assert.deepEqual(
    result.eligible.map(p => p.personId),
    ["I"]
  );
});

test("Rechaza cuenta digital contradictoria", async () => {
  const db = fakeDb();
  const originalCollection = db.collection.bind(db);

  db.collection = name => {
    const collection = originalCollection(name);

    if (name !== "persons") return collection;

    return {
      doc(id) {
        const reference = collection.doc(id);

        return {
          async get() {
            const snapshot = await reference.get();

            if (id !== "P") return snapshot;

            return {
              ...snapshot,
              data: () => ({
                ...snapshot.data(),
                accountUid: "UID-P-DIFERENTE"
              })
            };
          }
        };
      }
    };
  };

  const result = await discover({...options, db});

  assert.equal(result.ok, true);

  // P debe quedar excluido porque su cuenta digital
  // contradice la membresia canonica.
  assert.equal(result.eligible.length, 3);
  assert.ok(
    result.eligible.every(person => person.personId !== "P")
  );
});

function dbWithDigitalAccounts(membershipUid, personUid) {
  const db = fakeDb();
  const originalCollection = db.collection.bind(db);

  db.collection = name => {
    const collection = originalCollection(name);

    if (name === "persons") {
      return {
        doc(id) {
          const reference = collection.doc(id);
          return {
            async get() {
              const snapshot = await reference.get();
              if (id !== "P") return snapshot;
              return {
                ...snapshot,
                data: () => ({
                  ...snapshot.data(),
                  accountUid: personUid
                })
              };
            }
          };
        }
      };
    }

    if (name === "territorialMemberships") {
      return {
        ...collection,
        doc(id) {
          const reference = collection.doc(id);
          return {
            async get() {
              const snapshot = await reference.get();
              if (id !== canonicalMembershipDocumentId(campaignId, "P")) {
                return snapshot;
              }
              return {
                ...snapshot,
                data: () => ({
                  ...snapshot.data(),
                  accountUid: membershipUid
                })
              };
            }
          };
        },
        where(field, op, value) {
          const query = collection.where(field, op, value);
          const originalGet = query.get.bind(query);
          query.get = async () => {
            const snapshot = await originalGet();
            return {
              ...snapshot,
              docs: snapshot.docs.map(doc =>
                doc.id === canonicalMembershipDocumentId(campaignId, "P")
                  ? {
                      ...doc,
                      data: () => ({
                        ...doc.data(),
                        accountUid: membershipUid
                      })
                    }
                  : doc
              )
            };
          };
          return query;
        }
      };
    }

    return collection;
  };

  return db;
}

test("Rechaza cuenta presente solo en membresia", async () => {
  const result = await discover({
    ...options,
    db: dbWithDigitalAccounts("UID-P", null)
  });

  assert.equal(result.ok, true);
  assert.equal(result.eligible.length, 3);
  assert.ok(result.eligible.every(p => p.personId !== "P"));
});

test("Rechaza dos cuentas digitales diferentes", async () => {
  const result = await discover({
    ...options,
    db: dbWithDigitalAccounts("UID-P-1", "UID-P-2")
  });

  assert.equal(result.ok, true);
  assert.equal(result.eligible.length, 3);
  assert.ok(result.eligible.every(p => p.personId !== "P"));
});

test("Acepta cuenta digital coincidente", async () => {
  const result = await discover({
    ...options,
    db: dbWithDigitalAccounts("UID-P", "UID-P")
  });

  assert.equal(result.ok, true);
  assert.equal(result.eligible.length, 4);
  assert.ok(result.eligible.some(p => p.personId === "P"));
});

test("Rechaza duplicados contradictorios en consulta Firestore", async () => {
  const db = fakeDb();
  const originalCollection = db.collection.bind(db);

  db.collection = name => {
    const collection = originalCollection(name);

    if (name !== "territorialMemberships") {
      return collection;
    }

    return {
      ...collection,
      where(field, op, value) {
        const query = collection.where(field, op, value);
        const originalGet = query.get.bind(query);

        query.get = async () => {
          const snapshot = await originalGet();

          const original = snapshot.docs.find(
            doc => doc.data().personId === "P"
          );

          assert.ok(original);

          const duplicate = {
            id: original.id + "-DUPLICADO",
            data: () => ({
              ...original.data(),
              structureId: "EST-CONTRADICTORIA"
            })
          };

          const docs = [...snapshot.docs, duplicate];

          return {
            docs,
            size: docs.length
          };
        };

        return query;
      }
    };
  };

  await assert.rejects(
    discover({...options, db}),
    /conflicting|duplicate|invalid|incomplete/
  );
});

test("Todas las lecturas utilizan el mismo tx", async () => {
  const db = fakeDb();
  const readings = [];

  const tx = {
    async get(reference) {
      const isQuery =
        typeof reference.where === "function" ||
        typeof reference.limit === "function";

      readings.push(isQuery ? "query" : "document");
      return reference.get();
    }
  };

  const result = await discover({
    ...options,
    db,
    tx
  });

  assert.equal(result.ok, true);
  assert.equal(result.eligible.length, 4);

  // Jefe: 1; consulta: 1; cadenas: 2+3+4+5;
  // personas: 4. Total: 20 lecturas.
  assert.equal(readings.length, 20);
  assert.equal(
    readings.filter(type => type === "query").length,
    1
  );
  assert.equal(
    readings.filter(type => type === "document").length,
    19
  );
});