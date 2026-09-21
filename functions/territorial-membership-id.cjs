'use strict';

const {
  createHash
} = require(
  'node:crypto'
);


// ======================================================
// IDENTIFICADOR CANONICO DE MEMBRESIA TERRITORIAL
//
// Regla:
// una persona tiene una sola membresia territorial
// canonica dentro de una campaña.
//
// El documento es reproducible mediante:
//
// campaignId + personId
//
// La version forma parte deliberadamente del hash.
// ======================================================

function validCanonicalId(
  value,
  fieldName
) {

  if (
    typeof value !==
      'string'
  ) {

    throw new TypeError(
      `${fieldName} debe ser texto.`
    );
  }


  const id =
    value.trim();


  if (
    !id ||
    id.length > 128 ||
    id.includes('/')
  ) {

    throw new TypeError(
      `${fieldName} no es válido.`
    );
  }


  return id;
}


function canonicalMembershipDocumentId(
  campaignId,
  personId
) {

  const canonicalCampaignId =
    validCanonicalId(
      campaignId,
      'campaignId'
    );


  const canonicalPersonId =
    validCanonicalId(
      personId,
      'personId'
    );


  return createHash(
    'sha256'
  )
    .update(
      JSON.stringify([
        'territorial-membership-v1',
        canonicalCampaignId,
        canonicalPersonId
      ])
    )
    .digest(
      'hex'
    );
}


module.exports = {

  canonicalMembershipDocumentId,

  _test: {
    validCanonicalId
  }
};
