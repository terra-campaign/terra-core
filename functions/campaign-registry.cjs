'use strict';

const {
  validId,
  adminCampaignAccessDocumentPath
} = require(
  './admin-campaign-access.cjs'
);


// ======================================================
// NOMBRE DE CAMPAÑA
// ======================================================

function normalizeCampaignName(
  value
) {

  if (
    typeof value !== 'string'
  ) {
    throw new TypeError(
      'name debe ser string.'
    );
  }

  const name =
    value
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  if (
    name.length < 2 ||
    name.length > 120
  ) {
    throw new TypeError(
      'name invalido.'
    );
  }

  return name;
}


// ======================================================
// RUTA CANONICA DE CAMPAÑA
// ======================================================

function campaignDocumentPath(
  campaignId
) {

  const id =
    validId(
      campaignId,
      'campaignId'
    );

  return [
    'campaigns',
    id
  ].join('/');
}


// ======================================================
// CONTRATO CENTRAL DE CAMPAÑA
//
// Los timestamps NO forman parte de este helper puro.
// El backend confiable agregara createdAt / updatedAt
// con serverTimestamp cuando corresponda.
// ======================================================

function buildCampaignRecord({
  campaignId,
  name,
  createdBy
}) {

  const id =
    validId(
      campaignId,
      'campaignId'
    );

  const creatorUid =
    validId(
      createdBy,
      'createdBy'
    );

  return {
    campaignId:
      id,

    name:
      normalizeCampaignName(
        name
      ),

    active:
      true,

    createdBy:
      creatorUid,

    version:
      1
  };
}


// ======================================================
// CONTRATO CENTRAL DE ACCESO ADMINISTRATIVO
//
// Este registro autoriza al Admin tecnico sobre
// UNA campaña especifica.
// ======================================================

function buildAdminCampaignAccessRecord({
  adminUid,
  campaignId,
  createdBy
}) {

  const uid =
    validId(
      adminUid,
      'adminUid'
    );

  const id =
    validId(
      campaignId,
      'campaignId'
    );

  const creatorUid =
    validId(
      createdBy,
      'createdBy'
    );

  return {
    adminUid:
      uid,

    campaignId:
      id,

    active:
      true,

    createdBy:
      creatorUid,

    version:
      1
  };
}


// ======================================================
// PAQUETE CANONICO DE CREACION
//
// Permite construir de una sola vez:
//
// campaigns/{campaignId}
//
// y
//
// adminCampaignAccess/{adminUid}/campaigns/{campaignId}
//
// sin realizar escritura alguna.
// ======================================================

function buildCampaignRegistration({
  campaignId,
  name,
  adminUid
}) {

  const campaign =
    buildCampaignRecord({
      campaignId,
      name,
      createdBy:
        adminUid
    });

  const access =
    buildAdminCampaignAccessRecord({
      adminUid,
      campaignId:
        campaign.campaignId,
      createdBy:
        adminUid
    });

  return {
    campaignPath:
      campaignDocumentPath(
        campaign.campaignId
      ),

    campaign,

    accessPath:
      adminCampaignAccessDocumentPath(
        access.adminUid,
        access.campaignId
      ),

    access
  };
}


module.exports = {
  normalizeCampaignName,
  campaignDocumentPath,
  buildCampaignRecord,
  buildAdminCampaignAccessRecord,
  buildCampaignRegistration
};
