# Kasr Al-Ainy Exams — Implementation Report

Kasr Al Ainy Faculty of Medicine, Cairo University — practice examination platform. This report covers the rebuild requested in the latest brief: rebranding to "Kasr Al-Ainy Exams" with a multi-module homepage, re-importing all five Module 101 exams from the new **Book Verified Answer Key** source files, simplified before/after-answering practice screens, a Ready/Review grading model kept fully separate from book-coverage evidence, renamed "Full Past Exams" filtering with an Advanced-filters coverage control, and a full Arabic/English interface translation with a persisted language switch. It supersedes the report's previous revision, which described an earlier, now-replaced import (355 questions from independently-reasoned/DeepSeek-style keys).

## 1. What changed in this phase

| Area | Before | After |
|---|---|---|
| Branding | "Module 101 Examination Platform" | **"Kasr Al-Ainy Exams"**, multi-module homepage (101 live, 102/103 "Coming Soon") |
| Answer source | Independent/DeepSeek-reasoned keys + OCR'd scans, one exam verified | **Book Verified Answer Key** `.docx` files for all 5 batches, parsed directly (no OCR) |
| Question count | 355 (3 papers fully imported, 2 skipped as unreadable scans) | **528 — all 5 batches, 100% imported** (194: 48, 195: 120, 196: 120, 198: 120, 199: 120) |
| Grading model | Verified / Needs Review (tied to "has an answer key at all") | **Ready / Review** — a grading-status field independent of book coverage, carried from the revised key's own review flag |
| Evidence model | None (single Verified/Unverified flag) | **Direct / Calculated / Inferred / Partial / Not covered**, grouped as "Book Supported" where applicable, kept distinct from grading status |
| Practice screen | Showed evidence/verification state before answering | **Before:** question + options only. **After:** recommended answer, concise explanation, restrained notices only when relevant, optional "View source and details" panel |
| Exam builder | "Specific Historical Paper", single Needs-Review toggle | **"Full Past Exams"**, original count/order preserved including Review questions; coverage filtering moved into a collapsible **Advanced filters** section; a coverage-filtered paper is labelled "Filtered Practice Set" |
| Scoring | Verified-only denominator | **Ready-only denominator**; Review questions are practice-only, answerable, shown with their recommended answer, and reported separately on the results screen |
| Language | English only | **English / العربية** switch (persisted), full interface-chrome translation, RTL layout for Arabic with exam content kept LTR |
| Dashboard | Module 101 cards slightly uneven height | Fixed (CSS sibling-selector bug firing inside the grid) — all four cards now equal size and aligned |

