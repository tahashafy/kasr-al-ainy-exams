# Module 205 Neuroscience MCQ Bank — Extraction & Database Report

Source: `module205_new-3.pdf` (236 pages). This report documents how the full
document was turned into a structured, validated dataset, and lists every
item that still needs a human's eyes.

## 1. What was discovered in the source (not assumed in advance)

The PDF turned out to be organized as:

- **3 subjects**: Anatomy (AN), Physiology (PH), Histology (HI) — each with its
  own running page-footer label and a two-letter subject code baked into every
  question code.
- **10 chapters** total across the three subjects, each opening with a banner
  line stating the chapter's declared question count (used below as an
  independent cross-check).
- **~90 sections** nested under those chapters (e.g. Anatomy → Head & Neck →
  "Larynx", "Ear", "Facial Nerve", etc.), discovered from in-text ALL-CAPS
  section headers, not predicted beforehand.
- **A question-code scheme**: `SUBJECT-TOPIC-CHAPTER#-QUESTION#`, e.g.
  `AN-NEC-33-26` (Anatomy, Neck topic, Chapter 33, Question 26).
- **A separate "Previous Exams" section**, organized by **exam batch number**
  (e.g. Batch 192, 193, 197…), each containing its own locally-numbered
  question list, some of which reference a bank code (`ref_code`) when the
  same question also appears in the main bank, and some of which are
  exam-only.
- **An answer-key block printed at the bottom of each page**, visually
  rotated/mirrored relative to the body text, giving `question-number →
  letter` pairs scoped to whatever question range is on that page (bank
  numbering and exam-batch numbering are tracked as separate scopes).
- **Occasional embedded figures** (diagrams/photos) referenced from specific
  questions.
- **Occasional editorial notes** printed in brackets directly in the source
  (e.g. "[Shared vignette for Q21 and Q22...]", "[Stem and option a are on
  page 30, not in this unit.]") — preserved verbatim as part of the
  question's `options_note` field rather than stripped out.

None of this was assumed from the task prompt's illustrative examples; the
schema below was built to match what was actually found.

## 2. Extraction method

1. **Text extraction**: `pdftotext -layout` with page-region cropping
   (header / left column / right column / footer), rather than raw
   `pdfplumber` word extraction — `pdfplumber` was corrupted on this file by
   an overlapping hidden watermark text layer, confirmed by direct
   command-line comparison. `pdfplumber` was kept only for its geometry
   (detecting the left/right column gutter position per page).
2. **Answer-key orientation**: despite being visually rotated/mirrored on the
   page, `pdftotext` was found to already extract these footer blocks in
   correct reading order as clean `number letter` pairs — verified by
   rendering and visually inspecting sample pages. No manual image rotation
   was needed.
3. **Parsing**: page text was tokenized into a linear event stream (question
   headers, options, section headers, chapter/batch banners, footer
   answer-key pairs), repaired for known OCR/line-split artifacts, then fed
   through a stateful block-builder that reconstructs each question as one
   record.
4. **Answer resolution**: each page's footer answer-key pairs were matched to
   the nearest preceding question/exam-entry **by its actual printed number
   within its own numbering scope** (bank vs. exam-batch), not by assuming
   sequential order — per the task's explicit requirement.
5. **Cross-validation**: every extracted count was checked against an
   independent total stated in the source itself — chapter banner counts,
   cover-page subject totals, and per-batch totals — rather than relying on
   visual spot-checking alone.

## 3. Validation results

| Check | Result |
|---|---|
| Total bank questions (728 + 957 + 523 declared, by subject) | **2,208 / 2,208 — exact match** |
| Total previous-exam entries (61+90+89+115+112 declared, by batch) | **467 / 467 — exact match** |
| Chapters matched to declared per-chapter counts | **10 / 10 exact match** |
| Sections' question counts summing to their chapter total | **All reconcile** |
| Questions with a resolved answer | **2,208 / 2,208 printed — none unverified in the main bank** |
| Exam entries with a resolved answer | **461 printed + 4 `unverified_in_source` + 2 `cancelled`** |
| Options with answer-letter mismatch (QA pass) | **0 remaining** (initial automated corruptions fixed — see §5) |

## 4. Answers that could not be verified from the source (do not guess)

Per the explicit instruction not to infer an answer from medical knowledge
when the printed key is illegible, the following 4 **previous-exam entries**
are marked `unverified_in_source` and need the original PDF / an
instructor's key to resolve. All 4 occur in the "Previous Exams" section
only — every main-bank question's answer was resolved cleanly.

