import { db, auth, isFirebaseConfigured } from "./firebase";
import {
  addDoc, collection, doc, getDocs, onSnapshot, setDoc, deleteDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "firebase/auth";

/* ============================================================
   Capa de datos de los viajes.
   Con Firebase configurado usa Firestore (compartido entre
   todos los visitantes); si no, usa localStorage como respaldo.

   Firestore:
   - Colección "trips": viajes agregados desde el panel.
   - Documento "settings/catalog": { hiddenIds: [...] } con los
     viajes del catálogo base ocultados desde el panel.
   ============================================================ */

export const usingFirebase = isFirebaseConfigured;

// `expires` es el primer día del viaje: el viaje desaparece cuando comienza.
export const isExpired = (trip) =>
  Boolean(trip.expires) && new Date(trip.expires + "T00:00:00") <= new Date();

/* ---------- respaldo en localStorage ---------- */
const TRIPS_KEY = "flores-custom-trips";
const HIDDEN_KEY = "flores-hidden-trips";
const LEADS_KEY = "flores-leads";
const localListeners = { trips: new Set(), hidden: new Set(), leads: new Set() };

function localRead(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function localWrite(key, value, which) {
  localStorage.setItem(key, JSON.stringify(value));
  localListeners[which].forEach((cb) => cb(value));
}

function localActiveTrips() {
  const list = localRead(TRIPS_KEY);
  const active = list.filter((t) => !isExpired(t));
  if (active.length !== list.length) localStorage.setItem(TRIPS_KEY, JSON.stringify(active));
  return active;
}

/* ---------- suscripciones ---------- */

/** Llama a cb con la lista de viajes agregados; devuelve una función para cancelar. */
export function subscribeCustomTrips(cb) {
  if (usingFirebase) {
    return onSnapshot(
      collection(db, "trips"),
      (snap) => {
        const trips = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((t) => !isExpired(t))
          .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        cb(trips);
      },
      (err) => {
        console.error("Error al leer viajes de Firestore:", err);
        cb([]);
      },
    );
  }
  cb(localActiveTrips());
  localListeners.trips.add(cb);
  return () => localListeners.trips.delete(cb);
}

/** Llama a cb con los ids del catálogo ocultos; devuelve una función para cancelar. */
export function subscribeHiddenIds(cb) {
  if (usingFirebase) {
    return onSnapshot(
      doc(db, "settings", "catalog"),
      (snap) => cb(snap.data()?.hiddenIds ?? []),
      (err) => {
        console.error("Error al leer configuración de Firestore:", err);
        cb([]);
      },
    );
  }
  cb(localRead(HIDDEN_KEY));
  localListeners.hidden.add(cb);
  return () => localListeners.hidden.delete(cb);
}

/* ---------- escrituras ---------- */

export async function addTrip(trip) {
  if (usingFirebase) {
    const { id, ...data } = trip;
    await setDoc(doc(db, "trips", id), { ...data, createdAt: Date.now() });
    return;
  }
  localWrite(TRIPS_KEY, [...localActiveTrips(), trip], "trips");
}

export async function updateTrip(trip) {
  if (usingFirebase) {
    const { id, ...data } = trip;
    // merge:true conserva campos no enviados (p. ej. createdAt)
    await setDoc(doc(db, "trips", id), data, { merge: true });
    return;
  }
  localWrite(TRIPS_KEY, localActiveTrips().map((t) => (t.id === trip.id ? trip : t)), "trips");
}

export async function deleteTrip(id) {
  if (usingFirebase) {
    await deleteDoc(doc(db, "trips", id));
    return;
  }
  localWrite(TRIPS_KEY, localActiveTrips().filter((t) => t.id !== id), "trips");
}

export async function saveHiddenIds(ids) {
  if (usingFirebase) {
    await setDoc(doc(db, "settings", "catalog"), { hiddenIds: ids });
    return;
  }
  localWrite(HIDDEN_KEY, ids, "hidden");
}

/* ---------- solicitudes de contacto (leads) ---------- */

/** Guarda una solicitud de contacto. Cualquier visitante puede enviarla. */
export async function addLead(lead) {
  const record = { ...lead, createdAt: Date.now() };
  if (usingFirebase) {
    await addDoc(collection(db, "leads"), record);
    return;
  }
  localWrite(LEADS_KEY, [{ id: `lead-${Date.now()}`, ...record }, ...localRead(LEADS_KEY)], "leads");
}

/** Solicitudes recibidas, la más reciente primero. Leerlas requiere sesión iniciada. */
export function subscribeLeads(cb) {
  if (usingFirebase) {
    return onSnapshot(
      collection(db, "leads"),
      (snap) => {
        cb(snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
      },
      (err) => {
        console.error("Error al leer solicitudes de Firestore:", err);
        cb([]);
      },
    );
  }
  cb(localRead(LEADS_KEY));
  localListeners.leads.add(cb);
  return () => localListeners.leads.delete(cb);
}

export async function deleteLead(id) {
  if (usingFirebase) {
    await deleteDoc(doc(db, "leads", id));
    return;
  }
  localWrite(LEADS_KEY, localRead(LEADS_KEY).filter((l) => l.id !== id), "leads");
}

/** Borra de Firestore los viajes ya vencidos. Requiere sesión iniciada. */
export async function purgeExpiredTrips() {
  if (!usingFirebase) return;
  try {
    const snap = await getDocs(collection(db, "trips"));
    const expired = snap.docs.filter((d) => isExpired(d.data()));
    await Promise.all(expired.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    console.error("No se pudieron purgar los viajes vencidos:", err);
  }
}

/* ---------- autenticación del panel ---------- */

/** Llama a cb con el usuario actual (o null); devuelve una función para cancelar. */
export function subscribeAuth(cb) {
  if (!usingFirebase) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
