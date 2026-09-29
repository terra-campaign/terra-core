'use strict';

const {
  onCall,
  HttpsError
} =
  require(
    'firebase-functions/v2/https'
  );

const {
  getFirestore,
  FieldValue
} =
  require(
    'firebase-admin/firestore'
  );

const {
  resolveCanonicalPersonForAccount
} =
  require(
    './person-identity.cjs'
  );

const {
  canonicalMembershipDocumentId
} =
  require(
    './territorial-membership-id.cjs'
  );

const {
  ACTIVITY_PREFERENCES_VERSION,
  normalizeActivityPreferences,
  membershipMatchesSubject
} =
  require(
    './activity-preferences.cjs'
  );


const OPTIONS = {
  region:
    'us-central1',

  timeoutSeconds:
    60
};


function cleanId(
  value
) {

  return typeof value ===
    'string'
    ? value.trim()
    : '';
}


function fail(
  code,
  message
) {

  throw new HttpsError(
    code,
    message
  );
}


function buildPreferenceUpdate(
  input
) {

  const preferences =
    normalizeActivityPreferences(
      input
    );

  return {
    activityPreferences:
      preferences,

    preferencesVersion:
      ACTIVITY_PREFERENCES_VERSION
  };
}


function buildActivityPreferencesRead(
  membership
) {

  const source =
    membership &&
    typeof membership === 'object'
      ? membership.activityPreferences
      : {};

  return {
    ok: true,

    activityPreferences:
      normalizeActivityPreferences(
        source || {}
      ),

    preferencesVersion:
      ACTIVITY_PREFERENCES_VERSION
  };
}

function validateSelfServiceSubject({
  profile,
  campaignId,
  personId,
  membershipId,
  membership
}) {

  if (
    !profile ||
    typeof profile !== 'object' ||
    profile.active !== true
  ) {
    return {
      ok: false,
      reason: 'inactive-profile'
    };
  }

  if (
    profile.role === 'admin'
  ) {
    return {
      ok: false,
      reason: 'technical-admin'
    };
  }

  const storedCampaignId =
    cleanId(
      profile.campaignId
    );

  if (
    !storedCampaignId ||
    storedCampaignId !==
      cleanId(campaignId)
  ) {
    return {
      ok: false,
      reason: 'campaign-mismatch'
    };
  }

  if (
    !cleanId(personId) ||
    !cleanId(membershipId)
  ) {
    return {
      ok: false,
      reason: 'invalid-subject'
    };
  }

  if (
    !membershipMatchesSubject({
      membership,
      membershipId:
        cleanId(membershipId),
      campaignId:
        storedCampaignId,
      personId:
        cleanId(personId)
    })
  ) {
    return {
      ok: false,
      reason: 'membership-mismatch'
    };
  }

  return {
    ok: true,
    campaignId:
      storedCampaignId,
    personId:
      cleanId(personId),
    membershipId:
      cleanId(membershipId)
  };
}


function buildMembershipPreferenceUpdate({
  membership,
  activityPreferences,
  updatedAt
}) {

  const preferenceUpdate =
    buildPreferenceUpdate(
      activityPreferences
    );

  const legacyActivityPreferences =
    membership &&
    membership.activityPreferences &&
    typeof membership.activityPreferences ===
      'object'
      ? membership.activityPreferences
      : {};

  const legacyEventosMitines =
    Object.hasOwn(
      legacyActivityPreferences,
      'eventos_mitines'
    )
      ? legacyActivityPreferences
          .eventos_mitines
      : undefined;

  const membershipUpdate = {
    ...preferenceUpdate,
    updatedAt
  };

  if (
    legacyEventosMitines !==
      undefined
  ) {

    membershipUpdate
      .legacyActivityPreferences = {
        eventos_mitines:
          legacyEventosMitines
      };
  }

  return membershipUpdate;
}


