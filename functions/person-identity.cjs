'use strict';

// ======================================================
// TERRA CAMPAIGN
// BUILD-118C-3B1
// BUSQUEDA GLOBAL SEGURA DE PERSONAS
//
// Primera defensa contra duplicados.
//
// IMPORTANTE:
// - NO crea personas.
// - NO reasigna personas.
// - NO fusiona perfiles.
// - NO expone INE ni datos sensibles.
// - Busca en toda la campaña del usuario autenticado.
// ======================================================

const {
  onCall,
  HttpsError
} = require('firebase-functions/v2/https');

const {
  getFirestore
} = require('firebase-admin/firestore');


const {
  createHash
} = require('node:crypto');


const OPTIONS = {
  region: 'us-central1',
  timeoutSeconds: 60
};


const ALLOWED_ROLES =
  new Set([
    'admin',
    'lider_principal',
    'coordinador_municipal',
    'jefe_estructura',
    'integrante',
    'participante'
  ]);


function fail(
  code,
  message
) {

  throw new HttpsError(
    code,
    message
  );
}


function normalizeIdentityText(
  value
) {

  return String(
    value || ''
  )
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9\s]/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


function normalizeIdentityPhone(
  value
) {

  return String(
    value || ''
  )
    .replace(
      /\D/g,
      ''
    );
}


// ======================================================
// EQUIVALENCIA TELEFONICA
//
// TERRA opera actualmente en México.
// Se considera equivalente:
//
// 3221234567
// +52 3221234567
//
// El teléfono es SEÑAL DE COINCIDENCIA,
// no identidad legal definitiva.
// Una familia puede compartir número.
// ======================================================

function phoneIdentityKeys(
  value
) {

  const digits =
    normalizeIdentityPhone(
      value
    );


  if (!digits) {
    return [];
  }


  const keys =
    new Set([
      digits
    ]);


  if (
    digits.length === 12 &&
    digits.startsWith('52')
  ) {
    keys.add(
      digits.slice(2)
    );
  }


  if (
    digits.length === 10
  ) {
    keys.add(
      `52${digits}`
    );
  }


  return [
    ...keys
  ];
}


function phonesEquivalent(
  left,
  right
) {

  const a =
    phoneIdentityKeys(
      left
    );

  const b =
    new Set(
      phoneIdentityKeys(
        right
      )
    );


  return (
    a.length > 0 &&
    a.some(
      key =>
        b.has(key)
    )
  );
}


function maskedPhone(
  value
) {

  const digits =
    normalizeIdentityPhone(
      value
    );


  if (!digits) {
    return '';
  }


  return (
    '••••' +
    digits.slice(-4)
  );
}


// ======================================================
// CALCULAR COINCIDENCIA
//
// NO decide automáticamente que sean la misma persona.
// Solo genera candidatos para revisión humana.
// ======================================================

function personCandidateMatch(
  query,
  profile
) {

  if (!profile) {
    return null;
  }


  const reasons = [];

  let score = 0;


  const queryName =
    normalizeIdentityText(
      query?.name
    );

  const candidateName =
    normalizeIdentityText(
      profile.name
    );


  const queryLocality =
    normalizeIdentityText(
      query?.locality
    );

  const candidateLocality =
    normalizeIdentityText(
      profile.locality
    );


  const queryStreet =
    normalizeIdentityText(
      query?.street
    );

  const candidateStreet =
    normalizeIdentityText(
      profile.street
    );


  const queryHouseNumber =
    normalizeIdentityText(
      query?.houseNumber
    );

  const candidateHouseNumber =
    normalizeIdentityText(
      profile.houseNumber
    );


  const phoneMatch =
    phonesEquivalent(
      query?.phone,
      profile.phone
    );


  const nameMatch =
    Boolean(
      queryName &&
      candidateName &&
      queryName ===
        candidateName
    );


  const localityMatch =
    Boolean(
      queryLocality &&
      candidateLocality &&
      queryLocality ===
        candidateLocality
    );


  const streetMatch =
    Boolean(
      queryStreet &&
      candidateStreet &&
      queryStreet ===
        candidateStreet
    );


  const houseMatch =
    Boolean(
      queryHouseNumber &&
      candidateHouseNumber &&
      queryHouseNumber ===
        candidateHouseNumber
    );


  if (phoneMatch) {

    score += 100;

    reasons.push(
      'phone'
    );
  }


  if (nameMatch) {

    score += 50;

    reasons.push(
      'name'
    );
  }


  if (localityMatch) {

    score += 20;

    reasons.push(
      'locality'
    );
  }


  if (streetMatch) {

    score += 15;

    reasons.push(
      'street'
    );
  }


  if (houseMatch) {

    score += 10;

    reasons.push(
      'houseNumber'
    );
  }


  // ==================================================
  // REGLAS PARA MOSTRAR CANDIDATO
  //
  // A) teléfono equivalente
  // B) nombre exacto + población exacta
  // C) nombre exacto + calle + número
  //
  // Nombre solo NO basta.
  // ==================================================

  const candidate =
    phoneMatch ||
    (
      nameMatch &&
      localityMatch
    ) ||
    (
      nameMatch &&
      streetMatch &&
      houseMatch
    );


  if (!candidate) {
    return null;
  }


  return {
    score,
    reasons
  };
}


