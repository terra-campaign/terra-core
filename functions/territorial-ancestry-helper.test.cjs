'use strict';

const test =
  require(
    'node:test'
  );

const assert =
  require(
    'node:assert/strict'
  );

const {
  canonicalChildAncestry
} =
  require(
    './territorial-ancestry.cjs'
  );


test(
  'leader root produces one-level canonical ancestry',
  () => {

    const result =
      canonicalChildAncestry({

        parentUid:
          'leader-uid',

        parentPersonId:
          'leader-person',

        parentProfile: {

          uid:
            'leader-uid',

          personId:
            'leader-person',

          role:
            'lider_principal'
        }
      });


    assert.deepEqual(
      result,
      {
        parentUserId:
          'leader-uid',

        parentPersonId:
          'leader-person',

        ancestorUserIds: [
          'leader-uid'
        ],

        ancestorPersonIds: [
          'leader-person'
        ]
      }
    );
  }
);


test(
  'direct parent fallback repairs coordinator ancestry before migration',
  () => {

    const result =
      canonicalChildAncestry({

        parentUid:
          'coord-uid',

        parentPersonId:
          'coord-person',

        parentProfile: {

          uid:
            'coord-uid',

          personId:
            'coord-person',

          role:
            'coordinador_municipal',

          parentUserId:
            'leader-uid',

          parentPersonId:
            'leader-person'
        }
      });


    assert.deepEqual(
      result.ancestorUserIds,
      [
        'coord-uid',
        'leader-uid'
      ]
    );


    assert.deepEqual(
      result.ancestorPersonIds,
      [
        'coord-person',
        'leader-person'
      ]
    );
  }
);


test(
  'canonical inherited ancestry remains parallel',
  () => {

    const result =
      canonicalChildAncestry({

        parentUid:
          'chief-uid',

        parentPersonId:
          'chief-person',

        parentProfile: {

          uid:
            'chief-uid',

          personId:
            'chief-person',

          role:
            'jefe_estructura',

          parentUserId:
            'coord-uid',

          parentPersonId:
            'coord-person',

          ancestorIds: [
            'coord-uid',
            'leader-uid'
          ],

          ancestorPersonIds: [
            'coord-person',
            'leader-person'
          ]
        }
      });


    assert.deepEqual(
      result.ancestorUserIds,
      [
        'chief-uid',
        'coord-uid',
        'leader-uid'
      ]
    );


    assert.deepEqual(
      result.ancestorPersonIds,
      [
        'chief-person',
        'coord-person',
        'leader-person'
      ]
    );
  }
);


test(
  'incomplete legacy person ancestry is rejected',
  () => {

    assert.throws(
      () =>
        canonicalChildAncestry({

          parentUid:
            'chief-uid',

          parentPersonId:
            'chief-person',

          parentProfile: {

            uid:
              'chief-uid',

            personId:
              'chief-person',

            role:
              'jefe_estructura',

            ancestorIds: [
              'coord-uid',
              'leader-uid'
            ]
          }
        }),

      error =>
        error?.code ===
          'failed-precondition'
    );
  }
);


test(
  'technical admin cannot become territorial parent',
  () => {

    assert.throws(
      () =>
        canonicalChildAncestry({

          parentUid:
            'admin-uid',

          parentPersonId:
            'admin-person',

          parentProfile: {

            uid:
              'admin-uid',

            personId:
              'admin-person',

            role:
              'admin'
          }
        }),

      error =>
        error?.code ===
          'failed-precondition'
    );
  }
);


test(
  'profile UID and person identity must match resolved parent',
  () => {

    assert.throws(
      () =>
        canonicalChildAncestry({

          parentUid:
            'coord-uid',

          parentPersonId:
            'coord-person',

          parentProfile: {

            uid:
              'other-uid',

            personId:
              'coord-person',

            role:
              'coordinador_municipal'
          }
        }),

      error =>
        error?.code ===
          'failed-precondition'
    );


    assert.throws(
      () =>
        canonicalChildAncestry({

          parentUid:
            'coord-uid',

          parentPersonId:
            'coord-person',

          parentProfile: {

            uid:
              'coord-uid',

            personId:
              'other-person',

            role:
              'coordinador_municipal'
          }
        }),

      error =>
        error?.code ===
          'failed-precondition'
    );
  }
);
