// ======================================================
// TERRA CAMPAIGN
// Configuración central de Firebase
// ======================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnmI3WxL7CpJSL7M12u-FQ7qTHF_RVUhE",
  authDomain: "terra-campaign.firebaseapp.com",
  projectId: "terra-campaign",
  storageBucket: "terra-campaign.firebasestorage.app",
  messagingSenderId: "962555584741",
  appId: "1:962555584741:web:2d7d97e9814a4b188db40c"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export {
  app,
  auth,
  db,
  storage
}; 