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

assert.match(html, /id="eventEndsAt"/);
assert.match(html, /data-event-filter="active"/);
assert.match(html, /data-event-filter="future"/);
assert.match(html, /data-event-filter="in-progress"/);
assert.match(html, /data-event-filter="completed"/);
assert.match(html, /data-event-filter="legacy"/);

assert.match(js, /selectedEventFilter = "active"/);
assert.match(js, /function eventMatchesFilter/);
assert.match(js, /function renderEventFilters/);
assert.match(js, /"En curso"/);
assert.match(js, /"Concluido"/);

assert.match(backend, /endsAtMillis/);
assert.match(backend, /input\.endsAt/);
assert.match(workspace, /endsAtMillis/);

console.log(
  'OK: BUILD-118D1F0 event lifecycle and filters contract passed.'
);
