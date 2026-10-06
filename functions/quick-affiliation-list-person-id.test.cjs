"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const source =
  fs.readFileSync(
    path.join(
      __dirname,
      "quick-affiliation.cjs"
    ),
    "utf8"
  );

const start =
  source.indexOf(
    "exports.getMyQuickAffiliations ="
  );

const end =
  source.indexOf(
    "exports._test =",
    start
  );

assert.notEqual(
  start,
  -1,
  "Debe existir getMyQuickAffiliations."
);

assert.notEqual(
  end,
  -1,
  "Debe poder aislarse el bloque de getMyQuickAffiliations."
);

const block =
  source.slice(
    start,
    end
  );

test(
  "getMyQuickAffiliations exposes canonical personId for each member",
  () => {

    assert.match(
      block,
      /members\.push\(\{[\s\S]*personId:\s*snapshot\.id/
    );
  }
);

test(
  "getMyQuickAffiliations keeps opaque personRef separate from canonical personId",
  () => {

    assert.match(
      block,
      /personRef:\s*hash\([\s\S]*quick-affiliation-member/
    );

    assert.match(
      block,
      /personId:\s*snapshot\.id/
    );
  }
);