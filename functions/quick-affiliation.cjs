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
// VISIBILIDAD CANONICA DE INTEGRANTES
//
// Admin:
//   puede consultar estructuras de su campaña.
//
// Responsable de estructura:
//   únicamente su propia estructura.
//
// Coordinador municipal:
//   NO recibe detalle personal.
// ======================================================

function canViewStructureMembers(
  viewer,
  structure
) {

  if (
    !viewer ||
    !structure ||
    viewer.active !== true ||
    !viewer.campaignId ||
    viewer.campaignId !==
      structure.campaignId
  ) {
    return false;
  }


  if (
    viewer.role ===
      'admin'
  ) {
    return true;
  }


  if (
    viewer.role ===
      'jefe_estructura'
  ) {

    return (
      !!viewer.structureId &&
      !!structure.id &&
      viewer.structureId ===
        structure.id
    );
  }


  return false;
}


async function readStructureViewer(
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


  const viewer = {
    ...snapshot.data(),
    uid:
      snapshot.id
  };


  if (
    viewer.active !== true ||
    !viewer.campaignId
  ) {

    fail(
      'permission-denied',
      'Perfil no autorizado.'
    );
  }


  return viewer;
}


// ======================================================
// LISTAR INTEGRANTES DE LA ESTRUCTURA
// ======================================================

exports.getStructureMembers =
  onCall(
    OPTIONS,

    async request => {

      const db =
        getFirestore();


      const viewer =
        await readStructureViewer(
          db,
          request
        );


      const data =
        request.data ||
        {};


      const structureDocumentId =
        cleanText(
          data.structureDocumentId,
          128
        );


      if (
        !structureDocumentId
      ) {

        fail(
          'invalid-argument',
          'Falta identificar la estructura.'
        );
      }


      const structureSnapshot =
        await db
          .collection(
            'estructuras'
          )
          .doc(
            structureDocumentId
          )
          .get();


      if (
        !structureSnapshot.exists
      ) {

        fail(
          'not-found',
          'La estructura no existe.'
        );
      }


      const structure = {
        ...structureSnapshot.data(),
        firestoreId:
          structureSnapshot.id
      };


      if (
        !canViewStructureMembers(
          viewer,
          structure
        )
      ) {

        fail(
          'permission-denied',
          'No tienes autorización para consultar el detalle de integrantes de esta estructura.'
        );
      }


      // Consulta amplia por campaña para evitar depender
      // todavía de un índice compuesto adicional.
      const membershipsSnapshot =
        await db
          .collection(
            'territorialMemberships'
          )
          .where(
            'campaignId',
            '==',
            viewer.campaignId
          )
          .limit(
            1001
          )
          .get();


      if (
        membershipsSnapshot.size >
          1000
      ) {

        fail(
          'resource-exhausted',
          'La campaña requiere un índice escalable antes de continuar.'
        );
      }


      const memberships =
        membershipsSnapshot.docs
          .map(
            document => ({
              ...document.data(),
              membershipId:
                document.id
            })
          )
          .filter(
            membership =>
              membership.active ===
                true &&
              membership.role ===
                'integrante' &&
              membership.structureId ===
                structure.id
          );


      if (
        memberships.length ===
          0
      ) {

        return {
          success:
            true,

          members:
            []
        };
      }


      const personSnapshots =
        await db.getAll(
          ...memberships.map(
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
          memberships.map(
            membership => [
              membership.personId,
              membership
            ]
          )
        );


      const members =
        [];


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
          person.campaignId !==
            viewer.campaignId ||
          person.structureId !==
            structure.id
        ) {
          continue;
        }


        // La PERSONA sigue siendo la identidad canónica
        // aunque posteriormente tenga cuenta digital.
        const accountUid =
          typeof person.accountUid ===
            'string'
            ? person.accountUid.trim()
            : '';


        members.push({

          personRef:
            hash(
              'structure-member',
              viewer.campaignId,
              structure.id,
              snapshot.id
            ),

          name:
            typeof person.name ===
              'string'
              ? person.name
              : '',

          locality:
            typeof person.locality ===
              'string'
              ? person.locality
              : '',

          phone:
            typeof person.phone ===
              'string'
              ? person.phone
              : '',

          hasWhatsApp:
            person.hasWhatsApp ===
              true,

          active:
            person.active !==
              false,

          role:
            'integrante',

          accountUid:
            accountUid ||
            null,

          hasDigitalAccount:
            Boolean(
              accountUid
            ),

          introducedByUserId:
            typeof membership
              .introducedByUserId ===
                'string'
              ? membership
                  .introducedByUserId
              : '',

          introducedByName:
            typeof membership
              .parentUserName ===
                'string'
              ? membership
                  .parentUserName
              : ''
        });
      }


      members.sort(
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
                'base'
            }
          )
      );


      return {

        success:
          true,

        structure: {
          id:
            structure.id,

          name:
            structure.name ||
            ''
        },

        members
      };
    }
  );


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


      // ==================================================
      // BUILD-123B2
      // IDENTIDAD CANONICA DEL ACTOR TERRITORIAL
      //
      // caller.uid      = cuenta digital compatible.
      // callerPersonId  = identidad permanente.
      // ==================================================

      const callerIdentity =
        await resolveCanonicalPersonForAccount({

          db,

          accountUid:
            caller.uid,

          profile:
            caller,

          campaignId:
            caller.campaignId
        });


      const callerPersonId =
        callerIdentity.personId;


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
        canonicalMembershipDocumentId(
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

              introducedByPersonId:
                callerPersonId,

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

              parentPersonId:
                callerPersonId,

              parentUserName:
                caller.name ||
                '',

              mentorUserId:
                caller.uid,

              introducedByUserId:
                caller.uid,

              introducedByPersonId:
                callerPersonId,

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
  roleLabel,
  canViewStructureMembers
};
