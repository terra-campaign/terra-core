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
  eventScopeMemberDocumentId,
  eventAttendanceRequestMode,
  eventAttendanceDocumentId,
  eventAttendanceView,
  canValidateEventAttendance,
  EVENT_ENABLED_CHECKIN_METHODS,
  EVENT_ATTENDANCE_EARLY_MINUTES,
  EVENT_ATTENDANCE_LATE_MINUTES,
  eventAttendanceWindow,
  canRecordEventAttendanceAt,
  eventAttendanceWorkspaceScope,
  eventAttendanceInvitationAllowed,
  eventAttendanceUsesCanonicalRoster,
  eventScopeMemberAttendanceView,
  canValidateEventScopeAttendance
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



assert.equal(
  EVENT_CONFIRMATION_LEAD_MINUTES.has(0),
  true
);


const urgentEventTime =
  Date.parse(
    '2099-01-01T18:00:00.000Z'
  );


assert.equal(
  eventConfirmationClosesAtMillis({
    active:
      true,

    startsAt:
      '2099-01-01T18:00:00.000Z',

    startsAtMillis:
      urgentEventTime,

    confirmationLeadMinutes:
      0
  }),
  urgentEventTime
);


console.log(
  'OK: BUILD-118C-3A1 urgent event confirmation tests passed.'
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
  'colaborador_base'
);

assert.equal(
  NEXT.colaborador_base,
  undefined
);


const baseParticipantForDelegation = {
  uid: 'PART-BASE-PARENT',
  role: 'participante',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001',
  structureId: 'EST-001'
};


const baseCollaboratorTarget = {
  uid: 'BASE-001',
  role: 'colaborador_base',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001',
  structureId: 'EST-001',
  parentUserId: 'PART-BASE-PARENT'
};


assert.equal(
  targetAllowed(
    baseParticipantForDelegation,
    baseCollaboratorTarget
  ),
  true
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
  EVENT_ATTENDANCE_EARLY_MINUTES,
  45
);


assert.equal(
  EVENT_ATTENDANCE_LATE_MINUTES,
  90
);


const attendanceWindow =
  eventAttendanceWindow(
    temporalAttendanceEvent
  );


assert.equal(
  attendanceWindow.opensAtMillis,
  Date.parse(
    '2099-01-01T17:15:00.000Z'
  )
);


assert.equal(
  attendanceWindow.closesAtMillis,
  Date.parse(
    '2099-01-01T19:30:00.000Z'
  )
);


// 45 minutos y 1 segundo antes:
// todavía cerrado.
assert.equal(
  canRecordEventAttendanceAt(
    temporalAttendanceEvent,
    Date.parse(
      '2099-01-01T17:14:59.000Z'
    )
  ),
  false
);


// Exactamente 45 minutos antes:
// abre recepción.
assert.equal(
  canRecordEventAttendanceAt(
    temporalAttendanceEvent,
    Date.parse(
      '2099-01-01T17:15:00.000Z'
    )
  ),
  true
);


// Antes de la hora citada:
assert.equal(
  canRecordEventAttendanceAt(
    temporalAttendanceEvent,
    Date.parse(
      '2099-01-01T17:59:59.000Z'
    )
  ),
  true
);


// Hora citada:
assert.equal(
  canRecordEventAttendanceAt(
    temporalAttendanceEvent,
    Date.parse(
      '2099-01-01T18:00:00.000Z'
    )
  ),
  true
);


// Un segundo antes del cierre:
assert.equal(
  canRecordEventAttendanceAt(
    temporalAttendanceEvent,
    Date.parse(
      '2099-01-01T19:29:59.000Z'
    )
  ),
  true
);


// Exactamente 1 hora 30 minutos después:
// asistencia cerrada.
assert.equal(
  canRecordEventAttendanceAt(
    temporalAttendanceEvent,
    Date.parse(
      '2099-01-01T19:30:00.000Z'
    )
  ),
  false
);


// Evento inactivo:
assert.equal(
  canRecordEventAttendanceAt(
    {
      ...temporalAttendanceEvent,
      active:
        false
    },
    Date.parse(
      '2099-01-01T18:30:00.000Z'
    )
  ),
  false
);


console.log(
  'OK: BUILD-118C-3A2A ventana asistencia -45/+90 passed.'
);

const currentInvitationPersonId =
  attendanceInvitation.personId ||
  attendanceInvitation.assignedTo;


assert.equal(
  currentInvitationPersonId,
  'MEMBER'
);


const futureAccountlessInvitation = {
  eventId:
    'EVENT-ATT-001',

  personId:
    'PERSON-BASE-001',

  assignedTo:
    ''
};


assert.equal(
  futureAccountlessInvitation.personId ||
  futureAccountlessInvitation.assignedTo,
  'PERSON-BASE-001'
);


