import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/* ============================================================
   Configuración de Firebase.
   Los valores vienen de .env.local (ver .env.example).
   Si no hay configuración, el sitio funciona en modo local
   (los cambios del panel se guardan solo en este navegador).
   ============================================================ */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

let db = null;
let auth = null;

if (isFirebaseConfigured) {
  const app = initializeApp(config);
  db = getFirestore(app);
  auth = getAuth(app);
}

export { db, auth };
