'use strict';

const test =
  require(
    'node:test'
  );

const assert =
  require(
    'node:assert/strict'
  );

const fs =
  require(
    'node:fs'
  );

const path =
  require(
    'node:path'
  );

const source =
  fs.readFileSync(
    path.join(
      __dirname,
      'index.js'
    ),
    'utf8'
  );

function callableBlock(
  name
) {

  const marker =
    `exports.${name} = onCall(`;

  const start =
    source.indexOf(
      marker
    );

  assert.notEqual(
    start,
    -1
  );

  let end =
    source.indexOf(
      '\nexports.',
      start + marker.length
    );

  if (end < 0) {
    end =
      source.length;
  }

  return source.slice(
    start,
    end
  );
}

test(
  'createStructureChief creates canonical identity and atomic hierarchy',
  () => {

    const block =
      callableBlock(
        'createStructureChief'
      );

    for (
      const pattern
      of [
        /resolveCanonicalPersonForAccount/,
        /canonicalChildAncestry/,
        /canonicalMembershipDocumentId/,
        /\.collection\(\s*["']persons["']\s*\)/,
        /\.collection\(\s*["']territorialMemberships["']\s*\)/,
        /parentPersonId/,
        /ancestorPersonIds/,
        /ancestorUserIds:\s*ancestorIds/,
        /introducedByPersonId:\s*creatorPersonId/,
        /const batch\s*=\s*db\.batch\(\)/,
        /batch\.create\(\s*chiefRef/,
        /batch\.create\(\s*personRef/,
        /batch\.create\(\s*membershipRef/,
        /batch\.update\(\s*structureRef/,
        /batch\.create\(\s*logRef/,
        /await batch\.commit\(\)/,
        /auth\.deleteUser/,
        /auth\/invalid-password/
      ]
    ) {
      assert.match(
        block,
        pattern
      );
    }

    assert.doesNotMatch(
      block,
      /await chiefRef\.set/
    );

    assert.doesNotMatch(
      block,
      /await structureRef\.update/
    );

    assert.doesNotMatch(
      block,
      /\.collection\(\s*["']logs["']\s*\)\s*\.add\s*\(/
    );
  }
);
