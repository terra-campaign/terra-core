'use strict';

const {
  onCall,
  HttpsError
} = require(
  'firebase-functions/v2/https'
);

const {
  getFirestore,
  FieldValue
} = require(
  'firebase-admin/firestore'
);

const {
  getAuth
} = require(
  'firebase-admin/auth'
);

const {
  resolveCanonicalPersonForAccount
} = require(
  './person-identity.cjs'
);

const {
  canonicalMembershipDocumentId
} = require(
  './territorial-membership-id.cjs'
);

const {
  canonicalChildAncestry
} = require(
  './territorial-ancestry.cjs'
);

const {
  allowedUpwardRolesFor,
  requiredParentRoleFor,
  requiresOwnDigitalAccount
} = require(
  './upward-incorporation-policy.cjs'
);

const {
  cleanText,
  normalizePhone,
  assertNoStrongDuplicate
} = require(
  './person-deduplication.cjs'
);


const OPTIONS = {
  region: 'us-central1',
  timeoutSeconds: 60
};


function fail(
  code,
  message
) {
  throw new HttpsError(
    code,
    message
  );
}


// ======================================================
// ACTOR
// Solo Apoyo Territorial con cuenta digital.
// ======================================================

async function readIntroducer(
  db,
  request
) {

  if (!request.auth) {
    fail(
      'unauthenticated',
      'Inicia sesión.'
    );
  }

  const snapshot =
    await db
      .collection('usuarios')
      .doc(request.auth.uid)
      .get();

  if (!snapshot.exists) {
    fail(
      'permission-denied',
      'Perfil no autorizado.'
    );
  }

  const profile = {
    ...snapshot.data(),
    uid: snapshot.id
  };

  if (
    profile.active !== true ||
    profile.role !==
      'apoyo_territorial' ||
    !profile.campaignId
  ) {
    fail(
      'permission-denied',
      'Esta operación está disponible únicamente para Apoyo Territorial activo.'
    );
  }

  if (
    !profile.municipalityId ||
    !profile.structureId
  ) {
    fail(
      'failed-precondition',
      'La cuenta no tiene territorio y estructura definidos.'
    );
  }

  return profile;
}


// ======================================================
// SEGURIDAD DE LÍNEA JERÁRQUICA
//
// El Apoyo Territorial únicamente puede incorporar
// personas bajo responsables que ya formen parte
// de su propia cadena ascendente canónica.
// ======================================================

function isParentInIntroducerLineage({
  introducer,
  parentPersonId
}) {

  if (
    !introducer ||
    !parentPersonId
  ) {
    return false;
  }

  const ancestorPersonIds =
    Array.isArray(
      introducer.ancestorPersonIds
    )
      ? introducer.ancestorPersonIds
      : [];

  return ancestorPersonIds.includes(
    parentPersonId
  );
}


// ======================================================
// PADRE JERÁRQUICO REAL
//
// El Apoyo incorpora.
// El Apoyo NO es parentPersonId.
// ======================================================

