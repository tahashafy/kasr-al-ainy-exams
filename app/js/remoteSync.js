// Thin Firestore wrapper. Loaded dynamically (only when a real Firebase
// config is present) from Firebase's own CDN, so the app has zero npm
// dependencies and this file is a total no-op — including no network
// calls — when Firebase isn't configured.
//
// Data shape per student, keyed by their access code (see identity.js):
//   students/{code}                         — doc: { createdAt, lastOpenedAt,
//                                               lastAttemptAt, attemptsCount }
//                                               (see touchPresence/noteAttempt
//                                               below — this is a lightweight
//                                               activity summary only, never
//                                               the student's actual answers)
//   students/{code}/attempts/{attemptId}    — one doc per finished attempt
//   students/{code}/bookmarks/{questionId}  — one doc per bookmarked question
//   students/{code}/meta/settings           — singleton doc: theme etc.
//
// See firestore.rules: a student can only read/write under their own code's
// subtree, and the top-level `students` collection can only be LISTED (i.e.
// enumerated/queried across all codes) by the signed-in admin account — a
// student still can't discover another student's code this way, since
// `get`ting one doc by its exact code remains open (needed for the
// code-recovery flow) but listing all of them is admin-only.

import { firebaseConfig, FIREBASE_ENABLED } from "./firebaseConfig.js";

const SDK_VERSION = "10.13.2";
let dbPromise = null;
let fs = null; // the firebase/firestore module namespace, once loaded

function loadFirestore() {
  if (!FIREBASE_ENABLED) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    try {
      const [{ initializeApp }, firestoreMod] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);
      fs = firestoreMod;
      const app = initializeApp(firebaseConfig);
      return fs.getFirestore(app);
    } catch (err) {
      console.warn("[remoteSync] Firebase unavailable — continuing in local-only mode.", err);
      return null;
    }
  })();
  return dbPromise;
}

/**
 * Best-effort: records that this code opened the app just now, and sets
 * createdAt the first time this code is ever seen. Called once per app
 * load from initStore(). This is what lets the admin view tell "generated a
 * code and never came back" apart from "actually comes back and uses it".
 */
export async function touchPresence(code) {
  const db = await loadFirestore();
  if (!db) return;
  try {
    const ref = fs.doc(db, "students", code);
    const snap = await fs.getDoc(ref);
    if (!snap.exists()) {
      await fs.setDoc(ref, { createdAt: Date.now(), lastOpenedAt: Date.now(), attemptsCount: 0 });
    } else {
      await fs.setDoc(ref, { lastOpenedAt: Date.now() }, { merge: true });
    }
  } catch (err) {
    console.warn("[remoteSync] touchPresence failed.", err);
  }
}

/** Best-effort: bumps this code's finished-attempt count/timestamp. */
async function noteAttempt(code) {
  const db = await loadFirestore();
  if (!db) return;
  try {
    const ref = fs.doc(db, "students", code);
    await fs.setDoc(
      ref,
      { lastAttemptAt: Date.now(), attemptsCount: fs.increment(1) },
      { merge: true }
    );
  } catch (err) {
    console.warn("[remoteSync] noteAttempt failed.", err);
  }
}

export function isRemoteEnabled() {
  return FIREBASE_ENABLED;
}

/** Fetches everything stored for this access code. Never throws. */
export async function fetchRemoteBundle(code) {
  const db = await loadFirestore();
  if (!db) return null;
  try {
    const attemptsSnap = await fs.getDocs(fs.collection(db, "students", code, "attempts"));
    const attempts = attemptsSnap.docs.map((d) => d.data());

    const bookmarksSnap = await fs.getDocs(fs.collection(db, "students", code, "bookmarks"));
    const bookmarks = bookmarksSnap.docs.map((d) => d.id);

    const settingsDoc = await fs.getDoc(fs.doc(db, "students", code, "meta", "settings"));
    const settings = settingsDoc.exists() ? settingsDoc.data() : null;

    return { attempts, bookmarks, settings };
  } catch (err) {
    console.warn("[remoteSync] fetchRemoteBundle failed — using local data only.", err);
    return null;
  }
}

/** Best-effort background push — failures are logged, never thrown to the caller. */
export async function pushAttempt(code, attempt) {
  const db = await loadFirestore();
  if (!db) return;
  try {
    await fs.setDoc(fs.doc(db, "students", code, "attempts", attempt.id), attempt);
    noteAttempt(code); // fire-and-forget — a finished attempt is the clearest "real use" signal
  } catch (err) {
    console.warn("[remoteSync] pushAttempt failed (saved locally only for now).", err);
  }
}

