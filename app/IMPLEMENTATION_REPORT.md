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

Regenerating the question bank from the source `.docx` files (only needed if the source files change):

```bash
python3 scripts2/extract_questions.py
python3 scripts2/extract_answer_keys.py
python3 scripts2/build_question_bank_v2.py
```

The optional Firebase-backed multi-student sync (access codes, Firestore, `SETUP_FIREBASE.md`) from the previous phase is unchanged and still off by default — the app runs fully local/offline unless an administrator deliberately configures it.

## 10. Unresolved issues and limitations

- **None of the five batches' imports produced a discrepancy against the brief's validation totals** (§7) — there is nothing currently flagged as needing investigation on the data side.
- **Category/chapter mapping remains the existing automated/heuristic keyword classifier**, not hand-verified per question; the brief's instruction to flag uncertain mappings rather than invent new ones was followed by preserving the existing mapping approach unchanged, not by adding a new uncertainty flag — a future pass could add explicit per-question mapping-confidence if that's wanted.
- **"Ready" status reflects the revised key's own review flag only** — per the brief's own definition, it is not and is never presented as official faculty approval; this is stated explicitly both in-app (About page, per-question details panel) and here.
- **No admin UI yet** for reviewing Review-status questions, editing coverage labels, or approving accepted answers — the data model (`gradingStatus`, `coverageLabel`, `conditionalAlternatives`, stable per-question IDs) is already shaped to support one being added later without a schema change, consistent with the brief's note that AI-key comparisons and similar review tooling belong in an admin view rather than the student screen.
- **Module 102 and 103** remain intentionally inert ("Coming Soon") — the homepage and router support adding a module without further restructuring, but no content has been imported for either.
- **Arabic translation covers interface chrome only**, as specified — question stems, options, explanations, calculations, and source quotations are and will remain English-only by design, not an oversight.
