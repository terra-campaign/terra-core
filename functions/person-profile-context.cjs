"use strict";

const {
  onCall,
  HttpsError
} = require("firebase-functions/v2/https");

const {
  getFirestore
} = require("firebase-admin/firestore");

const {
  canonicalMembershipDocumentId
} = require("./territorial-membership-id.cjs");

const {
  resolveCanonicalPersonForAccount
} = require("./person-identity.cjs");

const {
  adminCampaignAccessDocumentPath
} = require("./admin-campaign-access.cjs");

const {
  canReadPerformanceSummary
} = require("./performance-summary-read-policy.cjs");


const OPTIONS = {
  region: "us-central1",
  timeoutSeconds: 60
};


function cleanId(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}


function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}


function validDocumentId(value) {

  const id =
    cleanId(value);

  return Boolean(
    id &&
    id.length <= 128 &&
    !id.includes("/")
  );
}


function fail(code, message) {
  throw new HttpsError(
    code,
    message
  );
}


function readAccountUid(
  person,
  membership = null
) {

  return (
    cleanId(
      person?.accountUid
    ) ||
    cleanId(
      membership?.accountUid
    ) ||
    null
  );
}


function membershipMatches({
  membership,
  membershipId,
  campaignId,
  personId
}) {

  if (
    !membership ||
    membership.active !== true
  ) {
    return false;
  }

  if (
    cleanId(
      membership.membershipId
    ) &&
    cleanId(
      membership.membershipId
    ) !==
      cleanId(
        membershipId
      )
  ) {
    return false;
  }

  return (
    cleanId(
      membership.campaignId
    ) ===
      cleanId(
        campaignId
      ) &&
    cleanId(
      membership.personId
    ) ===
      cleanId(
        personId
      )
  );
}


function buildProfileProjection({
  person,
  membership,
  personId,
  membershipId,
  parentPerson = null
}) {

  const accountUid =
    readAccountUid(
      person,
      membership
    );

  const parentPersonId =
    cleanId(
      membership?.parentPersonId
    ) ||
    cleanId(
      person?.parentPersonId
    );

  const parentName =
    cleanText(
      parentPerson?.name
    ) ||
    cleanText(
      membership?.parentUserName
    ) ||
    cleanText(
      person?.parentUserName
    );

  return Object.freeze({

    personId:
      cleanId(personId),

    membershipId:
      cleanId(membershipId),

    accountUid,

    hasDigitalAccount:
      Boolean(accountUid),

    name:
      cleanText(
        person?.name
      ),

    email:
      cleanText(
        person?.email
      ),

    phone:
      cleanText(
        person?.phone
      ),

    hasWhatsApp:
      person?.hasWhatsApp === true
        ? true
        : person?.hasWhatsApp === false
          ? false
          : null,

    locality:
      cleanText(
        person?.locality
      ),

    street:
      cleanText(
        person?.street
      ),

    houseNumber:
      cleanText(
        person?.houseNumber
      ),

    active:
      person?.active !== false &&
      membership?.active === true,

    role:
      cleanId(
        membership?.role
      ) ||
      cleanId(
        person?.role
      ),

    campaignId:
      cleanId(
        membership?.campaignId
      ) ||
      cleanId(
        person?.campaignId
      ),

    municipalityId:
      cleanId(
        membership?.municipalityId
      ) ||
      cleanId(
        person?.municipalityId
      ),

    municipalityName:
      cleanText(
        membership?.municipalityName
      ) ||
      cleanText(
        person?.municipalityName
      ),

    structureId:
      cleanId(
        membership?.structureId
      ) ||
      cleanId(
        person?.structureId
      ),

    structureDocumentId:
      cleanId(
        membership?.structureDocumentId
      ) ||
      cleanId(
        person?.structureDocumentId
      ),

    structureName:
      cleanText(
        membership?.structureName
      ) ||
      cleanText(
        person?.structureName
      ),

    /*
     * structureChiefId sigue siendo un UID legado.
     * No se interpreta como personId canonico.
     */
    structureChiefName:
      cleanText(
        membership?.structureChiefName
      ) ||
      cleanText(
        person?.structureChiefName
      ),

    parentPersonId:
      parentPersonId || null,

    parentName:
      parentName || ""
  });
}


