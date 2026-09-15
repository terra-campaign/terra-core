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
  createHash
} = require(
  'node:crypto'
);


const OPTIONS = {
  region:
    'us-central1',

  timeoutSeconds:
    60
};


const NEXT_AFFILIATION_ROLE = {

  jefe_estructura:
    'integrante',

  integrante:
    'participante',

  participante:
    'colaborador_base'
};


const ROLE_LABELS = {

  jefe_estructura:
    'Responsable de estructura',

  integrante:
    'Integrante',

  participante:
    'Participante',

  colaborador_base:
    'Colaborador de base'
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


function cleanText(
  value,
  max
) {

  if (
    value == null
  ) {
    return '';
  }


  if (
    typeof value !==
      'string'
  ) {

    fail(
      'invalid-argument',
      'Hay un campo con formato inválido.'
    );
  }


  const result =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      );


  if (
    result.length >
      max
  ) {

    fail(
      'invalid-argument',
      'Uno de los campos excede la longitud permitida.'
    );
  }


  return result;
}


function normalizeText(
  value
) {

  return cleanText(
    value,
    240
  )
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase();
}


function normalizePhone(
  value
) {

  const digits =
    String(
      value || ''
    )
      .replace(
        /\D/g,
        ''
      );


  if (!digits) {
    return '';
  }


  // México:
  // si viene 52 + 10 dígitos,
  // almacenamos los 10 dígitos nacionales.
  if (
    digits.length === 12 &&
    digits.startsWith(
      '52'
    )
  ) {

    return digits.slice(
      2
    );
  }


  return digits;
}


function hash(
  ...parts
) {

  return createHash(
    'sha256'
  )
    .update(
      JSON.stringify(
        parts
      )
    )
    .digest(
      'hex'
    );
}


function nextAffiliationRole(
  role
) {

  return (
    NEXT_AFFILIATION_ROLE[
      role
    ] ||
    null
  );
}


function roleLabel(
  role
) {

  return (
    ROLE_LABELS[
      role
    ] ||
    role ||
    ''
  );
}


async function readCaller(
  db,
  request
) {

  if (
    !request.auth
  ) {

    fail(
      'unauthenticated',
      'Inicia sesión.'
    );
  }


  const snapshot =
    await db
      .collection(
        'usuarios'
      )
      .doc(
        request.auth.uid
      )
      .get();


  if (
    !snapshot.exists
  ) {

    fail(
      'permission-denied',
      'Perfil no autorizado.'
    );
  }


  const profile = {

    ...snapshot.data(),

    uid:
      snapshot.id
  };


  const targetRole =
    nextAffiliationRole(
      profile.role
    );


  if (
    profile.active !== true ||
    !profile.campaignId ||
    !targetRole
  ) {

    fail(
      'permission-denied',
      'Esta cuenta no tiene habilitada la afiliación rápida.'
    );
  }


  if (
    !profile.municipalityId
  ) {

    fail(
      'failed-precondition',
      'La cuenta no tiene municipio territorial definido.'
    );
  }


  if (
    !profile.structureId
  ) {

    fail(
      'failed-precondition',
      'La cuenta no tiene estructura territorial definida.'
    );
  }


  return {
    ...profile,
    targetRole
  };
}


// ======================================================
// DUPLICADO FUERTE
//
// No se fusiona automáticamente por nombre.
// ======================================================

async function assertNoStrongDuplicate({
  db,
  campaignId,
  name,
  locality,
  phone,
  street,
  houseNumber
}) {

  const [
    personsSnapshot,
    usersSnapshot
  ] =
    await Promise.all([

      db
        .collection(
          'persons'
        )
        .where(
          'campaignId',
          '==',
          campaignId
        )
        .limit(
          1001
        )
        .get(),

      db
        .collection(
          'usuarios'
        )
        .where(
          'campaignId',
          '==',
          campaignId
        )
        .limit(
          1001
        )
        .get()
    ]);


  if (
    personsSnapshot.size >
      1000 ||
    usersSnapshot.size >
      1000
  ) {

    fail(
      'resource-exhausted',
      'La campaña requiere el índice de identidad escalable antes de continuar.'
    );
  }


  const normalizedPhone =
    normalizePhone(
      phone
    );


  const normalizedName =
    normalizeText(
      name
    );


  const normalizedLocality =
    normalizeText(
      locality
    );


  const normalizedStreet =
    normalizeText(
      street
    );


  const normalizedHouse =
    normalizeText(
      houseNumber
    );


  const records = [

    ...personsSnapshot.docs.map(
      item =>
        item.data()
    ),

    ...usersSnapshot.docs.map(
      item =>
        item.data()
    )
  ];


  for (
    const record of
    records
  ) {

    const recordPhone =
      normalizePhone(
        record.phone
      );


    if (
      normalizedPhone &&
      recordPhone &&
      normalizedPhone ===
        recordPhone
    ) {

      fail(
        'already-exists',
        'Ya existe una persona en TERRA con ese teléfono.'
      );
    }


    if (
      normalizedStreet &&
      normalizedHouse &&
      normalizedName ===
        normalizeText(
          record.name
        ) &&
      normalizedLocality ===
        normalizeText(
          record.locality
        ) &&
      normalizedStreet ===
        normalizeText(
          record.street
        ) &&
      normalizedHouse ===
        normalizeText(
          record.houseNumber
        )
    ) {

      fail(
        'already-exists',
        'Ya existe una persona con el mismo nombre y domicilio.'
      );
    }
  }
}