// ======================================================
// REFERENCIA OPACA DE PERSONA
//
// Nunca se entrega UID ni personId al frontend.
// La referencia se vuelve a validar en backend antes
// de cualquier acción posterior.
// ======================================================

function opaquePersonCandidateRef(
  campaignId,
  source,
  id
) {

  return createHash(
    'sha256'
  )
    .update(
      JSON.stringify([
        campaignId,
        source,
        id,
        'person-candidate-v1'
      ])
    )
    .digest(
      'hex'
    );
}


// ======================================================
// CLAVE CANONICA PARA EVITAR DOBLE RESULTADO
//
// Si una PERSONA ya tiene accountUid,
// el registro PERSONA prevalece sobre usuarios.
// No se fusiona por nombre, teléfono ni domicilio.
// ======================================================

function identityRecordKey(
  record
) {

  if (
    record?.source ===
      'user'
  ) {

    return `account:${
      record.id
    }`;
  }


  if (
    record?.source ===
      'person'
  ) {

    const accountUid =
      typeof record
        ?.profile
        ?.accountUid ===
          'string'
        ? record.profile
            .accountUid
            .trim()
        : '';


    if (accountUid) {

      return `account:${
        accountUid
      }`;
    }


    return `person:${
      record.id
    }`;
  }


  return `unknown:${
    record?.id || ''
  }`;
}


function mergeIdentityRecords(
  userRecords,
  personRecords
) {

  const records =
    new Map();


  for (
    const record of
    Array.isArray(
      userRecords
    )
      ? userRecords
      : []
  ) {

    records.set(
      identityRecordKey(
        record
      ),
      record
    );
  }


  // PERSONA es el modelo canónico.
  // Si está vinculada con una cuenta existente,
  // sustituye el resultado duplicado de usuarios.
  for (
    const record of
    Array.isArray(
      personRecords
    )
      ? personRecords
      : []
  ) {

    records.set(
      identityRecordKey(
        record
      ),
      record
    );
  }


  return [
    ...records.values()
  ];
}


// ======================================================
// CALLABLE
// ======================================================

