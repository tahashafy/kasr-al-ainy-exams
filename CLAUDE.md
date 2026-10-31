# CLAUDE.md — read this first

This repo is "Kasr Al-Ainy Exams", a practice exam platform for Kasr Al Ainy Faculty of Medicine, Cairo University, built for a single non-technical user (the repo owner) who is not a developer. Explain things in plain terms when talking to them; don't assume they know git/Node/etc.

Read `IMPLEMENTATION_REPORT.md` at the repo root for the full narrative of what's been built, why, and what's still unresolved. This file (`CLAUDE.md`) is the *technical* map — how the pieces fit together and the conventions to preserve so you don't break something the user doesn't know to ask about.

## What this is

A zero-build, zero-npm-dependency vanilla JS web app (`app/`) that serves exam practice questions to medical students, with optional Firebase-backed multi-device sync via an anonymous per-student access code (off by default; see `app/SETUP_FIREBASE.md`). It is deployed to Firebase Hosting at `https://kasr-aliny-exams.web.app/`.

## Repo layout

```
app/                          the actual deployed application — THIS is what gets served
  index.html                  shell page; nav, footer, language toggle live here
  css/styles.css               hand-written CSS, no framework
  js/
    app.js                    router wiring, access-code modal, "coming soon" pages
    router.js                 tiny hash-based router
    data.js                   question-bank query layer (filtering, chapters, sources)
    scoring.js                PURE scoring engine — has its own test suite, do not touch casually
    store.js                  localStorage-backed state + settings (incl. language pref)
    identity.js / remoteSync.js   optional Firebase access-code sync (see below)
    i18n.js                   English/Arabic dictionary + t()/applyStaticTranslations()
    views/*.js                one file per screen (home, moduleSelect, library101,
                               examSetup, examTake, examResults, mistakes, bookmarks,
                               history, about)
  data/
    questions.json            THE QUESTION BANK — 528 records as of the last import (Module 101)
    sources.json              one entry per imported exam batch (label, counts, academic year)
    chapters.json             category/chapter taxonomy + textbook edition string
  firebase.json, firestore.rules, .firebaserc   Firebase Hosting + Firestore config
  server.js                   ~50-line dependency-free static file server (local dev only)
  tests/scoring.test.js       Node's built-in test runner, 14 tests — keep these passing

scripts2/                     the CURRENT import pipeline (Word-doc sources). Use this, not
                              any older `scripts/` you might find referenced in history —
                              that one parsed PDFs/OCR and is fully superseded.
  extract_questions.py        parses original question .docx files → questions_raw.json
  extract_answer_keys.py      parses "Book Verified Answer Key" .docx files → answer_keys_raw.json
  build_question_bank_v2.py   merges both + classifies category/chapter → app/data/questions.json

source_docs/101/
  questions/                            original question papers (.docx), one per batch
  book_verified_answer_keys/            the CURRENT, authoritative answer-key .docx files
  superseded_independent_answer_keys_DO_NOT_USE/
                                          an EARLIER answer-key format (self-described as
                                          "independently reasoned... not an official university
                                          marking scheme"). Kept only for historical reference.
                                          Never use these to answer a question — if a batch's
                                          book_verified_answer_keys file disagrees with one of
                                          these, the book_verified one always wins.

IMPLEMENTATION_REPORT.md      narrative report of the whole build, kept in sync with the
                              same-named doc in the user's claude.ai Project ("Med Exams Web
                              App"). Update BOTH when you make a material change.
```

## The data model — the two axes that must never be conflated

Every question in `app/data/questions.json` carries two **independent** classifications. Keep them independent in any new code, UI, or filter you add:

