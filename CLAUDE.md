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

scripts2/                     the CURRENT import pipeline. For 101/102 (Word-doc sources):
  extract_questions.py        parses original question .docx files → questions_raw.json
  extract_answer_keys.py      parses "Book Verified Answer Key" .docx files → answer_keys_raw.json
  build_question_bank_v2.py   merges both + classifies category/chapter → app/data/questions.json
                              (currently modules 101/102/103 — writes questions.json from ONLY
                              these modules' own data, so Module 205's records are gone from the
                              file until build_module205_question_bank.py is run again afterward)
  build_module205_question_bank.py   Module 205's own importer — see "Module 205" section below.
                              Does NOT re-parse the original PDF; it reshapes the already-validated
                              source_docs/205/*.json into this app's data model. Re-run it any time
                              source_docs/205/*.json changes; it only replaces the "205" slice of
                              chapters.json/questions.json/sources.json, leaving 101/102/103 untouched.
                              MUST be run AFTER build_question_bank_v2.py any time that script also
                              ran, or Module 205 silently disappears from questions.json — see
                              IMPLEMENTATION_REPORT.md §16.5 and the §9 "How to run" command order.

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

Other per-question fields worth knowing about: `bookPages` (PDF-viewer page numbers counted from 1 **including the cover** — not printed page numbers; preserve this convention exactly when importing new sources), `evidence` (the explanation text), `reviewNote` (reasoning/doubt note), `conditionalAlternatives` (alternate acceptable answers + their condition), `allowAbstention`, `isMultipleAnswerOrException`. Stable question IDs follow the pattern `B<batch>-Q<originalNumber>` (e.g. `B199-Q118`) — preserve this scheme for new batches, **except when a new module reuses another module's batch numbers** (Module 103 reuses 101's batch numbers 195-199 for the same student cohorts): then the bare `B<batch>-Q<n>` text would silently collide with the other module's existing ids, so prefix the actual `id` field with the module (`M103-B195-Q001`) and keep the bare label only as a non-`id` `stableId` field if you need it — always re-check the full file for zero duplicate ids after any import, not just within the new batch. Module 103 also introduced `bookSource` (`"department"`/`"hisham_esmat"`) and `bookSourceLabel`, `null`/omitted for every other module — see IMPLEMENTATION_REPORT.md §16.2 before extending this pattern to a future module that also needs a second reference source.

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

## Module 205 — a different kind of module, and the config mechanism it introduced

Module 205 (Neuroscience) is the first module that is **not** a set of End-of-Module exam papers — it's a standalone MCQ question bank (2,208 questions, organized by subject/chapter/section, extracted and validated from a 236-page PDF) plus a separate set of 467 previous-exam reprints. This surfaced two real differences from 101/102 that are now handled through **per-module config flags in `app/data/chapters.json`**, not hardcoded `if (moduleId === "205")` checks scattered through the views:

- `chapters.json["205"].contentKind: "mcq"` (101/102 omit this field, defaulting to `"eom"` via `data.js`'s `getModuleContentKind()`). `library.js` reads this to show "MCQ Questions" instead of "End-of-Module" in the breadcrumb and to swap the "Examination library" section's title/description to "Previous exams" wording — nothing else changes. `moduleSelect.js`'s own breadcrumb was also made generic ("Modules" instead of the hardcoded "End-of-Module Examinations") since it's now the entry point to more than one content kind.
- `chapters.json["205"].showWrittenTab: true` (via `data.js`'s `getModuleShowWrittenTab()`, defaults to `true` if omitted). `library.js` renders an inactive "Written / Final Examinations" card (same disabled-card convention as the homepage) on every module's page now that modules have their own landing page — this is additive and doesn't change 101/102's existing interactive functionality.

To add a future non-EOM module, set these two flags in its `chapters.json` entry rather than adding new branches to the view files.

**Data-model reuse, not a parallel schema.** Module 205's bank questions map onto the *existing* `category`/`chapter` fields (subject → category, PDF chapter → chapter) exactly like 101/102's taxonomy, so `library.js`/`examSetup.js`/`filterQuestions()` needed zero changes to support custom-mix practice by subject/chapter. Its previous-exam reprints map onto the existing `sourceExam`/`batch` fields exactly like 101/102's historical papers, so "Full Past Exams" mode works unchanged. The one real schema wrinkle: 205's bank questions are *not* tied to any single exam paper, so they get `sourceExam: null` — `data.js`'s `getExamSources()` now skips records with no `sourceExam` (a no-op for 101/102, where every record already has one) so they don't collapse into a bogus "null" row in the papers table. Exam-reprint records are deliberately given `category: null, chapter: null` (kept distinguishable from the bank's own subject classification, per the integration brief) — `filterQuestions()`'s existing category-match logic already excludes anything with no category from category-filtered practice, so no new filtering code was needed either.

Fields with no 101/102 equivalent (`coverageLabel`/`coverageGroup`) are left `null` for every 205 record rather than invented — this source was never cross-referenced against a textbook, so there is honestly nothing to report there, and `null` already resolves to the existing "undetermined" bucket the Advanced-filters coverage control handles. New 205-only fields (`questionCode`, `topicCode`, `section`, `tags`, `historicalBatches`, `sourcePdfPage`, `answerVerificationStatus`, `hasFigure`/`figures`, and on exam entries `batch`/`refCode`/`cancelled`/`figureReproductionNote`) extend each record without touching the shared fields other modules rely on. A handful of questions (2 of 2,675) whose original "options" are labelled points on a diagram rather than selectable text are force-set to `gradingStatus: "Review"` with `correctOptionId: null`, since they can't be fairly scored through a text UI — see `scripts2/build_module205_question_bank.py`'s `figure_label_only` handling.

**Figures**: the 4 extracted diagram/photo files live at `app/data/figures/*.png`; `examTake.js` renders `<img>` tags for any question with `hasFigure`/`figures` set (new — 101/102 never had this).

**Source material**: `source_docs/205/` holds the already-extracted-and-validated `questions_final.json`/`exam_entries_final.json`/`chapter_banners.json` (produced by a separate PDF-extraction pipeline, not committed here — see `MODULE205_DATABASE_REPORT.md` in that folder for its own methodology/validation/manual-review notes) plus `review_answers.json` (4 exam-entry questions whose printed answer-key mark was a literal "?" in the source — correctly carried through as `answerVerificationStatus: "unverified_in_source"` / `gradingStatus: "Review"`, never guessed).

### Sections, the IPKA filter, and the per-question source-metadata toggle

Module 205's PDF table of contents is a 3-level **Subject → Chapter → Section** hierarchy (e.g. Anatomy → Neuro → Spinal Cord), one level deeper than 101/102's Category → Chapter taxonomy. This is exposed as a third, chapter-scoped filtering tier:

- `sectionId` (e.g. `m205-an-1--spinal-cord`) is a new per-question field, computed by `scripts2/build_module205_question_bank.py`'s `build_sections_by_chapter()` **directly from the validated question records in first-seen (printed) order** — not hand-transcribed from the PDF TOC — so it can never drift out of sync with the actual data. (It was cross-checked against the PDF's own printed section counts via `pdftotext -layout` during development and matched exactly; see `IMPLEMENTATION_REPORT.md` for the sampled figures.) The resulting list lands on each chapter object in `chapters.json` as a `sections: [{id, title, count}]` array. 101/102 chapters simply have no `sections` array.
- `data.js`'s `getSectionsForChapters(moduleId, chapterIds)` returns the sections belonging to the chapters currently selected in the exam builder, or `[]` for any chapter without a `sections` array — a silent no-op for 101/102.
- `filterQuestions()` gained a `sections` criterion (`q.sectionId` match) alongside the existing `categories`/`chapters`. `examSetup.js` renders a section-chip row underneath the chapter chips, only when `sectionOptions.length > 0`, and prunes `state.selectedSections` whenever the chapter selection changes (mirroring the existing category→chapter pruning).
- **IPKA filter**: Module 205 questions carry a `tags` array (`"IPKA"`, `"COMMON"`, `"DEPT BOOK"` — printed next to each question in the source, with **no legend in the PDF explaining them**; the IPKA/non-IPKA distinction is per the repo owner's own domain description — "a parallel program to mainstream" — not independently verified against any other source). `filterQuestions()` gained an `ipka` criterion (`"only"` / `"exclude"` / unset = all). The chip row (`setup.ipkaLabel`/`IPKA_OPTIONS` in `examSetup.js`) is gated behind `data.js`'s `moduleHasProgramTags(moduleId)` — a data-driven check (`_questions.some(q => q.module === moduleId && q.tags?.length)`), so it only ever renders for a module that actually has tagged questions, with no hardcoded module-id check and no UI changes needed for modules that don't.
- **Per-question source metadata toggle**: every question's `questionCode`, `tags`, and `historicalBatches` (which exam batches it's on record as having appeared in) can be shown or hidden beside the question itself. This is a persisted student preference — `store.js`'s `DEFAULT_SETTINGS.showQuestionMeta` (default **`true`** — shown by default for every student automatically, since there's nothing to hide) — toggled via a "Hide Info"/"Show Info" button that `examTake.js` renders next to the bookmark button, gated by `examTake.js`'s exported `hasQuestionMeta(q)` helper (true iff the question has a code, tags, or batches — false, and so invisible, for every 101/102 question). The same badge row (`renderQuestionMetaRow(q)`, also exported from `examTake.js`) is reused in `examResults.js`'s review list so the identifiers are visible on the results/review screen too, driven by the same stored setting (no separate toggle button there — it's one student-wide preference).
- **"Book coverage" filter gating**: the Advanced-filters "Book coverage" chip row (Direct/Calculated/Inferred/Partial/Not covered) is only meaningful for a module that was actually cross-referenced against a textbook. `data.js`'s `moduleHasBookCoverage(moduleId)` (`_questions.some(q => q.module === moduleId && q.coverageLabel != null)`) gates it the same data-driven way as the IPKA/section mechanisms above — true for 101/102 (unchanged), false for 205 (every 205 record has `coverageLabel: null`, so the row would be meaningless noise there). If a module has *neither* book coverage nor program tags, the whole "Advanced filters" card itself is hidden rather than rendering an empty, pointless toggle.

This whole feature set follows the same principle as the `contentKind`/`showWrittenTab` flags above: everything new is driven by fields that are simply absent or empty for 101/102 (or for 205, as appropriate), so no module-id branching was needed anywhere in the view code.

### Module "Source" line and home-page wording

- `moduleSelect.js`'s `MODULE_CARDS` entries now carry an optional `sourceKey` (e.g. `modules.m101source`) rendered as a `Source: ...` line on the card, under the existing description, whenever present — omitted entirely for a module with no `sourceKey` (currently only the still-unavailable 103 placeholder). The copy itself lives in `i18n.js` per module (`modules.m101source`/`m102source`/`m205source`, both languages) and names the actual batch/exam-date lists, so it needs a manual update whenever a new batch is imported for any module — it is not derived from `sources.json` automatically.
- The home page's "End-of-Module Examinations" card heading/i18n key (`home.eomTitle`) was renamed to "Practice with MCQ Questions" (and `home.eomDesc`/`home.subtitle` reworded to drop their stale "Module 101 is live now" wording), since the card now leads to a module picker spanning EOM-exam modules (101/102) and a non-EOM MCQ-bank module (205) alike — the old EOM-specific phrasing no longer described what a student actually finds there.

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
