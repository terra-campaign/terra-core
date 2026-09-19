'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const html = fs.readFileSync(
  path.join(root, 'eventos.html'),
  'utf8'
);

const js = fs.readFileSync(
  path.join(root, 'eventos.js'),
  'utf8'
);

const backend = fs.readFileSync(
  path.join(__dirname, 'event-general.cjs'),
  'utf8'
);

const workspace = fs.readFileSync(
  path.join(__dirname, 'event-delegation.cjs'),
  'utf8'
);

const functionsIndex = fs.readFileSync(
  path.join(__dirname, 'index.js'),
  'utf8'
);

assert.match(html, /id="eventEndsAt"/);
assert.match(html, /data-event-filter="active"/);
assert.match(html, /data-event-filter="future"/);
assert.match(html, /data-event-filter="in-progress"/);
assert.match(html, /data-event-filter="completed"/);
assert.match(html, /data-event-filter="legacy"/);
assert.match(html, /data-event-filter="test"/);
assert.match(html, /data-event-filter="archived"/);

assert.match(js, /selectedEventFilter = "active"/);
assert.match(js, /function eventMatchesFilter/);
assert.match(js, /function renderEventFilters/);
assert.match(js, /"En curso"/);
assert.match(js, /"Concluido"/);
assert.match(
  js,
  /selectedEventFilter ===\s*"test"/
);
assert.match(
  js,
  /event\?\.recordMode ===\s*"test"/
);

assert.match(
  js,
  /selectedEventFilter ===\s*"archived"/
);

assert.match(
  js,
  /event\?\.archived ===\s*true/
);

assert.match(
  js,
  /const regularEvents/
);

assert.match(
  js,
  /archived:\s*events\.filter/
);

assert.match(
  js,
  /const setEventArchived =/
);

assert.match(
  js,
  /async function changeEventArchivedState/
);

assert.match(
  js,
  /"Archivar evento"/
);

assert.match(
  js,
  /"Restaurar evento"/
);

assert.match(
  js,
  /event\.archived !==\s*true/
);

assert.match(
  js,
  /await setEventArchived\(/
);

assert.match(
  functionsIndex,
  /exports\.setEventArchived/
);

assert.match(
  backend,
  /exports\.setEventArchived/
);

assert.match(backend, /endsAtMillis/);
assert.match(backend, /input\.endsAt/);
assert.match(workspace, /endsAtMillis/);
assert.match(
  workspace,
  /recordMode:/
);

assert.match(
  workspace,
  /archived:/
);

assert.match(
  workspace,
  /archivedAtMillis:/
);

assert.match(
  workspace,
  /archivedBy:/
);


// ======================================================
// BUILD-118D1F1
// TEST / PRODUCTION RECORD MODE
// ======================================================

assert.match(
  js,
  /function currentEventRecordMode/
);

assert.match(
  js,
  /terra-campaign\.web\.app/
);

assert.match(
  js,
  /terra-campaign\.firebaseapp\.com/
);

assert.match(
  js,
  /terra-campaign\.github\.io/
);

assert.match(
  js,
  /recordMode:\s*currentEventRecordMode\(\)/
);

assert.match(
  backend,
  /function eventRecordMode/
);

assert.match(
  backend,
  /recordMode/
);


console.log(
  'OK: BUILD-118D1F0 event lifecycle and filters contract passed.'
);

console.log(
  'OK: BUILD-118D1F1 frontend record mode contract passed.'
);

console.log(
  'OK: BUILD-118D1F2 archived event filtering contract passed.'
);

console.log(
  'OK: BUILD-118D1F2 archive and restore UI contract passed.'
);