1. **`gradingStatus`**: `"Ready"` or `"Review"`.
   - Ready = no unresolved scoring issue was identified in the answer key. It does **not** mean officially approved by the faculty.
   - Review = practice-only; answerable by students, shown with its recommended answer after submission, but **excluded from the scored denominator** and reported separately on the results screen.
   - `reviewStatus` (`"verified"` / `"needs_review"`) is a **derived alias** of this field, computed at build time in `build_question_bank_v2.py`, that exists *only* so `scoring.js` — already fully tested — never had to change. If you add a new grading concept, extend `gradingStatus`/`reviewStatus` together; don't invent a third parallel field.

2. **`coverageLabel`** / **`coverageGroup`**: `Direct` / `Calculated` / `Inferred` / `Partial` / `"Not covered"`, where the first three are grouped as `"Book Supported"` (`coverageGroup`) for filtering, while the original specific label is preserved for the detailed "View source and details" panel.
   - This describes how well the **recommended answer is supported by the reference textbook** — nothing about scoring eligibility or faculty approval.

**Never add grading-status and coverage counts together, and never derive one from the other.** The validation check for an import is always: total, Ready count, Review count, and the five coverage-label counts — reported as separate numbers, not combined.

Other per-question fields worth knowing about: `bookPages` (PDF-viewer page numbers counted from 1 **including the cover** — not printed page numbers; preserve this convention exactly when importing new sources), `evidence` (the explanation text), `reviewNote` (reasoning/doubt note), `conditionalAlternatives` (alternate acceptable answers + their condition), `allowAbstention`, `isMultipleAnswerOrException`. Stable question IDs follow the pattern `B<batch>-Q<originalNumber>` (e.g. `B199-Q118`) — preserve this scheme for new batches.

## How to import a new exam batch (same module)

