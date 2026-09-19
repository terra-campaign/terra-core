// ======================================================
// TERRA CAMPAIGN
// BUILD-119A5B — EVIDENCIA TERRITORIAL SEGURA
//
// La evidencia se obtiene mediante Firebase Storage
// autenticado. Nunca genera ni conserva download URLs
// permanentes.
// ======================================================

import {
  storage
} from "../firebase-config.js";

import {
  ref,
  getBlob
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const activeEvidenceUrls =
  new Map();


function releaseImageUrl(image) {

  if (!image) {
    return;
  }

  const objectUrl =
    activeEvidenceUrls.get(image);

  if (!objectUrl) {
    image.removeAttribute("src");
    return;
  }

  image.removeAttribute("src");

  URL.revokeObjectURL(
    objectUrl
  );

  activeEvidenceUrls.delete(
    image
  );
}


export async function loadTerritorialEvidenceImage(
  image,
  photoPath
) {

  if (!image || !photoPath) {
    return false;
  }

  releaseImageUrl(image);

  image.dataset.evidenceState =
    "loading";

  try {

    const photoReference =
      ref(
        storage,
        photoPath
      );

    const blob =
      await getBlob(
        photoReference,
        8 * 1024 * 1024
      );

    if (!image.isConnected) {
      return false;
    }

    const objectUrl =
      URL.createObjectURL(blob);

    activeEvidenceUrls.set(
      image,
      objectUrl
    );

    image.src =
      objectUrl;

    image.dataset.evidenceState =
      "ready";

    return true;

  } catch (error) {

    image.removeAttribute("src");

    image.dataset.evidenceState =
      error?.code ===
      "storage/unauthorized"
        ? "unauthorized"
        : "error";

    console.warn(
      "Evidencia territorial no disponible:",
      error?.code ||
      error?.message ||
      error
    );

    return false;
  }
}


export function releaseTerritorialEvidence(
  root = null
) {

  for (
    const [image, objectUrl]
    of [...activeEvidenceUrls.entries()]
  ) {

    const belongsToRoot =
      !root ||
      image === root ||
      (
        typeof root.contains ===
          "function" &&
        root.contains(image)
      );

    if (!belongsToRoot) {
      continue;
    }

    image.removeAttribute("src");

    URL.revokeObjectURL(
      objectUrl
    );

    activeEvidenceUrls.delete(
      image
    );
  }
}