async function readAuthorizedParent({
  db,
  introducer,
  introducerPersonId,
  parentPersonId,
  targetRole
}) {

  if (
    !parentPersonId ||
    parentPersonId ===
      introducerPersonId
  ) {
    fail(
      'invalid-argument',
      'Debe seleccionarse un responsable jerárquico válido distinto del incorporador.'
    );
  }

  if (
    !isParentInIntroducerLineage({
      introducer,
      parentPersonId
    })
  ) {
    fail(
      'permission-denied',
      'El responsable seleccionado no pertenece a tu línea jerárquica autorizada.'
    );
  }

  const requiredParentRole =
    requiredParentRoleFor(
      targetRole
    );

  if (!requiredParentRole) {
    fail(
      'invalid-argument',
      'El nivel solicitado no tiene padre jerárquico autorizado.'
    );
  }

  const membershipId =
    canonicalMembershipDocumentId(
      introducer.campaignId,
      parentPersonId
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
      'not-found',
      'No se encontró la membresía del responsable seleccionado.'
    );
  }

  const membership = {
    ...membershipSnapshot.data(),
    membershipId:
      membershipSnapshot.id
  };

  if (
    membership.active !== true ||
    membership.campaignId !==
      introducer.campaignId ||
    membership.role !==
      requiredParentRole
  ) {
    fail(
      'permission-denied',
      'El responsable seleccionado no corresponde al nivel jerárquico requerido.'
    );
  }

  if (
    membership.municipalityId !==
      introducer.municipalityId ||
    membership.structureId !==
      introducer.structureId
  ) {
    fail(
      'permission-denied',
      'El responsable seleccionado debe pertenecer a la misma estructura territorial.'
    );
  }

  const parentPersonSnapshot =
    await db
      .collection('persons')
      .doc(parentPersonId)
      .get();

  if (!parentPersonSnapshot.exists) {
    fail(
      'not-found',
      'No se encontró la persona responsable seleccionada.'
    );
  }

  const parentPerson = {
    ...parentPersonSnapshot.data(),
    personId:
      parentPersonSnapshot.id
  };

  let parentUser = null;

  if (membership.accountUid) {
    const parentUserSnapshot =
      await db
        .collection('usuarios')
        .doc(membership.accountUid)
        .get();

    if (parentUserSnapshot.exists) {
      parentUser = {
        ...parentUserSnapshot.data(),
        uid:
          parentUserSnapshot.id
      };
    }
  }

  return {
    membership,
    person:
      parentPerson,
    user:
      parentUser,
    requiredParentRole
  };
}


// ======================================================
// CONTEXTO DE INCORPORACIÓN ASCENDENTE
//
// Devuelve únicamente responsables jerárquicos válidos
// dentro de la misma campaña, municipio y estructura.
// ======================================================

const getUpwardIncorporationContext =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();

      const introducer =
        await readIntroducer(
          db,
          request
        );

      const allowedRoles =
        allowedUpwardRolesFor(
          introducer.role
        );

      if (!allowedRoles.length) {
        fail(
          'permission-denied',
          'Esta cuenta no tiene habilitada la incorporación ascendente.'
        );
      }


      const requiredParentRoles =
        [
          ...new Set(
            allowedRoles
              .map(
                targetRole =>
                  requiredParentRoleFor(
                    targetRole
                  )
              )
              .filter(Boolean)
          )
        ];


      const membershipsSnapshot =
        await db
          .collection(
            'territorialMemberships'
          )
          .where(
            'campaignId',
            '==',
            introducer.campaignId
          )
          .limit(1001)
          .get();


      if (
        membershipsSnapshot.size >
          1000
      ) {
        fail(
          'resource-exhausted',
          'La campaña requiere un índice escalable para consultar responsables.'
        );
      }


      const candidateMemberships =
        membershipsSnapshot.docs
          .map(
            doc => ({
              ...doc.data(),
              membershipId:
                doc.id
            })
          )
          .filter(
            membership =>
              membership.active === true &&
              membership.municipalityId ===
                introducer.municipalityId &&
              membership.structureId ===
                introducer.structureId &&
              isParentInIntroducerLineage({
                introducer,
                parentPersonId:
                  membership.personId
              }) &&
              requiredParentRoles.includes(
                membership.role
              ) &&
              typeof membership.personId ===
                'string' &&
              membership.personId.trim()
          );


      const personSnapshots =
        await Promise.all(
          candidateMemberships.map(
            membership =>
              db
                .collection('persons')
                .doc(
                  membership.personId
                )
                .get()
          )
        );


      const peopleById =
        new Map();

      personSnapshots.forEach(
        snapshot => {

          if (!snapshot.exists) {
            return;
          }

          peopleById.set(
            snapshot.id,
            {
              ...snapshot.data(),
              personId:
                snapshot.id
            }
          );
        }
      );


      const parentCandidates =
        allowedRoles.map(
          targetRole => {

            const requiredParentRole =
              requiredParentRoleFor(
                targetRole
              );

            const members =
              candidateMemberships
                .filter(
                  membership =>
                    membership.role ===
                      requiredParentRole
                )
                .map(
                  membership => {

                    const person =
                      peopleById.get(
                        membership.personId
                      );

                    if (!person) {
                      return null;
                    }

                    return {
                      personId:
                        person.personId,

                      name:
                        person.name || '',

                      role:
                        membership.role,

                      accountUid:
                        membership.accountUid ||
                        null,

                      membershipId:
                        membership.membershipId
                    };
                  }
                )
                .filter(Boolean)
                .sort(
                  (a, b) =>
                    a.name.localeCompare(
                      b.name,
                      'es',
                      {
                        sensitivity:
                          'base'
                      }
                    )
                );


            return {
              targetRole,

              targetRoleLabel:
                targetRole ===
                  'participante'
                  ? 'Participante'
                  : 'Apoyo territorial',

              requiredParentRole,

              requiredParentRoleLabel:
                requiredParentRole ===
                  'integrante'
                  ? 'Integrante'
                  : 'Colaborador de base',

              members
            };
          }
        );


      return {
        success:
          true,

        introducer: {
          uid:
            introducer.uid,

          personId:
            introducer.personId ||
            null,

          name:
            introducer.name ||
            '',

          role:
            introducer.role,

          municipalityId:
            introducer.municipalityId,

          municipalityName:
            introducer.municipalityName ||
            '',

          structureId:
            introducer.structureId,

          structureName:
            introducer.structureName ||
            ''
        },

        allowedRoles,

        parentCandidates
      };
    }
  );


