'use strict';

const {
  HttpsError
} = require(
  'firebase-functions/v2/https'
);


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
  max = 240
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

  if (
    digits.length === 12 &&
    digits.startsWith('52')
  ) {
    return digits.slice(2);
  }

  return digits;
}


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
        .collection('persons')
        .where(
          'campaignId',
          '==',
          campaignId
        )
        .limit(1001)
        .get(),

      db
        .collection('usuarios')
        .where(
          'campaignId',
          '==',
          campaignId
        )
        .limit(1001)
        .get()
    ]);


  if (
    personsSnapshot.size > 1000 ||
    usersSnapshot.size > 1000
  ) {
    fail(
      'resource-exhausted',
      'La campaña requiere el índice de identidad escalable antes de continuar.'
    );
  }


  const normalizedPhone =
    normalizePhone(phone);

  const normalizedName =
    normalizeText(name);

  const normalizedLocality =
    normalizeText(locality);

  const normalizedStreet =
    normalizeText(street);

  const normalizedHouse =
    normalizeText(houseNumber);


  const records = [
    ...personsSnapshot.docs.map(
      item => item.data()
    ),
    ...usersSnapshot.docs.map(
      item => item.data()
    )
  ];


  for (
    const record of records
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


module.exports = {
  cleanText,
  normalizeText,
  normalizePhone,
  assertNoStrongDuplicate,

  _test: {
    cleanText,
    normalizeText,
    normalizePhone
  }
};