'use strict';

const assert =
  require('node:assert/strict');

const {
  canReadTarget,
  buildSummary
} =
  require('./person-activity.cjs')._test;


// ======================================================
// AUTORIZACIÓN
// ======================================================

const admin = {
  uid: 'ADMIN',
  role: 'admin',
  active: true,
  campaignId: 'CAM-001'
};

const chief = {
  uid: 'CHIEF',
  role: 'jefe_estructura',
  active: true,
  campaignId: 'CAM-001',
  structureId: 'EST-001'
};

const member = {
  uid: 'MEMBER',
  role: 'integrante',
  active: true,
  campaignId: 'CAM-001',
  structureId: 'EST-001',
  parentUserId: 'CHIEF'
};

const participant = {
  uid: 'PERSON',
  role: 'participante',
  active: true,
  campaignId: 'CAM-001',
  structureId: 'EST-001',
  parentUserId: 'MEMBER'
};

assert.equal(
  canReadTarget(
    participant,
    participant
  ),
  true
);

assert.equal(
  canReadTarget(
    admin,
    participant
  ),
  true
);

assert.equal(
  canReadTarget(
    member,
    participant
  ),
  true
);

assert.equal(
  canReadTarget(
    chief,
    participant
  ),
  true
);

assert.equal(
  canReadTarget(
    {
      uid: 'OTHER',
      role: 'integrante',
      active: true,
      campaignId: 'CAM-001',
      structureId: 'EST-001'
    },
    participant
  ),
  false
);

assert.equal(
  canReadTarget(
    {
      uid: 'COORD',
      role: 'coordinador_municipal',
      active: true,
      campaignId: 'CAM-001',
      municipalityId: 'MUN-001'
    },
    participant
  ),
  false
);


// ======================================================
// MÉTRICAS
// ======================================================

const summary =
  buildSummary({

    targetUid:
      'PERSON',

    targetPersonId:
      'PERSON-ID-001',

    campaignId:
      'CAM-001',

    missions: [

      {
        id: 'M1',
        data: {
          campaignId: 'CAM-001',
          assignedTo: 'PERSON',
          linkedVersion: 1
        }
      },

      {
        id: 'M2',
        data: {
          campaignId: 'CAM-001',
          assignedTo: 'PERSON',
          linkedVersion: 1
        }
      },

      {
        id: 'M3',
        data: {
          campaignId: 'CAM-001',
          assignedTo: 'PERSON',
          linkedVersion: 1
        }
      },

      {
        id: 'LEGACY',
        data: {
          campaignId: 'CAM-001',
          assignedTo: 'PERSON'
        }
      },

      {
        id: 'OTHER',
        data: {
          campaignId: 'CAM-001',
          assignedTo: 'OTHER_PERSON',
          linkedVersion: 1
        }
      }
    ],

    evidence: [

      {
        id: 'E1',
        data: {
          campaignId: 'CAM-001',
          missionId: 'M1',
          uploadedBy: 'PERSON'
        }
      },

      {
        id: 'E2',
        data: {
          campaignId: 'CAM-001',
          missionId: 'M2',
          uploadedBy: 'PERSON'
        }
      },

      {
        id: 'E3',
        data: {
          campaignId: 'CAM-001',
          missionId: 'M3',
          uploadedBy: 'PERSON'
        }
      },

      {
        id: 'E4',
        data: {
          campaignId: 'CAM-001',
          missionId: 'M1',
          uploadedBy: 'PERSON'
        }
      },

      {
        id: 'BAD',
        data: {
          campaignId: 'CAM-001',
          missionId: 'OTHER',
          uploadedBy: 'PERSON'
        }
      }
    ],

    reviews: [

      {
        id: 'E1',
        data: {
          campaignId: 'CAM-001',
          evidenceId: 'E1',
          subjectId: 'PERSON',
          status: 'validated',
          pendingAppeal: false
        }
      },

      {
        id: 'E2',
        data: {
          campaignId: 'CAM-001',
          evidenceId: 'E2',
          subjectId: 'PERSON',
          status: 'rejected',
          pendingAppeal: false
        }
      },

      {
        id: 'E3',
        data: {
          campaignId: 'CAM-001',
          evidenceId: 'E3',
          subjectId: 'PERSON',
          status: 'validated',
          pendingAppeal: true
        }
      },

      // Segunda evidencia de M1 validada.
      // Debe seguir contando una sola misión cumplida.
      {
        id: 'E4',
        data: {
          campaignId: 'CAM-001',
          evidenceId: 'E4',
          subjectId: 'PERSON',
          status: 'validated',
          pendingAppeal: false
        }
      }
    ],

    attendance: [

      {
        id: 'ATT-1',
        data: {
          campaignId: 'CAM-001',
          personId: 'PERSON-ID-001',
          eventId: 'EVENT-001',
          attended: true
        }
      },

      {
        id: 'ATT-2',
        data: {
          campaignId: 'CAM-001',
          personId: 'PERSON-ID-001',
          eventId: 'EVENT-002',
          attended: true
        }
      },

      // Mismo evento: no debe duplicarse.
      {
        id: 'ATT-2-DUP',
        data: {
          campaignId: 'CAM-001',
          personId: 'PERSON-ID-001',
          eventId: 'EVENT-002',
          attended: true
        }
      },

      // No asistio.
      {
        id: 'ATT-3',
        data: {
          campaignId: 'CAM-001',
          personId: 'PERSON-ID-001',
          eventId: 'EVENT-003',
          attended: false
        }
      },

      // Otra campana.
      {
        id: 'ATT-4',
        data: {
          campaignId: 'CAM-999',
          personId: 'PERSON-ID-001',
          eventId: 'EVENT-004',
          attended: true
        }
      },

      // Otra persona.
      {
        id: 'ATT-5',
        data: {
          campaignId: 'CAM-001',
          personId: 'OTHER-PERSON',
          eventId: 'EVENT-005',
          attended: true
        }
      },

      // Sin eventId valido.
      {
        id: 'ATT-6',
        data: {
          campaignId: 'CAM-001',
          personId: 'PERSON-ID-001',
          eventId: '',
          attended: true
        }
      }

    ]
  });


assert.deepEqual(
  summary,
  {
    assigned: 3,
    completed: 1,
    evidence: 4,
    eventsAttended: 2
  }
);


console.log(
  'OK: BUILD-117B-1 person activity tests passed.'
);
