'use strict';


// ======================================================
// VALIDACION DE IDENTIFICADORES
// ======================================================

function validId(
  value,
  fieldName = 'id'
) {

  if (
    typeof value !== 'string'
  ) {
    throw new TypeError(
      `${fieldName} debe ser string.`
    );
  }

  const result =
    value.trim();

  if (
    !result ||
    result.length > 128 ||
    result.includes('/')
  ) {
    throw new TypeError(
      `${fieldName} invalido.`
    );
  }

  return result;
}


// ======================================================
// RUTA DETERMINISTICA DEL ACCESO
// ======================================================

function adminCampaignAccessDocumentPath(
  adminUid,
  campaignId
) {

  const uid =
    validId(
      adminUid,
      'adminUid'
    );

  const campaign =
    validId(
      campaignId,
      'campaignId'
    );

  return [
    'adminCampaignAccess',
    uid,
    'campaigns',
    campaign
  ].join('/');
}


// ======================================================
// PERFIL ADMIN TECNICO
// ======================================================

function isActiveTechnicalAdmin(
  profile
) {

  return Boolean(
    profile &&
    profile.active === true &&
    profile.role === 'admin'
  );
}


// ======================================================
// REGISTRO EXPLICITO DE ACCESO
// ======================================================

function accessRecordAllows(
  accessRecord,
  adminUid,
  campaignId
) {

  if (
    !accessRecord ||
    accessRecord.active !== true
  ) {
    return false;
  }

  let uid;
  let campaign;

  try {

    uid =
      validId(
        adminUid,
        'adminUid'
      );

    campaign =
      validId(
        campaignId,
        'campaignId'
      );

  } catch {

    return false;
  }

  return (
    accessRecord.adminUid === uid &&
    accessRecord.campaignId === campaign
  );
}


// ======================================================
// DECISION CENTRAL
//
// El Administrador técnico solo obtiene acceso mediante
// un registro explícito adminCampaignAccess.
//
// profile.campaignId puede seguir existiendo en perfiles
// antiguos, pero NO concede autorización.
// ======================================================

function adminCanAccessCampaign({
  profile,
  adminUid,
  campaignId,
  accessRecord = null
}) {

  if (
    !isActiveTechnicalAdmin(
      profile
    )
  ) {
    return false;
  }

  return accessRecordAllows(
    accessRecord,
    adminUid,
    campaignId
  );
}


module.exports = {
  validId,
  adminCampaignAccessDocumentPath,
  isActiveTechnicalAdmin,
  accessRecordAllows,
  adminCanAccessCampaign
};