// ======================================================
// CONTEXTO PARA LA PANTALLA
// ======================================================

exports.getQuickAffiliationContext =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const caller =
        await readCaller(
          db,
          request
        );


      return {

        success:
          true,

        caller: {

          name:
            caller.name ||
            '',

          role:
            caller.role,

          roleLabel:
            roleLabel(
              caller.role
            ),

          municipalityName:
            caller
              .municipalityName ||
            '',

          structureName:
            caller
              .structureName ||
            ''
        },

        targetRole:
          caller.targetRole,

        targetRoleLabel:
          roleLabel(
            caller.targetRole
          )
      };
    }
  );


// ======================================================
// CREAR AFILIACION
// ======================================================

exports.createQuickAffiliation =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const caller =
        await readCaller(
          db,
          request
        );


      const data =
        request.data ||
        {};


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


      const hasWhatsApp =
        phone
          ? data.hasWhatsApp ===
              true
          : false;


      if (
        name.length < 2
      ) {

        fail(
          'invalid-argument',
          'Ingrese el nombre completo.'
        );
      }


      if (
        locality.length < 2
      ) {

        fail(
          'invalid-argument',
          'Ingrese la población.'
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


      await assertNoStrongDuplicate({

        db,

        campaignId:
          caller.campaignId,

        name,

        locality,

        phone,

        street,

        houseNumber
      });


      const personRef =
        db
          .collection(
            'persons'
          )
          .doc();


      const membershipId =
        hash(
          'territorial-membership',
          caller.campaignId,
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


      const logRef =
        db
          .collection(
            'logs'
          )
          .doc();


      const ancestorUserIds =
        [
          caller.uid,
          ...(
            Array.isArray(
              caller.ancestorIds
            )
              ? caller
                  .ancestorIds
              : []
          )
        ]
          .filter(
            (
              value,
              index,
              list
            ) =>
              typeof value ===
                'string' &&
              value.length &&
              list.indexOf(
                value
              ) ===
                index
          );


      const now =
        FieldValue
          .serverTimestamp();


      await db.runTransaction(
        async tx => {

          const [
            personSnapshot,
            membershipSnapshot
          ] =
            await Promise.all([

              tx.get(
                personRef
              ),

              tx.get(
                membershipRef
              )
            ]);


          if (
            personSnapshot.exists ||
            membershipSnapshot.exists
          ) {

            fail(
              'already-exists',
              'No fue posible generar una identidad única. Intenta nuevamente.'
            );
          }


          tx.create(
            personRef,
            {

              personId:
                personRef.id,

              name,

              locality,

              phone,

              hasWhatsApp,

              street,

              houseNumber,

              active:
                true,

              campaignId:
                caller.campaignId,

              municipalityId:
                caller
                  .municipalityId,

              municipalityName:
                caller
                  .municipalityName ||
                '',

              structureId:
                caller
                  .structureId,

              structureDocumentId:
                caller
                  .structureDocumentId ||
                '',

              structureName:
                caller
                  .structureName ||
                '',

              accountUid:
                null,

              identityStatus:
                'minimal',

              source:
                'quick_affiliation',

              introducedByUserId:
                caller.uid,

              referredByUserId:
                caller.uid,

              mentorUserId:
                caller.uid,

              createdByUserId:
                caller.uid,

              createdByRole:
                caller.role,

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

              campaignId:
                caller.campaignId,

              municipalityId:
                caller
                  .municipalityId,

              municipalityName:
                caller
                  .municipalityName ||
                '',

              structureId:
                caller
                  .structureId,

              structureDocumentId:
                caller
                  .structureDocumentId ||
                '',

              structureName:
                caller
                  .structureName ||
                '',

              role:
                caller.targetRole,

              active:
                true,

              parentUserId:
                caller.uid,

              parentUserName:
                caller.name ||
                '',

              mentorUserId:
                caller.uid,

              introducedByUserId:
                caller.uid,

              referredByUserId:
                caller.uid,

              ancestorUserIds,

              source:
                'quick_affiliation',

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
            logRef,
            {

              action:
                'AFFILIATE_PERSON',

              campaignId:
                caller.campaignId,

              municipalityId:
                caller
                  .municipalityId,

              structureId:
                caller
                  .structureId,

              personId:
                personRef.id,

              membershipId,

              targetRole:
                caller.targetRole,

              targetName:
                name,

              createdBy:
                caller.uid,

              createdByRole:
                caller.role,

              createdAt:
                now
            }
          );
        }
      );


      return {

        success:
          true,

        person: {

          personId:
            personRef.id,

          name,

          locality,

          phone,

          hasWhatsApp,

          street,

          houseNumber,

          accountUid:
            null
        },

        membership: {

          role:
            caller.targetRole,

          roleLabel:
            roleLabel(
              caller.targetRole
            ),

          parentUserName:
            caller.name ||
            '',

          structureName:
            caller
              .structureName ||
            '',

          municipalityName:
            caller
              .municipalityName ||
            ''
        },

        message:
          `${name} fue afiliado correctamente como ${roleLabel(
            caller.targetRole
          )}.`
      };
    }
  );


exports._test = {
  normalizePhone,
  normalizeText,
  nextAffiliationRole,
  roleLabel
};
