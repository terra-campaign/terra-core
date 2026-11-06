"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

const html = fs.readFileSync(
  path.join(root, "direccion.html"), "utf8"
);

const js = fs.readFileSync(
  path.join(root, "direccion.js"), "utf8"
);

const match = js.match(
  /async function refreshTerritorialProgressAccess\(user,version,campaignId\)\{[\s\S]*?\r?\n\}/
);

assert.ok(match, "No existe la funcion de validacion.");

function scenario(response) {
  const link = { hidden: false };

  const context = {
    epoch: 4,
    auth: { currentUser: { uid: "usuario-prueba" } },
    $: id => id === "territorialProgressLink" ? link : null,
    getMyTerritorialAccessCall: response
  };

  vm.runInNewContext(
    match[0] +
    "\nthis.execute = refreshTerritorialProgressAccess;",
    context
  );

  return { link, context, execute: context.execute };
}

const grant = campaignId => ({
  authorized: true,
  read: true,
  grant: { campaignId }
});

test("Enlace oculto inicialmente en HTML", () => {
  assert.match(
    html,
    /<p id="territorialProgressLink" hidden><a class="direction-button" href="\.\/direccion-territorio\.html">/
  );
});

test("Autoriza lectura vigente en campana correcta", async () => {
  const s = scenario(async () => ({ data: grant("CAM-004") }));

  await s.execute({ uid: "usuario-prueba" }, 4, "CAM-004");

  assert.equal(s.link.hidden, false);
});

test("Sin grant mantiene el enlace oculto", async () => {
  const s = scenario(async () => ({
    data: { authorized: false, read: false }
  }));

  await s.execute({ uid: "usuario-prueba" }, 4, "CAM-004");

  assert.equal(s.link.hidden, true);
});

test("Sin permiso read mantiene el enlace oculto", async () => {
  const s = scenario(async () => ({
    data: {
      authorized: true,
      read: false,
      grant: { campaignId: "CAM-004" }
    }
  }));

  await s.execute({ uid: "usuario-prueba" }, 4, "CAM-004");

  assert.equal(s.link.hidden, true);
});

test("Grant de otra campana no habilita enlace", async () => {
  const s = scenario(async () => ({ data: grant("CAM-003") }));

  await s.execute({ uid: "usuario-prueba" }, 4, "CAM-004");

  assert.equal(s.link.hidden, true);
});

test("Error del servicio mantiene enlace oculto", async () => {
  const s = scenario(async () => {
    throw new Error("Simulacion de error");
  });

  await s.execute({ uid: "usuario-prueba" }, 4, "CAM-004");

  assert.equal(s.link.hidden, true);
});

test("Respuesta tardia tras cambio de sesion no habilita enlace", async () => {
  let resolveRequest;

  const s = scenario(
    () => new Promise(resolve => {
      resolveRequest = resolve;
    })
  );

  const pending = s.execute(
    { uid: "usuario-prueba" }, 4, "CAM-004"
  );

  s.context.epoch = 5;
  s.context.auth.currentUser = { uid: "otro-usuario" };

  resolveRequest({ data: grant("CAM-004") });

  await pending;

  assert.equal(s.link.hidden, true);
});