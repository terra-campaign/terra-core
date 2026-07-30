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

function getVisitColor(result) {
  const colors = {
    flyer_entregado: "#16a34a",
    no_estaba: "#eab308",
    se_nego: "#dc2626",
    volver: "#2563eb",
    deshabitado: "#6b7280"
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

function buildInfoWindow(visit) {
  const address =
    `${escapeHtml(visit.street || "")} ` +
    `${escapeHtml(visit.houseNumber || "")}`;

  const zone =
    `${escapeHtml(visit.neighborhood || "")}, ` +
    `${escapeHtml(visit.locality || "")}`;

  const photoHtml = visit.photoURL
  ? `
      <img
        src="${escapeHtml(visit.photoURL)}"
        alt="Evidencia fotográfica"
        style="
          display:block;
          width:100%;
          max-width:260px;
          max-height:220px;
          object-fit:cover;
          margin-top:10px;
          border-radius:8px;
        "
      >
    `
  : `
      <p>
        <b>Fotografía:</b>
        Sin evidencia
      </p>
    `;

return `
  <div
    class="map-info-window"
    style="max-width:280px;"
  >
    <strong>${address}</strong>

    <p>${zone}</p>

    <p>
      <b>Resultado:</b>
      ${formatVisitResult(visit.visitResult)}
    </p>

    <p>
      <b>Intención:</b>
      ${formatVotingIntention(visit.votingIntention)}
    </p>

    <p>
      <b>Encuestador:</b>
      ${escapeHtml(
        visit.interviewerName ||
        visit.interviewerEmail ||
        "Sin identificar"
      )}
    </p>

    ${photoHtml}
  </div>
`;
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