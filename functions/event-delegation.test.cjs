'use strict';

const assert =
  require('node:assert/strict');

const {
  NEXT,
  targetAllowed,
  eventContactView,
  EVENT_RESPONSE_STATUSES,
  eventStartsAtMillis,
  canRespondToEventInvitation,
  EVENT_CONFIRMATION_LEAD_MINUTES,
  eventConfirmationClosesAtMillis
} =
  require('./event-delegation.cjs')._test;


assert.equal(
  NEXT.lider_principal,
  'coordinador_municipal'
);

assert.equal(
  NEXT.coordinador_municipal,
  'jefe_estructura'
);

assert.equal(
  NEXT.jefe_estructura,
  'integrante'
);

assert.equal(
  NEXT.integrante,
  'participante'
);


const coordinator = {
  uid: 'COORD',
  role: 'coordinador_municipal',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001'
};

const chief = {
  uid: 'CHIEF',
  role: 'jefe_estructura',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001',
  structureId: 'EST-001',
  parentUserId: 'COORD'
};

assert.equal(
  targetAllowed(
    coordinator,
    chief
  ),
  true
);


assert.equal(
  targetAllowed(
    coordinator,
    {
      ...chief,
      municipalityId:
        'MUN-002'
    }
  ),
  false
);


const member = {
  uid: 'MEMBER',
  role: 'integrante',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001',
  structureId: 'EST-001',
  parentUserId: 'CHIEF'
};

assert.equal(
  targetAllowed(
    chief,
    member
  ),
  true
);


assert.equal(
  targetAllowed(
    chief,
    {
      ...member,
      structureId:
        'EST-999'
    }
  ),
  false
);


const participant = {
  uid: 'PARTICIPANT',
  role: 'participante',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001',
  structureId: 'EST-001',
  parentUserId: 'MEMBER'
};

assert.equal(
  targetAllowed(
    member,
    participant
  ),
  true
);


assert.equal(
  targetAllowed(
    member,
    {
      ...participant,
      parentUserId:
        'OTHER'
    }
  ),
  false
);



const leader = {
  uid: 'LEADER',
  role: 'lider_principal',
  active: true,
  campaignId: 'CAM-001'
};

const municipalCoordinator = {
  uid: 'COORD-2',
  role: 'coordinador_municipal',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-002'
};

assert.equal(
  targetAllowed(
    leader,
    municipalCoordinator
  ),
  true
);

assert.equal(
  targetAllowed(
    leader,
    {
      ...municipalCoordinator,
      campaignId: 'CAM-999'
    }
  ),
  false
);

assert.equal(
  targetAllowed(
    leader,
    {
      ...municipalCoordinator,
      active: false
    }
  ),
  false
);

assert.equal(
  targetAllowed(
    member,
    {
      ...participant,
      role: 'integrante'
    }
  ),
  false
);

assert.equal(
  NEXT.participante,
  undefined
);


const allowedContact =
  eventContactView(
    member,
    {
      ...participant,
      phone: '3271042361',
      hasWhatsApp: true
    }
  );

assert.deepEqual(
  allowedContact,
  {
    assignedToPhone: '3271042361',
    assignedToHasWhatsApp: true
  }
);


const forbiddenContact =
  eventContactView(
    member,
    {
      ...participant,
      parentUserId: 'OTHER',
      phone: '3279999999',
      hasWhatsApp: true
    }
  );

assert.deepEqual(
  forbiddenContact,
  {
    assignedToPhone: '',
    assignedToHasWhatsApp: false
  }
);


assert.equal(
  EVENT_RESPONSE_STATUSES.has(
    'attending'
  ),
  true
);

assert.equal(
  EVENT_RESPONSE_STATUSES.has(
    'not_attending'
  ),
  true
);

assert.equal(
  EVENT_RESPONSE_STATUSES.has(
    'pending'
  ),
  false
);


const responseEvent = {
  id: 'EVENT-001',
  campaignId: 'CAM-001',
  active: true,
  startsAt:
    '2099-01-01T18:00:00.000Z',
  startsAtMillis:
    Date.parse(
      '2099-01-01T18:00:00.000Z'
    ),
  confirmationLeadMinutes: 60,
  confirmationClosesAtMillis:
    Date.parse(
      '2099-01-01T17:00:00.000Z'
    )
};


const responseInvitation = {
  id: 'INV-001',
  eventId: 'EVENT-001',
  campaignId: 'CAM-001',
  active: true,
  assignedTo: 'PARTICIPANT'
};


assert.equal(
  eventStartsAtMillis(
    responseEvent
  ),
  Date.parse(
    '2099-01-01T18:00:00.000Z'
  )
);


assert.equal(
  canRespondToEventInvitation(
    participant,
    responseInvitation,
    responseEvent,
    Date.parse(
      '2099-01-01T16:59:00.000Z'
    )
  ),
  true
);


assert.equal(
  canRespondToEventInvitation(
    participant,
    {
      ...responseInvitation,
      assignedTo: 'OTHER'
    },
    responseEvent,
    Date.parse(
      '2099-01-01T17:00:00.000Z'
    )
  ),
  false
);


assert.equal(
  canRespondToEventInvitation(
    participant,
    responseInvitation,
    responseEvent,
    Date.parse(
      '2099-01-01T19:00:00.000Z'
    )
  ),
  false
);


assert.equal(
  canRespondToEventInvitation(
    participant,
    responseInvitation,
    {
      ...responseEvent,
      active: false
    },
    Date.parse(
      '2099-01-01T17:00:00.000Z'
    )
  ),
  false
);


assert.equal(
  canRespondToEventInvitation(
    participant,
    {
      ...responseInvitation,
      campaignId: 'CAM-999'
    },
    responseEvent,
    Date.parse(
      '2099-01-01T17:00:00.000Z'
    )
  ),
  false
);


console.log(
  'OK: BUILD-118B-1 event response tests passed.'
);

assert.equal(
  EVENT_CONFIRMATION_LEAD_MINUTES.has(
    60
  ),
  true
);

assert.equal(
  EVENT_CONFIRMATION_LEAD_MINUTES.has(
    1440
  ),
  true
);

assert.equal(
  EVENT_CONFIRMATION_LEAD_MINUTES.has(
    30
  ),
  false
);

assert.equal(
  eventConfirmationClosesAtMillis(
    responseEvent
  ),
  Date.parse(
    '2099-01-01T17:00:00.000Z'
  )
);

assert.equal(
  canRespondToEventInvitation(
    participant,
    responseInvitation,
    responseEvent,
    Date.parse(
      '2099-01-01T17:00:00.000Z'
    )
  ),
  false
);

console.log(
  'OK: BUILD-118B-3A confirmation deadline tests passed.'
);
