// ======================================================
// TERRA CAMPAIGN
// PASSWORD VISIBILITY TOGGLE
// BUILD-116D-2
// ======================================================

function installPasswordToggles() {

  const passwordInputs =
    document.querySelectorAll(
      'input[type="password"]'
    );

  passwordInputs.forEach((input) => {

    if (
      input.closest(".password-field")
    ) {
      return;
    }

    const wrapper =
      document.createElement("div");

    wrapper.className =
      "password-field";

    input.parentNode.insertBefore(
      wrapper,
      input
    );

    wrapper.appendChild(input);

    const button =
      document.createElement("button");

    button.type =
      "button";

    button.className =
      "password-toggle";

    button.setAttribute(
      "aria-label",
      "Mostrar contraseña"
    );

    button.setAttribute(
      "aria-pressed",
      "false"
    );

    button.textContent =
      "👁";

    button.addEventListener(
      "click",
      () => {

        const showing =
          input.type === "text";

        input.type =
          showing
            ? "password"
            : "text";

        button.setAttribute(
          "aria-label",
          showing
            ? "Mostrar contraseña"
            : "Ocultar contraseña"
        );

        button.setAttribute(
          "aria-pressed",
          showing
            ? "false"
            : "true"
        );

        button.textContent =
          showing
            ? "👁"
            : "🙈";
      }
    );

    wrapper.appendChild(
      button
    );
  });
}


if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    installPasswordToggles
  );

} else {

  installPasswordToggles();
}
