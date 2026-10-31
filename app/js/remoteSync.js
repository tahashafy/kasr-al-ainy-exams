// Thin Firestore wrapper. Loaded dynamically (only when a real Firebase
// config is present) from Firebase's own CDN, so the app has zero npm
// dependencies and this file is a total no-op — including no network
// calls — when Firebase isn't configured.
//
// Data shape per student, keyed by their access code (see identity.js):
//   students/{code}                         — doc: { createdAt }
//   students/{code}/attempts/{attemptId}    — one doc per finished attempt
//   students/{code}/bookmarks/{questionId}  — one doc per bookmarked question
//   students/{code}/meta/settings           — singleton doc: theme etc.
//
// See firestore.rules: a student can only read/write under their own code's
// subtree, and the top-level `students` collection cannot be listed, so a
// code can't be discovered by enumeration — only by whoever holds it.

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