1. Get the original question file and the **Book Verified Answer Key** file for the new batch from the user — insist on the "Book Verified" naming/format specifically; if what you're handed looks like the superseded independent-key format (no PDF page references, no coverage labels, no Ready/Review field — see `source_docs/.../superseded_...DO_NOT_USE/` for what that looks like), say so and ask for the right file rather than importing it.
2. Drop the new files into `source_docs/101/questions/` and `source_docs/101/book_verified_answer_keys/` with the same naming convention as the existing ones.
3. Extend `scripts2/extract_questions.py` and `scripts2/extract_answer_keys.py` to also read the new batch (add it to whatever batch-list/dict drives the loop; don't fork a parallel one-off script per batch — the existing parsers already handle multiple option layouts, but re-check against the new file's actual formatting before assuming it'll just work; batch 194 needed a dedicated parser because it had no printed question numbers, for example).
4. Add the new batch's metadata (`BATCH_META` in `build_question_bank_v2.py` — academic year, exam date, filenames) and re-run all three scripts in order (extract_questions → extract_answer_keys → build_question_bank_v2).
5. **Cross-validate before trusting the merge**: compare the independently-parsed stem text from the question file against the stem text recorded in the answer-key file, for every question in the new batch — this is what catches silent Q/A misalignment. Also spot-check that each answer-option letter's recorded text matches the actual option text. Zero mismatches is the bar; do not proceed past a mismatch by "just picking one" — investigate it.
6. Ask the user for the validation totals they expect (total questions, Ready/Review split, coverage-label split) and check the rebuilt `app/data/questions.json` against them exactly, the same way the first import was validated (see §7 of `IMPLEMENTATION_REPORT.md` for the worked example). Investigate any discrepancy; never edit a record just to force a match.
7. Run `cd app && npm test` (scoring engine — should still be 14/14 unchanged) and a Playwright/manual pass through at least: the new batch selectable as a Full Past Exam with the correct question count, a question from it showing the right before/after-answering behavior, and (if it has any Review questions) the "Practice only — excluded from your score" notice appearing correctly.
8. Update `app/data/sources.json` counts (handled automatically by the build script) and both `IMPLEMENTATION_REPORT.md` files (this repo's root copy, and ask whether to also update the claude.ai Project copy if you're working from a session that has that Project attached).

## How to add a brand-new module (e.g. 102/103)

The homepage (`app/js/views/moduleSelect.js`) and router (`app/js/app.js`) already support N modules without restructuring — 102/103 currently render as disabled "Coming Soon" cards. To light one up:

1. Run the same batch-import pipeline above, but under a new module's own `source_docs/<module>/` tree and a new module id used throughout (`module` field on each question record, route params like `/module/102`, `/setup/102`).
2. In `app/js/app.js`, change the relevant `registerRoute("/module/:id", ...)` / `/setup/:id` branches to route the new module id to its own library/setup views instead of `renderComingSoon` (you'll likely want to genericize `library101.js`/parts of `examSetup.js` to take a module id rather than hardcoding "101" — they are currently 101-specific and were deliberately not generalized prematurely since only one module existed).
3. Add the new module's card data (title, description, chapter/category taxonomy) and i18n keys (see below) following the same pattern as the 101 cards.
4. Keep Module 101 fully working throughout — this app explicitly promises "allow future modules to be added without major restructuring," so prefer extending the existing data/view shape over a parallel one-off path for the new module.

## i18n conventions (`app/js/i18n.js`)

- **Never translate exam content**: question stems, options, option letters, academic answer text/explanations, calculations, source quotations. These always render in English, and always `dir="ltr"` even inside an Arabic-language page. This is a hard rule from the brief, not a style preference — don't "helpfully" translate a question stem.
- Everything else — navigation, buttons, filters, settings, onboarding text, notices, empty states, errors — gets a key pair in both `DICT.en` and `DICT.ar`, used via `t("some.key")` (or `t("some.key", {var})` for interpolation) in the view files, or `data-i18n="some.key"` / `data-i18n-attr="attrName:some.key"` for static markup in `index.html`.
- If you add a new piece of UI text, add both language entries in the same edit — don't leave an English-only key "for now."
- `applyStaticTranslations()` sets `dir="rtl"`/`dir="ltr"` on `<html>` and is re-run after a language switch (currently via `location.reload()` — the simplest correct way to force every view to re-render in the new language; don't try to avoid the reload without also auditing every view for stale-language state).

## Testing discipline

- `cd app && npm test` runs `tests/scoring.test.js` (Node's built-in test runner, no dependency). These 14 tests are the contract for `scoring.js`'s behavior (Ready-only denominator, abstention handling, zero-eligible-questions state, etc.) — if a change to the data model or scoring rules would require changing one of these tests, treat that as a signal to slow down and confirm the new rule with the user before proceeding, not just update the test to match.
- There's no checked-in Playwright test file (the E2E passes done so far were ad-hoc scripts run during the session, not committed) — if you want repeatable E2E coverage, consider adding one under `app/tests/e2e/` using the pre-installed Playwright, driven against `node server.js`.
- Before calling any import or UI change "done," actually run the app (`cd app && npm start`, open http://localhost:3000) and click through the specific thing you changed — don't rely on code review alone for UI-facing work.

## Deployment

The live site (`https://kasr-aliny-exams.web.app/`) is Firebase Hosting, already configured — `app/firebase.json` and `app/.firebaserc` point at the real project. To deploy a change: `cd app && firebase deploy --only hosting,firestore:rules` (needs the Firebase CLI logged in to an account with access to that project — see `app/SETUP_FIREBASE.md` for the full non-technical walkthrough, written for the repo owner). None of this app's static assets are cache-busted (no content-hashed filenames), so after deploying, a hard refresh (or waiting out the browser cache) may be needed to see changes — this has already confused the user once; mention it proactively after any deploy instructions you give them.

## Working with the repo owner

They are not a developer. When giving instructions, write them as literal numbered steps (what to click, what to paste, what command to run from which folder), not as a diff or a description of the change. They've previously gotten tripped up by: running CLI commands from the wrong folder, browser caching after a deploy looking like a failed deploy, and confusing GitHub's own "Claude Directory"/marketplace pages with the specific Claude GitHub App install link. Anticipate this and be explicit (exact URLs, exact `cd` targets) rather than assuming familiarity.
