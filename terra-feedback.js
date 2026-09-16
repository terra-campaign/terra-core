// ======================================================
// TERRA PLATFORM / TERRA CAMPAIGN
// FEEDBACK VISUAL TRANSVERSAL
//
// success = verde
// info    = azul
// warning = amarillo
// danger  = rojo
//
// emphasize = true
// produce resplandor temporal para hacer evidente
// que una operación acaba de actualizarse.
// ======================================================

export function clearTerraUpdateFeedback(
  element
) {

  if (!element) {
    return;
  }


  if (
    element.__terraFeedbackTimer
  ) {

    clearTimeout(
      element.__terraFeedbackTimer
    );

    element.__terraFeedbackTimer =
      null;
  }


  element.style.border =
    "1px solid transparent";

  element.style.backgroundColor =
    "transparent";

  element.style.borderRadius =
    "8px";

  element.style.padding =
    "0";

  element.style.fontWeight =
    "400";

  element.style.boxShadow =
    "none";

  element.style.transform =
    "scale(1)";

  element.style.transition =
    [
      "border-color 180ms ease",
      "background-color 180ms ease",
      "box-shadow 180ms ease",
      "transform 180ms ease"
    ].join(",");
}


export function applyTerraUpdateFeedback(
  element,
  tone = "info",
  emphasize = false
) {

  if (!element) {
    return;
  }


  const tones = {

    success: {
      border:
        "#16a34a",

      background:
        "#f0fdf4",

      shadow:
        "rgba(22, 163, 74, 0.28)"
    },

    info: {
      border:
        "#2563eb",

      background:
        "#eff6ff",

      shadow:
        "rgba(37, 99, 235, 0.25)"
    },

    warning: {
      border:
        "#d97706",

      background:
        "#fffbeb",

      shadow:
        "rgba(217, 119, 6, 0.25)"
    },

    danger: {
      border:
        "#dc2626",

      background:
        "#fef2f2",

      shadow:
        "rgba(220, 38, 38, 0.25)"
    }
  };


  const selectedTone =
    tones[tone] ||
    tones.info;


  if (
    element.__terraFeedbackTimer
  ) {

    clearTimeout(
      element.__terraFeedbackTimer
    );

    element.__terraFeedbackTimer =
      null;
  }


  element.style.border =
    `2px solid ${
      selectedTone.border
    }`;

  element.style.backgroundColor =
    selectedTone.background;

  element.style.borderRadius =
    "10px";

  element.style.padding =
    "10px 12px";

  element.style.fontWeight =
    "600";

  element.style.transition =
    [
      "border-color 180ms ease",
      "background-color 180ms ease",
      "box-shadow 180ms ease",
      "transform 180ms ease"
    ].join(",");


  element.setAttribute(
    "role",
    "status"
  );

  element.setAttribute(
    "aria-live",
    "polite"
  );


  if (!emphasize) {

    element.style.boxShadow =
      "none";

    element.style.transform =
      "scale(1)";

    return;
  }


  element.style.boxShadow =
    `0 0 0 5px ${
      selectedTone.shadow
    }`;

  element.style.transform =
    "scale(1.012)";


  element.__terraFeedbackTimer =
    setTimeout(
      () => {

        element.style.boxShadow =
          "none";

        element.style.transform =
          "scale(1)";

        element.__terraFeedbackTimer =
          null;

      },
      2200
    );
}
