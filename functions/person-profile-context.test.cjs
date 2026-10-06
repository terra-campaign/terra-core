"use strict";

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const {
  buildProfileProjection
} =
  require("./person-profile-context.cjs")
    ._test;


const source =
  fs.readFileSync(
    require.resolve(
      "./person-profile-context.cjs"
    ),
    "utf8"
  );


assert.match(
  source,
  /request\.data\?\.personId/,
  "El callable debe recibir personId canonico."
);

assert.match(
  source,
  /collection\("persons"\)/,
  "El perfil debe leer persons en backend."
);

assert.match(
  source,
  /collection\(\s*"territorialMemberships"\s*\)/,
  "El perfil debe usar membresia territorial canonica."
);

assert.match(
  source,
  /canReadPerformanceSummary/,
  "El perfil debe reutilizar la politica canonica de autorizacion."
);

assert.match(
  source,
  /adminCampaignAccessDocumentPath/,
  "Admin debe autorizarse por acceso explicito de campana."
);

assert.match(
  source,
  /resolveCanonicalPersonForAccount/,
  "El actor territorial debe resolverse a persona canonica."
);

assert.match(
  source,
  /targetMembership\.parentPersonId/,
  "El responsable directo debe resolverse por parentPersonId."
);

assert.doesNotMatch(
  source,
  /collection\("persons"\)[\s\S]{0,100}\.doc\(\s*targetPerson\.structureChiefId/,
  "structureChiefId no debe interpretarse como personId."
);


const accountless =
  buildProfileProjection({

    person: {
      personId:
        "person-participant",
      campaignId:
        "campaign-1",
      name:
        "Participante sin cuenta",
      active:
        true,
      phone:
        "",
      email:
        ""
    },

    membership: {
      membershipId:
        "membership-1",
      personId:
        "person-participant",
      campaignId:
        "campaign-1",
      role:
        "participante",
      active:
        true,
      parentPersonId:
        "person-integrante",
      structureName:
        "Estructura Norte",
      structureChiefName:
        "Responsable Norte"
    },

    personId:
      "person-participant",

    membershipId:
      "membership-1",

    parentPerson: {
      personId:
        "person-integrante",
      name:
        "Integrante Responsable"
    }
  });


assert.equal(
  accountless.personId,
  "person-participant"
);

assert.equal(
  accountless.accountUid,
  null
);

assert.equal(
  accountless.hasDigitalAccount,
  false
);

assert.equal(
  accountless.parentPersonId,
  "person-integrante"
);

assert.equal(
  accountless.parentName,
  "Integrante Responsable"
);

assert.equal(
  accountless.structureChiefName,
  "Responsable Norte"
);


const digital =
  buildProfileProjection({

    person: {
      personId:
        "person-digital",
      accountUid:
        "uid-digital",
      campaignId:
        "campaign-1",
      active:
        true,
      name:
        "Persona Digital"
    },

    membership: {
      membershipId:
        "membership-2",
      personId:
        "person-digital",
      campaignId:
        "campaign-1",
      role:
        "integrante",
      active:
        true
    },

    personId:
      "person-digital",

    membershipId:
      "membership-2"
  });


assert.equal(
  digital.accountUid,
  "uid-digital"
);

assert.equal(
  digital.hasDigitalAccount,
  true
);


console.log(
  "OK: canonical person profile context contract passed."
);
