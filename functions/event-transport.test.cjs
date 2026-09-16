'use strict';

const assert =
  require('node:assert/strict');


const {
  ALLOWED_ROLES,
  transportRequestId,
  canSelfManageTransport,
  canonicalPersonMatchesProfile
} =
  require('./event-transport.cjs')
    ._test;


assert.equal(
  ALLOWED_ROLES.has(
    'colaborador_base'
  ),
  true
);


const profile = {
  uid: 'BASE-001',
  role: 'colaborador_base',
  active: true,
  campaignId: 'CAM-001'
};


assert.equal(
  canonicalPersonMatchesProfile(
    {
      campaignId: 'CAM-001',
      accountUid: 'BASE-001'
    },
    profile
  ),
  true
);


assert.equal(
  canonicalPersonMatchesProfile(
    {
      campaignId: 'CAM-999',
      accountUid: 'BASE-001'
    },
    profile
  ),
  false
);


assert.equal(
  canonicalPersonMatchesProfile(
    {
      campaignId: 'CAM-001',
      accountUid: 'OTHER'
    },
    profile
  ),
  false
);


const invitation = {
  id: 'INV-001',
  active: true,
  campaignId: 'CAM-001',
  eventId: 'EV-001',
  assignedTo: 'BASE-001'
};


const event = {
  id: 'EV-001',
  active: true,
  campaignId: 'CAM-001'
};


assert.equal(
  canSelfManageTransport(
    profile,
    invitation,
    event,
    {
      status: 'attending'
    }
  ),
  true
);


assert.equal(
  canSelfManageTransport(
    profile,
    invitation,
    event,
    {
      status: 'not_attending'
    }
  ),
  false
);


assert.equal(
  canSelfManageTransport(
    profile,
    {
      ...invitation,
      assignedTo: 'OTHER'
    },
    event,
    {
      status: 'attending'
    }
  ),
  false
);


assert.equal(
  canSelfManageTransport(
    profile,
    invitation,
    {
      ...event,
      campaignId: 'CAM-999'
    },
    {
      status: 'attending'
    }
  ),
  false
);


assert.equal(
  transportRequestId(
    'EV-001',
    'PERSON-001'
  ),
  transportRequestId(
    'EV-001',
    'PERSON-001'
  )
);


assert.notEqual(
  transportRequestId(
    'EV-001',
    'PERSON-001'
  ),
  transportRequestId(
    'EV-001',
    'PERSON-002'
  )
);


assert.notEqual(
  transportRequestId(
    'EV-001',
    'PERSON-001'
  ),
  transportRequestId(
    'EV-002',
    'PERSON-001'
  )
);


console.log(
  'OK: BUILD-118C-3B3E-3G-A event transport domain tests passed.'
);