async function getPersonProfileContextCore({
  db,
  actorUid,
  targetPersonId
}) {

  if (!db) {
    throw new Error(
      "INVALID_DATABASE"
    );
  }

  const uid =
    cleanId(actorUid);

  const requestedPersonId =
    cleanId(targetPersonId);

  if (
    !validDocumentId(uid)
  ) {
    fail(
      "unauthenticated",
      "La sesion no contiene una identidad valida."
    );
  }

  if (
    !validDocumentId(
      requestedPersonId
    )
  ) {
    fail(
      "invalid-argument",
      "Persona invalida."
    );
  }


  const [
    actorProfileSnapshot,
    targetPersonSnapshot
  ] =
    await Promise.all([

      db
        .collection("usuarios")
        .doc(uid)
        .get(),

      db
        .collection("persons")
        .doc(requestedPersonId)
        .get()
    ]);


  if (
    !actorProfileSnapshot.exists
  ) {
    fail(
      "permission-denied",
      "Perfil no autorizado."
    );
  }


  if (
    !targetPersonSnapshot.exists
  ) {
    fail(
      "not-found",
      "La persona solicitada no existe."
    );
  }


  const actorProfile = {
    ...actorProfileSnapshot.data(),
    uid
  };

  const targetPerson = {
    ...targetPersonSnapshot.data(),
    personId:
      requestedPersonId
  };


  if (
    actorProfile.active !== true
  ) {
    fail(
      "permission-denied",
      "El usuario no tiene un perfil activo."
    );
  }


  const campaignId =
    cleanId(
      targetPerson.campaignId
    );

  if (!campaignId) {
    fail(
      "failed-precondition",
      "La persona no pertenece a una campana valida."
    );
  }


  const targetMembershipId =
    canonicalMembershipDocumentId(
      campaignId,
      requestedPersonId
    );


  const targetMembershipSnapshot =
    await db
      .collection(
        "territorialMemberships"
      )
      .doc(
        targetMembershipId
      )
      .get();


  if (
    !targetMembershipSnapshot.exists
  ) {
    fail(
      "failed-precondition",
      "La persona no tiene membresia territorial canonica."
    );
  }


  const targetMembership = {
    ...targetMembershipSnapshot.data(),
    membershipId:
      targetMembershipId
  };


  if (
    !membershipMatches({
      membership:
        targetMembership,
      membershipId:
        targetMembershipId,
      campaignId,
      personId:
        requestedPersonId
    })
  ) {
    fail(
      "failed-precondition",
      "La membresia territorial de la persona no es valida."
    );
  }


  let actorPersonId =
    null;

  let actorMembership =
    null;

  let adminAccessRecord =
    null;


  if (
    actorProfile.role ===
      "admin"
  ) {

    const accessPath =
      adminCampaignAccessDocumentPath(
        uid,
        campaignId
      );

    const accessSnapshot =
      await db
        .doc(accessPath)
        .get();

    adminAccessRecord =
      accessSnapshot.exists
        ? accessSnapshot.data()
        : null;

  } else {

    const identity =
      await resolveCanonicalPersonForAccount({
        db,
        accountUid:
          uid,
        profile:
          actorProfile,
        campaignId
      });


    actorPersonId =
      cleanId(
        identity?.personId
      );

    if (!actorPersonId) {
      fail(
        "permission-denied",
        "No fue posible resolver la identidad territorial del usuario."
      );
    }


    const actorMembershipId =
      canonicalMembershipDocumentId(
        campaignId,
        actorPersonId
      );


    const actorMembershipSnapshot =
      await db
        .collection(
          "territorialMemberships"
        )
        .doc(
          actorMembershipId
        )
        .get();


    if (
      actorMembershipSnapshot.exists
    ) {

      actorMembership = {
        ...actorMembershipSnapshot.data(),
        membershipId:
          actorMembershipId
      };
    }
  }


  const authorized =
    canReadPerformanceSummary({

      actorProfile,

      actorPersonId,

      actorMembership,

      targetPerson,

      targetMembership,

      adminAccessRecord
    });


  if (
    authorized !== true
  ) {
    fail(
      "permission-denied",
      "No tienes autorizacion para consultar el perfil de esta persona."
    );
  }


  const parentPersonId =
    cleanId(
      targetMembership.parentPersonId
    ) ||
    cleanId(
      targetPerson.parentPersonId
    );


  let parentPerson =
    null;


  if (
    validDocumentId(
      parentPersonId
    ) &&
    parentPersonId !==
      requestedPersonId
  ) {

    const parentSnapshot =
      await db
        .collection("persons")
        .doc(parentPersonId)
        .get();

    if (
      parentSnapshot.exists
    ) {

      const candidate =
        parentSnapshot.data();

      if (
        cleanId(
          candidate.campaignId
        ) === campaignId
      ) {

        parentPerson = {
          ...candidate,
          personId:
            parentPersonId
        };
      }
    }
  }


  return Object.freeze({

    success:
      true,

    person:
      buildProfileProjection({
        person:
          targetPerson,

        membership:
          targetMembership,

        personId:
          requestedPersonId,

        membershipId:
          targetMembershipId,

        parentPerson
      })
  });
}


exports.getPersonProfileContext =
  onCall(
    OPTIONS,

    async request => {

      if (!request.auth) {
        fail(
          "unauthenticated",
          "Inicia sesion."
        );
      }

      return getPersonProfileContextCore({

        db:
          getFirestore(),

        actorUid:
          request.auth.uid,

        targetPersonId:
          request.data?.personId
      });
    }
  );


exports._test = {
  cleanId,
  cleanText,
  validDocumentId,
  readAccountUid,
  membershipMatches,
  buildProfileProjection,
  getPersonProfileContextCore
};
