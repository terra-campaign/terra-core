// ======================================================
// TERRA CAMPAIGN
// MAP ENGINE — Google Maps
// ======================================================

import { PROJECT_CONFIG } from "../project-config.js";

let map = null;
let infoWindow = null;
let currentLocationMarker = null;
let visitMarkers = [];
let googleMapsPromise = null;

// Centro inicial: Zacualpan, Nayarit
const DEFAULT_CENTER = {
  lat: 21.2475,
  lng: -105.1665
};

// ------------------------------------------------------
// CARGAR GOOGLE MAPS
// ------------------------------------------------------

export async function initializeTerritoryMap() {
  const mapElement = document.querySelector("#territoryMap");
  const messageElement = document.querySelector("#mapMessage");

  if (!mapElement) {
    throw new Error("No existe el contenedor #territoryMap.");
  }

  const apiKey = PROJECT_CONFIG.googleMapsApiKey;

  if (!apiKey || apiKey.includes("REEMPLAZAR")) {
    messageElement.textContent =
      "La clave de Google Maps todavía no está configurada.";

    return false;
  }

  try {
    await loadGoogleMaps(apiKey);

    const { Map } = await google.maps.importLibrary("maps");

    map = new Map(mapElement, {
      center: DEFAULT_CENTER,
      zoom: 16,
      mapId: "DEMO_MAP_ID",
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      clickableIcons: false
    });

    infoWindow = new google.maps.InfoWindow();

    messageElement.textContent =
      "Mapa territorial conectado.";

    return true;

  } catch (error) {
    console.error("Error al iniciar Google Maps:", error);

    messageElement.textContent =
      "No fue posible cargar Google Maps.";

    return false;
  }
}

// ------------------------------------------------------
// CARGA DINÁMICA DEL SDK
// ------------------------------------------------------

function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve();
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName =
      `terraMapsReady_${Date.now()}`;

    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };

    const script = document.createElement("script");

    script.src =
      "https://maps.googleapis.com/maps/api/js" +
      `?key=${encodeURIComponent(apiKey)}` +
      "&v=weekly" +
      `&callback=${callbackName}` +
      "&loading=async";

    script.async = true;
    script.defer = true;

    script.onerror = () => {
      delete window[callbackName];

      reject(
        new Error("Google Maps no pudo descargarse.")
      );
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

// ------------------------------------------------------
// MOSTRAR VISITAS
// ------------------------------------------------------

export async function renderVisitMarkers(visits = []) {
  if (!map) {
    return;
  }

  clearVisitMarkers();

  const visitsWithLocation = visits.filter((visit) => {
    return (
      Number.isFinite(visit.latitude) &&
      Number.isFinite(visit.longitude)
    );
  });

  if (!visitsWithLocation.length) {
    return;
  }

  const { AdvancedMarkerElement, PinElement } =
    await google.maps.importLibrary("marker");

  const bounds = new google.maps.LatLngBounds();

  for (const visit of visitsWithLocation) {
    const position = {
      lat: visit.latitude,
      lng: visit.longitude
    };

    const color = getVisitColor(visit.visitResult);

    const pin = new PinElement({
      background: color,
      borderColor: "#ffffff",
      glyphColor: "#ffffff",
      scale: 1.05
    });

    const marker = new AdvancedMarkerElement({
      map,
      position,
      title: buildMarkerTitle(visit),
      content: pin.element,
      gmpClickable: true
    });

    marker.addEventListener("gmp-click", () => {
      infoWindow.setContent(buildInfoWindow(visit));

      infoWindow.open({
        map,
        anchor: marker
      });
    });

    visitMarkers.push(marker);
    bounds.extend(position);
  }

  if (visitsWithLocation.length === 1) {
    map.setCenter({
      lat: visitsWithLocation[0].latitude,
      lng: visitsWithLocation[0].longitude
    });

    map.setZoom(18);

  } else {
    map.fitBounds(bounds, 70);
  }
}

// ------------------------------------------------------
// MOSTRAR UBICACIÓN ACTUAL
// ------------------------------------------------------

export async function showCurrentLocation(
  latitude,
  longitude
) {
  if (
    !map ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return;
  }

  const position = {
    lat: latitude,
    lng: longitude
  };

  const { AdvancedMarkerElement, PinElement } =
    await google.maps.importLibrary("marker");

  if (currentLocationMarker) {
    currentLocationMarker.map = null;
  }

  const pin = new PinElement({
    background: "#2563eb",
    borderColor: "#ffffff",
    glyphColor: "#ffffff",
    glyph: "●",
    scale: 1.15
  });

  currentLocationMarker = new AdvancedMarkerElement({
    map,
    position,
    title: "Mi ubicación actual",
    content: pin.element
  });

  map.setCenter(position);
  map.setZoom(19);
}

// ------------------------------------------------------
// CENTRAR MAPA
// ------------------------------------------------------

export function centerTerritoryMap(
  latitude,
  longitude,
  zoom = 18
) {
  if (!map) {
    return;
  }

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    map.setCenter({
      lat: latitude,
      lng: longitude
    });

    map.setZoom(zoom);

  } else {
    map.setCenter(DEFAULT_CENTER);
    map.setZoom(16);
  }
}

// ------------------------------------------------------
// LIMPIAR MARCADORES
// ------------------------------------------------------

