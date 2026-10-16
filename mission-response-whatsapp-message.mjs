"use strict";

export function buildMissionResponseWhatsAppUrl(
  data,
  missionId,
  pageUrl
) {
  if (!data ||
      typeof missionId !== "string" ||
      !missionId ||
      data.missionId !== missionId ||
      typeof data.phone !== "string" ||
      !/^[1-9]\d{7,14}$/.test(data.phone) ||
      !["ACCEPTED","DECLINED"].includes(data.status)) {
    throw new Error("Contacto o confirmación inválidos.");
  }

  for (const field of [
    "ownerName",
    "memberName",
    "missionTitle"
  ]) {
    if (typeof data[field] !== "string" ||
        !data[field].trim() ||
        data[field].length > 160) {
      throw new Error("Identidad o misión incompleta.");
    }
  }

  const indexUrl = new URL(
    "./confirmaciones-mision.html",
    pageUrl
  );

  const local =
    ["localhost","127.0.0.1"].includes(indexUrl.hostname);

  if (indexUrl.protocol !== "https:" &&
      !(local && indexUrl.protocol === "http:")) {
    throw new Error("Origen no autorizado para el enlace.");
  }

  indexUrl.searchParams.set("id",missionId);

  const decision = data.status === "ACCEPTED"
    ? "he aceptado participar"
    : "no podré participar";

  const message = [
    `Hola, ${data.ownerName.trim()}. Soy ${data.memberName.trim()}.`,
    `Te informo que ${decision} en la misión "${data.missionTitle.trim()}".`,
    "Mi decisión está registrada en TERRA Campaign.",
    "Puedes consultar las confirmaciones de tu equipo aquí:",
    indexUrl.href
  ].join("\n\n");

  return "https://wa.me/" +
    data.phone +
    "?text=" +
    encodeURIComponent(message);
}