// ======================================================
// TERRA CAMPAIGN
// Login con Firebase Authentication
// ======================================================

import { auth } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const form = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const message = document.querySelector("#loginMessage");
const submitButton = form.querySelector('button[type="submit"]');


//========================================
// Animación de entrada del formulario
//========================================

window.addEventListener("load", () => {

    setTimeout(() => {

        document.querySelector(".auth-card").style.display = "block";

    }, 2000);

});


// Si el usuario ya inició sesión, enviarlo al panel.
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "./admin.html";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  message.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = "Ingresando...";

  try {
    await signInWithEmailAndPassword(auth, email, password);

    message.textContent = "Acceso correcto.";
    window.location.href = "./admin.html";

  } catch (error) {
    console.error("Error de autenticación:", error);

    switch (error.code) {
      case "auth/invalid-credential":
        message.textContent = "Correo o contraseña incorrectos.";
        break;

      case "auth/invalid-email":
        message.textContent = "El correo no es válido.";
        break;

      case "auth/user-disabled":
        message.textContent = "Este usuario está deshabilitado.";
        break;

      case "auth/too-many-requests":
        message.textContent = "Demasiados intentos. Intenta nuevamente más tarde.";
        break;

      case "auth/network-request-failed":
        message.textContent = "No hay conexión con Firebase.";
        break;

      default:
        message.textContent = "No fue posible iniciar sesión.";
    }

  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Ingresar";
  }
});
