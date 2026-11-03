// Persistence layer. Reads are synchronous against an in-memory cache (kept
// warm from localStorage + — when configured — Firestore) so every existing
// view can keep calling these functions exactly as before with no
// async/await changes. Writes update the cache and localStorage immediately
// (so the UI never waits on the network), and push to Firestore in the
// background on a best-effort basis when Firebase is configured (see
// firebaseConfig.js / remoteSync.js). If that push fails — offline, no
// Firebase project set up, etc. — the data is still safe locally.
//
// Each student is identified only by an anonymous access code (identity.js)
// they can re-enter on another device to pull their history back down; see
// the "Your access code" control wired up in app.js.

import { getAccessCode, setAccessCode, normalizeCode } from "./identity.js";
import * as remote from "./remoteSync.js";

const KEYS = {
  ATTEMPTS: "m101_attempts_v1",
  BOOKMARKS: "m101_bookmarks_v1",
  SETTINGS: "m101_settings_v1",
  IN_PROGRESS: "m101_in_progress_v1",
};

const DEFAULT_SETTINGS = {
  theme: "light", // 'light' | 'dark'
  explanationMode: "after-submit", // 'immediate' | 'after-submit'
  lang: "en", // 'en' | 'ar' — interface language; exam content always stays English
  showQuestionMeta: true, // show/hide each question's source metadata (code, tags, batches) — on by default
};

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("Storage read failed for", key, e);
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn("Storage write failed for", key, e);
    return false;
  }
}

export function isStorageAvailable() {
  try {
    const t = "__m101_test__";
    localStorage.setItem(t, "1");
    localStorage.removeItem(t);
    return true;
  } catch (e) {
    return false;
  }
}

// ---------- In-memory cache ----------
let cache = {
  attempts: safeGet(KEYS.ATTEMPTS, []),
  bookmarks: safeGet(KEYS.BOOKMARKS, []),
  settings: { ...DEFAULT_SETTINGS, ...safeGet(KEYS.SETTINGS, {}) },
};
let initialized = false;
let initPromise = null;

function persistCache() {
  safeSet(KEYS.ATTEMPTS, cache.attempts);
  safeSet(KEYS.BOOKMARKS, cache.bookmarks);
  safeSet(KEYS.SETTINGS, cache.settings);
}

function mergeAttempts(local, remoteAttempts) {
  const byId = new Map(local.map((a) => [a.id, a]));
  for (const a of remoteAttempts) byId.set(a.id, a); // attempts are immutable once finished; remote is as good as local
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.finishedAt || b.startedAt) - new Date(a.finishedAt || a.startedAt)
  );
}

/**
 * Call once at app startup (awaited) before rendering routes. Loads the
 * local cache (already synchronous above) and, if Firebase is configured,
 * pulls this access code's remote data down and merges it in so a student
 * who switches devices sees their history immediately.
 */
export async function initStore() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (remote.isRemoteEnabled()) {
      const code = getAccessCode();
      remote.touchPresence(code); // fire-and-forget — records this app-open for the admin view
      const bundle = await remote.fetchRemoteBundle(code);
      if (bundle) {
        if (bundle.attempts && bundle.attempts.length) {
          cache.attempts = mergeAttempts(cache.attempts, bundle.attempts);
        }
        if (bundle.bookmarks && bundle.bookmarks.length) {
          cache.bookmarks = Array.from(new Set([...cache.bookmarks, ...bundle.bookmarks]));
        }
        if (bundle.settings) {
          cache.settings = { ...cache.settings, ...bundle.settings };
        }
        persistCache();
      }
    }
    initialized = true;
  })();
  return initPromise;
}

export function isInitialized() {
  return initialized;
}

export function isRemoteEnabled() {
  return remote.isRemoteEnabled();
}

// ---------- Access code (identity) ----------
export { getAccessCode };

/**
 * Switches this browser to a different access code (e.g. a student recovers
 * their account on a new device) and re-pulls that code's remote data.
 * Local data under the OLD code is left alone in this browser's
 * localStorage under its own keys only conceptually — in practice the
 * simple model here keeps one local cache per browser, so switching codes
 * replaces the active view with the new code's (merged local+remote) data.
 */
export async function switchAccessCode(rawInput) {
  const normalized = normalizeCode(rawInput);
  if (!normalized) return { ok: false, error: "That doesn't look like a valid access code." };
  setAccessCode(normalized);
  cache = { attempts: [], bookmarks: [], settings: { ...DEFAULT_SETTINGS } };
  persistCache();
  initPromise = null;
  initialized = false;
  await initStore();
  return { ok: true, code: normalized };
}

// ---------- Attempts (completed exam history) ----------
export function getAttempts() {
  return cache.attempts;
}

export function saveAttempt(attempt) {
  cache.attempts = [attempt, ...cache.attempts.filter((a) => a.id !== attempt.id)];
  persistCache();
  remote.pushAttempt(getAccessCode(), attempt); // fire-and-forget
  return attempt;
}

export function getAttemptById(id) {
  return cache.attempts.find((a) => a.id === id) || null;
}

// ---------- In-progress exam (local/per-device only — not synced) ----------
export function saveInProgress(state) {
  safeSet(KEYS.IN_PROGRESS, state);
}
export function getInProgress() {
  return safeGet(KEYS.IN_PROGRESS, null);
}
export function clearInProgress() {
  try {
    localStorage.removeItem(KEYS.IN_PROGRESS);
  } catch (e) {
    /* ignore */
  }
}

// ---------- Bookmarks ----------
export function getBookmarks() {
  return cache.bookmarks;
}
export function isBookmarked(questionId) {
  return cache.bookmarks.includes(questionId);
}
export function toggleBookmark(questionId) {
  const idx = cache.bookmarks.indexOf(questionId);
  const nowBookmarked = idx < 0;
  if (idx >= 0) cache.bookmarks = cache.bookmarks.filter((id) => id !== questionId);
  else cache.bookmarks = [...cache.bookmarks, questionId];
  persistCache();
  const code = getAccessCode();
  if (nowBookmarked) remote.pushBookmarkAdd(code, questionId);
  else remote.pushBookmarkRemove(code, questionId);
  return nowBookmarked;
}

// ---------- Settings ----------
export function getSettings() {
  return cache.settings;
}
export function saveSettings(partial) {
  cache.settings = { ...cache.settings, ...partial };
  persistCache();
  remote.pushSettings(getAccessCode(), cache.settings);
  return cache.settings;
}

// ---------- Derived: mistake review ----------
/**
 * Collect every incorrectly-answered (graded) question across attempt
 * history, most recent attempt's response kept per question.
 */
export function getMistakeQuestionIds() {
  const mistakes = new Map(); // questionId -> {attemptId, selected}
  for (const attempt of cache.attempts) {
    for (const qid of Object.keys(attempt.responses || {})) {
      const r = attempt.responses[qid];
      if (r.wasCorrect === false && !mistakes.has(qid)) {
        mistakes.set(qid, { attemptId: attempt.id, selected: r.selected });
      }
    }
  }
  return mistakes;
}

export function clearAllData() {
  cache = { attempts: [], bookmarks: [], settings: { ...DEFAULT_SETTINGS } };
  try {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    /* ignore */
  }
  remote.deleteAllRemote(getAccessCode());
}

// ---------- Admin (see js/views/admin.js) ----------
export const adminSignIn = remote.adminSignIn;
export const adminSignOut = remote.adminSignOut;
export const onAdminAuthChanged = remote.onAdminAuthChanged;
export const fetchAllStudentsSummary = remote.fetchAllStudentsSummary;