// ======================================================
// INCORPORACIÓN ASCENDENTE
// ======================================================

const createUpwardIncorporation =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();

      const auth =
        getAuth();

      const introducer =
        await readIntroducer(
          db,
          request
        );

      const introducerIdentity =
        await resolveCanonicalPersonForAccount({
          db,
          accountUid:
            introducer.uid,
          profile:
            introducer,
          campaignId:
            introducer.campaignId
        });

      const introducerPersonId =
        introducerIdentity.personId;

      const data =
        request.data || {};


      // ==================================================
      // CUENTA DIGITAL OBLIGATORIA
      //
      // La incorporación ascendente desde Apoyo
      // requiere cuenta digital propia de la persona.
      // ==================================================

      if (
        data.createDigitalAccount !== true
      ) {
        fail(
          'failed-precondition',
          'La incorporación ascendente requiere crear una cuenta digital propia.'
        );
      }


      const targetRole =
        cleanText(
          data.targetRole,
          64
        );

      const allowedRoles =
        allowedUpwardRolesFor(
          introducer.role
        );

      if (
        !allowedRoles.includes(
          targetRole
        )
      ) {
        fail(
          'permission-denied',
          'Ese nivel no está autorizado para incorporación desde Apoyo Territorial.'
        );
      }

      if (
        !requiresOwnDigitalAccount({
          introducerRole:
            introducer.role,
          targetRole
        })
      ) {
        fail(
          'failed-precondition',
          'La incorporación ascendente requiere cuenta digital propia.'
        );
      }

      const parentPersonId =
        cleanText(
          data.parentPersonId,
          128
        );

      const parent =
        await readAuthorizedParent({
          db,
          introducer,
          introducerPersonId,
          parentPersonId,
          targetRole
        });

      const name =
        cleanText(
          data.name,
          120
        );

      const locality =
        cleanText(
          data.locality,
          120
        );

      const phone =
        normalizePhone(
          data.phone
        );

      const street =
        cleanText(
          data.street,
          160
        );

      const houseNumber =
        cleanText(
          data.houseNumber,
          40
        );

      const email =
        cleanText(
          data.email,
          240
        ).toLowerCase();

      const password =
        String(
          data.password || ''
        );

      const hasWhatsApp =
        phone
          ? data.hasWhatsApp === true
          : false;

      if (name.length < 2) {
        fail(
          'invalid-argument',
          'Ingrese el nombre completo.'
        );
      }

      if (locality.length < 2) {
        fail(
          'invalid-argument',
          'Ingrese la población.'
        );
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        fail(
          'invalid-argument',
          'Ingrese un correo electrónico válido.'
        );
      }

      if (
        password.length < 6
      ) {
        fail(
          'invalid-argument',
          'La contraseña temporal debe tener al menos 6 caracteres.'
        );
      }

      if (
        phone &&
        (
          phone.length < 10 ||
          phone.length > 15
        )
      ) {
        fail(
          'invalid-argument',
          'El teléfono no es válido.'
        );
      }


      // ==================================================
      // DEDUPLICACIÓN CANÓNICA COMPARTIDA
      // ==================================================

      await assertNoStrongDuplicate({
        db,

        campaignId:
          introducer.campaignId,

        name,
        locality,
        phone,
        street,
        houseNumber
      });

      let authUser = null;

      try {

        authUser =
          await auth.createUser({
            email,
            password,
            displayName:
              name,
            disabled:
              false
          });

      } catch (error) {

        if (
          error?.code ===
            'auth/email-already-exists'
        ) {
          fail(
            'already-exists',
            'Ya existe un usuario registrado con ese correo.'
          );
        }

        if (
          error?.code ===
            'auth/invalid-email'
        ) {
          fail(
            'invalid-argument',
            'El correo electrónico no es válido.'
          );
        }

        if (
          error?.code ===
            'auth/invalid-password'
        ) {
          fail(
            'invalid-argument',
            'La contraseña temporal no es válida.'
          );
        }

        throw error;
      }


      const personRef =
        db
          .collection('persons')
          .doc();

      const membershipId =
        canonicalMembershipDocumentId(
          introducer.campaignId,
          personRef.id
        );

      const membershipRef =
        db
          .collection(
            'territorialMemberships'
          )
          .doc(
            membershipId
          );

      const userRef =
        db
          .collection('usuarios')
          .doc(authUser.uid);

      const logRef =
        db
          .collection('logs')
          .doc();

      const parentUid =
        parent.membership.accountUid ||
        parent.user?.uid ||
        null;

      const parentProfile =
        parent.user || {
          ...parent.membership,
          uid:
            parentUid
        };

      const ancestry =
        canonicalChildAncestry({
          parentUid,
          parentPersonId,
          parentProfile
        });

      const ancestorUserIds =
        ancestry.ancestorUserIds;

      const ancestorPersonIds =
        ancestry.ancestorPersonIds;

      const now =
        FieldValue.serverTimestamp();


      try {

        await db.runTransaction(
          async tx => {

            tx.create(
              personRef,
              {
                personId:
                  personRef.id,

                name,
                email,
                phone,
                hasWhatsApp,
                locality,
                street,
                houseNumber,

                active:
                  true,

                campaignId:
                  introducer.campaignId,

                municipalityId:
                  introducer.municipalityId,

                municipalityName:
                  introducer.municipalityName ||
                  '',

                structureId:
                  introducer.structureId,

                structureDocumentId:
                  introducer.structureDocumentId ||
                  '',

                structureName:
                  introducer.structureName ||
                  '',

                accountUid:
                  authUser.uid,

                identityStatus:
                  'digital',

                source:
                  'upward_incorporation',

                introducedByUserId:
                  introducer.uid,

                introducedByPersonId:
                  introducerPersonId,

                createdByUserId:
                  introducer.uid,

                createdByRole:
                  introducer.role,

                createdAt:
                  now,

                updatedAt:
                  now,

                version:
                  1
              }
            );


            tx.create(
              membershipRef,
              {
                membershipId,

                personId:
                  personRef.id,

                accountUid:
                  authUser.uid,

                campaignId:
                  introducer.campaignId,

                municipalityId:
                  introducer.municipalityId,

                municipalityName:
                  introducer.municipalityName ||
                  '',

                structureId:
                  introducer.structureId,

                structureDocumentId:
                  introducer.structureDocumentId ||
                  '',

                structureName:
                  introducer.structureName ||
                  '',

                role:
                  targetRole,

                active:
                  true,

                parentUserId:
                  parentUid,

                parentPersonId,

                parentUserName:
                  parent.person.name ||
                  '',

                introducedByUserId:
                  introducer.uid,

                introducedByPersonId:
                  introducerPersonId,

                ancestorUserIds,

                ancestorPersonIds,

                source:
                  'upward_incorporation',

                activityPreferences: {
                  eventos_mitines:
                    true
                },

                createdAt:
                  now,

                updatedAt:
                  now,

                version:
                  1
              }
            );


            tx.create(
              userRef,
              {
                uid:
                  authUser.uid,

                personId:
                  personRef.id,

                membershipId,

                name,
                email,
                phone,
                hasWhatsApp,
                locality,
                street,
                houseNumber,

                role:
                  targetRole,

                active:
                  true,

                campaignId:
                  introducer.campaignId,

                municipalityId:
                  introducer.municipalityId,

                municipalityName:
                  introducer.municipalityName ||
                  '',

                structureId:
                  introducer.structureId,

                structureDocumentId:
                  introducer.structureDocumentId ||
                  '',

                structureName:
                  introducer.structureName ||
                  '',

                parentUserId:
                  parentUid,

                parentPersonId,

                parentUserName:
                  parent.person.name ||
                  '',

                ancestorIds:
                  ancestorUserIds,

                ancestorPersonIds,

                introducedByUserId:
                  introducer.uid,

                introducedByPersonId:
                  introducerPersonId,

                createdBy:
                  introducer.uid,

                createdByRole:
                  introducer.role,

                mustChangePassword:
                  true,

                createdAt:
                  now,

                updatedAt:
                  now,

                version:
                  1
              }
            );


            tx.create(
              logRef,
              {
                action:
                  'UPWARD_INCORPORATION',

                campaignId:
                  introducer.campaignId,

                municipalityId:
                  introducer.municipalityId,

                structureId:
                  introducer.structureId,

                introducerUserId:
                  introducer.uid,

                introducedByPersonId:
                  introducerPersonId,

                parentPersonId,

                parentUserId:
                  parentUid,

                targetPersonId:
                  personRef.id,

                targetUserId:
                  authUser.uid,

                targetRole,

                targetName:
                  name,

                targetUserEmail:
                  email,

                createdBy:
                  introducer.uid,

                createdByRole:
                  introducer.role,

                createdAt:
                  now
              }
            );
          }
        );

      } catch (error) {

        try {
          await auth.deleteUser(
            authUser.uid
          );
        } catch (rollbackError) {
          console.error(
            'No fue posible revertir Authentication:',
            rollbackError
          );
        }

        if (
          error instanceof HttpsError
        ) {
          throw error;
        }

        console.error(
          'Error en incorporación ascendente:',
          error
        );

        throw new HttpsError(
          'internal',
          'No fue posible guardar la incorporación.'
        );
      }


      return {
        success:
          true,

        person: {
          personId:
            personRef.id,

          accountUid:
            authUser.uid,

          hasDigitalAccount:
            true,

          mustChangePassword:
            true
        },

        membership: {
          role:
            targetRole,

          parentPersonId,

          introducedByPersonId:
            introducerPersonId,

          structureName:
            introducer.structureName ||
            '',

          municipalityName:
            introducer.municipalityName ||
            ''
        }
      };
    }
  );


module.exports = {
  getUpwardIncorporationContext,
  createUpwardIncorporation,

  _test: {
    isParentInIntroducerLineage,
    readAuthorizedParent
  }
};