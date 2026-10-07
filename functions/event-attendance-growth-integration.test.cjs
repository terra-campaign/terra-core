'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const sourcePath =
  path.join(
    __dirname,
    'event-delegation.cjs'
  );

const source =
  fs.readFileSync(
    sourcePath,
    'utf8'
  );

function blockBetween(
  text,
  startNeedle,
  endNeedle
) {
  const start =
    text.indexOf(
      startNeedle
    );

  assert.notEqual(
    start,
    -1,
    'No se encontró inicio de bloque'
  );

  const end =
    text.indexOf(
      endNeedle,
      start + startNeedle.length
    );

  assert.notEqual(
    end,
    -1,
    'No se encontró fin de bloque'
  );

  return text.slice(
    start,
    end
  );
}

test(
  'attendance growth bridge uses canonical growth service',
  () => {
    const helper =
      blockBetween(
        source,
        'async function completeAttendanceGrowthAfterCommitSafely',
        'function eventAttendanceWindow'
      );

    assert.match(
      helper,
      /completeGrowthValidationInternal/
    );

    assert.match(
      helper,
      /FIRST_VERIFIED_ACTIVITY/
    );

    assert.match(
      helper,
      /ATTENDANCE_RECORD/
    );

    assert.match(
      helper,
      /validatedByUserId/
    );

    assert.match(
      helper,
      /requestedPersonId/
    );

    assert.match(
      helper,
      /requestedSourceDocumentId/
    );
  }
);

test(
  'attendance growth bridge is fail-safe after committed attendance',
  () => {
    const helper =
      blockBetween(
        source,
        'async function completeAttendanceGrowthAfterCommitSafely',
        'function eventAttendanceWindow'
      );

    assert.match(
      helper,
      /catch\s*\(error\)/
    );

    assert.match(
      helper,
      /ATTENDANCE_GROWTH_BRIDGE_UNEXPECTED_FAILURE/
    );

    assert.match(
      helper,
      /return null/
    );
  }
);

test(
  'both attendance flows invoke growth bridge after contribution bridge',
  () => {
    const contributionCalls =
      [
        ...source.matchAll(
          /await deriveAttendanceContributionAfterCommitSafely\(\{/g
        )
      ];

    const growthCalls =
      [
        ...source.matchAll(
          /await completeAttendanceGrowthAfterCommitSafely\(\{/g
        )
      ];

    assert.equal(
      contributionCalls.length,
      2
    );

    assert.equal(
      growthCalls.length,
      2
    );

    for (let i = 0; i < 2; i++) {
      assert.ok(
        growthCalls[i].index >
          contributionCalls[i].index,
        'El puente de crecimiento debe ejecutarse después del puente de contribución'
      );
    }
  }
);