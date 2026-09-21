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
// COMPATIBILIDAD LEGACY
//
// Durante la transición, el campaignId histórico del Admin
// sigue autorizando únicamente esa misma campaña.
// No autoriza ninguna campaña adicional.
// ======================================================

function legacyAdminHasCampaignAccess(
  profile,
  campaignId
) {

  if (
    !isActiveTechnicalAdmin(
      profile
    )
  ) {
    return false;
  }

  let targetCampaignId;

  try {

    targetCampaignId =
      validId(
        campaignId,
        'campaignId'
      );

  } catch {

    return false;
  }

  const legacyCampaignId =
    typeof profile.campaignId === 'string'
      ? profile.campaignId.trim()
      : '';

  return (
    legacyCampaignId ===
    targetCampaignId
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
// Durante transición:
// 1. acceso explícito nuevo, o
// 2. campaignId legacy actual.
//
// Más adelante podremos retirar el fallback legacy.
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

  if (
    accessRecordAllows(
      accessRecord,
      adminUid,
      campaignId
    )
  ) {
    return true;
  }

  return legacyAdminHasCampaignAccess(
    profile,
    campaignId
  );
}


module.exports = {
  validId,
  adminCampaignAccessDocumentPath,
  isActiveTechnicalAdmin,
  legacyAdminHasCampaignAccess,
  accessRecordAllows,
  adminCanAccessCampaign
};
