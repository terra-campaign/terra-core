'use strict';

const {
  onCall,
  HttpsError
} = require(
  'firebase-functions/v2/https'
);

const {
  getFirestore
} = require(
  'firebase-admin/firestore'
);

const {
  validId,
  isActiveTechnicalAdmin,
  accessRecordAllows
} = require(
  './admin-campaign-access.cjs'
);


const OPTIONS = {
  region:
    'us-central1',

  timeoutSeconds:
    60
};


const MAX_CAMPAIGNS_PER_ADMIN =
  500;


// ======================================================
// CANDIDATOS AUTORIZADOS
//
// Une:
//
// 1. accesos explícitos nuevos
// 2. campaignId legacy durante transición
//
// No concede acceso por nombre ni por existencia de campaña.
// ======================================================

function collectAccessibleCampaignIds({
  profile,
  adminUid,
  accessRecords = []
}) {

  if (
    !isActiveTechnicalAdmin(
      profile
    )
  ) {
    return [];
  }

  let uid;

  try {

    uid =
      validId(
        adminUid,
        'adminUid'
      );

  } catch {

    return [];
  }

  const result =
    new Set();

  for (
    const record
    of accessRecords
  ) {

    if (
      !record ||
      record.active !== true
    ) {
      continue;
    }

    let campaignId;

    try {

      campaignId =
        validId(
          record.campaignId,
          'campaignId'
        );

    } catch {

      continue;
    }

    if (
      accessRecordAllows(
        record,
        uid,
        campaignId
      )
    ) {
      result.add(
        campaignId
      );
    }
  }

  return [
    ...result
  ].sort();
}


// ======================================================
// FILTRAR REGISTROS FORMALES DE CAMPAÑA
//
// Una autorización administrativa por sí sola no basta.
// La campaña debe existir formalmente y estar activa.
// ======================================================

function buildAccessibleCampaignList({
  campaignIds = [],
  campaignRecords = {}
}) {

  const campaigns =
    [];

  for (
    const campaignId
    of campaignIds
  ) {

    const record =
      campaignRecords[
        campaignId
      ];

    if (
      !record ||
      record.active !== true ||
      record.campaignId !==
        campaignId
    ) {
      continue;
    }

    const name =
      typeof record.name ===
        'string'
        ? record.name
            .replace(
              /\s+/g,
              ' '
            )
            .trim()
        : '';

    if (
      !name
    ) {
      continue;
    }

    campaigns.push({
      campaignId,
      name,
      active:
        true
    });
  }

  campaigns.sort(
    (a, b) =>
      a.name.localeCompare(
        b.name,
        'es'
      ) ||
      a.campaignId.localeCompare(
        b.campaignId
      )
  );

  return campaigns;
}


// ======================================================
// LISTAR CAMPAÑAS DEL ADMIN
//
// SOLO LECTURA.
//
// El navegador no necesita leer directamente:
// - campaigns
// - adminCampaignAccess
//
// El backend devuelve únicamente campañas autorizadas.
// ======================================================

exports.listAdminCampaigns =
  onCall(
    OPTIONS,
    async request => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          'unauthenticated',
          'Debe iniciar sesión.'
        );
      }

      const db =
        getFirestore();

      const adminUid =
        request.auth.uid;

      const profileSnapshot =
        await db
          .doc(
            `usuarios/${adminUid}`
          )
          .get();

      if (
        !profileSnapshot.exists
      ) {
        throw new HttpsError(
          'permission-denied',
          'Acceso no autorizado.'
        );
      }

      const profile =
        profileSnapshot.data();

      if (
        !isActiveTechnicalAdmin(
          profile
        )
      ) {
        throw new HttpsError(
          'permission-denied',
          'Acceso exclusivo del Administrador técnico.'
        );
      }

      const accessSnapshot =
        await db
          .collection(
            `adminCampaignAccess/${adminUid}/campaigns`
          )
          .limit(
            MAX_CAMPAIGNS_PER_ADMIN +
            1
          )
          .get();

      if (
        accessSnapshot.size >
        MAX_CAMPAIGNS_PER_ADMIN
      ) {
        throw new HttpsError(
          'resource-exhausted',
          'El Administrador supera el límite de campañas configurado.'
        );
      }

      const accessRecords =
        accessSnapshot.docs.map(
          doc =>
            doc.data()
        );

      const campaignIds =
        collectAccessibleCampaignIds({
          profile,
          adminUid,
          accessRecords
        });

      const campaignRecords =
        {};

      await Promise.all(
        campaignIds.map(
          async campaignId => {

            const snapshot =
              await db
                .doc(
                  `campaigns/${campaignId}`
                )
                .get();

            if (
              snapshot.exists
            ) {
              campaignRecords[
                campaignId
              ] =
                snapshot.data();
            }
          }
        )
      );

      const campaigns =
        buildAccessibleCampaignList({
          campaignIds,
          campaignRecords
        });

      const selectedCampaignId =
        campaigns[0]?.campaignId || '';


      return {
        campaigns,
        selectedCampaignId
      };
    }
  );


exports._test = {
  MAX_CAMPAIGNS_PER_ADMIN,
  collectAccessibleCampaignIds,
  buildAccessibleCampaignList
};
