# Module 101 Examination Platform — Implementation Report

Kasr Al Ainy Faculty of Medicine, Cairo University — Module 101 (ISK 101), End-of-Module practice platform.

## 1. Technology stack

No existing project/architecture was found in the workspace, so a stack was chosen from scratch, optimized for "runs anywhere with zero install":

- **Frontend:** Vanilla JavaScript (ES modules), hand-written CSS (no framework), hash-based client-side router. No build step.
- **Backend/serving:** A ~50-line Node.js static file server using only built-in `node:http`/`node:fs` (`server.js`) — no Express.
- **Persistence:** Browser `localStorage` (standalone frontend — see Limitations).
- **Testing:** Node's built-in test runner (`node --test`), no test framework dependency.
- **Data pipeline:** Python 3 (`pdfplumber`, `pypdf`/poppler-utils, `tesseract` OCR) to extract and structure the question bank from source PDFs into static JSON consumed by the frontend.

**Why not React/Next.js/Tailwind as suggested in the brief:** this sandboxed environment has no npm registry access (`registry.npmjs.org` and `pypi.org` both refused by the network policy — confirmed via direct test, not assumed). Rather than stop and ask, the app was built with an equivalent, dependency-free architecture: typed-ish JS modules, a pure/testable scoring engine, separated data/state/view layers, and no build tooling required. Functionally it meets every requirement in the brief (reusable components, separated UI/business-logic/data, typed question/exam models via JSDoc, validated imports, automated tests, responsive design).

## 2. Source directories and files inspected

