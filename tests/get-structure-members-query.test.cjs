'use strict';

// BUILD-127 / 15CU: regresion de filtros ANTES del limite.
// Sin conectarse a Firebase, red ni credenciales reales.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const sourcePath = path.resolve(__dirname, '..', 'functions', 'quick-affiliation.cjs');

let entries = [];
let people = new Map();
let grantEnabled = true;
let whereCalls = [];
let membershipQueryCalls = 0;
const structure = { id: 'TERR-77', campaignId: 'CAM-A', name: 'Prueba ficticia' };

const snap = (id, data) => ({
  id,
  exists: data !== undefined && data !== null,
  data: () => data
});

const fakeDb = {
  collection(name) {
    if (name === 'usuarios') {
      return {
        doc(id) {
          return {get: async () => snap(id, id === 'ADMIN-DEMO'
            ? { role: 'admin', active: true, campaignId: 'CAM-OTRA' }
            : null)};
        }
      };
    }
    if (name === 'estructuras') {
      return {
        doc(id) {
          return {get: async () => snap(id, id === 'DOC-77' ? structure : null)};
        }
      };
    }
    if (name === 'persons') {
      return { doc: id => ({id}) };
    }
    if (name === 'territorialMemberships') {
      const filters = [];
      let top = Infinity;
      return {
        where(field, op, value) {
          assert.equal(op, '==');
          filters.push({field, value});
          whereCalls.push({field, value});
          return this;
        },
        limit(n) {
          top = n;
          return this;
        },
        async get() {
          membershipQueryCalls++;
          const docs = entries
            .filter(entry => filters.every(f => entry[f.field] === f.value))
            .slice(0, top)
            .map(entry => snap(entry.membershipId, entry));
          return {size: docs.length, docs};
        }
      };
    }
    throw Error(`Unexpected collection: ${name}`);
  },
  doc(documentPath) {
    assert.equal(documentPath, 'adminCampaignAccess/ADMIN-DEMO/campaigns/CAM-A');
    return {get: async () => snap(documentPath, grantEnabled ? {
      adminUid: 'ADMIN-DEMO', campaignId: 'CAM-A', active: true
    } : null)};
  },
  async getAll(...refs) {
    return refs.map(ref => snap(ref.id, people.get(ref.id)));
  }
};

class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const stubs = {
  'firebase-functions/v2/https': {onCall: (_opts, handler) => handler, HttpsError},
  'firebase-admin/firestore': {getFirestore: () => fakeDb, FieldValue: {}},
  'firebase-admin/auth': {getAuth: () => ({})},
  './person-identity.cjs': {resolveCanonicalPersonForAccount: () => {}},
  './territorial-membership-id.cjs': {canonicalMembershipDocumentId: () => {}},
  './territorial-ancestry.cjs': {canonicalChildAncestry: () => {}},
  './person-deduplication.cjs': {assertNoStrongDuplicate: () => {}},
  './admin-campaign-access.cjs': {
    adminCampaignAccessDocumentPath: (uid, campaign) =>
      `adminCampaignAccess/${uid}/campaigns/${campaign}`,
    adminCanAccessCampaign: ({profile, adminUid, campaignId, accessRecord}) =>
      profile.role === 'admin' && profile.active === true &&
      accessRecord?.active === true && accessRecord.adminUid === adminUid &&
      accessRecord.campaignId === campaignId
  }
};

const loadOriginal = Module._load;
let getStructureMembers;
try {
  Module._load = function(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) {
      return stubs[request];
    }
    return loadOriginal.call(this, request, parent, isMain);
  };
  getStructureMembers = require(sourcePath).getStructureMembers;
} finally {
  Module._load = loadOriginal;
}

const request = {
  auth: {uid: 'ADMIN-DEMO'},
  data: {structureDocumentId: 'DOC-77'}
};

function reset() {
  entries = [];
  people = new Map();
  grantEnabled = true;
  whereCalls = [];
  membershipQueryCalls = 0;
}

function membership(id, personId, extra = {}) {
  return {
    membershipId: id,
    personId,
    campaignId: 'CAM-A',
    structureId: 'TERR-77',
    role: 'integrante',
    active: true,
    ...extra
  };
}

function person(id, extra = {}) {
  return {
    name: `Persona ficticia ${id}`,
    campaignId: 'CAM-A',
    structureId: 'TERR-77',
    ...extra
  };
}

test('15CU: campaña ajena con structureId compartido no consume limite', async () => {
  reset();
  entries.push(membership('M-A', 'P-A'));
  people.set('P-A', person('P-A'));
  for (let i = 0; i < 1205; i++) {
    entries.push(membership(`M-B-${i}`, `P-B-${i}`, {campaignId: 'CAM-B'}));
  }
  const result = await getStructureMembers(request);
  assert.equal(result.success, true);
  assert.deepEqual(result.members.map(m => m.personId), ['P-A']);
  assert.deepEqual(whereCalls, [
    {field:'campaignId', value:'CAM-A'},
    {field:'structureId', value:'TERR-77'},
    {field:'role', value:'integrante'},
    {field:'active', value:true}
  ]);
});

test('15CU: inactivos y otros roles no consumen el limite', async () => {
  reset();
  entries.push(membership('M-A', 'P-A'));
  people.set('P-A', person('P-A'));
  for (let i = 0; i < 1205; i++) {
    entries.push(membership(`M-I-${i}`, `P-I-${i}`, {active:false}));
    entries.push(membership(`M-R-${i}`, `P-R-${i}`, {role:'participante'}));
    entries.push(membership(`M-S-${i}`, `P-S-${i}`, {structureId:'TERR-OTRA'}));
  }
  const result = await getStructureMembers(request);
  assert.deepEqual(result.members.map(m => m.personId), ['P-A']);
});

test('15CU: exactamente 1000 integrantes activos se admiten', async () => {
  reset();
  for (let i = 0; i < 1000; i++) {
    const id = `P-${i}`;
    entries.push(membership(`M-${i}`, id));
    people.set(id, person(id));
  }
  const result = await getStructureMembers(request);
  assert.equal(result.members.length, 1000);
});

test('15CU: 1001 integrantes activos requieren paginación', async () => {
  reset();
  for (let i = 0; i < 1001; i++) {
    entries.push(membership(`M-${i}`, `P-${i}`));
  }
  await assert.rejects(
    getStructureMembers(request),
    error => error.code === 'resource-exhausted'
  );
});

test('15CU: sin grant se deniega sin iniciar consulta de membresias', async () => {
  reset();
  grantEnabled = false;
  await assert.rejects(
    getStructureMembers(request),
    error => error.code === 'permission-denied'
  );
  assert.equal(membershipQueryCalls, 0);
});

test('15CU: persona vinculada a campaña ajena sigue excluida', async () => {
  reset();
  entries.push(membership('M-A', 'P-A'));
  people.set('P-A', person('P-A', {campaignId:'CAM-B'}));
  const result = await getStructureMembers(request);
  assert.deepEqual(result.members, []);
});
