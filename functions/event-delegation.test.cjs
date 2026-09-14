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
  eventConfirmationClosesAtMillis,
  EVENT_INCIDENT_REASONS,
  canReportEventIncident,
  eventIncidentView,
  EVENT_CHECKIN_METHODS,
  eventAttendanceDocumentId,
  eventAttendanceView,
  canValidateEventAttendance,
  EVENT_ENABLED_CHECKIN_METHODS,
  canRecordEventAttendanceAt
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

assert.equal(
  EVENT_INCIDENT_REASONS.has(
    'transport'
  ),
  true
);

assert.equal(
  EVENT_INCIDENT_REASONS.has(
    'health'
  ),
  true
);

assert.equal(
  EVENT_INCIDENT_REASONS.has(
    'other'
  ),
  true
);

assert.equal(
  EVENT_INCIDENT_REASONS.has(
    'unknown'
  ),
  false
);


const attendingResponse = {
  status: 'attending',
  commitment: true,
  version: 1
};


assert.equal(
  canReportEventIncident(
    participant,
    responseInvitation,
    responseEvent,
    attendingResponse,
    Date.parse(
      '2099-01-01T17:01:00.000Z'
    )
  ),
  true
);


assert.equal(
  canReportEventIncident(
    participant,
    responseInvitation,
    responseEvent,
    attendingResponse,
    Date.parse(
      '2099-01-01T16:59:00.000Z'
    )
  ),
  false
);


assert.equal(
  canReportEventIncident(
    participant,
    responseInvitation,
    responseEvent,
    attendingResponse,
    Date.parse(
      '2099-01-01T18:00:00.000Z'
    )
  ),
  false
);


assert.equal(
  canReportEventIncident(
    participant,
    responseInvitation,
    responseEvent,
    {
      status:
        'not_attending'
    },
    Date.parse(
      '2099-01-01T17:01:00.000Z'
    )
  ),
  false
);


assert.equal(
  canReportEventIncident(
    {
      ...participant,
      uid:
        'OTHER'
    },
    responseInvitation,
    responseEvent,
    attendingResponse,
    Date.parse(
      '2099-01-01T17:01:00.000Z'
    )
  ),
  false
);


console.log(
  'OK: BUILD-118B-3C-1 incident tests passed.'
);

const incidentView =
  eventIncidentView({
    exists: true,
    data() {
      return {
        reason:
          'transport',
        note:
          'Falla mecanica',
        originalResponseStatus:
          'attending',
        version:
          1,
        reportedAt: {
          toDate() {
            return new Date(
              '2099-01-01T17:10:00.000Z'
            );
          }
        }
      };
    }
  });


assert.deepEqual(
  incidentView,
  {
    reported: true,
    reason: 'transport',
    note: 'Falla mecanica',
    reportedAt:
      '2099-01-01T17:10:00.000Z',
    originalResponseStatus:
      'attending',
    version: 1
  }
);


assert.equal(
  eventIncidentView(null),
  null
);


console.log(
  'OK: BUILD-118B-3C-2A incident workspace tests passed.'
);

assert.equal(
  EVENT_CHECKIN_METHODS.has(
    'manual'
  ),
  true
);

assert.equal(
  EVENT_CHECKIN_METHODS.has(
    'qr'
  ),
  true
);

assert.equal(
  EVENT_CHECKIN_METHODS.has(
    'code'
  ),
  true
);

assert.equal(
  EVENT_CHECKIN_METHODS.has(
    'gps'
  ),
  false
);


const attendanceEvent = {
  id:
    'EVENT-ATT-001',
  active:
    true,
  campaignId:
    'CAM-001',
  createdBy:
    'COORD'
};


const attendanceInvitation = {
  id:
    'INV-ATT-001',
  eventId:
    'EVENT-ATT-001',
  active:
    true,
  campaignId:
    'CAM-001',
  createdBy:
    'CHIEF',
  assignedTo:
    'MEMBER',
  assignedToName:
    'Persona de prueba'
};