function clearVisitMarkers() {
  for (const marker of visitMarkers) {
    marker.map = null;
  }

  visitMarkers = [];
}

// ------------------------------------------------------
// COLOR SEGÚN RESULTADO
// ------------------------------------------------------

// ------------------------------------------------------
// BUILD-102A — COLOR INTELIGENTE SEGÚN RESULTADO
// ------------------------------------------------------

function getVisitColor(result) {

  const colors = {

    // Se atendió el domicilio y se entregó propaganda
    flyer_entregado: "#16a34a",

    // No había ninguna persona
    no_estaba: "#6b7280",

    // No había nadie, pero se dejó flyer
    no_estaba_flyer: "#2563eb",

    // Se requiere regresar posteriormente
    volver: "#f97316",

    // La persona se negó a participar
    se_nego: "#111827",

    // Vivienda deshabitada
    deshabitado: "#92400e"

  };

  return colors[result] || "#17324d";
}

// ------------------------------------------------------
// TÍTULO DEL MARCADOR
// ------------------------------------------------------

function buildMarkerTitle(visit) {
  const address =
    `${visit.street || ""} ${visit.houseNumber || ""}`
      .trim();

  return address || "Domicilio visitado";
}

// ------------------------------------------------------
// VENTANA DE INFORMACIÓN
// ------------------------------------------------------

// ------------------------------------------------------
// BUILD-102A — VENTANA PROFESIONAL DE INFORMACIÓN
// ------------------------------------------------------

function buildInfoWindow(visit) {

  const address =
    `${escapeHtml(visit.street || "")} ` +
    `${escapeHtml(visit.houseNumber || "")}`;

  const zoneParts = [
    visit.neighborhood,
    visit.locality
  ]
    .filter(Boolean)
    .map(escapeHtml);

  const zone =
    zoneParts.length
      ? zoneParts.join(", ")
      : "Zona sin especificar";

  const interviewer =
    escapeHtml(
      visit.interviewerName ||
      visit.interviewerEmail ||
      "Sin identificar"
    );

  const visitDate =
    formatVisitDate(
      visit.visitedAt ||
      visit.createdAt
    );

  const followUpNumber =
    Number.isFinite(Number(visit.followUpNumber))
      ? Number(visit.followUpNumber)
      : 1;

  const visitType =
    visit.isFollowUp
      ? `Seguimiento #${followUpNumber}`
      : "Primera visita";

  const photoHtml = visit.photoURL
    ? `
        <div style="margin-top:12px;">
          <p style="margin:0 0 6px;">
            <b>Fotografía</b>
          </p>

          <img
            src="${escapeHtml(visit.photoURL)}"
            alt="Evidencia fotográfica"
            style="
              display:block;
              width:100%;
              max-width:280px;
              max-height:220px;
              object-fit:cover;
              border-radius:10px;
              border:1px solid #d1d5db;
            "
          >
        </div>
      `
    : `
        <p style="margin:10px 0 0;">
          <b>Fotografía:</b>
          Sin evidencia
        </p>
      `;

  return `
    <div
      class="map-info-window"
      style="
        width:280px;
        max-width:100%;
        font-family:Arial,sans-serif;
        color:#1f2937;
        line-height:1.4;
      "
    >
      <div
        style="
          padding-bottom:8px;
          border-bottom:1px solid #e5e7eb;
        "
      >
        <div
          style="
            font-size:17px;
            font-weight:700;
            color:#17324d;
          "
        >
          🏠 ${address || "Domicilio visitado"}
        </div>

        <div
          style="
            margin-top:4px;
            font-size:13px;
            color:#6b7280;
          "
        >
          ${zone}
        </div>
      </div>

      <div style="margin-top:10px;">
        <p style="margin:5px 0;">
          <b>👤 Encuestador:</b><br>
          ${interviewer}
        </p>

        <p style="margin:5px 0;">
          <b>📅 Fecha:</b><br>
          ${visitDate}
        </p>

        <p style="margin:5px 0;">
          <b>📋 Resultado:</b><br>
          ${formatVisitResult(visit.visitResult)}
        </p>

        <p style="margin:5px 0;">
          <b>🗳 Intención:</b><br>
          ${formatVotingIntention(
            visit.votingIntention
          )}
        </p>

        <p style="margin:5px 0;">
          <b>🔁 Tipo de visita:</b><br>
          ${visitType}
        </p>
      </div>

      ${photoHtml}
    </div>
  `;
}



// ------------------------------------------------------
// FORMATEAR FECHA DE VISITA
// ------------------------------------------------------

function formatVisitDate(value) {

  if (!value) {
    return "Sin fecha registrada";
  }

  let date = null;

  if (typeof value.toDate === "function") {
    date = value.toDate();

  } else if (Number.isFinite(value.seconds)) {
    date = new Date(value.seconds * 1000);

  } else if (value instanceof Date) {
    date = value;

  } else {
    date = new Date(value);
  }

  if (
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {
    return "Sin fecha registrada";
  }

  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


// ------------------------------------------------------
// FORMATEAR RESULTADO
// ------------------------------------------------------

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

// ------------------------------------------------------
// FORMATEAR INTENCIÓN
// ------------------------------------------------------

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

// ------------------------------------------------------
// PROTEGER TEXTO
// ------------------------------------------------------

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
} 