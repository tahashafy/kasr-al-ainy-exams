// Anonymous per-student access codes. No names, emails or passwords: a
// short human-friendly code is generated on first visit, stored in this
// browser, and doubles as the Firestore key that scopes that student's data
// (see remoteSync.js). A student who wants their history on a second device
// re-enters the same code there via the "Switch / recover account" flow.

const CODE_KEY = "m101_access_code_v1";
// Avoids visually-ambiguous characters (0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(len = 8) {
  const bytes = new Uint32Array(len);
  (crypto || window.crypto).getRandomValues(bytes);
  let raw = "";
  for (let i = 0; i < len; i++) raw += ALPHABET[bytes[i] % ALPHABET.length];
  return `KASR-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** True if this browser already has a code (vs. about to generate a fresh one). */
export function hasStoredAccessCode() {
  try {
    return !!localStorage.getItem(CODE_KEY);
  } catch (e) {
    return false;
  }
}

/** Returns the current browser's access code, generating one on first call. */
export function getAccessCode() {
  try {
    let code = localStorage.getItem(CODE_KEY);
    if (!code) {
      code = randomCode();
      localStorage.setItem(CODE_KEY, code);
    }
    return code;
  } catch (e) {
    // localStorage unavailable (private mode / blocked) — fall back to an
    // in-memory code for this page load only.
    if (!window.__m101_fallback_code) window.__m101_fallback_code = randomCode();
    return window.__m101_fallback_code;
  }
}

/** Normalizes user-typed codes (case/space/dash tolerant) to the canonical form. */
export function normalizeCode(input) {
  const cleaned = (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length < 8) return null;
  const core = cleaned.slice(-8); // tolerate/ignore an accidentally-typed "KASR" prefix
  return `KASR-${core.slice(0, 4)}-${core.slice(4)}`;
}

/** Switches this browser to a different (e.g. previously-issued) access code. */
export function setAccessCode(code) {
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch (e) {
    window.__m101_fallback_code = code;
  }
}