| Kind | Batch | Local # | Page | Why |
|---|---|---|---|---|
| unclear_answer_mark | 192 | 8 | 195 | The printed answer-key mark for this question is a literal "?" in the source — the compiler itself left it ambiguous, not an OCR failure. |
| unclear_answer_mark | 192 | 13 | 196 | Same — literal "?" in the printed key. |
| unclear_answer_mark | 192 | 26 | 197 | Same — literal "?" in the printed key. |
| unclear_answer_mark | 194 | 62 | 214 | Same — literal "?" in the printed key. |

(Listed row-by-row in the **"Manual Review Needed"** sheet of the Excel
workbook and in `review_answers.json`.)

No answer was ever "corrected" based on medical plausibility. Where a printed
answer looked medically questionable, it was preserved exactly as printed —
no instance of this actually arose in this document after full review.

## 5. Known source anomalies (preserved as printed, not "fixed")

These are genuine quirks of the source document, not extraction bugs — each
is flagged in the dataset and in the "Manual Review Needed" sheet:

- **`HI-NER-06-10`** — the question stem in the source is the single
  unpunctuated word "Synapses" with no question mark; this defeated the
  automated stem/option boundary heuristic and required a manual check
  against the page image (p.170) to confirm the correct option text.
- **`PH-SEN-03-57`** — the source prints this question's options as **E, F,
  G, H** instead of A–D (an apparent compiler typo). Preserved exactly as
  printed rather than renumbered to A–D.
- **Batch 192, local #12 and #13** — the source prints question
  `PH-SEN-04-31` **twice** in this exam reprint: #12 is an incomplete
  duplicate (missing option A, with a stray leftover "lettered points on
  figure" fragment), and #13 is the complete version carrying an explicit
  editorial bracket note ("[Stem and option a are on page 30, not in this
  unit.]"). Both entries are preserved as printed.
- **Batch 193, local #49 and #51** — explicitly marked **CANCELLED** in the
  source. Full question/option text is preserved; no answer-key entry exists
  for these (expected — cancelled questions aren't keyed).

## 6. Figures / diagrams

Exactly **4 unique images** are reused across the document (de-duplicated by
MD5 hash), linked to question codes as follows:

| Figure file | Linked question code(s) |
|---|---|
| `figure_AN-NEC-33-26_facial-nerve-pathway.png` | `AN-NEC-33-26` |
| `figure_PH-SPE-28-06_tuning-fork-test.png` | `PH-SPE-28-06` |
| `figure_A_spinal-brainstem-cross-section.png` | `HI-CNS-08-05`, `HI-CNS-12-05` |
| `figure_B_spinal-brainstem-cross-section.png` | `HI-CNS-08-06`, `HI-CNS-12-06` |

One edge case: the exam reprint of `PH-SEN-04-31` (Batch 192) references a
figure in its stem text, but the figure itself is not actually reproduced on
that reprint page — flagged via `figure_reproduction_note` rather than
silently supplying the bank's figure in its place.

## 7. Deliverables

| File | Contents |
|---|---|
| `Module205_Neuroscience_MCQ_Database.xlsx` | 5 sheets: Question Bank (2,208 rows), Previous Exams/Batches (467 rows), Chapters, Sections, Manual Review Needed |
| `module205_mcq_bank.db` | SQLite relational database — `questions`, `question_options`, `question_tags`, `question_batch_history`, `question_figures`, `exam_entries`, `exam_entry_options`, `exam_entry_figures`, `chapters`, with indexes on subject/chapter/section, tags, and exam batch — ready to back a study app |
| `questions_final.json` / `exam_entries_final.json` | The same data as nested JSON, one record per question, for direct use in a web/app frontend |
| `figures/` (4 PNGs) | The extracted diagrams/photos |
| This report | Methodology, validation, and the full anomaly/manual-review list |

## 8. Schema notes — explicit vs. derived vs. uncertain

- **Explicit** (taken directly from the source): `question_text`, `options`,
  `page`, `printed_number`, `batches_mentioned` (historical batch tags printed
  next to a bank question), `cancelled`, bracket editorial notes.
- **Derived** (computed from explicit structure, not guessed): `subject`,
  `chapter_num`/`chapter_title`, `section` (from the nearest preceding
  section header), `code` (constructed from the subject/topic/chapter/number
  pattern), `has_figure`.
- **Inferred via cross-matching**: `answer_letter` (matched from the
  footer answer-key block to its question by scope-aware number lookup, not
  by sequential assumption), `ref_code` linking an exam entry back to its
  bank twin.
- **Flagged as uncertain / needing manual verification**: every
  `answer_status: "unverified_in_source"` record (§4), plus the anomalies in
  §5 — none of these were resolved by guessing.