assert.equal(
  canValidateEventAttendance(
    {
      ...chief,
      uid:
        'CHIEF'
    },
    attendanceInvitation,
    attendanceEvent
  ),
  true
);


assert.equal(
  canValidateEventAttendance(
    coordinator,
    attendanceInvitation,
    attendanceEvent
  ),
  true
);


assert.equal(
  canValidateEventAttendance(
    {
      ...participant,
      uid:
        'OTHER'
    },
    attendanceInvitation,
    attendanceEvent
  ),
  false
);


const attendanceIdA =
  eventAttendanceDocumentId(
    'EVENT-1',
    'PERSON-1'
  );


const attendanceIdB =
  eventAttendanceDocumentId(
    'EVENT-1',
    'PERSON-1'
  );


const attendanceIdC =
  eventAttendanceDocumentId(
    'EVENT-1',
    'PERSON-2'
  );


assert.equal(
  attendanceIdA,
  attendanceIdB
);


assert.notEqual(
  attendanceIdA,
  attendanceIdC
);


const attendanceView =
  eventAttendanceView({
    exists: true,

    data() {
      return {
        attended:
          true,

        eventId:
          'EVENT-1',

        personId:
          'PERSON-1',

        accountUid:
          'ACCOUNT-1',

        invitationId:
          'INV-1',

        personName:
          'Persona prueba',

        checkInMethod:
          'manual',

        validatedByUserId:
          'VALIDATOR-1',

        validatedByName:
          'Validador',

        validatedByRole:
          'jefe_estructura',

        version:
          1,

        checkedInAt: {
          toDate() {
            return new Date(
              '2099-01-01T18:00:00.000Z'
            );
          }
        }
      };
    }
  });


assert.deepEqual(
  attendanceView,
  {
    attended:
      true,

    eventId:
      'EVENT-1',

    personId:
      'PERSON-1',

    accountUid:
      'ACCOUNT-1',

    invitationId:
      'INV-1',

    personName:
      'Persona prueba',

    checkInMethod:
      'manual',

    checkedInAt:
      '2099-01-01T18:00:00.000Z',

    validatedByUserId:
      'VALIDATOR-1',

    validatedByName:
      'Validador',

    validatedByRole:
      'jefe_estructura',

    version:
      1
  }
);


assert.equal(
  eventAttendanceView(null),
  null
);


console.log(
  'OK: BUILD-118C-1A attendance tests passed.'
);

assert.equal(
  EVENT_ENABLED_CHECKIN_METHODS.has(
    'manual'
  ),
  true
);

assert.equal(
  EVENT_ENABLED_CHECKIN_METHODS.has(
    'qr'
  ),
  false
);

assert.equal(
  EVENT_ENABLED_CHECKIN_METHODS.has(
    'code'
  ),
  false
);


const temporalAttendanceEvent = {
  id:
    'EVENT-TIME-001',

  active:
    true,

  startsAt:
    '2099-01-01T18:00:00.000Z',

  startsAtMillis:
    Date.parse(
      '2099-01-01T18:00:00.000Z'
    )
};


assert.equal(
  canRecordEventAttendanceAt(
    temporalAttendanceEvent,
    Date.parse(
      '2099-01-01T17:59:59.000Z'
    )
  ),
  false
);


assert.equal(
  canRecordEventAttendanceAt(
    temporalAttendanceEvent,
    Date.parse(
      '2099-01-01T18:00:00.000Z'
    )
  ),
  true
);


assert.equal(
  canRecordEventAttendanceAt(
    {
      ...temporalAttendanceEvent,
      active:
        false
    },
    Date.parse(
      '2099-01-01T18:05:00.000Z'
    )
  ),
  false
);


console.log(
  'OK: BUILD-118C-1A attendance security tests passed.'
);