assert.equal(
  eventAttendanceDocumentId(
    'EVENT-ATT-001',
    'PERSON-BASE-001'
  ),
  eventAttendanceDocumentId(
    futureAccountlessInvitation.eventId,
    futureAccountlessInvitation.personId
  )
);


console.log(
  'OK: BUILD-118C-1B attendance workspace compatibility passed.'
);

const attendanceMasterEvent = {
  id:
    'EVENT-ATT-WORKSPACE',

  active:
    true,

  campaignId:
    'CAM-001',

  createdBy:
    'COORD'
};


assert.equal(
  eventAttendanceWorkspaceScope(
    coordinator,
    attendanceMasterEvent
  ),
  'event'
);


assert.equal(
  eventAttendanceWorkspaceScope(
    chief,
    attendanceMasterEvent
  ),
  'direct'
);


assert.equal(
  eventAttendanceWorkspaceScope(
    {
      uid: 'BASE-ATTENDANCE',
      role: 'colaborador_base',
      active: true,
      campaignId: 'CAM-001',
      municipalityId: 'MUN-001',
      structureId: 'EST-001',
      parentUserId: 'PART-001'
    },
    attendanceMasterEvent
  ),
  'none'
);


assert.equal(
  eventAttendanceWorkspaceScope(
    {
      ...chief,
      uid:
        'VALIDATOR'
    },
    {
      ...attendanceMasterEvent,
      attendanceValidatorIds: [
        'VALIDATOR'
      ]
    }
  ),
  'event'
);


assert.equal(
  eventAttendanceWorkspaceScope(
    {
      ...chief,
      campaignId:
        'CAM-999'
    },
    attendanceMasterEvent
  ),
  'none'
);


const attendanceDirectInvitation = {
  active:
    true,

  campaignId:
    'CAM-001',

  eventId:
    'EVENT-ATT-WORKSPACE',

  createdBy:
    'CHIEF'
};


assert.equal(
  eventAttendanceInvitationAllowed(
    'direct',
    chief,
    attendanceDirectInvitation,
    'EVENT-ATT-WORKSPACE'
  ),
  true
);


assert.equal(
  eventAttendanceInvitationAllowed(
    'direct',
    chief,
    {
      ...attendanceDirectInvitation,
      createdBy:
        'OTHER'
    },
    'EVENT-ATT-WORKSPACE'
  ),
  false
);


assert.equal(
  eventAttendanceInvitationAllowed(
    'event',
    coordinator,
    {
      ...attendanceDirectInvitation,
      createdBy:
        'OTHER'
    },
    'EVENT-ATT-WORKSPACE'
  ),
  true
);


assert.equal(
  eventAttendanceInvitationAllowed(
    'event',
    coordinator,
    {
      ...attendanceDirectInvitation,
      campaignId:
        'CAM-999'
    },
    'EVENT-ATT-WORKSPACE'
  ),
  false
);


// ======================================================
// BUILD-118D1F3
// PADRON CANONICO DESDE EVENT SCOPE
// ======================================================

const digitalScopeMember =
  eventScopeMemberAttendanceView({
    id:
      'SCOPE-MEMBER-001',

    eventId:
      'EVENT-001',

    campaignId:
      'CAM-001',

    personId:
      'PERSON-001',

    accountUid:
      'USER-001',

    hasDigitalAccount:
      true,

    name:
      'Persona con cuenta',

    role:
      'participante',

    municipalityId:
      'MUN-001',

    municipalityName:
      'Compostela',

    structureId:
      'EST-001',

    structureName:
      'Estructura Uno',

    membershipId:
      'MEM-001',

    locality:
      'Compostela',

    active:
      true,

    resolutionVersion:
      1
  });


assert.equal(
  digitalScopeMember.rosterSource,
  'event_scope'
);

assert.equal(
  digitalScopeMember.personId,
  'PERSON-001'
);

assert.equal(
  digitalScopeMember.accountUid,
  'USER-001'
);

assert.equal(
  digitalScopeMember.assignedTo,
  'USER-001'
);

assert.equal(
  digitalScopeMember.assignedToName,
  'Persona con cuenta'
);

assert.equal(
  digitalScopeMember.active,
  true
);


const accountlessScopeMember =
  eventScopeMemberAttendanceView({
    id:
      'SCOPE-MEMBER-002',

    eventId:
      'EVENT-001',

    campaignId:
      'CAM-001',

    personId:
      'PERSON-002',

    accountUid:
      null,

    hasDigitalAccount:
      false,

    name:
      'Persona sin cuenta',

    role:
      'colaborador_base',

    municipalityId:
      'MUN-001',

    municipalityName:
      'Compostela',

    structureId:
      'EST-001',

    structureName:
      'Estructura Uno',

    membershipId:
      'MEM-002',

    locality:
      'Zacualpan',

    active:
      true,

    resolutionVersion:
      1
  });


