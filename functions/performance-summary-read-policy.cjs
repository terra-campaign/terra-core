"use strict";

const {
  adminCanAccessCampaign
} =
  require(
    "./admin-campaign-access.cjs"
  );

const PERFORMANCE_SUMMARY_READ_POLICY_VERSION =
  "1.0.0";

const PERFORMANCE_SUMMARY_READ_POLICY_STATUS =
  "DEFINED_NOT_EXPOSED";

const PERFORMANCE_SUMMARY_READ_POLICY_SCOPE =
  "CANONICAL_PERSON_PERFORMANCE_READ";

const DIRECT_PARENT_ROLES =
  Object.freeze([
    "coordinador_municipal",
    "jefe_estructura",
    "integrante",
    "participante"
  ]);

function cleanId(
  value
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function validActiveMembership(
  membership,
  {
    campaignId,
    personId
  }
) {
  const canonicalCampaignId =
    cleanId(
      campaignId
    );

  const canonicalPersonId =
    cleanId(
      personId
    );

  if (
    !membership ||
    membership.active !== true ||
    cleanId(
      membership.campaignId
    ) !== canonicalCampaignId ||
    cleanId(
      membership.personId
    ) !== canonicalPersonId
  ) {
    return false;
  }

  return true;
}

function canReadPerformanceSummary({
  actorProfile,
  actorPersonId,
  actorMembership = null,
  targetPerson,
  targetMembership,
  adminAccessRecord = null
}) {
  const actorId =
    cleanId(
      actorPersonId
    );

  const targetId =
    cleanId(
      targetPerson?.personId
    );

  const campaignId =
    cleanId(
      targetPerson?.campaignId
    );

  if (
    !actorProfile ||
    actorProfile.active !== true ||
    !targetId ||
    !campaignId ||
    targetPerson.active !== true
  ) {
    return false;
  }

  if (
    !validActiveMembership(
      targetMembership,
      {
        campaignId,
        personId:
          targetId
      }
    )
  ) {
    return false;
  }

  // ----------------------------------------------------
  // ADMIN TECNICO
  //
  // No requiere identidad territorial propia.
  // Su autoridad proviene exclusivamente de
  // adminCampaignAccess explÃ­cito para la campaÃ±a.
  // ----------------------------------------------------
  if (
    actorProfile.role ===
    "admin"
  ) {
    return adminCanAccessCampaign({
      profile:
        actorProfile,

      adminUid:
        cleanId(
          actorProfile.uid
        ),

      campaignId,

      accessRecord:
        adminAccessRecord
    });
  }

  // ----------------------------------------------------
  // ACTOR TERRITORIAL
  //
  // Toda autoridad territorial debe provenir de una
  // membresÃ­a canÃ³nica activa de la misma campaÃ±a.
  // ----------------------------------------------------
  if (!actorId) {
    return false;
  }

  if (
    !validActiveMembership(
      actorMembership,
      {
        campaignId,
        personId:
          actorId
      }
    )
  ) {
    return false;
  }

  const actorRole =
    cleanId(
      actorMembership.role
    );

  if (
    !actorRole ||
    actorRole !==
      cleanId(
        actorProfile.role
      )
  ) {
    return false;
  }

  if (
    cleanId(
      actorProfile.campaignId
    ) !== campaignId
  ) {
    return false;
  }

  // Propio desempeÃ±o.
  if (
    actorId ===
    targetId
  ) {
    return true;
  }

  // Subordinado directo por relaciÃ³n canÃ³nica personId.
  if (
    DIRECT_PARENT_ROLES.includes(
      actorRole
    ) &&
    cleanId(
      targetMembership
        .parentPersonId
    ) === actorId
  ) {
    return true;
  }

  // Responsable de estructura:
  // puede consultar miembros activos de su misma
  // estructura canÃ³nica.
  if (
    actorRole ===
      "jefe_estructura" &&
    cleanId(
      actorMembership.structureId
    ) &&
    cleanId(
      targetMembership.structureId
    ) ===
      cleanId(
        actorMembership.structureId
      )
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * PERFORMANCE SUMMARY READ SCOPE
 * ============================================================
 *
 * Esta funcion NO decide si el actor esta autorizado a leer.
 *
 * Esa decision pertenece a:
 *
 *   canReadPerformanceSummary()
 *
 * Esta funcion determina UNICAMENTE que alcance consolidado
 * puede recibir el actor cuando la lectura ya esta autorizada.
 *
 * IMPORTANTE:
 *
 * - No expone Contribution Ledger.
 * - No expone ledgerIds.
 * - No expone reglas de puntuacion.
 * - No expone evidencias.
 * - No permite lectura descendiente generalizada.
 * - No modifica scoring.
 * - No escribe datos.
 *
 * El resultado es exclusivamente un alcance semantico de
 * lectura de Performance Summary.
 * ============================================================
 */

const PERFORMANCE_SUMMARY_READ_SCOPE =
  Object.freeze({
    OWN:
      "OWN_PERFORMANCE",

    ADMIN_CAMPAIGN:
      "ADMIN_CAMPAIGN_PERFORMANCE",

    DIRECT_SUBORDINATE:
      "DIRECT_SUBORDINATE_PERFORMANCE",

    STRUCTURE_MEMBER:
      "STRUCTURE_MEMBER_PERFORMANCE",

    NONE:
      "NO_PERFORMANCE_SCOPE"
  });


function getPerformanceSummaryReadScope({
  actorProfile,
  actorPersonId,
  actorMembership = null,
  targetPerson,
  targetMembership
}) {

  const actorId =
    cleanId(
      actorPersonId
    );

  const targetId =
    cleanId(
      targetPerson?.personId
    );

  const campaignId =
    cleanId(
      targetPerson?.campaignId
    );

  /*
   * ----------------------------------------------------------
   * Validacion defensiva.
   * ----------------------------------------------------------
   *
   * Esta funcion NO sustituye la autorizacion.
   * canReadPerformanceSummary() sigue siendo la autoridad.
   *
   * Aqui solamente se determina el alcance semantico
   * del Performance Summary una vez solicitada la lectura.
   * ----------------------------------------------------------
   */

  if (
    !actorProfile ||
    actorProfile.active !== true ||
    (
      !actorId &&
      cleanId(
        actorProfile.role
      ) !== "admin"
    ) ||
    !targetId ||
    !campaignId ||
    targetPerson.active !== true
  ) {
    return null;
  }

  const actorRole =
    cleanId(
      actorProfile.role
    );


  if (
    actorRole ===
      "admin"
  ) {

    return PERFORMANCE_SUMMARY_READ_SCOPE.ADMIN_CAMPAIGN;
  }

  /*
   * ----------------------------------------------------------
   * PROPIO DESEMPEÑO
   * ----------------------------------------------------------
   *
   * Una persona siempre identifica su propio Performance
   * Summary mediante personId.
   *
   * El contrato publico del scope utiliza SELF.
   * ----------------------------------------------------------
   */

  if (
    actorId ===
    targetId
  ) {
    return PERFORMANCE_SUMMARY_READ_SCOPE.OWN;
  }

  /*
   * ----------------------------------------------------------
   * SUBORDINADO DIRECTO
   * ----------------------------------------------------------
   *
   * La relación canónica se determina exclusivamente mediante
   * targetMembership.parentPersonId.
   *
   * Esto aplica a:
   *
   * Coordinador -> subordinado directo
   * Jefe        -> subordinado directo
   * Integrante  -> subordinado directo
   * Participante-> subordinado directo
   *
   * IMPORTANTE:
   *
   * Un jefe de estructura que consulta a un subordinado directo
   * recibe DIRECT_SUBORDINATE, aunque pertenezca a su propia
   * estructura.
   * ----------------------------------------------------------
   */

  if (
    DIRECT_PARENT_ROLES.includes(
      actorRole
    ) &&
    cleanId(
      targetMembership?.parentPersonId
    ) === actorId
  ) {
    return PERFORMANCE_SUMMARY_READ_SCOPE.DIRECT_SUBORDINATE;
  }

  /*
   * ----------------------------------------------------------
   * JEFE DE ESTRUCTURA / MIEMBRO DE LA MISMA ESTRUCTURA
   * ----------------------------------------------------------
   *
   * Esta regla solamente entra cuando el objetivo NO es un
   * subordinado directo.
   *
   * Permite que el jefe tenga acceso al índice consolidado
   * de desempeño de integrantes de SU estructura.
   *
   * No utiliza ancestorPersonIds.
   *
   * No permite otra estructura.
   * ----------------------------------------------------------
   */

  if (
    actorRole ===
      "jefe_estructura"
  ) {

    const actorStructureId =
      cleanId(
        actorMembership?.structureId
      );

    const targetStructureId =
      cleanId(
        targetMembership?.structureId
      );

    if (
      actorStructureId &&
      targetStructureId &&
      actorStructureId ===
        targetStructureId
    ) {
      return PERFORMANCE_SUMMARY_READ_SCOPE.STRUCTURE_MEMBER;
    }
  }

  /*
   * ----------------------------------------------------------
   * SIN ALCANCE
   * ----------------------------------------------------------
   *
   * Importante:
   *
   * El contrato actual utiliza null para representar que no
   * existe un Performance Read Scope.
   *
   * Esto es distinto de:
   *
   * NO_PERFORMANCE_SCOPE
   *
   * porque los tests y el contrato actual esperan null.
   * ----------------------------------------------------------
   */

  return null;
}

const PERFORMANCE_SUMMARY_READ_POLICY =
  Object.freeze({
    version:
      PERFORMANCE_SUMMARY_READ_POLICY_VERSION,

    status:
      PERFORMANCE_SUMMARY_READ_POLICY_STATUS,

    scope:
      PERFORMANCE_SUMMARY_READ_POLICY_SCOPE,

    identity:
      "personId",

    actorAuthority:
      "territorialMemberships",

    targetAuthority:
      "territorialMemberships",

    accountlessTargetSupported:
      true,

    technicalAdminNeedsTerritorialPerson:
      false,

    adminRequiresExplicitCampaignAccess:
      true,

    directParentRelation:
      "parentPersonId",

    generalizedDescendantRead:
      false,

    clientFirestoreReadAllowed:
      false,

    callableExposed:
      false,

    performanceSummaryPersistenceEnabled:
      false
  });

module.exports = {
  PERFORMANCE_SUMMARY_READ_POLICY_VERSION,
  PERFORMANCE_SUMMARY_READ_POLICY_STATUS,
  PERFORMANCE_SUMMARY_READ_POLICY_SCOPE,
  PERFORMANCE_SUMMARY_READ_POLICY,
  DIRECT_PARENT_ROLES,
  validActiveMembership,
  canReadPerformanceSummary,
  getPerformanceSummaryReadScope,
  PERFORMANCE_SUMMARY_READ_SCOPE
};
