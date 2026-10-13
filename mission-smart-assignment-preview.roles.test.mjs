import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("./mission-smart-assignment-preview.js", import.meta.url),
  "utf8"
).replace(/\r\n/g, "\n");

function obtenerFiltroReal() {
  const startRoles = source.indexOf("const roleNames = {");
  const endRoles = source.indexOf("};", startRoles);
  const startConsult = source.indexOf(
    "async function consultCandidates()"
  );

  assert.ok(startRoles >= 0, "Catalogo de roles no encontrado");
  assert.ok(endRoles > startRoles, "Catalogo incompleto");
  assert.ok(startConsult >= 0, "Consulta B8 no encontrada");

  const roles = source.slice(startRoles, endRoles + 2);
  const consulta = source.slice(startConsult);

  const filtro = consulta.match(
    /const seen = new Set\(\);[\s\S]*?const preferred = response\.data\.eligible\.filter\(person => \{[\s\S]*?\n\s*\}\);/
  );

  assert.ok(filtro, "Filtro B8 no encontrado");

  return vm.runInNewContext(`
    response => {
      ${roles}
      ${filtro[0]}
      return preferred.map(p => p.assigneeRef);
    }
  `);
}

const ejecutarFiltro = obtenerFiltroReal();

function persona(ref, role = "integrante", interes = true) {
  return {
    assigneeRef: ref,
    role,
    preferenceSelected: interes,
    name: "Persona ficticia"
  };
}

const ref = caracter => caracter.repeat(64);

function filtrar(people) {
  return Array.from(
    ejecutarFiltro({data:{eligible:people}})
  );
}

test("01 admite los cuatro roles operativos autorizados", () => {
  const roles = [
    "integrante",
    "participante",
    "colaborador_base",
    "apoyo_territorial"
  ];

  const personas = roles.map((role, i) =>
    persona(ref(String(i + 1)), role)
  );

  assert.deepEqual(
    filtrar(personas),
    personas.map(p => p.assigneeRef)
  );
});

test("02 rechaza propiedades heredadas de Object", () => {
  const roles = [
    "constructor",
    "toString",
    "__proto__",
    "valueOf",
    "hasOwnProperty"
  ];

  assert.deepEqual(
    filtrar(roles.map((role, i) =>
      persona(ref(String(i + 1)), role)
    )),
    []
  );
});

test("03 rechaza roles que no son texto", () => {
  const roles = [
    null,
    undefined,
    ["integrante"],
    {role:"integrante"},
    123,
    true
  ];

  assert.deepEqual(
    filtrar(roles.map((role, i) =>
      ({...persona(ref(String(i + 1)), role), role})
    )),
    []
  );
});

test("04 rechaza roles desconocidos o vacios", () => {
  assert.deepEqual(
    filtrar([
      persona(ref("a"), "administrador_ficticio"),
      persona(ref("b"), ""),
      persona(ref("c"), "INTEGRANTE")
    ]),
    []
  );
});

test("05 valida estrictamente las referencias", () => {
  assert.deepEqual(
    filtrar([
      persona("z".repeat(64)),
      persona("A".repeat(64)),
      persona("a".repeat(63)),
      persona(""),
      persona(null)
    ]),
    []
  );
});

test("06 solo admite interes expresamente seleccionado", () => {
  assert.deepEqual(
    filtrar([
      persona(ref("a"), "integrante", false),
      persona(ref("b"), "integrante", null),
      persona(ref("c"), "integrante", true)
    ]),
    [ref("c")]
  );
});

test("07 impide duplicar la misma referencia", () => {
  assert.deepEqual(
    filtrar([
      persona(ref("a")),
      persona(ref("a")),
      persona(ref("b"))
    ]),
    [ref("a"), ref("b")]
  );
});

test("08 conserva los datos ficticios originales", () => {
  const personas = [
    persona(ref("a")),
    persona(ref("b"), "constructor"),
    persona(ref("c"), "participante", false)
  ];

  const antes = JSON.stringify(personas);

  assert.deepEqual(filtrar(personas), [ref("a")]);
  assert.equal(JSON.stringify(personas), antes);
});
