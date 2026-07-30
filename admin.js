// ======================================================
// TERRA CAMPAIGN
// Panel operativo + Firestore + Google Maps
// BUILD-002
// ======================================================

import {
  auth,
  db,
  storage
} from "./firebase-config.js";



import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";




import {
  initializeTerritoryMap,
  renderVisitMarkers,
  showCurrentLocation,
  centerTerritoryMap
} from "./js/maps.js";

// ======================================================
// ELEMENTOS DE PANTALLA
// ======================================================

const logoutButton = document.querySelector("#logoutButton");

const visitForm = document.querySelector("#visitForm");

const streetInput = document.querySelector("#street");
const houseNumberInput = document.querySelector("#houseNumber");
const neighborhoodInput = document.querySelector("#neighborhood");
const localityInput = document.querySelector("#locality");

const visitResultInput = document.querySelector("#visitResult");
const votingIntentionInput = document.querySelector("#votingIntention");

const locationButton = document.querySelector("#locationButton");
const centerMapButton = document.querySelector("#centerMapButton");

const locationStatus = document.querySelector("#locationStatus");
const mapMessage = document.querySelector("#mapMessage");

const latitudeInput = document.querySelector("#latitude");
const longitudeInput = document.querySelector("#longitude");

const saveVisitButton = document.querySelector("#saveVisitButton");
const visitMessage = document.querySelector("#visitMessage");

const photoInput = document.querySelector("#photo");

const photoPreview = document.querySelector("#photoPreview");

const photoStatus = document.querySelector("#photoStatus");



const totalVisitsElement = document.querySelector("#totalVisits");
const totalFlyersElement = document.querySelector("#totalFlyers");
const totalAnswersElement = document.querySelector("#totalAnswers");

const visitsList = document.querySelector("#visitsList");


// =====================================================
// BUILD-100 — SMART FORM ENGINE
// Resultado de visita → Intención de voto
// =====================================================

function applyVisitResultRules() {
console.log("Resultado:", visitResultInput.value);
  console.log(
    "SMART FORM:",
    visitResultInput.value
  );
    const visitResult =
        visitResultInput.value;

    // Sin resultado seleccionado
    if (!visitResult) {

        votingIntentionInput.value = "";
        votingIntentionInput.disabled = true;
        votingIntentionInput.required = false;

        return;
    }

    // Hubo contacto con la persona
    // La intención debe seleccionarse manualmente
    if (visitResult === "flyer_entregado") {

        votingIntentionInput.disabled = false;
        votingIntentionInput.required = true;
        votingIntentionInput.value = "";

        return;
    }

    // La persona se negó a responder
    if (visitResult === "se_nego") {

        votingIntentionInput.value =
            "no_respondio";

        votingIntentionInput.disabled = true;
        votingIntentionInput.required = false;

        return;
    }

    // No se realizó la pregunta
    if (
        visitResult === "no_estaba" ||
        visitResult === "no_estaba_flyer" ||
        visitResult === "volver" ||
        visitResult === "deshabitado"
    ) {

        votingIntentionInput.value =
            "no_aplica";

        votingIntentionInput.disabled = true;
        votingIntentionInput.required = false;

        return;
    }
}

visitResultInput.addEventListener(
    "change",
    applyVisitResultRules
);

applyVisitResultRules();


// ======================================================
// MODAL DOMICILIO DUPLICADO
// ======================================================

const duplicateVisitModal =
  document.querySelector("#duplicateVisitModal");

const duplicateVisitDetails =
  document.querySelector("#duplicateVisitDetails");

const duplicateVisitPhoto =
  document.querySelector("#duplicateVisitPhoto");

const confirmDuplicateVisitButton =
  document.querySelector("#confirmDuplicateVisitButton");

const cancelDuplicateVisitButton =
  document.querySelector("#cancelDuplicateVisitButton");



// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let latestVisits = [];
let mapReady = false;



