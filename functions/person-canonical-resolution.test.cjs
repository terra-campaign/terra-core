'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const {
  resolveCanonicalPersonForAccount
} =
  require(
    './person-identity.cjs'
  );


function snapshot(
  id,
  data
) {

  return {
    id,

    exists:
      data !== undefined,

    data() {
      return data;
    }
  };
}


function fakeDb(
  persons
) {

  const records =
    new Map(
      persons.map(
        person => [
          person.id,
          person
        ]
      )
    );


  return {

    collection(name) {

      assert.equal(
        name,
        'persons'
      );


      return {

        doc(id) {

          return {

            async get() {

              return snapshot(
                id,
                records.get(id)
              );
            }
          };
        },


        where(
          field,
          operator,
          value
        ) {

          assert.equal(
            field,
            'accountUid'
          );

          assert.equal(
            operator,
            '=='
          );


          return {

            limit(limitValue) {

              return {

                async get() {

                  const docs =
                    [...records.values()]
                      .filter(
                        person =>
                          person.accountUid ===
                            value
                      )
                      .slice(
                        0,
                        limitValue
                      )
                      .map(
                        person =>
                          snapshot(
                            person.id,
                            person
                          )
                      );


                  return {
                    docs
                  };
                }
              };
            }
          };
        }
      };
    }
  };
}


async function mustReject(
  operation,
  messagePattern
) {

  await assert.rejects(
    operation,
    messagePattern
  );
}


(async () => {

  // ====================================================
  // 1. CUENTA MODERNA CON personId
  // ====================================================

  const modernDb =
    fakeDb([
      {
        id:
          'PERSON-001',

        personId:
          'PERSON-001',

        accountUid:
          'UID-001',

        campaignId:
          'CAM-001',

        active:
          true,

        name:
          'Persona moderna'
      }
    ]);


  const modern =
    await resolveCanonicalPersonForAccount({

      db:
        modernDb,

      accountUid:
        'UID-001',

      campaignId:
        'CAM-001',

      profile: {
        personId:
          'PERSON-001',

        campaignId:
          'CAM-001',

        active:
          true
      }
    });


  assert.equal(
    modern.personId,
    'PERSON-001'
  );

  assert.equal(
    modern.accountUid,
    'UID-001'
  );


  // ====================================================
  // 2. CUENTA LEGACY SIN personId
  // ====================================================

  const legacyDb =
    fakeDb([
      {
        id:
          'PERSON-LEGACY',

        personId:
          'PERSON-LEGACY',

        accountUid:
          'UID-LEGACY',

        campaignId:
          'CAM-001',

        active:
          true
      }
    ]);


  const legacy =
    await resolveCanonicalPersonForAccount({

      db:
        legacyDb,

      accountUid:
        'UID-LEGACY',

      campaignId:
        'CAM-001',

      profile: {
        campaignId:
          'CAM-001',

        active:
          true
      }
    });


  assert.equal(
    legacy.personId,
    'PERSON-LEGACY'
  );


  // ====================================================
  // 3. CUENTA SIN PERSONA
  // ====================================================

  await mustReject(
    () =>
      resolveCanonicalPersonForAccount({

        db:
          fakeDb([]),

        accountUid:
          'UID-MISSING',

        campaignId:
          'CAM-001',

        profile: {
          campaignId:
            'CAM-001',

          active:
            true
        }
      }),

    /No fue posible resolver de forma única/
  );


  // ====================================================
  // 4. DOS PERSONAS PARA UNA MISMA CUENTA
  // ====================================================

  await mustReject(
    () =>
      resolveCanonicalPersonForAccount({

        db:
          fakeDb([
            {
              id:
                'PERSON-A',

              personId:
                'PERSON-A',

              accountUid:
                'UID-DUP',

              campaignId:
                'CAM-001',

              active:
                true
            },
            {
              id:
                'PERSON-B',

              personId:
                'PERSON-B',

              accountUid:
                'UID-DUP',

              campaignId:
                'CAM-001',

              active:
                true
            }
          ]),

        accountUid:
          'UID-DUP',

        campaignId:
          'CAM-001',

        profile: {
          campaignId:
            'CAM-001',

          active:
            true
        }
      }),

    /No fue posible resolver de forma única/
  );


  // ====================================================
  // 5. CAMPAÑA INCORRECTA
  // ====================================================

  await mustReject(
    () =>
      resolveCanonicalPersonForAccount({

        db:
          modernDb,

        accountUid:
          'UID-001',

        campaignId:
          'CAM-002',

        profile: {
          personId:
            'PERSON-001',

          campaignId:
            'CAM-001',

          active:
            true
        }
      }),

    /identidad territorial activa válida/
  );


  // ====================================================
  // 6. PERSONA CON accountUid INCONSISTENTE
  // ====================================================

  await mustReject(
    () =>
      resolveCanonicalPersonForAccount({

        db:
          fakeDb([
            {
              id:
                'PERSON-002',

              personId:
                'PERSON-002',

              accountUid:
                'OTRO-UID',

              campaignId:
                'CAM-001',

              active:
                true
            }
          ]),

        accountUid:
          'UID-002',

        campaignId:
          'CAM-001',

        profile: {
          personId:
            'PERSON-002',

          campaignId:
            'CAM-001',

          active:
            true
        }
      }),

    /datos de identidad inconsistentes/
  );


  // ====================================================
  // 7. LECTURA MEDIANTE TRANSACCION
  // ====================================================

  const transactionDb =
    fakeDb([
      {
        id:
          'PERSON-TX',

        personId:
          'PERSON-TX',

        accountUid:
          'UID-TX',

        campaignId:
          'CAM-001',

        active:
          true
      }
    ]);


  const tx = {

    async get(target) {

      return target.get();
    }
  };


  const transactional =
    await resolveCanonicalPersonForAccount({

      db:
        transactionDb,

      tx,

      accountUid:
        'UID-TX',

      campaignId:
        'CAM-001',

      profile: {
        personId:
          'PERSON-TX',

        campaignId:
          'CAM-001',

        active:
          true
      }
    });


  assert.equal(
    transactional.personId,
    'PERSON-TX'
  );


  console.log(
    'OK: BUILD-123A canonical account/person resolution tests passed.'
  );

})()
.catch(error => {

  console.error(error);
  process.exitCode = 1;
});
