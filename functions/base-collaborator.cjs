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


const OPTIONS = {
  region: 'us-central1',
  timeoutSeconds: 60
};


function fail(code, message) {
  throw new HttpsError(
    code,
    message
  );
}


function cleanText(
  value,
  max = 160
) {
  const result =
    String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ');

  if (result.length > max) {
    fail(
      'invalid-argument',
      'Uno de los campos excede la longitud permitida.'
    );
  }

  return result;
}


function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}


function normalizePhone(value) {
  const digits =
    String(value ?? '')
      .replace(/\D/g, '');

  if (
    digits.length === 12 &&
    digits.startsWith('52')
  ) {
    return digits.slice(2);
  }

  return digits;
}


function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}


exports.createBaseCollaborator =
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

      const auth =
        getAuth();

      const creatorUid =
        request.auth.uid;


      // ==================================================
      // PERFIL DEL PARTICIPANTE
      // ==================================================

      const creatorSnapshot =
        await db
          .collection('usuarios')
          .doc(creatorUid)
          .get();


      if (!creatorSnapshot.exists) {
        fail(
          'permission-denied',
          'El usuario no tiene un perfil autorizado.'
        );
      }


      const creatorProfile =
        creatorSnapshot.data();


      if (
        creatorProfile.active !== true ||
        creatorProfile.role !== 'participante'
      ) {
        fail(
          'permission-denied',
          'Sólo un Participante activo puede registrar colaboradores de base.'
        );
      }


      const campaignId =
        cleanText(
          creatorProfile.campaignId,
          128
        );


      if (!campaignId) {
        fail(
          'failed-precondition',
          'El Participante no tiene campaña asignada.'
        );
      }


      // ==================================================
      // BUILD-123B1
      // IDENTIDAD CANONICA DEL PARTICIPANTE CREADOR
      //
      // creatorUid    = cuenta digital compatible.
      // creatorPersonId = identidad permanente.
      // ==================================================

      const creatorIdentity =
        await resolveCanonicalPersonForAccount({

          db,

          accountUid:
            creatorUid,

          profile:
            creatorProfile,

          campaignId
        });


      const creatorPersonId =
        creatorIdentity.personId;


      // ==================================================
      // DATOS
      // ==================================================

      const data =
        request.data || {};


      const name =
        cleanText(
          data.name,
          120
        );


      const email =
        normalizeEmail(
          data.email
        );


      const phone =
        normalizePhone(
          data.phone
        );


      const hasWhatsApp =
        typeof data.hasWhatsApp ===
          'boolean'
          ? data.hasWhatsApp
          : null;


      const locality =
        cleanText(
          data.locality,
          120
        );


      const street =
        cleanText(
          data.street,
          160
        );


      const houseNumber =
        cleanText(
          data.houseNumber,
          30
        );


      const password =
        String(
          data.password || ''
        );


      // ==================================================
      // VALIDACIONES
      // ==================================================

      if (name.length < 2) {
        fail(
          'invalid-argument',
          'Ingrese un nombre válido.'
        );
      }


      if (!isValidEmail(email)) {
        fail(
          'invalid-argument',
          'Ingrese un correo electrónico válido.'
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
          'Ingrese un teléfono válido de entre 10 y 15 dígitos.'
        );
      }


      if (hasWhatsApp === null) {
        fail(
          'invalid-argument',
          'Debe indicar si el teléfono tiene WhatsApp.'
        );
      }


      if (
        hasWhatsApp === true &&
        !phone
      ) {
        fail(
          'invalid-argument',
          'Debe ingresar el teléfono que tiene WhatsApp.'
        );
      }


      if (locality.length < 2) {
        fail(
          'invalid-argument',
          'Ingrese una población válida.'
        );
      }


      if (street.length < 2) {
        fail(
          'invalid-argument',
          'Ingrese una calle válida.'
        );
      }


      if (!houseNumber) {
        fail(
          'invalid-argument',
          'Ingrese un número válido o S/N.'
        );
      }


      if (password.length < 6) {
        fail(
          'invalid-argument',
          'La contraseña temporal debe tener al menos 6 caracteres.'
        );
      }


      // ==================================================
      // FIREBASE AUTH
      // ==================================================

      let authUser =
        null;


      try {

        authUser =
          await auth.createUser({
            email,
            password,
            displayName: name,
            disabled: false
          });

      } catch (error) {

        console.error(
          'Error al crear colaborador en Authentication:',
          error
        );


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
            'La contraseña temporal no cumple los requisitos.'
          );
        }


        fail(
          'internal',
          'No fue posible crear la cuenta del colaborador.'
        );
      }


      // ==================================================
      // REFERENCIAS
      // ==================================================

      const userRef =
        db
          .collection('usuarios')
          .doc(authUser.uid);


      const personRef =
        db
          .collection('persons')
          .doc();


      const personId =
        personRef.id;


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


      const logRef =
        db
          .collection('logs')
          .doc();


      const ancestorIds =
        [
          creatorUid,
          ...(
            Array.isArray(
              creatorProfile.ancestorIds
            )
              ? creatorProfile.ancestorIds
              : []
          )
        ]
          .filter(
            (
              value,
              index,
              list
            ) =>
              typeof value === 'string' &&
              value.length > 0 &&
              list.indexOf(value) === index
          );


      const commonTerritory = {

        campaignId,

        municipalityId:
          creatorProfile.municipalityId ||
          '',

        municipalityName:
          creatorProfile.municipalityName ||
          '',

        coordinatorId:
          creatorProfile.coordinatorId ||
          '',

        coordinatorName:
          creatorProfile.coordinatorName ||
          '',

        structureId:
          creatorProfile.structureId ||
          '',

        structureDocumentId:
          creatorProfile.structureDocumentId ||
          '',

        structureName:
          creatorProfile.structureName ||
          '',

        structureChiefId:
          creatorProfile.structureChiefId ||
          null,

        structureChiefName:
          creatorProfile.structureChiefName ||
          ''
      };


      // ==================================================
      // PERFIL USUARIO
      // ==================================================

      const userProfile = {

        uid:
          authUser.uid,

        personId,

        membershipId,

        name,

        email,

        phone,

        hasWhatsApp,

        locality,

        street,

        houseNumber,

        role:
          'colaborador_base',

        active:
          true,

        ...commonTerritory,

        parentUserId:
          creatorUid,

        parentPersonId:
          creatorPersonId,

        parentUserName:
          creatorProfile.name ||
          '',

        ancestorIds,

        createdBy:
          creatorUid,

        createdByRole:
          creatorProfile.role,

        mustChangePassword:
          true,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),

        version:
          1
      };


      // ==================================================
      // PERSONA CANONICA
      // ==================================================

      const canonicalPerson = {

        personId,

        accountUid:
          authUser.uid,

        name,

        email,

        phone,

        hasWhatsApp,

        locality,

        street,

        houseNumber,

        active:
          true,

        campaignId,

        municipalityId:
          commonTerritory.municipalityId,

        municipalityName:
          commonTerritory.municipalityName,

        structureId:
          commonTerritory.structureId,

        structureDocumentId:
          commonTerritory.structureDocumentId,

        structureName:
          commonTerritory.structureName,

        identityStatus:
          'digital',

        source:
          'hierarchy_registration',

        introducedByUserId:
          creatorUid,

        introducedByPersonId:
          creatorPersonId,

        referredByUserId:
          creatorUid,

        mentorUserId:
          creatorUid,

        createdByUserId:
          creatorUid,

        createdByRole:
          creatorProfile.role,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),

        version:
          1
      };


      // ==================================================
      // MEMBRESIA
      // ==================================================

      const territorialMembership = {

        membershipId,

        personId,

        accountUid:
          authUser.uid,

        campaignId,

        municipalityId:
          commonTerritory.municipalityId,

        municipalityName:
          commonTerritory.municipalityName,

        structureId:
          commonTerritory.structureId,

        structureDocumentId:
          commonTerritory.structureDocumentId,

        structureName:
          commonTerritory.structureName,

        role:
          'colaborador_base',

        active:
          true,

        parentUserId:
          creatorUid,

        parentPersonId:
          creatorPersonId,

        parentUserName:
          creatorProfile.name ||
          '',

        mentorUserId:
          creatorUid,

        introducedByUserId:
          creatorUid,

        introducedByPersonId:
          creatorPersonId,

        referredByUserId:
          creatorUid,

        ancestorUserIds:
          ancestorIds,

        source:
          'hierarchy_registration',

        activityPreferences: {
          eventos_mitines: true
        },

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),

        version:
          1
      };


      // ==================================================
      // AUDITORIA
      // ==================================================

      const auditRecord = {

        action:
          'CREATE_BASE_COLLABORATOR',

        campaignId,

        municipalityId:
          commonTerritory.municipalityId,

        structureId:
          commonTerritory.structureId,

        structureDocumentId:
          commonTerritory.structureDocumentId,

        parentUserId:
          creatorUid,

        parentUserName:
          creatorProfile.name ||
          '',

        targetUserId:
          authUser.uid,

        targetUserName:
          name,

        targetUserEmail:
          email,

        phone,

        hasWhatsApp,

        locality,

        street,

        houseNumber,

        personId,

        membershipId,

        createdBy:
          creatorUid,

        createdByRole:
          creatorProfile.role,

        createdAt:
          FieldValue.serverTimestamp()
      };


      // ==================================================
      // FIRESTORE ATOMICO
      // ==================================================

      try {

        const batch =
          db.batch();


        batch.create(
          userRef,
          userProfile
        );


        batch.create(
          personRef,
          canonicalPerson
        );


        batch.create(
          membershipRef,
          territorialMembership
        );


        batch.create(
          logRef,
          auditRecord
        );


        await batch.commit();

      } catch (error) {

        console.error(
          'Error al guardar colaborador:',
          error
        );


        try {

          await auth.deleteUser(
            authUser.uid
          );

        } catch (
          rollbackError
        ) {

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


        fail(
          'internal',
          'No fue posible guardar el colaborador.'
        );
      }


      // ==================================================
      // RESPUESTA
      // ==================================================

      return {

        success:
          true,

        user: {

          uid:
            authUser.uid,

          personId,

          membershipId,

          name,

          email,

          phone,

          hasWhatsApp,

          locality,

          street,

          houseNumber,

          role:
            'colaborador_base',

          active:
            true,

          campaignId,

          municipalityId:
            commonTerritory.municipalityId,

          municipalityName:
            commonTerritory.municipalityName,

          structureId:
            commonTerritory.structureId,

          structureDocumentId:
            commonTerritory.structureDocumentId,

          structureName:
            commonTerritory.structureName,

          parentUserId:
            creatorUid,

          parentUserName:
            creatorProfile.name ||
            '',

          mustChangePassword:
            true
        },

        message:
          `${name} fue registrado como colaborador de base de ${creatorProfile.name || 'su Participante responsable'}.`
      };
    }
  );


exports._test = {
  normalizeEmail,
  normalizePhone,
  isValidEmail
};
