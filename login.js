// TERRA Campaign — acceso con destino de misión validado.
import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
const form = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const message = document.querySelector("#loginMessage");
const submitButton = form.querySelector('button[type="submit"]');

// Control de visibilidad, accesible con teclado y pantalla táctil.
const passwordWrapper = document.createElement("span");
passwordWrapper.style.cssText = "display:flex;align-items:center;gap:8px;width:100%;min-width:0";
passwordInput.before(passwordWrapper);
passwordWrapper.append(passwordInput);
passwordInput.style.flex = "1 1 auto";
passwordInput.style.minWidth = "0";
const passwordEye = document.createElement("button");
passwordEye.type = "button";
passwordEye.setAttribute("aria-controls", passwordInput.id);
passwordEye.style.cssText = "display:inline-flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;min-height:44px;padding:8px;margin:0;border:1px solid #8294a5;border-radius:8px;background:#fff;color:#17324d;cursor:pointer";
passwordWrapper.append(passwordEye);
function setPasswordVisible(visible) {
  passwordInput.type = visible ? "text" : "password";
  const label = visible ? "Ocultar contraseña" : "Mostrar contraseña";
  passwordEye.setAttribute("aria-label", label);
  passwordEye.title = label;
  passwordEye.innerHTML = `<svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${visible ? '<path d="m3 3 18 18"/>' : ''}</svg>`;
}
setPasswordVisible(false);
passwordEye.addEventListener("click", () => setPasswordVisible(passwordInput.type === "password"));
window.addEventListener("pagehide", () => setPasswordVisible(false));
form.addEventListener("reset", () => setPasswordVisible(false));

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
  setPasswordVisible(false);
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