exports.updateMyActivityPreferences =
  onCall(
    OPTIONS,

    async request => {

      if (
        !request.auth
      ) {

        fail(
          'unauthenticated',
          'Debe iniciar sesión.'
        );
      }

      const db =
        getFirestore();

      const actorUid =
        request.auth.uid;

      const data =
        request.data ||
        {};

      let preferenceUpdate;

      try {

        preferenceUpdate =
          buildPreferenceUpdate(
            data.activityPreferences
          );

      } catch (
        error
      ) {

        if (
          error instanceof
            HttpsError
        ) {
          throw error;
        }

        fail(
          'invalid-argument',
          'Las preferencias de actividad no son válidas.'
        );
      }


      try {

        return await db
          .runTransaction(
            async tx => {

              const actorProfileRef =
                db.doc(
                  'usuarios/' +
                  actorUid
                );

              const actorProfileSnapshot =
                await tx.get(
                  actorProfileRef
                );

              if (
                !actorProfileSnapshot
                  .exists
              ) {

                fail(
                  'permission-denied',
                  'La cuenta no tiene perfil territorial autorizado.'
                );
              }

              const actorProfile =
                actorProfileSnapshot
                  .data();

              if (
                !actorProfile ||
                actorProfile.active !==
                  true
              ) {

                fail(
                  'permission-denied',
                  'La cuenta territorial no está activa.'
                );
              }

              if (
                actorProfile.role ===
                  'admin'
              ) {

                fail(
                  'permission-denied',
                  'El Administrador técnico no tiene preferencias territoriales personales.'
                );
              }

              const campaignId =
                cleanId(
                  actorProfile
                    .campaignId
                );

              if (
                !campaignId
              ) {

                fail(
                  'failed-precondition',
                  'La cuenta no tiene campaña territorial válida.'
                );
              }

              const actorIdentity =
                await resolveCanonicalPersonForAccount({
                  db,
                  tx,

                  accountUid:
                    actorUid,

                  profile:
                    actorProfile,

                  campaignId
                });

              const personId =
                cleanId(
                  actorIdentity
                    .personId
                );

              if (
                !personId
              ) {

                fail(
                  'failed-precondition',
                  'La cuenta no tiene identidad territorial canónica.'
                );
              }

              const membershipId =
                canonicalMembershipDocumentId(
                  campaignId,
                  personId
                );

              const membershipRef =
                db
                  .collection(
                    'territorialMemberships'
                  )
                  .doc(
                    membershipId
                  );

              const membershipSnapshot =
                await tx.get(
                  membershipRef
                );

              if (
                !membershipSnapshot
                  .exists
              ) {

                fail(
                  'failed-precondition',
                  'La persona no tiene membresía territorial canónica.'
                );
              }

              const membership =
                membershipSnapshot
                  .data();

              const subjectValidation =
                validateSelfServiceSubject({
                  profile:
                    actorProfile,

                  campaignId,

                  personId,

                  membershipId,

                  membership
                });

              if (
                !subjectValidation.ok
              ) {

                fail(
                  'failed-precondition',
                  'La membresía territorial no corresponde a la identidad autenticada.'
                );
              }


              /*
               * Compatibilidad V1:
               *
               * activityPreferences pasa a contener
               * exclusivamente la matriz canónica.
               *
               * El valor legado eventos_mitines no se
               * reutiliza como preferencia canónica ni
               * se interpreta como compromiso.
               *
               * Se conserva separadamente cuando existe
               * para no destruir información histórica.
               */

              const updatedAt =
                FieldValue
                  .serverTimestamp();

              const membershipUpdate =
                buildMembershipPreferenceUpdate({
                  membership,

                  activityPreferences:
                    data.activityPreferences,

                  updatedAt
                });

              const auditRef =
                db
                  .collection(
                    'logs'
                  )
                  .doc();

              const auditRecord = {
                action:
                  'UPDATE_ACTIVITY_PREFERENCES',

                campaignId,

                personId,

                membershipId,

                actorUserId:
                  actorUid,

                actorPersonId:
                  personId,

                preferencesVersion:
                  ACTIVITY_PREFERENCES_VERSION,

                activityPreferences:
                  preferenceUpdate
                    .activityPreferences,

                createdAt:
                  updatedAt
              };

              tx.update(
                membershipRef,
                membershipUpdate
              );

              tx.create(
                auditRef,
                auditRecord
              );

              return {
                ok:
                  true,

                campaignId,

                personId,

                membershipId,

                activityPreferences:
                  preferenceUpdate
                    .activityPreferences,

                preferencesVersion:
                  ACTIVITY_PREFERENCES_VERSION
              };
            }
          );

      } catch (
        error
      ) {

        if (
          error instanceof
            HttpsError
        ) {
          throw error;
        }

        console.error(
          'updateMyActivityPreferences failed',
          error
        );

        fail(
          'internal',
          'No fue posible guardar las preferencias de actividad.'
        );
      }
    }
  );