export async function pushBookmarkAdd(code, questionId) {
  const db = await loadFirestore();
  if (!db) return;
  try {
    await fs.setDoc(fs.doc(db, "students", code, "bookmarks", questionId), { createdAt: Date.now() });
  } catch (err) {
    console.warn("[remoteSync] pushBookmarkAdd failed.", err);
  }
}

export async function pushBookmarkRemove(code, questionId) {
  const db = await loadFirestore();
  if (!db) return;
  try {
    await fs.deleteDoc(fs.doc(db, "students", code, "bookmarks", questionId));
  } catch (err) {
    console.warn("[remoteSync] pushBookmarkRemove failed.", err);
  }
}

export async function pushSettings(code, settings) {
  const db = await loadFirestore();
  if (!db) return;
  try {
    await fs.setDoc(fs.doc(db, "students", code, "meta", "settings"), settings, { merge: true });
  } catch (err) {
    console.warn("[remoteSync] pushSettings failed.", err);
  }
}

export async function deleteAllRemote(code) {
  const db = await loadFirestore();
  if (!db) return;
  try {
    const [attemptsSnap, bookmarksSnap] = await Promise.all([
      fs.getDocs(fs.collection(db, "students", code, "attempts")),
      fs.getDocs(fs.collection(db, "students", code, "bookmarks")),
    ]);
    const batch = fs.writeBatch(db);
    attemptsSnap.docs.forEach((d) => batch.delete(d.ref));
    bookmarksSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(fs.doc(db, "students", code, "meta", "settings"));
    await batch.commit();
  } catch (err) {
    console.warn("[remoteSync] deleteAllRemote failed.", err);
  }
}

// ---------- Admin ----------
// A single admin account (email + password, created once by hand in the
// Firebase console — see SETUP_FIREBASE.md) is the only identity that
// firestore.rules lets `list` the `students` collection, so these are the
// only functions in this file that can ever see data across more than one
// access code at a time. See admin.js for the view that uses these.

let authPromise = null;
let authMod = null;
let authInstance = null;

function loadAuth() {
  if (!FIREBASE_ENABLED) return Promise.resolve(null);
  if (authPromise) return authPromise;
  authPromise = (async () => {
    try {
      const [{ initializeApp, getApps }, mod] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      ]);
      authMod = mod;
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      authInstance = authMod.getAuth(app);
      return authInstance;
    } catch (err) {
      console.warn("[remoteSync] Firebase Auth unavailable.", err);
      return null;
    }
  })();
  return authPromise;
}

/** Attempts admin sign-in; returns { ok: true } or { ok: false, error }. */
export async function adminSignIn(email, password) {
  const auth = await loadAuth();
  if (!auth) return { ok: false, error: "Firebase Auth isn't available right now." };
  try {
    await authMod.signInWithEmailAndPassword(auth, email, password);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.code === "auth/invalid-credential" ? "Wrong email or password." : (err.message || String(err)) };
  }
}

export async function adminSignOut() {
  const auth = await loadAuth();
  if (!auth || !authMod) return;
  try {
    await authMod.signOut(auth);
  } catch (err) {
    console.warn("[remoteSync] adminSignOut failed.", err);
  }
}

/** Fires cb(user|null) now and on every future sign-in/out. Returns an unsubscribe fn. */
export function onAdminAuthChanged(cb) {
  let unsub = () => {};
  loadAuth().then((auth) => {
    if (!auth || !authMod) {
      cb(null);
      return;
    }
    unsub = authMod.onAuthStateChanged(auth, cb);
  });
  return () => unsub();
}

/**
 * Admin-only: every student code's lightweight activity summary (never
 * their actual answers/attempts content — just the students/{code} doc).
 * Firestore itself will reject this with a permission error for anyone
 * who isn't signed in as the admin account (see firestore.rules).
 */
export async function fetchAllStudentsSummary() {
  const db = await loadFirestore();
  if (!db) return { ok: false, error: "Sync isn't configured.", rows: [] };
  try {
    const snap = await fs.getDocs(fs.collection(db, "students"));
    const rows = snap.docs.map((d) => ({ code: d.id, ...d.data() }));
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, error: err.code === "permission-denied" ? "Not authorized." : (err.message || String(err)), rows: [] };
  }
}