The zero-dependency architecture (vanilla JS/ES modules, no build step, `node server.js` for serving, Node's built-in test runner) is unchanged.

## 2. Source files used for this import

Original question papers and the **latest Book Verified Answer Key** `.docx` files, per batch — these supersede the earlier independently-reasoned/DeepSeek answer files entirely; none of the superseded files' answers were used:

| Batch | Academic year | Questions file | Answer key file | Imported |
|---|---|---|---|---|
| 194 | 2020–2021 | original question `.docx` | `Module101_Batch194_Book_Verified_Answer_Key.docx` | 48/48 |
| 195 | 2021–2022 | original question `.docx` | `Module101_Batch195_Book_Verified_Answer_Key.docx` | 120/120 |
| 196 | 2022–2023 | original question `.docx` | `Module101_Batch196_Book_Verified_Answer_Key.docx` | 120/120 |
| 198 | 2024–2025 | original question `.docx` | `Module101_Batch198_Book_Verified_Answer_Key.docx` | 120/120 |
| 199 | 2025–2026 | original question `.docx` | `Module101_Batch199_Book_Verified_Answer_Key.docx` | 120/120 |
| **Total** | | | | **528/528** |

The reference textbook is identified throughout as the **academic year 2026–2027 edition** — the app does not claim this was necessarily the edition originally used for every past exam.

One discovery during this phase worth recording: the folder initially made available only contained the older, explicitly superseded `*_Answer_Key.docx` files (self-described as "independently reasoned answers... not an official university marking scheme") — not the Book Verified Answer Key format the brief described (no PDF page references, no coverage labels, no Ready/Review field). This was reported rather than substituted; the correct `*_Book_Verified_Answer_Key.docx` files were added to the folder shortly after and re-imported from there.

## 3. Import pipeline

Three new Python scripts (`scripts2/`), replacing the old PDF/OCR pipeline for this data since the new sources are Word documents:

1. **`extract_questions.py`** — parses the 5 original question `.docx` files into `questions_raw.json`. Batch 194 (no printed question numbers) uses a dedicated parser; the rest use a generic numbered-question parser handling both inline (`a. ... b. ...`) and separate-paragraph option layouts.
2. **`extract_answer_keys.py`** — parses the 5 Book Verified Answer Key `.docx` files into `answer_keys_raw.json`: recommended answer, coverage label, book page references, reasoning/doubt notes, conditional alternative answers, and the Ready/Review grading flag.
3. **`build_question_bank_v2.py`** — merges both sources per batch, re-using the existing keyword-based category/chapter classifier, and writes the final `app/data/questions.json` (528 records) and `app/data/sources.json` (5 batch entries).

**Cross-validation performed before trusting the merge:** the stem text independently parsed from the original-question file was compared against the stem text independently parsed from the answer-key file for all 528 questions (catches silent Q/A misalignment between the two sources) — **zero mismatches**. A looser check that each recorded answer-option letter's text matches the corresponding option in the original question also passed for all 528 records.

## 4. Data model

Each question record now carries, alongside the preserved original wording/options/order/numbering and a stable id (`B199-Q118` style):

- `gradingStatus`: `"Ready"` or `"Review"` — orthogonal to book coverage; "Ready" means no unresolved scoring issue was identified in the revised key, **not** official faculty approval.
- `coverageLabel` / `coverageGroup`: `Direct` / `Calculated` / `Inferred` / `Partial` / `"Not covered"`, with the first three grouped as `"Book Supported"` for optional filtering while the original label is preserved in the detailed record.
- `evidence`, `bookPages` (PDF-viewer page numbers, counted from 1 including the cover — not printed page numbers), `reviewNote`, `conditionalAlternatives`, `allowAbstention`, `isMultipleAnswerOrException`.
- `reviewStatus` — a backward-compatible alias derived from `gradingStatus` at build time, added purely so the existing, already-tested `scoring.js` engine could be left completely unmodified.

Coverage and grading counts are tracked as two independent axes everywhere (filter UI, data layer, display) and are never added together or derived from one another.

## 5. Practice-screen and scoring behavior

- **Before answering:** question, options, and normal controls only — no evidence classification, AI-key comparison, or review notes are shown.
- **After answering:** "Recommended answer", a concise explanation, and a short notice only when relevant (e.g. "More than one answer may be defensible", "Not fully covered in the department book", "Practice only — excluded from your score"), plus an optional **"View source and details"** panel with book page references, full reasoning, ambiguity/discrepancy notes, conditional alternatives and their conditions, and the detailed coverage label.
- **Scoring:** `Score % = Correct ÷ Ready-and-answered(non-abstained) × 100`. Review questions are included in practice and complete past papers, are fully answerable, show their recommended answer and any doubt note after submission, and are excluded from the score denominator — reported separately, matching the brief's example phrasing ("18/20 graded questions correct. Two additional practice questions were excluded from scoring."). A session with no Ready questions shows a practice-completed state with no percentage, never a division by zero.
- **Full Past Exams** preserve the original question count and order, including Review and Not-covered questions. Applying an Advanced coverage filter to one is explicitly relabelled **"Filtered Practice Set"** rather than presented as a complete past exam.

## 6. Arabic translation

A dictionary-based i18n module (`js/i18n.js`, ~180 keys per language) translates all general interface chrome — navigation, buttons, filters, settings, onboarding, dashboard descriptions, results summaries and scoring explanations, ambiguity/coverage/excluded-scoring notices, empty states, validation messages, and errors — into natural Modern Standard Arabic. A persisted `English / العربية` switch in the header applies the change immediately (`dir="rtl"` on `<html>`, `dir="ltr"` scoped to every element rendering exam content). **Question stems, answer options, option letters, academic answer text/explanations, calculations and source quotations are never translated**, per the brief, and always render left-to-right even on an Arabic-language page.

## 7. Validation against the brief's totals

Checked directly against `app/data/questions.json` after the rebuild:

| Metric | Expected | Actual | Match |
|---|---|---|---|
| Total questions | 528 | 528 | ✅ |
| Grading — Ready | 480 | 480 | ✅ |
| Grading — Review | 48 | 48 | ✅ |
| Coverage — Direct | 490 | 490 | ✅ |
| Coverage — Inferred | 13 | 13 | ✅ |
| Coverage — Calculated | 1 | 1 | ✅ |
| Coverage — Partial | 14 | 14 | ✅ |
| Coverage — Not covered | 10 | 10 | ✅ |

All eight figures match exactly; no discrepancies were found to investigate.

## 8. Automated and end-to-end testing performed

- **`node --test tests/*.test.js` — 14/14 passing, unchanged.** `scoring.js` itself was not touched this phase (the `reviewStatus` alias field was the only accommodation needed), so its existing test coverage stands as-is.
- **Playwright regression pass (28 checks, 0 console/page errors)** driven against the running app, covering: homepage branding and title; 3-module homepage with 102/103 correctly disabled as "Coming Soon"; Module 101 dashboard — all 4 cards confirmed equal height and top-aligned (regression check for the sizing fix); Full Past Exams mode selecting Batch 199 and confirming exactly 120 eligible questions with the "Full Past Exam" label; a practice-mode question showing no coverage/evidence language before answering and "Recommended answer" + "View source and details" (which expands to show book coverage) after; language switch applying `dir="rtl"` and rendering Arabic text; a full 10-question custom exam built, answered, and submitted through to a results screen with a review section; History, Bookmarks, Mistakes, and About pages all loading without error; the About page's Ready/Review explanation and batch-199 sources row; the 404 page; and, separately, working through a full Batch 199 paper to confirm a "Practice only — excluded from your score" notice actually appears on one of its Review questions.
- No unresolved bugs were found during this pass. (The dashboard card-sizing issue reported for the previous phase was fixed as part of this rebuild — see §1 — and is covered by its own regression check above.)

## 9. How to run

```bash
cd app
npm test        # run the automated scoring-engine tests (14/14)
npm start        # serve the app at http://localhost:3000 (node server.js — no install needed)
```

Regenerating the question bank from the source files (only needed if the source files
change). **Run in this exact order** — `build_question_bank_v2.py` (101/102/103) and
`build_module205_question_bank.py` (205) each rewrite `app/data/questions.json` from
scratch using only their own modules' data, so 205 must be rebuilt *after* the other three
scripts or its 2,675 records are silently dropped until it's re-run (see §16.5):

```bash
python3 scripts2/extract_questions.py
python3 scripts2/extract_answer_keys.py
python3 scripts2/build_question_bank_v2.py
python3 scripts2/build_module205_question_bank.py
```

The optional Firebase-backed multi-student sync (access codes, Firestore, `SETUP_FIREBASE.md`) from the previous phase is unchanged and still off by default — the app runs fully local/offline unless an administrator deliberately configures it.

## 10. Unresolved issues and limitations (as of the Module 101-only phase)

- **None of the five batches' imports produced a discrepancy against the brief's validation totals** (§7) — there is nothing currently flagged as needing investigation on the data side.
- **Category/chapter mapping remains the existing automated/heuristic keyword classifier**, not hand-verified per question; the brief's instruction to flag uncertain mappings rather than invent new ones was followed by preserving the existing mapping approach unchanged, not by adding a new uncertainty flag — a future pass could add explicit per-question mapping-confidence if that's wanted.
- **"Ready" status reflects the revised key's own review flag only** — per the brief's own definition, it is not and is never presented as official faculty approval; this is stated explicitly both in-app (About page, per-question details panel) and here.
- **No admin UI yet** for reviewing Review-status questions, editing coverage labels, or approving accepted answers — the data model (`gradingStatus`, `coverageLabel`, `conditionalAlternatives`, stable per-question IDs) is already shaped to support one being added later without a schema change, consistent with the brief's note that AI-key comparisons and similar review tooling belong in an admin view rather than the student screen.
- **Arabic translation covers interface chrome only**, as specified — question stems, options, explanations, calculations, and source quotations are and will remain English-only by design, not an oversight.

## 11. Module 102 — Introduction to Biomedical Sciences (this phase)

Module 102 is now live alongside Module 101 (no longer "Coming Soon"). This phase also had to **rebuild `scripts2/build_question_bank_v2.py` and the classifier it depends on from scratch**: the Module 101 pipeline's original keyword classifier (`scripts/build_question_bank.py`, only ever referenced by import path, never committed to this repo) and its hardcoded `/mnt/user-data/uploads/...` source file paths in `scripts2/extract_questions.py`/`extract_answer_keys.py` were both missing/broken on a fresh clone. Both scripts now read from `source_docs/<module>/...` (checked into the repo) and are reproducible end-to-end from a clean checkout. **To avoid silently reshuffling the already-shipped 528 Module 101 questions' category/chapter fields**, the rebuilt merge script reuses Module 101's existing category/chapter assignment from the previous `app/data/questions.json` rather than re-deriving it blind — verified byte-for-byte: every one of the 528 Module 101 records is identical to the pre-this-phase data except for a cosmetic `originalSourceFile` filename fix.

### 11.1 Source files imported

Five End-of-Module papers plus their Book Verified Answer Keys (newly produced this phase, verified against `102_INT_Published_V2.pdf`), under `source_docs/102/`:

| Batch (by exam date) | Academic year | Questions | Ready | Review | Imported |
|---|---|---|---|---|---|
| 2020-01-15 | 2019–2020 | 96 | 93 | 3 | 96/96 |
| 2020-12-20 | 2020–2021 | 96 | 94 | 2 | 96/96 |
| 2021-12-26 | 2021–2022 | 120 | 116 | 4 | 120/120 |
| 2023-11-30 | 2023–2024 | 120 | 119 | 1 | 120/120 |
| 2024-11-28 | 2024–2025 | 120 | 118 | 2 | 120/120 |
| **Total** | | **552** | **540** | **12** | **552/552** |

Coverage labels (book `102_INT_Published_V2.pdf`, Biochemistry + Hemopoietic/Autonomic-Nervous-System physiology only — this book has no general cell/nerve/muscle physiology or metabolic-pathway chapters, which is why "Not covered" is a large share): Direct 381, Partial 31, Inferred 21, Calculated 6, Not covered 113 (sums to 552).

Module 102 has no "batch number" convention in its source material (unlike 101's Batch 194/195/...), so the exam date itself (e.g. `20200115`) is used as the batch key and stable question IDs are `E<date>-Q<originalNumber>` (e.g. `E20200115-Q001`), parallel to 101's `B<batch>-Q<n>` scheme.

The concise independently-reasoned keys (pre-book-verification) are kept for reference only, at `source_docs/102/independent_answer_keys_reference/` — not used by the import pipeline, analogous to (but not the same thing as) 101's `superseded_independent_answer_keys_DO_NOT_USE/`.

### 11.2 Parsing notes specific to Module 102

- One question (2023-11-30, Q33) lays its four options out as a receptor-comparison **table** rather than `a)/b)/c)/d)` paragraphs; `extract_questions.py` now walks paragraphs and tables together in true document order and flattens such a table into one option-text string per row.
- The Book Verified Answer Key `.docx` format differs slightly from 101's: the "Question N  StableId" header and the question stem are sometimes the same paragraph (as in 101) and sometimes two separate paragraphs, depending on which batch; `extract_answer_keys.py` now handles both. Page citations are written as "Page(s) 12-13" rather than 101's "Pages 12, 13" — both are now accepted.
- Exactly one question (2021-12-26, "Regarding blood platelets, the following is true") has two independently defensible options (B and C); the key's own prose states which one is the intended **primary** answer ("C is kept as the primary answer..."), which the parser now extracts explicitly (`primaryLetterOverride`) rather than defaulting to whichever letter is listed first — `correctOptionId` must always be a single letter (never an array) for `scoring.js`/the view layer to work, so the other letter is carried in `conditionalAlternatives` instead.
- A new `deepseekComparison` field (`Agree`/`Disagree`/`Unresolved`/`Not supplied`/`null`) was carried over from the Book Verified key's own DeepSeek-comparison sentence per question. It isn't surfaced anywhere in the UI yet — available for a future admin/QA view.

### 11.3 Category/chapter classification

Module 102's chapter taxonomy (`app/data/chapters.json`) is taken directly from `102_INT_Published_V2.pdf`'s own table of contents: **Biochemistry** (14 chapters, PDF pages 4–127) and **Physiology** (2 chapters — Hemopoietic System p.128, Autonomic Nervous System p.164). A new keyword classifier (`scripts2/classify_102.py`) built from standard terminology for each of those 16 chapters assigns `category`/`chapter` — same "reasonable first pass, not hand-verified" caveat as 101's classifier. 117/552 (21%) questions didn't match any keyword set and are unclassified — higher than 101's 30/528 (5.7%), mainly because many Module 102 questions (general cell/nerve/muscle physiology, metabolic pathways) are outside this book's own scope entirely and so have no real chapter to assign; unclassified questions are excluded from category-filtered practice only, never silently dropped from the bank.

### 11.4 App generalization for a second module

Per CLAUDE.md's "add a brand-new module" instructions:

- `app/data/chapters.json` is now keyed by module id (`{"101": {...}, "102": {...}}`) instead of being a single Module-101-shaped object; `data.js`'s `getChapters`/`getCategoryList`/`getChaptersForCategories`/`getExamSources` now take a `moduleId` argument (`getChapterMeta`/`getCategoryMeta` didn't need one — chapter/category ids are unique across modules so they still resolve without it). `filterQuestions`/`drawExamQuestions` criteria gained a `module` field.
- `library101.js` was renamed to `library.js` and its `renderLibrary(root)` became `renderLibrary(root, moduleId)`; `examSetup.js`'s `renderExamSetup`/internal `paint`/`startExam` all now thread a `moduleId` through the same way. `app.js`'s `/module/:id` and `/setup/:id` routes now check `getAvailableModuleIds()` instead of hardcoding `=== "101"`.
- `moduleSelect.js`'s Module 102 card is no longer disabled/"Coming Soon".
- Fixed two latent single-module assumptions that would have actively misbehaved once a second module had real data: the exam-results "targeted revision" link and the in-exam "exit" button both used to hardcode `#/setup/101`/`#/module/101` regardless of which module the attempt actually belonged to — they now resolve the attempt's own module from its questions. Other screens' empty-state "start practicing" links (Mistakes/Bookmarks/History, reached with no exam context at all) now point at the neutral `#/exams` module-picker instead of assuming 101.
- Module 101 was re-verified working end-to-end (paper selection, exam start, scoring) after every change above.

### 11.5 Validation performed

- `extract_questions.py`: all 5 batches parsed to their expected question count (96/96/120/120/120), including the one table-based question.
- `extract_answer_keys.py`: all 5 batches parsed to their expected count with zero missing required fields (`answerLetter`/`coverageLabel`/`gradingStatus`).
- **Cross-validation** (per CLAUDE.md step 5): stem text from the independently-parsed question file compared against the stem text recorded in the answer-key file, and every answer letter checked against the actual option text, for all 552 Module 102 questions (and, as a regression check, all 528 Module 101 questions) — **zero mismatches**.
- `cd app && npm test` — scoring engine, still 14/14 passing, unchanged.
- Manual Playwright pass against `node server.js`: Module 102 library page (chapter/question counts correct), exam builder (all 5 papers listed with correct counts and Ready/Review split), a full 96-question attempt from the 2020-01-15 paper answered and submitted (score 23/93 graded, 3 correctly excluded as practice-only, matching that paper's own 93 Ready/3 Review split), the post-results revision link correctly pointing at `#/setup/102`, and Module 101's own full flow (paper list, exam start) re-confirmed unaffected. No console/page errors in any of the above.
- Caught and fixed one real regression introduced mid-build: the rewritten merge script initially dropped the `reviewStatus` field (`scoring.js`'s derived alias of `gradingStatus`), which silently made every question — in both modules — score as ineligible. Caught by the Playwright scoring check above before this was committed.

### 11.6 Limitations specific to this phase

- Classifier coverage for Module 102 (79% of questions assigned a chapter) is lower than Module 101's (90%), for the structural reason explained in §11.3, not a classifier-quality problem — most of the unclassified questions genuinely have no matching chapter in this book.
- `deepseekComparison` is parsed and stored but not yet shown anywhere in the UI.
- As with Module 101, none of this — including "Book Verified" — is presented as an official university marking scheme, in-app or here.

## 12. Post-launch fixes and small features (ongoing)

Changes made after both modules were live, in response to real usage feedback from the repo owner:

- **RTL mobile blank-page bug (fixed).** The `.skip-link` accessibility element was hidden with `position: absolute; left: -999px`, which still widens the page's scrollable area even though the element itself is invisible. Harmless in LTR (the browser clamps scroll position at 0, so the phantom space to the left is never reached), but on mobile in RTL the browser's default scroll position landed inside that phantom space, so the page appeared blank until the user swiped to find the real content. Replaced with the standard clip-based visually-hidden technique, which cannot create scrollable overflow; `overflow-x: hidden` was also added to `html, body` as a general safety net. Verified at 390px width in Arabic with Playwright: `scrollWidth === clientWidth`, content visible immediately.
- **Cache-control headers.** `firebase.json` now serves `.js/.css/.json/.html` with `Cache-Control: no-cache, must-revalidate`, so a plain refresh after a deploy picks up the new version (previously only a hard refresh reliably did, which confused the owner and would have confused students).
- **Admin usage-stats page** (`#/admin`, not linked in the nav). Shows every access code's `createdAt`/`lastOpenedAt`/`attemptsCount`/`lastAttemptAt`, gated by a real Firebase Auth login (not just a hidden URL — Firestore's own rules reject the `list` query for anyone but the one admin email via a new `isAdmin()` check). `remoteSync.js` gained `touchPresence()` (called from `initStore()`, upserts the `students/{code}` summary doc) and `noteAttempt()` (called from `pushAttempt()`, increments `attemptsCount`).
- **Homepage additions:** a persistent red-text reminder of the student's own access code (not just the one-time welcome popup), and a "Contact Admin — WhatsApp" link at the top of the page.
- **About page generalized** for multiple modules (was still Module-101-specific text); the imported-sources table now shows which module each paper belongs to and is grouped accordingly.
- **Bookmark vs. Mark-for-Review clarified.** These were already two intentionally separate features (★ Bookmark persists to the Bookmarks page forever; Mark for Review only flags a question within the current attempt's navigator and clears on submission, per `scoring.test.js`'s "marking a question for review does not affect its grading"), but a student expected flagged questions to show up in Bookmarks. No behavior changed — relabeled "Mark for Review" to "Flag (this exam only)", added tooltips to both buttons, and a one-line note under the question navigator spelling out the distinction.
- **Not-covered notice + universal abstain option.** Two related changes to `examTake.js`:
  1. A question whose `coverageLabel` is `"Not covered"` now shows an amber "⚠️ Not covered in the supplied department book" banner directly above the question text, visible before answering (previously this was only disclosed after submitting, in the post-answer explanation panel).
  2. The "I choose not to answer this question" (abstain) option, which `scoring.js` already fully supported (excludes the question from the eligible denominator — see its docstring), was previously only rendered when `q.allowAbstention` was true (which the build script only ever set for Review-status questions). It is now rendered unconditionally on every question, so a student can decline to answer — and have it not count against their score — on any question, book-covered or not, Ready or Review. `scoring.js`'s stale comment describing the old gated behavior was corrected to match; the scoring logic itself required no change. Verified end-to-end with Playwright (not-covered question → banner shows, abstain excluded from denominator → "Practice completed"/0-eligible state; a mixed one-answered-one-abstained attempt → 1/1 graded, 100%) and the 14 existing `scoring.test.js` tests still pass unchanged.

## 13. Module 205 — Neuroscience (new module, different kind of content)

Module 205 is live alongside 101/102. Unlike those, it isn't a set of End-of-Module exam papers — it's a standalone **MCQ question bank** (2,208 questions covering Anatomy/Physiology/Histology, independently extracted and validated from a 236-page compiled PDF — methodology and validation documented separately in `source_docs/205/MODULE205_DATABASE_REPORT.md`) plus **467 previous-exam reprints** across 5 batches. The already-prepared, validated database was used as the source of truth — no re-parsing of the original PDF happened in this app's repo.

### 13.1 What's different for this module, and how

Per the integration brief: no End-of-Module framing for this module, and a Written tab that's present but inactive. Implemented as two config flags on `chapters.json["205"]` — `contentKind: "mcq"` and `showWrittenTab: true` — read by new `data.js` helpers (`getModuleContentKind`, `getModuleShowWrittenTab`), rather than scattering module-id checks through the views:

- `library.js`'s breadcrumb reads "MCQ Questions" instead of "End-of-Module" for this module, and its "Examination library" section is relabeled "Previous exams" (describing the 467 reprints, not EOM papers). An inactive "Written / Final Examinations" card (same disabled-card styling the homepage already uses) now appears on every module's library page, including 101/102 — additive only, no existing interactive functionality changed.
- `moduleSelect.js`'s own breadcrumb was generalized from the hardcoded "End-of-Module Examinations" to a plain "Modules" crumb, and its three hardcoded module tiles were replaced with a small declarative `MODULE_CARDS` list (adding a 4th tile for 205) so a future module just adds one line here instead of another hardcoded `<a class="choice-card">` block.
- 101 and 102 were re-verified end-to-end after these changes (home → module list → library → exam setup → full exam → results, Playwright + `npm test`) — both render and score exactly as before.

### 13.2 Data-model mapping (reused, not forked)

Module 205's own structure maps directly onto the app's *existing* two independent axes:

- **Bank questions (2,208)**: subject (Anatomy/Physiology/Histology) → `category` (`m205-an`/`m205-ph`/`m205-hi`), PDF chapter → `chapter` (`m205-<subj>-<chapter_num>`, 10 chapters total, taken from `chapter_banners.json`). `sourceExam: null` (not tied to one paper) — `data.js`'s `getExamSources()` was patched to skip records with no `sourceExam` so these don't collapse into a bogus row in the papers table (a no-op for 101/102, which never had a null `sourceExam`).
- **Previous-exam reprints (467)**: map onto `sourceExam`/`batch` exactly like 101/102's historical papers (label: "Module 205 — Previous Exam — Batch `<n>`"), so "Full Past Exams" mode in the exam builder works unchanged. Deliberately given `category: null, chapter: null` — kept distinguishable from the bank's own subject classification per the brief, and the exam builder's existing category-filter logic already excludes null-category records from category-filtered practice with no new code.
- **Answer verification**: `answer_status` from the source (`printed` / `unverified_in_source` / `cancelled`) maps to `gradingStatus: "Ready"` (printed) or `"Review"` (unverified/cancelled) — Review questions are practice-only and excluded from the score denominator, exactly like 101/102's Review questions, so an unresolved answer is never silently presented as confirmed. The original status is preserved separately as `answerVerificationStatus` so nothing is lost. The 4 questions whose printed answer-key mark was a literal "?" in the source (not an OCR failure — flagged in `source_docs/205/review_answers.json`) are `unverified_in_source`/Review; none were guessed.
- **Book coverage** (`coverageLabel`/`coverageGroup`): left `null` for every 205 record — this source was never cross-referenced against a textbook, so there's honestly nothing to report, and `null` already resolves to the existing "undetermined" bucket. The Advanced-filters "Book Supported"/"Partial"/"Not covered" buttons correctly exclude all 205 questions; only "All Questions" includes them.
- **New fields** (extend, don't replace, the shared schema): `questionCode`, `topicCode`, `section`, `tags`, `historicalBatches` (batch numbers a bank question is annotated as having appeared in — kept separate from `sourceExam`/`batch`, which only exam-reprint records carry), `sourcePdfPage`, `answerVerificationStatus`, `hasFigure`/`figures`; exam-entry records additionally carry `batch`, `refCode` (links back to a bank question when the same one was reprinted), `cancelled`, `figureReproductionNote`.
- **Edge case — 2 questions whose source "options" are labelled points on a diagram** (`AN-NEC-33-26` in the bank, and exam batch 192 local #12) rather than selectable text: these are force-set to `gradingStatus: "Review"`/`correctOptionId: null` with a `reviewNote` explaining why, since they can't be fairly scored through a text-only UI. Caught by the importer's own validation pass (answer-letter-not-in-options check) before being special-cased — not silently dropped or mis-scored.
- **Figures**: the 4 extracted diagram/photo PNGs live at `app/data/figures/`; `examTake.js` now renders them inline for any question with `hasFigure` set (new capability — 101/102 never needed this).

### 13.3 Import pipeline

New `scripts2/build_module205_question_bank.py` reshapes `source_docs/205/questions_final.json` + `exam_entries_final.json` + `chapter_banners.json` (already independently extracted and validated — see that folder's own report) into `app/data/chapters.json`/`questions.json`/`sources.json`. It is additive/idempotent: it only ever replaces the `"205"` slice of each file, leaving 101/102 byte-for-byte untouched, and can be safely re-run if the source files change.

### 13.4 Validation performed

- Importer's own validation printout: 2,208 bank + 467 exam-entry records imported (2,675 total), **zero duplicate ids** across the whole 3,755-record `questions.json` (all three modules), **zero answer-letter-not-in-options mismatches** after the figure-label-only edge case was handled, 2,667 Ready / 8 Review for Module 205 (6 unverified/cancelled questions + 2 figure-label-only questions).
- `cd app && npm test` — scoring engine, still **14/14 passing, unchanged**.
- Playwright pass against `node server.js`: home → "End-of-Module Examinations" → module picker (breadcrumb now reads "Modules", Module 205 tile present) → Module 205 library page (breadcrumb reads "MCQ Questions", inactive "Written" card present, category cards show Anatomy/Physiology/Histology counts, "Previous exams" table lists all 5 batches) → exam builder (custom mode: 2,208 eligible / 2,207 graded / 1 practice-only; paper mode, batch selected: 61 eligible / 57 graded / 4 practice-only) → a full 5-question custom attempt answered and submitted through to a working results screen, no console/page errors. About page's sources table confirmed to list all 15 batch rows (5+5+5) across all three modules with no crash. Module 101's library page re-confirmed unaffected (breadcrumb still "End-of-Module", written card now additionally present as designed).

### 13.5 Limitations

- No book-coverage assessment exists for Module 205 (by design — this source has no associated textbook cross-reference); the Advanced-filters coverage control simply has nothing to show for it.
- The 2 figure-label-only questions and the 4 unverified-answer questions are practice-only and will never show a scored "correct answer" — this is the intended, honest behavior per the integration brief, not a gap to fix.
- `chapterMeta`-based "Chapter mapping pending review" fallback text (pre-existing, from Module 102's unclassified questions) is shown for Module 205's exam-reprint records too, since those are deliberately uncategorized — technically accurate but could use 205-specific wording in a future pass.

## 14. Module 205 — section filter, IPKA filter, and per-question source-metadata display (this phase)

The repo owner noticed the PDF prints additional identifiers beside each question — e.g. `AN-NEU-02-01 Batches 192` and `COMMON IPKA Batches 194 · 196` — and asked (1) to confirm these were correctly decoded before building anything, (2) to decode the table of contents for its chapter/section structure, (3) for a section-level filter (not just chapter-level — e.g. "Spinal Cord" as a sub-topic of chapter "Neuro"), (4) for an IPKA ("a parallel program to mainstream") filter — IPKA only / without IPKA / all — and (5) for all of a question's tag/code/batch info to be shown beside it in the app, behind a show/hide toggle.

### 14.1 Verification before building

- Confirmed via direct inspection of the already-validated `source_docs/205/questions_final.json` that `tags` (`COMMON`/`IPKA`/`DEPT BOOK`) and `batches_mentioned` were already captured correctly — spot-checked against the PDF's own printed headers (e.g. `AN-NEU-01-01`).
- Decoded the PDF's table of contents (`pdftotext -f 2 -l 3 -layout`) and confirmed it's a 3-level **Subject → Chapter → Section** hierarchy; cross-validated several section-level question counts against the already-extracted data (Anatomy/Neuro/Spinal Cord: 63; Histology/Nervous system/Neurons: 66; Physiology/Sensory/Pain sensation: 53; Anatomy/Head/Trigeminal nerve: 35; and the full 15-section breakdown of chapter "Neuro": 63, 81, 24, 17, 40, 10, 23, 6, 7, 7, 7, 14, 24, 23, 13) — all matched exactly.
- Corrected one point in the repo owner's own example: "Spinal Cord" is a **section** inside the "Neuro" **chapter**, not the chapter itself — "Neuro" also contains Brain stem, Cerebellum, Fourth ventricle, Sulci & gyri, and other sibling sections.
- Found **no in-PDF legend** explaining what IPKA/COMMON/DEPT BOOK mean — this is carried through the app exactly as printed, relying on the repo owner's own domain description rather than any independent source. Flagged this explicitly before building, consistent with the project's existing "never guess/invent, flag uncertainty" rule for answer verification.

### 14.2 What was built

- **Section filter**: a new `sectionId` field per Module 205 bank question (`scripts2/build_module205_question_bank.py`'s `build_sections_by_chapter()`, derived from the question data itself in printed order — not hand-transcribed from the TOC, so it can't drift out of sync). Surfaced in the exam builder as a chip row that appears once a chapter is selected (e.g. selecting "Neuro" reveals its 15 sections, including "Spinal Cord").
- **IPKA filter**: a new `ipka` criterion on `filterQuestions()` (`"only"` / `"exclude"` / all), shown as a 3-way chip row ("All Questions" / "IPKA Only" / "Exclude IPKA") in the exam builder's Advanced filters, with a note that the tag comes from the source material and isn't independently verified. The row only renders for a module that actually has tagged questions (`data.js`'s `moduleHasProgramTags()`), so it never appears for 101/102.
- **Per-question source-metadata toggle**: a "Show Info"/"Hide Info" button next to the bookmark button during practice (`examTake.js`) reveals a small badge row with the question's code (e.g. `AN-NEU-02-61`), program tags (e.g. `IPKA`), and historical batch mentions (e.g. `Batches: 192`). This is a persisted student preference (`store.js`'s `showQuestionMeta` setting, default off), so it stays set across questions and sessions. The same badge row is shown on the results/review screen (`examResults.js`) when the setting is on.

### 14.3 Validation performed

- Playwright pass against `node server.js`: selecting the "Neuro" chapter in Module 205's custom-mix builder revealed all 15 section chips; selecting "Spinal Cord" narrowed the eligible pool to exactly 63 questions, matching the TOC-validated count above. The IPKA filter chip row rendered with 3 options and narrowed the pool correctly. Starting a practice exam showed the "Show Info" toggle next to a question carrying real metadata (code `AN-NEU-02-61`, `Batches: 192`); clicking it flipped the button text ("Show Info" → "Hide Info"), set `aria-pressed`, and revealed the badge row with those identifiers pulled straight from the question record.
- Regression check: Module 101's exam builder shows **zero** section chips (no chapter there has a `sections` array) and **zero** IPKA chips (no 101 question carries `tags`) — both features are fully invisible for 101/102, with no module-id branching anywhere in the view code.
- `cd app && npm test` — scoring engine, still **14/14 passing, unchanged**.

## 15. Module 205 filter cleanup, default-on metadata, module source lines, and home-page wording (this phase)

Follow-up feedback after §14 shipped: the "Book coverage" filter is noise on Module 205 (it has none), the section drill-down needed confirming across *all* chapters (not just the Neuro example), the metadata toggle should default to showing rather than hiding, each module card needs a plain-language "Source" line, and the homepage's "End-of-Module Examinations" heading no longer fits a world with a non-EOM module.

### 15.1 "Book coverage" filter, gated off for Module 205

New `data.js` helper `moduleHasBookCoverage(moduleId)` (`_questions.some(q => q.module === moduleId && q.coverageLabel != null)`) — same data-driven pattern as `moduleHasProgramTags`. `examSetup.js`'s Advanced-filters coverage row is now wrapped in this check; the whole "Advanced filters" card is hidden if a module has *neither* book coverage nor program tags, so there's never an empty, pointless toggle. Verified: Module 101/102 still show their 4 coverage chips unchanged; Module 205 shows 0 coverage chips and its 3 IPKA chips (unaffected by this change, which was explicitly scoped to the coverage row only).

### 15.2 Section filter verified across every chapter, not just one example

Direct data check against `app/data/questions.json`/`chapters.json`: all 10 of Module 205's chapters (3 Anatomy, 3 Physiology, 4 Histology) have a non-empty `sections` array, every one of the 2,208 bank questions has a `sectionId` set (zero missing), and every chapter's section-count sum matches its actual question count exactly (e.g. `m205-an-1` "Neuro": 359 = 359; `m205-hi-4` "Ear": 71 = 71 — all 10 chapters checked, all exact). A Playwright pass clicking through every one of the 10 chapter chips in turn confirmed the UI renders the correct section-chip count for each (15/9/16/9/11/9/7/5/5/3, matching the data exactly) — this was already a generic, data-driven mechanism from §14, so no code changes were needed here, only verification.

### 15.3 Question-metadata toggle now defaults to on

`store.js`'s `DEFAULT_SETTINGS.showQuestionMeta` flipped from `false` to `true`. Since the button's label and the badge row's visibility were already both driven live off `getSettings().showQuestionMeta` (not a hardcoded label), this one-line change was sufficient — no other code needed updating. Verified with a brand-new browser context (no prior localStorage, simulating a student who's never touched the setting): the metadata toggle shows "Hide Info" and the badge row (question code + tags, e.g. `AN-NEU-01-15` / `DEPT BOOK`) is visible immediately on the very first question, with no action needed from the student. This is a global default change, so it applies to every student automatically, not just new installs.

### 15.4 Per-module "Source" line on the Modules page

`moduleSelect.js`'s `MODULE_CARDS` entries gained an optional `sourceKey`, rendered as a `Source: ...` line under each card's existing description (only for modules that have one — currently 101, 102, 205; the still-unavailable 103 placeholder has none). Copy added to `i18n.js` in both languages, naming the actual batch/exam-date lists pulled from `app/data/sources.json`:
- **101**: "Past-years End-of-Module exams — Batches 194, 195, 196, 198, 199 (academic years 2020–2021 through 2025–2026)."
- **102**: "Past-years End-of-Module exams — 2020-01-15, 2020-12-20, 2021-12-26, 2023-11-30, 2024-11-28 (academic years 2019–2020 through 2024–2025)."
- **205**: "A large MCQ question bank extracted from the Neuroscience course material (Anatomy, Physiology, Histology), plus reprints from past-years exam batches 192, 193, 194, 196, 197."

This is plain descriptive copy, not derived automatically from `sources.json` — it needs a manual update (both languages) whenever a new batch is imported for any module. Verified in both English and Arabic (RTL) with Playwright — all three cards render their Source line correctly; the disabled Module 103 card correctly has none.

### 15.5 Home-page wording no longer EOM-specific

`home.eomTitle` renamed from "End-of-Module Examinations" to "Practice with MCQ Questions" (and the Arabic equivalent updated the same way), since that homepage card now leads to a module picker spanning both EOM-exam modules (101/102) and a non-EOM MCQ-bank module (205). `home.eomDesc` and `home.subtitle` were also reworded to drop their now-stale "Module 101 is live now" phrasing (102 and 205 have been live for a while). Verified with Playwright in both languages; Module 101's full flow (library → setup → exam-take) re-confirmed unaffected by any of this phase's changes, with no console/page errors.

### 15.6 Validation performed

- `cd app && npm test` — scoring engine, still **14/14 passing, unchanged**.
- All checks above run via Playwright against `node server.js`, in a single consolidated pass plus targeted follow-ups; zero console/page errors throughout.

## 16. Module 103 — Biomedical Sciences & Musculoskeletal Sciences (this phase)

Module 103 is now live alongside 101/102/205 (no longer "Coming Soon"). Structurally it is
the same kind of module as 101/102 — five End-of-Module exam batches (195, 196, 197, 198,
199, matching 101's batch numbers since both modules sit the same student cohorts in the
same academic years), same Book Verified Answer Key pipeline, same Ready/Review and
coverage-label data model. The one genuine new mechanism is described in §16.3 below.

### 16.1 Source files imported

| Batch | Academic year | Exam date | Ready | Review | Imported |
|---|---|---|---|---|---|
| 195 | 2021–2022 | 2022-03-19 | 119 | 1 | 120/120 |
| 196 | 2022–2023 | 2023-03-09 | 119 | 1 | 120/120 |
| 197 | 2023–2024 | *(cropped in original scan — stored as `examDate: null`, not invented)* | 119 | 1 | 120/120 |
| 198 | 2024–2025 | 2025-02-13 | 118 | 2 | 120/120 |
| 199 | 2025–2026 | 2026-01-10 | 120 | 0 | 120/120 |
| **Total** | | | **595** | **5** | **600/600** |

Coverage labels across the 600 new questions: Direct 535, Not covered 30, Inferred 19,
Partial 15, Calculated 1 (sums to 600).

### 16.2 The two-book situation: `bookSource` / `bookSourceLabel`

The department textbook (`103_BMS_Published.pdf`, AY 2026–2027) has no usable text at all
in its Biochemistry section this academic year. Roughly a third of each batch's questions
(226 of 600 overall) are Biochemistry questions whose recommended answer was instead
checked against **Dr. Hisham Esmat's Biochemistry book** (prepared for Batch 199, academic
year 2025–2026). This is surfaced as a genuine new field on every question record, not a
one-off UI hack:

- `bookSource`: `"department"` (374 of 600 Module 103 records; also the implicit value —
  `null`/omitted — for every 101/102/205 record, which were never checked against a second
  book) or `"hisham_esmat"` (226 of 600).
- `bookSourceLabel`: a human-readable citation string for the Hisham-sourced records
  (`"Dr. Hisham Esmat's Biochemistry book (prepared for Batch 199, academic year
  2025–2026)"`), `null` otherwise.
- For a Hisham-sourced record, `coverageLabel` is classified from the Book/Review line's own
  prose (`extract_answer_keys.py`'s `parse_103`/`finalize()`): "partial"/"partially" or
  "inferred"/"inference" language downgrades it from the Direct default to `Partial`/
  `Inferred` respectively. Spot-checked across all ~230 Hisham-sourced records before
  trusting it for the full set — one real false positive was found and fixed during that
  check (a question whose evidence quoted "partial or complete HGPRTase deficiency" as a
  clinical term, not a coverage assessment; the regex now excludes that specific phrase).
  All 17 resulting Partial/Inferred classifications were individually re-verified against
  their source sentences afterward with zero remaining false positives/negatives.
- A handful of "Not covered" entries (5–9 per batch) remain "Not covered" even after
  Hisham's book was also checked — these keep `bookSource: "department"` (neither book
  actually supports the answer), with the Book line's extra sentence about checking Hisham's
  book too preserved verbatim in `evidence`/`reviewNote`.
- **UI**: `examTake.js`'s new exported `bookSourceLine(q)` helper (reused as-is by
  `examResults.js`) renders an extra line in the existing "View source and details" panel —
  *"Source: Dr. Hisham Esmat's Biochemistry book (...) — not the department textbook"* —
  whenever `q.bookSource === "hisham_esmat"`, and renders nothing at all otherwise. This is
  data-driven (checks the field, not the module id), so it is a no-op for every 101/102/205
  record exactly as before. Two new i18n keys (`take.bookSourceLabel`, `take.bookSourceNotDept`)
  were added in both languages as interface chrome; the book name/citation itself stays
  English, same rule as all other evidence text. `moduleSelect.js`'s Module 103 card and its
  `modules.m103source` i18n entry (both languages) also name the two-book situation plainly,
  per the repo owner's explicit instruction not to bury this in only one place.

### 16.3 Parsing — what's actually different from 101/102, verified directly against the source files

Several real format differences turned up that were not fully anticipated going in; each was
confirmed by direct inspection of the `.docx` files before being special-cased, per this
project's "investigate, never force a match" rule:

- **Exam-instruction paragraphs before Q1** (Batches 195/196/197): a `"Transcription note."`
  paragraph is present, verified, in all 5 question-paper files, always immediately before
  the real Q1. `extract_questions.py`'s new `parse_103` slices to start right after it,
  reusing the existing numbered/table-walking logic for everything after.
- **`a-`/`b-`/`c-`/`d-` option dashes instead of `a.`/`b.`** (Batches 197 and 199, all 120
  questions each — confirmed, not a one-off): the shared `OPT_RE` now also accepts `-` as an
  option separator, alongside the existing `.`/`)` (checked against all of 101/102's data
  first — no collisions).
- **Batch 199's paragraphs are transcribed in a scrambled, non-sequential order**
  (`...29, 30, 47, 48, ..., 54, 39, 40, ..., 46, 31, 32, ...`), even though every individual
  paragraph carries its own correct printed question number. The shared sequential-numbering
  parser (`expected_next`-based) would have silently produced only 38/120 questions here —
  caught by an explicit "did we get exactly 1..N with no duplicates" check added to
  `extract_questions.py`'s own validation printout, not just a bare count. Fixed with a new
  order-agnostic variant (`_parse_numbered_items_any_order`) that matches each paragraph by
  its own printed number instead of a running sequential counter; used for all 5 batches
  (harmless for the four that are in plain sequential order).
- **Batch 198 Q45: both the question number and the first letter of every option were
  physically cropped off the scanned page**, leaving `"[45; number cropped] Regarding the
  white muscle fibers..."` and options like `"[initial letter cropped]ore mitochondria"`
  literally in the source `.docx` (the briefing this phase started from asserted this was
  already cleanly reconstructed in the source file — direct inspection showed it was not).
  Fixed in two parts: (1) a generic `CROPPED_NUM_RE` recognizes the `"[N; ...cropped...]"`
  annotation and rewrites it to plain `"N. "` before the numbered parser ever sees it, so
  Q46–120 don't silently desync; (2) the four option texts are corrected via a small, explicit
  `KNOWN_OPTION_FIXES` dict, sourced verbatim from the Book Verified Answer Key's own Review
  note for B198-Q045, which independently re-inspected the scan and states the reconstructed
  wording ("More mitochondria", "Anaerobic pathway", "Few glycogens", "Abundant myoglobin").
- **Batch 197 Q35, options B and D: a transcription typo reads "... of high" instead of
  "... of thigh"** (dropping the leading "t") — confirmed as an isolated, one-question typo
  (no other "of high" occurrence anywhere in any of the 5 batches), and confirmed as a typo
  rather than the intended wording because the Book Verified Answer Key's own Answer and
  Book-evidence lines both independently say "of thigh". Corrected via the same
  `KNOWN_OPTION_FIXES` mechanism (partial per-letter override).
- **Answer-key header format**: Batches 197/198 print `"Question N B197-Q001 <stem>"` all on
  one line/paragraph (single spaces, no newline), unlike 195/196/199's `"Question N
  B195-Q001\n<stem>"` (two spaces, then a newline) — matches the same kind of variation
  101→102 already needed. `Q_RE_103` accepts either shape in one regex.
- **Answer line can be `"None"`** (no option is correct as transcribed — a genuine printing
  defect in the exam itself; 2 of 600) **or multi-letter** (`"A / D"`; 1 of 600, same
  mechanism 102 already uses for its one B/C case). A `"None"` answer is forced to
  `gradingStatus: "Review"` with `correctOptionId: null` regardless of what the source's own
  Grading line says (both real cases happened to print "Grading: Ready.", which would have
  silently mis-scored them) — the same precedent as Module 205's figure-label-only handling.
- **One "Not covered" line is written `"Book Not covered | Page 58: ..."`** (citing a page
  even though the label is "Not covered" — the book gives related-but-incomplete information)
  instead of the plain `"Book Not covered: ..."` used everywhere else. `BOOK_NOTCOVERED_RE_103`
  accepts an optional `| Page(s) N` clause without changing the Not-covered classification.
- **Hisham-book page citations sometimes include a parenthetical aside before the colon**
  (`"Page 3 (Dr. Hisham Esmat's Biochemistry book, prepared for Batch 199, ... 2025–2026):
  ..."`) **and sometimes go straight to the colon** (`"Page 5: ..."`); the page-number group
  stops at the first `(` or `:` either way so digits inside the parenthetical (e.g. "Batch
  199", "2025–2026") never leak into the extracted page list. Verified against all ~230 real
  Hisham-sourced lines with zero parse failures.

### 16.4 Category/chapter classification

`scripts2/classify_103.py` is a new keyword classifier — same "reasonable first pass, not
hand-verified" caveat as 101/102/205's classifiers. Chapter structure comes from the two
source books' own tables of contents, per the integration brief (not invented): **Anatomy**
and **Physiology — Nerve and Muscle** and **Histology** (10 + 5 + 4 chapters, department
textbook, PDF page = printed page + 2 throughout, stored as `startPage` in `chapters.json`)
and **Biochemistry** (10 chapters, taken from Dr. Hisham Esmat's own chapter list instead,
since that's the book actually used for this category — no page numbers available, so
`startPage: null` rather than invented). Category/chapter ids are module-prefixed
(`m103-anat-1`, `m103-phys-2`, `m103-hist-3`, `m103-bio-4`, ...) since plain ids like
`"histology"`/`"biochemistry"`/`"physiology"` are already used by Module 101/102's own
category ids and would otherwise collide in the global id lookups (`getChapterMeta`/
`getCategoryMeta` resolve by id across every module without being told which one).

Classifier coverage: 584/600 (97.3%) of questions matched a category, 570/600 (95.0%) also
matched a specific chapter — slightly better than both 101 (90%) and 102 (79%)'s existing
classifiers, reached after one iteration of adding keywords for terms the first pass missed
(spot-checked against the actual unclassified stems, e.g. "ICF"/"ECF", "gluconeogenic",
"porphyria", "adrenaline/noradrenaline", "niacin").

### 16.5 Critical: question-id collision with Module 101, avoided

Module 101 already uses stable ids `B194-Q001`..`B199-Q120` in `questions.json`, and Module
103's batch numbers are the *same* numbers (195–199) — the stable id baked into the 103 Book
Verified Answer Key text is *also* literally `B195-Q001` etc. Using that text verbatim as the
`id` field would have silently collided with Module 101's existing records. Module 103
records instead get a module-prefixed `id` (`M103-B195-Q001`), with the bare source-docx
label kept only as a non-`id` `stableId` field for cross-reference. Verified directly: **zero
duplicate ids across the full 4,355-record `questions.json`** (528 Module 101 + 552 Module
102 + 2,675 Module 205 + 600 Module 103), checked by `build_module205_question_bank.py`'s own
existing duplicate-id printout (see §16.6) after rebuilding everything.

**Build-order note for future runs**: `build_question_bank_v2.py` writes 101/102/103 and
knows nothing about Module 205 — running it alone overwrites `questions.json` with *only*
101+102+103, discarding Module 205's 2,675 records until `build_module205_question_bank.py`
is run again afterward (it re-merges its own "205" slice back in from `source_docs/205/`,
leaving the other modules untouched, exactly as its own docstring describes). This was caught
during this phase's own rebuild (not left as a surprise for next time) and should be added to
the "How to run" command sequence in §9: `extract_questions.py` → `extract_answer_keys.py` →
`build_question_bank_v2.py` → **`build_module205_question_bank.py`**, in that order, whenever
any of the first three are re-run.

### 16.6 Validation performed

- `extract_questions.py`: all 5 new batches parse to exactly **120/120**, now checked against
  the full expected number *set* (`{1..120}`, no duplicates) rather than just a count — this
  is what caught Batch 199's scrambled transcription order (§16.3) before it could silently
  under-import.
- `extract_answer_keys.py`: all 5 new batches parse to **120/120** with zero missing
  `answerLetter`/`coverageLabel`/`gradingStatus`.
- **Cross-validation** (CLAUDE.md step 5): stem text from the independently-parsed question
  file compared against the stem text recorded in the answer-key file, and every recorded
  answer letter's text checked against the actual option text, for all 600 new questions (and,
  as a regression check, all 528+552 existing Module 101/102 questions) — **zero real
  mismatches** after accounting for curly-vs-straight-quote encoding differences between the
  two `.docx` files (cosmetic, not content) and the answer key's own habit of abbreviating long
  clinical-vignette stems with "..." in its header line for 14 Batch-198 questions (verified
  each one's full un-abbreviated body text still matches the question file exactly; the
  abbreviation is cosmetic to the key's own header, and the app always displays the question
  file's full stem, never the key's shortened one). Two real content-affecting issues were
  found and fixed this way, not just detected: the Batch 197 Q35 "of high"/"of thigh" typo and
  the Batch 198 Q45 cropped options (§16.3) — both are typos/scan-damage in the *source*
  `.docx`, not misalignment between the two independently-parsed files.
- **Zero id collisions**: confirmed directly against the rebuilt `questions.json` — **4,355**
  total records (3,755 existing + 600 new), matching exactly.
- Final figures (computed from the rebuilt file, not estimated): Module 103 — **595 Ready /
  5 Review**; coverage **Direct 535 / Not covered 30 / Inferred 19 / Partial 15 / Calculated
  1**; **bookSource: department 374 / hisham_esmat 226**.
- `cd app && npm test` — scoring engine, still **14/14 passing, unchanged**.
- Playwright pass against `node server.js`: homepage → Modules picker (zero disabled
  "Coming Soon" cards now; Module 103's card shows its description and two-book Source line)
  → Module 103 library page (Anatomy/Physiology—Nerve and Muscle/Histology/Biochemistry
  category cards with correct question counts) → exam builder (all 5 batches listed as Full
  Past Exams, 120 questions each, per `sources.json`) → a Biochemistry question with
  `bookSource: "hisham_esmat"` (`M103-B195-Q052`) showing the Hisham attribution line exactly
  as designed in its "View source and details" panel → a Review-status question
  (`M103-B195-Q098`) showing the "Practice only — excluded from your score" notice in its
  explanation panel → Module 101's full flow re-confirmed unaffected (home → library → exam
  setup → a 48-question custom attempt answered and submitted through to a results screen,
  via its own confirm-submit dialog) → Module 102 and 205's library/setup pages also
  re-confirmed loading without error → About page confirmed listing Module 103 and its
  batches. Zero console/page errors throughout (the only network errors seen,
  `ERR_TUNNEL_CONNECTION_FAILED` for the optional Firebase sync's `gstatic.com` scripts, are a
  pre-existing sandbox network restriction unrelated to this phase — confirmed by reproducing
  the identical error on Module 101 before any of this phase's changes).

### 16.7 Limitations specific to this phase

- `bookSource`/`bookSourceLabel` are new, Module-103-only fields; every 101/102/205 record has
  `bookSource: null` (implicit "department"), which is the honest default since those modules
  were never checked against a second book.
- As with 101/102, "Ready" reflects the revised key's own review flag only, never presented as
  official faculty approval; this phase's `"None"`-answer override (forced to Review
  regardless of the source's own Grading line) is the one place this phase deliberately
  overrides the source data, and is documented here precisely because it's a deviation worth
  knowing about later.
- Classifier coverage (97.3%/95.0%) is a first pass like 101/102/205's; the ~16 unclassified
  and ~30 chapter-less questions are excluded from category-filtered practice only, never
  silently dropped from the bank.