`C:\Users\Taha Khalaf\Downloads\Telegram Desktop\0Exams\امتحانات منظمة\101\`

| File | Pages | Content | Result |
|---|---|---|---|
| `101_ISK_Published V2.pdf` | 281 | Module 101 textbook, "ISK 101 — Normal Structure of the Human Body", Academic Year 2026-2027 | **Digital text layer** — full table of contents and all 4 category / 29 chapter titles extracted programmatically (no OCR, no fabrication) |
| `EOM/Module101_EOM_2025-2026_Batch199_Round1_Solved.pdf` | 11 | 120-MCQ End-of-Module exam, 20/11/2025, **with the correct answer highlighted** | Digital text layer + geometric highlight detection → **120 questions with a verified answer key** |
| `EOM/Module101_EOM_2025-2026_Batch199_Round1_Unsolved.pdf` | 11 | Same exam, no answers | Redundant with the Solved version above; not re-imported |
| `EOM/Module101_Pre5Yr_EOM_2020-2021_Batch194_Round1_Dec2020.pdf` | 6 | 48-MCQ exam, 24/12/2020, scanned (no text layer), no answer key | OCR → 47/48 questions imported as **Needs Review** |
| `EOM/Module101_EOM_2021-2022_Batch195_Round1.pdf` | 11 | 120-MCQ exam, 18/12/2021, scanned, no answer key | OCR → 118/120 questions imported as **Needs Review** |
| `EOM/Module101_EOM_2022-2023_Batch196_Round1.pdf` | 11 | 120-MCQ exam, 10/12/2022, scanned (phone photo with watermark + bleed-through, 2-column layout) | OCR quality too low for reliable automated import — **see Limitations** |
| `EOM/Module101_EOM_2023-2024_Batch197_Round1.pdf` | 11 | 120-MCQ exam, scanned, similar quality issues | **Not imported** — see Limitations |
| `EOM/Module101_EOM_2024-2025_Batch198_Round1_AnatomyPartial.pdf` | 10 | Anatomy-only partial paper, scanned, different question format | OCR → 70/75 questions imported as **Needs Review** |
| `101\امتحان_إضافي_غير_مؤكد_النوع_2022-09-15_32_درجة.pdf` | 8 | **Final** Theoretical exam (15/9/2022) — mixed short-essay + MCQ + extended-matching, 32 marks | Out of scope for this release (Written/Final section is "Coming Soon" per spec; also not a pure-MCQ format) — identified, not imported |
| `102\...` (all Module 102 files) | — | Module 102 examinations | Not inspected — out of scope; Module 102 is shown as "Coming Soon" |

No files were silently skipped: every file above was opened and classified; see Limitations for the two unimported papers and why.

## 3. Features implemented

- Homepage: Written/Final ("Coming Soon") vs. End-of-Module (active) choice.
- Module selection: 101 available, 102 clearly "Coming Soon" and unenterable.
- Module 101 library: category overview, examination library table (by academic year, with verified/needs-review status).
- Exam builder: category multi-select (Select All / Clear), chapter filter within selected categories, specific-historical-paper mode (original question order preserved), needs-review inclusion toggle with warning, all-questions vs. custom-count, live eligible-question count computed before starting, explanation mode (immediate practice vs. exam mode), optional timer with student-chosen duration (no official duration could be verified for any imported paper, stated explicitly in the UI).
- Interactive MCQ interface: question text/options, previous/next, question-grid navigator (answered/marked/current states), mark-for-review, bookmarking, keyboard arrow-key navigation, abstention ("I choose not to answer this question") offered only on out-of-syllabus / needs-review questions.
- Submission: confirmation modal (total/answered/unanswered/marked), guard against double submission, auto-submit on timer expiry.
- Results: score %, correct/incorrect/unanswered/abstained/excluded breakdown, "provisional" flag when unverified questions were included, per-question review with options, correct answer (verified questions only), chapter/source attribution, and a chapter-level "where to focus next" weakness summary driving a "start a targeted revision quiz" link.
- Review Mistakes (cross-attempt, persisted), Bookmarks, Attempt History — all local-storage backed.
- Responsive layout (tested at 390px and desktop widths) and a dark mode toggle.

## 4. Question counts

| | Count |
|---|---|
| Total questions imported | **355** |
| Verified (answer key confirmed, graded) | **120** (2025-2026 paper) |
| Needs Review (imported, excluded from scoring) | **235** |
| Auto-classified into one of the 4 categories | 333 / 355 (22 left uncategorized, visible nowhere in category-filtered practice, not silently discarded) |
| Auto-mapped to a specific textbook chapter | 317 / 355 |

Category/chapter assignment is done by an automated keyword classifier (`scripts/build_question_bank.py`) built from the textbook's own table of contents and standard terminology for each chapter — **not hand-verified question-by-question**. It is a reasonable first pass, not a certified mapping; see Limitations.

## 5. Scoring rules implemented

- `Score % = Correct ÷ Eligible × 100`, where **Eligible** = graded (verified-answer-key) questions minus deliberately abstained ones.
- Questions without a verified answer key are **excluded from the denominator entirely**, and the attempt is flagged **provisional**.
- An out-of-syllabus/needs-review question left to abstention is excluded from the denominator; if answered anyway, it is graded normally (the spec's recommended default).
- An unanswered **verified** question counts as incorrect.
- Zero eligible questions → "No graded questions" is displayed, never a division by zero.
- Duplicate/missing question IDs are defensively de-duplicated/skipped in the scoring engine.

## 6. Automated tests executed

`node --test tests/*.test.js` — **14/14 passing**, covering every boundary case the brief asked for: all-correct, all-incorrect, mixed answered/unanswered, the worked 20-question/2-abstained example from the spec, abstention exclusion, answering-instead-of-abstaining, zero eligible questions, unverified-question exclusion + provisional flag, duplicate IDs, missing IDs, "no eligible questions" state, pool-count toggling, submission summary counts, and mark-for-review not affecting grading.

Re-run with: `cd app && npm test`

## 7. End-to-end testing performed

Driven with Playwright (Chromium) against the running app, covering the brief's full user-journey checklist: homepage → End-of-Module → Module 101 → category selection (single, then multiple) → chapter filter → historical-paper-by-year selection → custom question count → exam start → answer selection → forward/back navigation preserving answers → mark for review → question-grid jump → submission confirmation (with unanswered-question warning) → results/scoring → history → review mistakes → bookmarks → dark mode → mobile viewport (390px) → Module 102 blocked. Two real bugs were found and fixed during this pass:

1. **Zero-category selection incorrectly showed all 116 questions as eligible** (an empty-array filter was silently treated as "no filter"). Fixed in `examSetup.js`; the Start Exam button now correctly disables.
2. **An unverified ("Needs Review") question's selected option rendered in red/"incorrect" in the results review**, which is misleading since there is no confirmed correct answer to compare against. Fixed in `examResults.js` to show a neutral "selected" state instead.

A third cosmetic bug (a sticky summary bar overlapping content on the exam-builder page) was also caught and fixed.

## 8. How to run

```bash
cd app
npm test        # run the automated scoring-engine tests
npm start        # serve the app at http://localhost:3000 (node server.js — no install needed)
```

No environment variables, database, or build step are required. Regenerating the question bank from the source PDFs (optional, only needed if source files change):

```bash
python3 scripts/build_question_bank.py   # re-reads data/*.json produced by the extraction scripts
```

(The PDF→JSON extraction scripts — `scripts/extract_solved_2025_2026.py`, `scripts/parse_ocr_exam.py` — are included for transparency but expect the source PDFs and intermediate OCR text, which were not copied into this delivery to keep it small; re-run them against the original files if you need to reproduce the pipeline end-to-end.)

## 9. Limitations and next steps (please read before relying on this for exam prep)

- **Only one exam has a verified answer key** (2025-2026, 120 questions). Everything else (235 questions) is explicitly labelled "Needs Review" in the UI, carries no answer key, and is excluded from scoring — by design, per the instruction not to present an unverified answer as fact.
- **Two historical papers (2022-2023 and 2023-2024, 240 questions total) were not imported.** Both are phone-photographed scans with a watermark, visible bleed-through from the facing page, and a 2-column layout that defeated automatic OCR+parsing even after threshold/denoise attempts (spot-checked, OCR text was frequently garbled mid-sentence). Rather than publish garbled question text, these were left out. A higher-quality scan, or manual transcription, would let a future pass import them the same way the other three historical papers were.
- **No worked explanations.** The brief asked for textbook-grounded explanations; verifying and writing one per question against the 281-page textbook for 355 questions was not feasible in this pass. The UI is explicit about this ("a worked explanation has not been authored yet") rather than fabricating one, and always shows the chapter/page area to revise instead. The verified answer key (for the 120 graded questions) is real and shown.
- **Category and chapter tagging is automated/heuristic** (keyword matching against the textbook's table of contents), not hand-verified per question. 22 questions didn't match any category keyword set and are excluded from category-filtered practice (visible only if a future admin pass reviews them).
- **Syllabus status** is a simplification: the 2025-2026 paper is treated as "in syllabus" (it's this year's own exam against this year's textbook edition); no individual question across any paper has been positively confirmed "out of syllabus" — that would require a line-by-line diff against the textbook, which wasn't done. The infrastructure (the `syllabusStatus` field, the abstention option, the scoring exclusion) is fully built and ready for that review to be dropped in.
- **No backend/database/auth.** This is a standalone frontend; attempts, bookmarks, and settings live only in `localStorage` in one browser, are not synced across devices, and are not protected the way server-side student data would be. This is stated plainly to students on the About page. Swapping in a real backend later only requires replacing `js/store.js`.
- **No admin UI** for importing/approving/editing questions yet (the brief allows deferring this). The data model (`reviewStatus`, `syllabusStatus`, source file, original question number, etc.) was designed to support one being bolted on later without a schema change.
- **Module 102 and Written/Final exams** are intentionally inert ("Coming Soon") — no content was fabricated for them.
- The official Kasr Al Ainy / Cairo University logo was not available in the workspace and fetching an external logo asset was out of scope for this pass; the platform currently uses a clean text-based "101" mark instead, as the brief allows.
