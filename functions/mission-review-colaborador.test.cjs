'use strict';

const assert =
  require('node:assert/strict');

const {
  parentOf
} =
  require('./mission-review-policy.cjs');


const participant = {
  uid: 'PART-001',
  role: 'participante',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001',
  structureId: 'EST-001'
};


const collaborator = {
  uid: 'BASE-001',
  role: 'colaborador_base',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001',
  structureId: 'EST-001',
  parentUserId: 'PART-001'
};


const support = {
  uid: 'SUPPORT-001',
  role: 'apoyo_territorial',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001',
  structureId: 'EST-001',
  parentUserId: 'BASE-001'
};


assert.equal(
  parentOf(
    participant,
    collaborator
  ),
  true
);


assert.equal(
  parentOf(
    {
      ...participant,
      structureId: 'EST-OTRA'
    },
    collaborator
  ),
  false
);


assert.equal(
  parentOf(
    collaborator,
    support
  ),
  true
);


assert.equal(
  parentOf(
    support,
    {
      ...support,
      uid: 'SUPPORT-002',
      parentUserId: 'SUPPORT-001'
    }
  ),
  false
);


console.log(
  'OK: participante -> colaborador_base y colaborador_base -> apoyo_territorial habilitados; apoyo_territorial permanece terminal.'
);
