'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  tutorMatchesInviter
} =
  require(
    './door-person-registration.cjs'
  )._test;


const participant = {
  uid: 'participant-1',
  role: 'participante',
  active: true,
  campaignId: 'campaign-1',
  municipalityId: 'municipality-1',
  structureId: 'structure-1'
};


const baseCollaborator = {
  uid: 'base-1',
  role: 'colaborador_base',
  active: true,
  campaignId: 'campaign-1',
  municipalityId: 'municipality-1',
  structureId: 'structure-1',
  parentUserId: 'participant-1',
  ancestorUserIds: [
    'chief-1',
    'member-1',
    'participant-1'
  ]
};


const territorialSupport = {
  uid: 'support-1',
  role: 'apoyo_territorial',
  active: true,
  campaignId: 'campaign-1',
  municipalityId: 'municipality-1',
  structureId: 'structure-1',
  parentUserId: 'base-1',
  ancestorUserIds: [
    'chief-1',
    'member-1',
    'participant-1',
    'base-1'
  ]
};


const unrelatedParticipant = {
  uid: 'participant-2',
  role: 'participante',
  active: true,
  campaignId: 'campaign-1',
  municipalityId: 'municipality-1',
  structureId: 'structure-1'
};


const supportAsTutor = {
  uid: 'support-1',
  role: 'apoyo_territorial',
  active: true,
  campaignId: 'campaign-1',
  municipalityId: 'municipality-1',
  structureId: 'structure-1'
};


assert.equal(
  tutorMatchesInviter(
    baseCollaborator,
    participant
  ),
  true,
  'Colaborador de base debe aceptar como tutor a su participante ancestro.'
);


assert.equal(
  tutorMatchesInviter(
    territorialSupport,
    participant
  ),
  true,
  'Apoyo territorial debe aceptar como tutor a su participante ancestro.'
);


assert.equal(
  tutorMatchesInviter(
    territorialSupport,
    unrelatedParticipant
  ),
  false,
  'Apoyo territorial no debe aceptar un participante ajeno a su ancestry.'
);


assert.equal(
  tutorMatchesInviter(
    territorialSupport,
    supportAsTutor
  ),
  false,
  'Apoyo territorial nunca debe funcionar como tutor.'
);


console.log(
  'OK: door inviter hierarchy Base/Apoyo policy passed.'
);