let selectedPhoto = null;
let previewPhotoUrl = "";



// ======================================================
// INICIO DE SESIÓN Y MAPA
// ======================================================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  currentUser = user;

  try {
    mapReady = await initializeTerritoryMap();
  } catch (error) {
    console.error("No fue posible iniciar el mapa:", error);
    mapMessage.textContent = "No fue posible iniciar Google Maps.";
  }

  listenVisits();
});

// ======================================================
// CERRAR SESIÓN
// ======================================================

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = "Saliendo...";

  try {
    await signOut(auth);
    window.location.href = "./login.html";
  } catch (error) {
    console.error("Error al cerrar sesión:", error);

    logoutButton.disabled = false;
    logoutButton.textContent = "Salir";

    alert("No fue posible cerrar la sesión.");
  }
});

// ======================================================
// OBTENER UBICACIÓN GPS
// ======================================================

locationButton.addEventListener("click", () => {
  captureCurrentLocation();
});

// ======================================================
// BOTÓN MI UBICACIÓN
// ======================================================

centerMapButton.addEventListener("click", () => {
  const latitude = Number(latitudeInput.value);
  const longitude = Number(longitudeInput.value);

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    centerTerritoryMap(latitude, longitude, 19);
    return;
  }

  captureCurrentLocation();
});

// ======================================================
// CAPTURAR GPS
// ======================================================

function captureCurrentLocation() {
  if (!navigator.geolocation) {
    locationStatus.textContent =
      "Este dispositivo no permite obtener ubicación GPS.";

    return;
  }

  locationButton.disabled = true;
  centerMapButton.disabled = true;

  locationButton.textContent = "Obteniendo ubicación...";
  locationStatus.textContent =
    "Esperando la ubicación del dispositivo...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      latitudeInput.value = String(latitude);
      longitudeInput.value = String(longitude);

      locationStatus.textContent =
        `Ubicación capturada. Precisión aproximada: ${Math.round(accuracy)} metros.`;

      locationButton.textContent = "Actualizar ubicación GPS";
      locationButton.disabled = false;
      centerMapButton.disabled = false;

      if (mapReady) {
        await showCurrentLocation(latitude, longitude);
      }
    },

    (error) => {
      console.error("Error de geolocalización:", error);

      switch (error.code) {
        case error.PERMISSION_DENIED:
          locationStatus.textContent =
            "El permiso de ubicación fue rechazado.";
          break;

        case error.POSITION_UNAVAILABLE:
          locationStatus.textContent =
            "No fue posible obtener la ubicación.";
          break;

        case error.TIMEOUT:
          locationStatus.textContent =
            "El dispositivo tardó demasiado en obtener el GPS.";
          break;

        default:
          locationStatus.textContent =
            "Ocurrió un error al obtener la ubicación.";
      }

      locationButton.textContent = "Obtener ubicación GPS";
      locationButton.disabled = false;
      centerMapButton.disabled = false;
    },

    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
}


// ======================================================
// SELECCIONAR FOTOGRAFÍA
// ======================================================

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];

  if (!file) {
    selectedPhoto = null;

    photoPreview.removeAttribute("src");
    photoPreview.style.display = "none";

    photoStatus.textContent =
      "Fotografía todavía no capturada.";

    return;
  }

  if (!file.type.startsWith("image/")) {
    selectedPhoto = null;
    photoInput.value = "";

    photoPreview.removeAttribute("src");
    photoPreview.style.display = "none";

    photoStatus.textContent =
      "El archivo seleccionado no es una imagen.";

    return;
  }

  selectedPhoto = file;

  if (previewPhotoUrl) {
    URL.revokeObjectURL(previewPhotoUrl);
  }

  previewPhotoUrl = URL.createObjectURL(file);

  photoPreview.src = previewPhotoUrl;
  photoPreview.style.display = "block";

  photoStatus.textContent =
    "Fotografía lista para guardar.";
});


