'use strict';

const {
  onCall,
  HttpsError,
} =
  require(
    'firebase-functions/v2/https'
  );

const {
  getFirestore,
} =
  require(
    'firebase-admin/firestore'
  );

const {
  resolveCanonicalPersonForAccount,
} =
  require(
    './person-identity.cjs'
  );

const {
  canonicalMembershipDocumentId,
} =
  require(
    './territorial-membership-id.cjs'
  );

const {
  membershipMatchesSubject,
  actorCanAssistTarget,
} =
  require(
    './territorial-assistance-policy.cjs'
  );

const {
  adminCampaignAccessDocumentPath,
  adminCanAccessCampaign,
} =
  require(
    './admin-campaign-access.cjs'
  );


const OPTIONS = {
  region:
    'us-central1',

  timeoutSeconds:
    60,
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


function cleanId(
  value
) {

  return typeof value ===
    'string'
    ? value.trim()
    : '';
}


function cleanText(
  value
) {

  return typeof value ===
    'string'
    ? value.trim()
    : '';
}


function readAccountUid(
  person
) {

  const value =
    cleanId(
      person?.accountUid
    );

  return value ||
    null;
}


exports.getParticipantManagementContext =
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

      const actorUserId =
        request.auth.uid;

      const actorProfileSnapshot =
        await db
          .collection(
            'usuarios'
          )
          .doc(
            actorUserId
          )
          .get();


      if (
        !actorProfileSnapshot.exists
      ) {

        fail(
          'permission-denied',
          'El usuario no tiene un perfil autorizado.'
        );
      }


      const actorProfile = {
        ...actorProfileSnapshot.data(),

        uid:
          actorProfileSnapshot.id,
      };


      if (
        actorProfile.active !==
          true
      ) {

        fail(
          'permission-denied',
          'El usuario no tiene un perfil activo.'
        );
      }


      const data =
        request.data ||
        {};


      const requestedParentPersonId =
        cleanId(
          data.parentPersonId
        );


      let actorPersonId =
        null;

      let campaignId =
        '';

      let parentPersonId =
        requestedParentPersonId;

      let recordingMode =
        'administrative';


      /*
       * ==================================================
       * ADMIN TECNICO
       *
       * No requiere identidad territorial propia.
       * Debe indicar la persona Integrante objetivo.
       * La campaña se obtiene de esa persona y después
       * se valida adminCampaignAccess explícito.
       * ==================================================
       */
      if (
        actorProfile.role ===
          'admin'
      ) {

        if (
          !parentPersonId
        ) {

          fail(
            'invalid-argument',
            'Debe seleccionar un integrante.'
          );
        }

      } else {

        /*
         * ================================================
         * ACTOR TERRITORIAL
         * ================================================
         */
        campaignId =
          cleanId(
            actorProfile.campaignId
          );


        if (
          !campaignId
        ) {

          fail(
            'permission-denied',
            'El usuario no tiene una campaña territorial activa.'
          );
        }


        const actorIdentity =
          await resolveCanonicalPersonForAccount({

            db,

            accountUid:
              actorUserId,

            profile:
              actorProfile,

            campaignId,
          });


        actorPersonId =
          actorIdentity.personId;


        if (
          !parentPersonId
        ) {

          parentPersonId =
            actorPersonId;
        }
      }


      const parentPersonSnapshot =
        await db
          .collection(
            'persons'
          )
          .doc(
            parentPersonId
          )
          .get();


      if (
        !parentPersonSnapshot.exists
      ) {

        fail(
          'not-found',
          'El integrante responsable no existe.'
        );
      }


      const parentPerson =
        parentPersonSnapshot.data();


      const parentCampaignId =
        cleanId(
          parentPerson.campaignId
        );


      if (
        parentPerson.active !==
          true ||
        !parentCampaignId
      ) {

        fail(
          'failed-precondition',
          'El integrante responsable no pertenece a una campaña activa.'
        );
      }


      /*
       * ==================================================
       * AUTORIZACION DE ADMIN TECNICO
       * ==================================================
       */
      let adminAccessRecord =
        null;


      if (
        actorProfile.role ===
          'admin'
      ) {

        campaignId =
          parentCampaignId;


        const accessPath =
          adminCampaignAccessDocumentPath(
            actorUserId,
            campaignId
          );


        const [
          accessSnapshot,
          campaignSnapshot,
        ] =
          await Promise.all([

            db
              .doc(
                accessPath
              )
              .get(),

            db
              .collection(
                'campaigns'
              )
              .doc(
                campaignId
              )
              .get(),
          ]);


        adminAccessRecord =
          accessSnapshot.exists
            ? accessSnapshot.data()
            : null;


        if (
          !adminCanAccessCampaign({

            profile:
              actorProfile,

            adminUid:
              actorUserId,

            campaignId,

            accessRecord:
              adminAccessRecord,
          })
        ) {

          fail(
            'permission-denied',
            'No tiene autorización para consultar esta campaña.'
          );
        }


        const campaign =
          campaignSnapshot.exists
            ? campaignSnapshot.data()
            : null;


        if (
          !campaign ||
          campaign.active !==
            true ||
          cleanId(
            campaign.campaignId
          ) !==
            campaignId
        ) {

          fail(
            'failed-precondition',
            'La campaña seleccionada no está activa.'
          );
        }

      } else {

        if (
          parentCampaignId !==
            campaignId
        ) {

          fail(
            'permission-denied',
            'El integrante responsable pertenece a otra campaña.'
          );
        }
      }


      const parentMembershipId =
        canonicalMembershipDocumentId(
          campaignId,
          parentPersonId
        );


      const parentMembershipSnapshot =
        await db
          .collection(
            'territorialMemberships'
          )
          .doc(
            parentMembershipId
          )
          .get();


      if (
        !parentMembershipSnapshot.exists
      ) {

        fail(
          'failed-precondition',
          'El integrante responsable no tiene membresía territorial canónica.'
        );
      }


      const parentMembership =
        parentMembershipSnapshot.data();


      if (
        !membershipMatchesSubject({

          membership:
            parentMembership,

          membershipId:
            parentMembershipId,

          campaignId,

          personId:
            parentPersonId,
        })
      ) {

        fail(
          'failed-precondition',
          'La membresía territorial del integrante responsable no es válida.'
        );
      }


      if (
        parentMembership.role !==
          'integrante'
      ) {

        fail(
          'failed-precondition',
          'La persona seleccionada no es un integrante.'
        );
      }


      /*
       * ==================================================
       * AUTORIZACION TERRITORIAL
       * ==================================================
       */
      if (
        actorProfile.role !==
          'admin'
      ) {

        recordingMode =
          actorPersonId ===
            parentPersonId
            ? 'self'
            : 'assisted';


        if (
          recordingMode ===
            'self'
        ) {

          if (
            actorProfile.role !==
              'integrante'
          ) {

            fail(
              'permission-denied',
              'Solo un integrante puede consultar directamente su propia base.'
            );
          }

        } else {

          const actorMembershipId =
            canonicalMembershipDocumentId(
              campaignId,
              actorPersonId
            );


          const actorMembershipSnapshot =
            await db
              .collection(
                'territorialMemberships'
              )
              .doc(
                actorMembershipId
              )
              .get();


          if (
            !actorMembershipSnapshot.exists
          ) {

            fail(
              'permission-denied',
              'No tiene una membresía territorial activa.'
            );
          }


          const actorMembership =
            actorMembershipSnapshot.data();


          if (
            !actorCanAssistTarget({

              actorPersonId,

              actorMembership,

              targetMembership:
                parentMembership,

              campaignId,
            })
          ) {

            fail(
              'permission-denied',
              'No tiene autoridad territorial sobre este integrante.'
            );
          }
        }
      }


      /*
       * ==================================================
       * PARTICIPANTES DIRECTOS
       *
       * La relación jerárquica se resuelve por
       * parentPersonId, nunca por parentUserId.
       * ==================================================
       */
      const membershipsSnapshot =
        await db
          .collection(
            'territorialMemberships'
          )
          .where(
            'parentPersonId',
            '==',
            parentPersonId
          )
          .get();


      const participantMemberships =
        membershipsSnapshot.docs
          .map(
            document => ({

              ...document.data(),

              membershipId:
                document.id,
            })
          )
          .filter(
            membership =>
              membership.active ===
                true &&
              membership.role ===
                'participante' &&
              cleanId(
                membership.campaignId
              ) ===
                campaignId &&
              cleanId(
                membership.parentPersonId
              ) ===
                parentPersonId
          );


      let participants =
        [];


      if (
        participantMemberships.length
      ) {

        const personSnapshots =
          await db.getAll(
            ...participantMemberships.map(
              membership =>
                db
                  .collection(
                    'persons'
                  )
                  .doc(
                    membership.personId
                  )
            )
          );


        const membershipByPerson =
          new Map(
            participantMemberships.map(
              membership => [
                membership.personId,
                membership,
              ]
            )
          );


        for (
          const snapshot of
          personSnapshots
        ) {

          if (
            !snapshot.exists
          ) {
            continue;
          }


          const person =
            snapshot.data();

          const membership =
            membershipByPerson.get(
              snapshot.id
            );


          if (
            !membership ||
            person.active ===
              false ||
            cleanId(
              person.campaignId
            ) !==
              campaignId ||
            cleanId(
              membership.parentPersonId
            ) !==
              parentPersonId
          ) {

            continue;
          }


          const accountUid =
            readAccountUid(
              person
            );


          participants.push({

            personId:
              snapshot.id,

            membershipId:
              membership.membershipId,

            accountUid,

            hasDigitalAccount:
              Boolean(
                accountUid
              ),

            name:
              cleanText(
                person.name
              ),

            email:
              cleanText(
                person.email
              ),

            phone:
              cleanText(
                person.phone
              ),

            hasWhatsApp:
              person.hasWhatsApp ===
                true,

            locality:
              cleanText(
                person.locality
              ),

            street:
              cleanText(
                person.street
              ),

            houseNumber:
              cleanText(
                person.houseNumber
              ),

            active:
              person.active !==
                false,

            role:
              'participante',

            parentPersonId:
              cleanId(
                membership.parentPersonId
              ),

            parentUserId:
              cleanId(
                membership.parentUserId
              ) ||
              null,
          });
        }


        participants.sort(
          (a, b) =>
            String(
              a.name
            ).localeCompare(
              String(
                b.name
              ),
              'es',
              {
                sensitivity:
                  'base',
              }
            )
        );
      }


      const parentAccountUid =
        readAccountUid(
          parentPerson
        );


      return {

        success:
          true,

        recordingMode,

        actor: {

          userId:
            actorUserId,

          personId:
            actorPersonId,
        },

        member: {

          personId:
            parentPersonId,

          membershipId:
            parentMembershipId,

          accountUid:
            parentAccountUid,

          hasDigitalAccount:
            Boolean(
              parentAccountUid
            ),

          name:
            cleanText(
              parentPerson.name
            ),

          email:
            cleanText(
              parentPerson.email
            ),

          phone:
            cleanText(
              parentPerson.phone
            ),

          locality:
            cleanText(
              parentPerson.locality
            ),

          active:
            parentPerson.active ===
              true,

          role:
            'integrante',

          campaignId,

          municipalityId:
            cleanId(
              parentMembership.municipalityId
            ),

          municipalityName:
            cleanText(
              parentMembership.municipalityName
            ),

          structureId:
            cleanId(
              parentMembership.structureId
            ),

          structureDocumentId:
            cleanId(
              parentMembership.structureDocumentId
            ),

          structureName:
            cleanText(
              parentMembership.structureName
            ),
        },

        participants,
      };
    }
  );


exports._test = {
  cleanId,
  cleanText,
  readAccountUid,
};
