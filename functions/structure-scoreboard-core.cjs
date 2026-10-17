"use strict";

const ROLE_LABELS = Object.freeze({
  jefe_estructura: "Responsable de estructura",
  integrante: "Integrante",
  participante: "Participante",
  colaborador_base: "Colaborador de base",
  apoyo_territorial: "Apoyo territorial",
  coordinador_municipal: "Coordinador municipal"
});

const validId = value => typeof value === "string" &&
  /^[A-Za-z0-9_-]{1,128}$/.test(value);
const clean = value => typeof value === "string" ? value.trim() : "";

function normalizeMxWhatsApp(person) {
  if (!person || person.hasWhatsApp !== true) return null;
  const phone = clean(person.phone);
  if (!/^[+\d\s().-]+$/.test(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  if (/^\d{10}$/.test(digits)) return "52" + digits;
  if (/^52\d{10}$/.test(digits)) return digits;
  return null;
}

function authorizeChief({profile, actorMembership, structure, uid}) {
  if (!validId(uid) || profile?.active !== true ||
      profile?.role !== "jefe_estructura" ||
      !validId(profile.campaignId) || !validId(profile.personId) ||
      !validId(profile.structureId) ||
      actorMembership?.active !== true ||
      actorMembership.role !== "jefe_estructura" ||
      actorMembership.personId !== profile.personId ||
      actorMembership.campaignId !== profile.campaignId ||
      actorMembership.structureId !== profile.structureId ||
      (actorMembership.accountUid && actorMembership.accountUid !== uid) ||
      !structure || structure.id !== profile.structureId ||
      structure.campaignId !== profile.campaignId ||
      (profile.municipalityId && structure.municipalityId !== profile.municipalityId)) {
    return false;
  }
  return true;
}

function sortRows(rows) {
  return [...rows].sort((a,b) =>
    b.points - a.points || a.name.localeCompare(b.name,"es",{sensitivity:"base"}) ||
    a.personId.localeCompare(b.personId)
  ).map((row,i) => ({...row,position:i+1}));
}

// La proyección de puntos llega exclusivamente desde el Performance Summary canónico.
function projectRows({members, personsById, ledgerByPerson, nameById, campaignId,
                      buildPerformanceSummaryProjection}) {
  const result=[];
  for (const membership of members) {
    const personId=membership.personId;
    const person=personsById.get(personId);
    if (!person || person.active !== true || person.campaignId !== campaignId) {
      throw new Error("PERSON_IDENTITY_INCONSISTENT");
    }
    const summary=buildPerformanceSummaryProjection({
      campaignId,personId,ledgerEntries:ledgerByPerson.get(personId)||[]
    });
    const historical=summary?.contribution?.historical;
    if (!historical || !Number.isFinite(historical.points) ||
        !Number.isSafeInteger(historical.contributionCount) ||
        historical.contributionCount<0) throw new Error("INVALID_CANONICAL_SUMMARY");
    const parentRaw=membership.parentPersonId||person.parentPersonId;
    const introducedRaw=membership.introducedByPersonId||person.introducedByPersonId;
    const parentId=validId(parentRaw)?parentRaw:null;
    const introducerId=validId(introducedRaw)?introducedRaw:null;
    const name=clean(person.name);
    if (!name) throw new Error("MISSING_PERSON_NAME");
    result.push({
      personId,name,role:membership.role||"",roleLabel:ROLE_LABELS[membership.role]||"Integrante",
      municipality:clean(membership.municipalityName)||clean(person.municipalityName)||"No registrado",
      parentPersonId:parentId,
      parentName:parentId?(nameById.get(parentId)||"No registrado"):"No registrado",
      introducedByPersonId:introducerId,
      introducedByName:introducerId?(nameById.get(introducerId)||"No registrado"):"No registrado",
      points:historical.points,contributions:historical.contributionCount,
      byDimension:historical.byDimension||{},
      whatsAppNumber:normalizeMxWhatsApp(person),
      hasDigitalAccount:Boolean(clean(person.accountUid)||clean(membership.accountUid))
    });
  }
  return sortRows(result);
}

module.exports={validId,clean,normalizeMxWhatsApp,authorizeChief,sortRows,projectRows};
