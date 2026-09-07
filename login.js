// TERRA Campaign — acceso con destino de misión validado.
import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
const form = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const message = document.querySelector("#loginMessage");
const submitButton = form.querySelector('button[type="submit"]');
const missionId = new URLSearchParams(window.location.search).get("mission");
// Solo IDs; nunca aceptamos una URL de redirección enviada desde fuera.
const validMission = typeof missionId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(missionId);
const destination = validMission ? `./mision.html?id=${encodeURIComponent(missionId)}` : "./admin.html";
let redirecting = false;
function enter() {
  if (redirecting) return;
  redirecting = true;
  window.location.replace(destination);
}
window.addEventListener("load", () => {
  setTimeout(() => {
    const card = document.querySelector(".auth-card");
    if (card) card.style.display = "block";
  }, 3000);
});
onAuthStateChanged(auth, user => { if (user) enter(); });
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (submitButton.disabled) return;
  message.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = "Ingresando...";
  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    message.textContent = "Acceso correcto.";
    enter();
  } catch (error) {
    const messages = {
      "auth/invalid-credential": "Correo o contraseña incorrectos.",
      "auth/invalid-email": "El correo no es válido.",
      "auth/user-disabled": "Este usuario está deshabilitado.",
      "auth/too-many-requests": "Demasiados intentos. Intenta nuevamente más tarde.",
      "auth/network-request-failed": "No hay conexión con Firebase."
    };
    message.textContent = messages[error.code] || "No fue posible iniciar sesión.";
  } finally {
    if (!redirecting) {
      submitButton.disabled = false;
      submitButton.textContent = "Ingresar";
    }
  }
});