// ======================================================
// COMPRIMIR FOTOGRAFÍA
// ======================================================

async function compressPhoto(file) {
  const imageBitmap = await createImageBitmap(file);

  const maximumWidth = 1200;
  const maximumHeight = 1200;

  let targetWidth = imageBitmap.width;
  let targetHeight = imageBitmap.height;

  const reductionRatio = Math.min(
    maximumWidth / targetWidth,
    maximumHeight / targetHeight,
    1
  );

  targetWidth = Math.round(
    targetWidth * reductionRatio
  );

  targetHeight = Math.round(
    targetHeight * reductionRatio
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context =
    canvas.getContext("2d");

  if (!context) {
    imageBitmap.close();

    throw new Error(
      "No fue posible preparar la fotografía."
    );
  }

  context.drawImage(
    imageBitmap,
    0,
    0,
    targetWidth,
    targetHeight
  );

  imageBitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              "No fue posible comprimir la fotografía."
            )
          );

          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      0.72
    );
  });
}



// ======================================================
// NORMALIZAR DIRECCIÓN
// ======================================================

function normalizeAddress(
  street,
  houseNumber,
  neighborhood,
  locality
) {
  return `${street} ${houseNumber}, ${neighborhood}, ${locality}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ======================================================
// BUSCAR DOMICILIO YA VISITADO
// ======================================================

async function findExistingVisit(normalizedAddress) {

  if (!normalizedAddress) {
    return null;
  }

  const visitsQuery = query(
    collection(db, "visitas"),
    where(
      "normalizedAddress",
      "==",
      normalizedAddress
    )
  );

  const snapshot =
    await getDocs(visitsQuery);

  if (snapshot.empty) {
    return null;
  }

  let latestVisit = null;

  snapshot.forEach((doc) => {

    const data = doc.data();

    if (
      !latestVisit ||
      (
        data.createdAt?.seconds || 0
      ) >
      (
        latestVisit.createdAt?.seconds || 0
      )
    ) {

      latestVisit = {
        id: doc.id,
        ...data
      };

    }

  });

  return latestVisit;

}

async function confirmDuplicateVisit(existingVisit){

  return new Promise((resolve)=>{

    const interviewer =
      existingVisit.interviewerName ||
      existingVisit.interviewerEmail ||
      "Sin identificar";

    const visitDate =
      existingVisit.visitedAt?.toDate?.() ||
      existingVisit.createdAt?.toDate?.();

    duplicateVisitDetails.innerHTML = `
      <p><b>Fecha:</b> ${
        visitDate
          ? visitDate.toLocaleString("es-MX")
          : "Sin fecha"
      }</p>

      <p><b>Encuestador:</b>
        ${escapeHtml(interviewer)}
      </p>

      <p><b>Resultado:</b>
        ${formatVisitResult(existingVisit.visitResult)}
      </p>

      <p><b>Intención:</b>
        ${formatVotingIntention(existingVisit.votingIntention)}
      </p>
    `;

    if(existingVisit.photoURL){

      duplicateVisitPhoto.src =
        existingVisit.photoURL;

      duplicateVisitPhoto.style.display =
        "block";

    }else{

      duplicateVisitPhoto.style.display =
        "none";

    }

    duplicateVisitModal.hidden = false;

    confirmDuplicateVisitButton.onclick = ()=>{

      duplicateVisitModal.hidden = true;

      resolve(true);

    };

    cancelDuplicateVisitButton.onclick = ()=>{

      duplicateVisitModal.hidden = true;

      resolve(false);

    };

  });

}



// ======================================================
// GUARDAR VISITA
// ======================================================

visitForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    visitMessage.textContent =
      "La sesión todavía no está disponible.";

    return;
  }

  const street = streetInput.value.trim();
  const houseNumber = houseNumberInput.value.trim();
  const neighborhood = neighborhoodInput.value.trim();
  const locality = localityInput.value.trim();

const normalizedAddress = normalizeAddress(
  street,
  houseNumber,
  neighborhood,
  locality
);

  const visitResult = visitResultInput.value;
  const votingIntention = votingIntentionInput.value;

  const latitude = latitudeInput.value
    ? Number(latitudeInput.value)
    : null;

  const longitude = longitudeInput.value
    ? Number(longitudeInput.value)
    : null;

  if (
    !street ||
    !houseNumber ||
    !neighborhood ||
    !locality ||
    !visitResult ||
    !votingIntention
  ) {
    visitMessage.textContent =
      "Completa todos los campos obligatorios.";

    return;
  }

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    visitMessage.textContent =
      "Debes obtener la ubicación GPS antes de guardar.";

    return;
  }

if (!selectedPhoto) {
  visitMessage.textContent =
    "Debes tomar una fotografía antes de guardar.";

  return;
}



  saveVisitButton.disabled = true;
  saveVisitButton.textContent = "Guardando...";
  visitMessage.textContent = "";

  const flyerDelivered =
  visitResult === "flyer_entregado" ||
  visitResult === "no_estaba_flyer";

  const answeredQuestion =
    votingIntention !== "no_respondio" &&
    votingIntention !== "no_aplica";




  try {
const existingVisit =
  await findExistingVisit(normalizedAddress);

if (existingVisit) {
  const continueAsFollowUp =
  await confirmDuplicateVisit(existingVisit);



  if (!continueAsFollowUp) {
    return;
  }
}





    const visitRef = doc(collection(db, "visitas"));

    const visitId = visitRef.id;

saveVisitButton.textContent =
  "Comprimiendo fotografía...";

const compressedPhoto =
  await compressPhoto(selectedPhoto);

const photoPath =
  `visitas/CAM-001/${visitId}/evidencia.jpg`;

const photoReference =
  ref(storage, photoPath);

saveVisitButton.textContent =
  "Subiendo fotografía...";

await uploadBytes(
  photoReference,
  compressedPhoto,
  {
    contentType: "image/jpeg"
  }
);

const photoURL =
  await getDownloadURL(photoReference);

saveVisitButton.textContent =
  "Guardando visita...";


    await setDoc(visitRef, {



        id: visitId,

      campaignId: "CAM-001",

      interviewerId: currentUser.uid,
interviewerEmail: currentUser.email || "",
interviewerName:
  currentUser.displayName ||
  currentUser.email?.split("@")[0] ||
  "Sin identificar",

     street,
houseNumber,
neighborhood,
locality,

normalizedAddress,

isFollowUp: Boolean(existingVisit),
previousVisitId: existingVisit?.id || null,

visitResult,


      flyerDelivered,

      votingIntention,
      answeredQuestion,

      latitude,
      longitude,
      hasLocation: true,

      photoURL,
photoPath,
hasPhoto: true,

      visitedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      version: 1
    });

    visitMessage.textContent =
      `Visita guardada correctamente. ID: ${visitId}`;

    visitForm.reset();

// Restablecer las reglas del formulario inteligente
applyVisitResultRules();

    latitudeInput.value = "";
    longitudeInput.value = "";

    locationStatus.textContent =
      "Ubicación todavía no capturada.";

selectedPhoto = null;

if (previewPhotoUrl) {
  URL.revokeObjectURL(previewPhotoUrl);
  previewPhotoUrl = "";
}

photoPreview.removeAttribute("src");
photoPreview.style.display = "none";

photoStatus.textContent =
  "Fotografía todavía no capturada.";



    setTimeout(() => {
      visitMessage.textContent = "";
    }, 4000);
  } catch (error) {
    console.error("Error al guardar visita:", error);

    if (error.code === "permission-denied") {
      visitMessage.textContent =
        "Firestore rechazó el registro por las reglas de seguridad.";
    } else {
      visitMessage.textContent =
        "No fue posible guardar la visita.";
    }
  } finally {
    saveVisitButton.disabled = false;
    saveVisitButton.textContent = "Guardar visita";
  }
});

// ======================================================
// ESCUCHAR VISITAS EN TIEMPO REAL
// ======================================================

function listenVisits() {
  const visitsQuery = query(
    collection(db, "visitas"),
    orderBy("createdAt", "desc"),
    limit(200)
  );

  onSnapshot(
    visitsQuery,

    async (snapshot) => {
      latestVisits = [];

      snapshot.forEach((documentSnapshot) => {
        latestVisits.push({
          id: documentSnapshot.id,
          ...documentSnapshot.data()
        });
      });

      updateMetrics(latestVisits);
      renderVisits(latestVisits.slice(0, 10));

      if (mapReady) {
        await renderVisitMarkers(latestVisits);
      }
    },

    (error) => {
      console.error("Error al consultar visitas:", error);

      visitsList.innerHTML =
        "<p>No fue posible consultar las visitas.</p>";
    }
  );
}

// ======================================================
// CONTADORES
// ======================================================

function updateMetrics(visits) {
  const totalVisits = visits.length;

  const totalFlyers = visits.filter(
    (visit) => visit.flyerDelivered === true
  ).length;

  const totalAnswers = visits.filter(
    (visit) => visit.answeredQuestion === true
  ).length;

  totalVisitsElement.textContent = totalVisits;
  totalFlyersElement.textContent = totalFlyers;
  totalAnswersElement.textContent = totalAnswers;
}

// ======================================================
// LISTA DE VISITAS
// ======================================================

function renderVisits(visits) {
  if (!visits.length) {
    visitsList.innerHTML =
      "<p>Todavía no existen visitas registradas.</p>";

    return;
  }

  visitsList.innerHTML = visits
    .map((visit) => {
      const dateText =
        formatFirestoreDate(visit.createdAt);

      const hasCoordinates =
        Number.isFinite(visit.latitude) &&
        Number.isFinite(visit.longitude);

      return `
        <article class="visit-item">

          <div>
            <strong>
              ${escapeHtml(visit.street || "")}
              ${escapeHtml(visit.houseNumber || "")}
            </strong>

            <p>
              ${escapeHtml(visit.neighborhood || "")},
              ${escapeHtml(visit.locality || "")}
            </p>
          </div>

          <div>
            <p>
              Resultado:
              <strong>
                ${formatVisitResult(visit.visitResult)}
              </strong>
            </p>

            <p>
              Intención:
              <strong>
                ${formatVotingIntention(visit.votingIntention)}
              </strong>
            </p>

            <p>
              GPS:
              <strong>
                ${hasCoordinates ? "Sí" : "No"}
              </strong>
            </p>

            <p>${dateText}</p>
          </div>

        </article>
      `;
    })
    .join("");
}

// ======================================================
// ETIQUETAS
// ======================================================

function formatVisitResult(value) {
  const labels = {
    flyer_entregado: "Flyer entregado",
    no_estaba: "No había nadie",
    no_estaba_flyer: "No había nadie — Flyer dejado",
    se_nego: "Se negó",
    volver: "Volver posteriormente",
    deshabitado: "Domicilio deshabitado"
  };

  return labels[value] || "Sin especificar";
}

function formatVotingIntention(value) {
  const labels = {
    apoya: "Apoya al candidato",
    indeciso: "Indeciso",
    otra_opcion: "Prefiere otra opción",
    no_respondio: "Prefirió no responder",
    no_aplica: "No se realizó la pregunta"
  };

  return labels[value] || "Sin especificar";
}

// ======================================================
// FECHA
// ======================================================

function formatFirestoreDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "Sin fecha";
  }

  return timestamp.toDate().toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

// ======================================================
// SEGURIDAD DE TEXTO
// ======================================================

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}