exports.getMyActivityPreferences =
  onCall(
    OPTIONS,

    async request => {

      if (!request.auth) {
        fail(
          'unauthenticated',
          'Debe iniciar sesión.'
        );
      }

      const db =
        getFirestore();

      const actorUid =
        request.auth.uid;

      try {

        const actorProfileSnapshot =
          await db
            .doc(
              'usuarios/' +
              actorUid
            )
            .get();

        if (!actorProfileSnapshot.exists) {
          fail(
            'permission-denied',
            'La cuenta no tiene perfil territorial autorizado.'
          );
        }

        const actorProfile =
          actorProfileSnapshot.data();

        if (
          !actorProfile ||
          actorProfile.active !== true
        ) {
          fail(
            'permission-denied',
            'La cuenta territorial no está activa.'
          );
        }

        if (actorProfile.role === 'admin') {
          fail(
            'permission-denied',
            'El Administrador técnico no tiene preferencias territoriales personales.'
          );
        }
        const campaignId =
          cleanId(
            actorProfile.campaignId
          );

        if (!campaignId) {
          fail(
            'failed-precondition',
            'La cuenta no tiene campaña territorial válida.'
          );
        }

        const actorIdentity =
          await resolveCanonicalPersonForAccount({
            db,
            accountUid: actorUid,
            profile: actorProfile,
            campaignId
          });

        const personId =
          cleanId(
            actorIdentity.personId
          );

        if (!personId) {
          fail(
            'failed-precondition',
            'La cuenta no tiene identidad territorial canónica.'
          );
        }

        const membershipId =
          canonicalMembershipDocumentId(
            campaignId,
            personId
          );

        const membershipSnapshot =
          await db
            .collection(
              'territorialMemberships'
            )
            .doc(
              membershipId
            )
            .get();

        if (!membershipSnapshot.exists) {
          fail(
            'failed-precondition',
            'La persona no tiene membresía territorial canónica.'
          );
        }

        const membership =
          membershipSnapshot.data();

        const subjectValidation =
          validateSelfServiceSubject({
            profile: actorProfile,
            campaignId,
            personId,
            membershipId,
            membership
          });

        if (!subjectValidation.ok) {
          fail(
            'failed-precondition',
            'La membresía territorial no corresponde a la identidad autenticada.'
          );
        }

        const result =
          buildActivityPreferencesRead(
            membership
          );

        return {
          ...result,
          campaignId,
          personId,
          membershipId
        };

      } catch (error) {

        if (error instanceof HttpsError) {
          throw error;
        }

        console.error(
          'getMyActivityPreferences failed',
          error
        );

        fail(
          'internal',
          'No fue posible consultar las preferencias de actividad.'
        );
      }
    }
  );

module.exports._test = {
  cleanId,
  buildPreferenceUpdate,
  buildActivityPreferencesRead,
  validateSelfServiceSubject,
  buildMembershipPreferenceUpdate
};