exports.searchPersonCandidates =
  onCall(
    OPTIONS,

    async request => {

      if (!request.auth) {

        fail(
          'unauthenticated',
          'Inicia sesión.'
        );
      }


      const db =
        getFirestore();


      const callerSnapshot =
        await db
          .collection(
            'usuarios'
          )
          .doc(
            request.auth.uid
          )
          .get();


      if (
        !callerSnapshot.exists
      ) {

        fail(
          'permission-denied',
          'Perfil no autorizado.'
        );
      }


      const caller = {
        ...callerSnapshot.data(),
        uid:
          callerSnapshot.id
      };


      if (
        caller.active !== true ||
        !caller.campaignId ||
        !ALLOWED_ROLES.has(
          caller.role
        )
      ) {

        fail(
          'permission-denied',
          'Perfil no autorizado.'
        );
      }


      const data =
        request.data || {};


      const phone =
        normalizeIdentityPhone(
          data.phone
        );


      const name =
        normalizeIdentityText(
          data.name
        );


      const locality =
        normalizeIdentityText(
          data.locality
        );


      const street =
        normalizeIdentityText(
          data.street
        );


      const houseNumber =
        normalizeIdentityText(
          data.houseNumber
        );


      if (
        phone &&
        (
          phone.length < 10 ||
          phone.length > 15
        )
      ) {

        fail(
          'invalid-argument',
          'El teléfono para búsqueda no es válido.'
        );
      }


      // Para evitar consultas abiertas que
      // puedan convertirse en directorio de campaña:
      //
      // - teléfono válido
      //   O
      // - nombre + población.
      if (
        !phone &&
        (
          name.length < 4 ||
          locality.length < 2
        )
      ) {

        fail(
          'invalid-argument',
          'Ingresa teléfono o nombre completo y población para buscar coincidencias.'
        );
      }


      // ==================================================
      // IDENTIDAD UNIFICADA
      //
      // usuarios:
      // personas que tienen cuenta digital.
      //
      // persons:
      // identidad operacional canónica, incluyendo
      // colaboradores sin cuenta.
      // ==================================================

      const [
        usersSnapshot,
        personsSnapshot
      ] =
        await Promise.all([

          db
            .collection(
              'usuarios'
            )
            .where(
              'campaignId',
              '==',
              caller.campaignId
            )
            .limit(
              1001
            )
            .get(),

          db
            .collection(
              'persons'
            )
            .where(
              'campaignId',
              '==',
              caller.campaignId
            )
            .limit(
              1001
            )
            .get()
        ]);


      if (
        usersSnapshot.size > 1000 ||
        personsSnapshot.size > 1000
      ) {

        fail(
          'resource-exhausted',
          'La campaña requiere el índice de identidad escalable antes de continuar la búsqueda.'
        );
      }


      const identityRecords =
        mergeIdentityRecords(

          usersSnapshot.docs.map(
            document => ({
              source:
                'user',

              id:
                document.id,

              profile:
                document.data()
            })
          ),

          personsSnapshot.docs.map(
            document => ({
              source:
                'person',

              id:
                document.id,

              profile:
                document.data()
            })
          )
        );


      const query = {
        phone:
          data.phone || '',

        name:
          data.name || '',

        locality:
          data.locality || '',

        street:
          data.street || '',

        houseNumber:
          data.houseNumber || ''
      };


      const candidates = [];


      for (
        const record of
        identityRecords
      ) {

        const profile =
          record.profile;


        const match =
          personCandidateMatch(
            query,
            profile
          );


        if (!match) {
          continue;
        }


        candidates.push({

          // Referencia opaca.
          // No expone UID ni personId.
          candidateRef:
            opaquePersonCandidateRef(
              caller.campaignId,
              record.source,
              record.id
            ),

          name:
            typeof profile.name ===
              'string'
              ? profile.name
              : 'Sin nombre',

          locality:
            typeof profile.locality ===
              'string'
              ? profile.locality
              : '',

          // Solo pista parcial.
          // Nunca teléfono completo.
          phoneHint:
            maskedPhone(
              profile.phone
            ),

          matchScore:
            match.score,

          matchReasons:
            match.reasons,

          requiresHumanReview:
            true
        });
      }


      candidates.sort(
        (a, b) => {

          if (
            b.matchScore !==
            a.matchScore
          ) {
            return (
              b.matchScore -
              a.matchScore
            );
          }


          return a.name.localeCompare(
            b.name,
            'es'
          );
        }
      );


      return {

        success:
          true,

        candidates:
          candidates.slice(
            0,
            20
          ),

        totalCandidates:
          candidates.length,

        limited:
          candidates.length > 20,

        // Esta versión no declara duplicados
        // automáticamente.
        duplicateDecision:
          'human_review_required'
      };
    }
  );


// ======================================================
// HELPERS PARA PRUEBAS
// ======================================================

exports._test = {
  normalizeIdentityText,
  normalizeIdentityPhone,
  phoneIdentityKeys,
  phonesEquivalent,
  maskedPhone,
  personCandidateMatch,
  opaquePersonCandidateRef,
  identityRecordKey,
  mergeIdentityRecords
};