assert.equal(
  accountlessScopeMember.personId,
  'PERSON-002'
);

assert.equal(
  accountlessScopeMember.accountUid,
  null
);

assert.equal(
  accountlessScopeMember.assignedTo,
  ''
);

assert.equal(
  accountlessScopeMember.hasDigitalAccount,
  false
);

assert.equal(
  accountlessScopeMember.assignedToName,
  'Persona sin cuenta'
);

assert.equal(
  accountlessScopeMember.active,
  true
);


assert.equal(
  eventScopeMemberAttendanceView(
    null
  ),
  null
);


assert.equal(
  eventAttendanceUsesCanonicalRoster({
    scopeMode:
      'organizational',
    scopeType:
      'municipality'
  }),
  true
);

assert.equal(
  eventAttendanceUsesCanonicalRoster({
    scopeMode:
      'delegated',
    scopeType:
      'municipality'
  }),
  false
);

assert.equal(
  eventAttendanceUsesCanonicalRoster({
    scopeMode:
      'organizational',
    scopeType:
      'structure'
  }),
  false
);

assert.equal(
  eventAttendanceUsesCanonicalRoster(
    null
  ),
  false
);


const {
  scopeMemberId:
    generalScopeMemberId
} =
  require(
    './event-general-scope.cjs'
  )._test;


assert.equal(
  eventScopeMemberDocumentId(
    'EVENT-001',
    'PERSON-001'
  ),
  generalScopeMemberId(
    'EVENT-001',
    'PERSON-001'
  )
);


assert.equal(
  eventAttendanceRequestMode({
    invitationId:
      'INV-001'
  }),
  'invitation'
);


assert.equal(
  eventAttendanceRequestMode({
    eventId:
      'EVENT-001',

    personId:
      'PERSON-001'
  }),
  'event_scope'
);


assert.equal(
  eventAttendanceRequestMode({
    invitationId:
      'INV-001',

    eventId:
      'EVENT-001',

    personId:
      'PERSON-001'
  }),
  'invalid'
);


assert.equal(
  eventAttendanceRequestMode({
    eventId:
      'EVENT-001'
  }),
  'invalid'
);


assert.equal(
  eventAttendanceRequestMode({}),
  'invalid'
);


const canonicalAttendanceEvent = {
  id:
    'EVENT-SCOPE-001',

  campaignId:
    'CAM-001',

  active:
    true,

  scopeMode:
    'organizational',

  scopeType:
    'municipality',

  createdBy:
    'COORD-001',

  attendanceValidatorIds:
    [
      'VALIDATOR-001'
    ]
};


const canonicalAttendanceMember = {
  eventId:
    'EVENT-SCOPE-001',

  campaignId:
    'CAM-001',

  personId:
    'PERSON-001',

  active:
    true
};


assert.equal(
  canValidateEventScopeAttendance(
    {
      uid:
        'COORD-001',

      campaignId:
        'CAM-001',

      role:
        'coordinador_municipal',

      active:
        true
    },
    canonicalAttendanceMember,
    canonicalAttendanceEvent
  ),
  true
);


assert.equal(
  canValidateEventScopeAttendance(
    {
      uid:
        'VALIDATOR-001',

      campaignId:
        'CAM-001',

      role:
        'integrante',

      active:
        true
    },
    canonicalAttendanceMember,
    canonicalAttendanceEvent
  ),
  true
);


assert.equal(
  canValidateEventScopeAttendance(
    {
      uid:
        'OTHER-001',

      campaignId:
        'CAM-001',

      role:
        'integrante',

      active:
        true
    },
    canonicalAttendanceMember,
    canonicalAttendanceEvent
  ),
  false
);


assert.equal(
  canValidateEventScopeAttendance(
    {
      uid:
        'COORD-001',

      campaignId:
        'CAM-001',

      role:
        'coordinador_municipal',

      active:
        true
    },
    {
      ...canonicalAttendanceMember,

      campaignId:
        'CAM-999'
    },
    canonicalAttendanceEvent
  ),
  false
);


assert.equal(
  canValidateEventScopeAttendance(
    {
      uid:
        'COORD-001',

      campaignId:
        'CAM-001',

      role:
        'coordinador_municipal',

      active:
        true
    },
    canonicalAttendanceMember,
    {
      ...canonicalAttendanceEvent,

      scopeMode:
        'delegated'
    }
  ),
  false
);


console.log(
  'OK: BUILD-118D1F3 canonical attendance authorization passed.'
);


console.log(
  'OK: BUILD-118D1F3 attendance request contract passed.'
);


console.log(
  'OK: BUILD-118D1F3 canonical roster selector passed.'
);


console.log(
  'OK: BUILD-118D1F3 canonical attendance roster adapter passed.'
);


console.log(
  'OK: BUILD-118C-2A attendance workspace security passed.'
);
