'use strict';

const assert = require('node:assert/strict');

const {
  canSuperiorAccessReview
} = require('./mission-review-policy.cjs');


// Apelación pendiente:
// el superior autorizado puede consultarla.
assert.equal(
  canSuperiorAccessReview(
    true,
    {
      pendingAppeal: true,
      escalated: false
    },
    'SUPERIOR-A'
  ),
  true
);


// Ya fue resuelta por ese mismo superior:
// conserva acceso para consultar/comunicar resultado.
assert.equal(
  canSuperiorAccessReview(
    true,
    {
      pendingAppeal: false,
      escalated: true,
      lastActor: 'SUPERIOR-A'
    },
    'SUPERIOR-A'
  ),
  true
);


// Otro superior no hereda acceso a una resolución ajena.
assert.equal(
  canSuperiorAccessReview(
    true,
    {
      pendingAppeal: false,
      escalated: true,
      lastActor: 'SUPERIOR-A'
    },
    'SUPERIOR-B'
  ),
  false
);


// Ser el último actor no sirve si no pertenece
// jerárquicamente como superior.
assert.equal(
  canSuperiorAccessReview(
    false,
    {
      pendingAppeal: false,
      escalated: true,
      lastActor: 'SUPERIOR-A'
    },
    'SUPERIOR-A'
  ),
  false
);


// Sin apelación ni resolución escalada, no hay acceso.
assert.equal(
  canSuperiorAccessReview(
    true,
    {
      pendingAppeal: false,
      escalated: false,
      lastActor: 'SUPERIOR-A'
    },
    'SUPERIOR-A'
  ),
  false
);


console.log(
  'OK: mission review superior access tests passed.'
);
