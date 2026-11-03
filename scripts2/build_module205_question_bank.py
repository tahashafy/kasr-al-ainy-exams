"""
Integrate the already-prepared, validated Module 205 Neuroscience MCQ
database (source_docs/205/questions_final.json + exam_entries_final.json +
chapter_banners.json) into this app's existing data files:

    app/data/chapters.json   -> adds a "205" module entry
    app/data/questions.json  -> appends Module 205 question records
    app/data/sources.json    -> appends Module 205 batch entries

This does NOT re-parse the original PDF (module205_new-3.pdf) — that
extraction was already done and independently validated (see
source_docs/205/MODULE205_DATABASE_REPORT.md). This script only reshapes
the validated output to fit this app's data model, the same way
build_question_bank_v2.py merges Module 101/102 sources, and is additive:
it never touches existing Module 101/102 records.

Re-run safely any time: it always rebuilds the "205" slice of each file
from source_docs/205/ and replaces only that slice, leaving every other
module's data byte-for-byte as it was.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source_docs", "205")
APP_DATA = os.path.join(ROOT, "app", "data")

SUBJECT_ABBR = {"Anatomy": "an", "Physiology": "ph", "Histology": "hi"}
SUBJECT_FULL = {"an": "Anatomy", "ph": "Physiology", "hi": "Histology"}

MODULE_ID = "205"


def load(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return json.load(f)


def cat_id(subject):
    return f"m205-{SUBJECT_ABBR[subject]}"


def chapter_id(subject, chapter_num):
    return f"m205-{SUBJECT_ABBR[subject]}-{chapter_num}"


def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:40] or "section"


def section_id(chap_id, section_title):
    return f"{chap_id}--{slugify(section_title)}"


def build_sections_by_chapter(questions_raw):
    """Authoritative section list per chapter, in first-seen (= printed) order,
    with question counts — derived directly from the validated question
    records rather than hand-transcribed from the PDF's table of contents, so
    it can never drift out of sync with the actual data."""
    order = {}
    counts = {}
    for q in sorted(questions_raw, key=lambda x: x["printed_number"]):
        chap = chapter_id(q["subject"], q["chapter_num"])
        title = q.get("section") or "General"
        key = (chap, title)
        if key not in order:
            order[key] = len(order)
        counts[key] = counts.get(key, 0) + 1

    by_chapter = {}
    for (chap, title), _ in sorted(order.items(), key=lambda kv: kv[1]):
        by_chapter.setdefault(chap, []).append(
            {"id": section_id(chap, title), "title": title, "count": counts[(chap, title)]}
        )
    return by_chapter


def build_chapters_entry(banners, questions_raw):
    sections_by_chapter = build_sections_by_chapter(questions_raw)
    cats = {}
    for b in banners:
        cid = cat_id(b["subject"])
        cats.setdefault(cid, {"id": cid, "name": b["subject"], "chapters": []})
        chap_id = chapter_id(b["subject"], b["chapter_num"])
        cats[cid]["chapters"].append(
            {
                "id": chap_id,
                "number": str(b["chapter_num"]),
                "title": b["title"],
                "startPage": b["page"],
                "sections": sections_by_chapter.get(chap_id, []),
            }
        )
    # stable order: Anatomy, Physiology, Histology, each by chapter number
    order = ["m205-an", "m205-ph", "m205-hi"]
    categories = []
    for cid in order:
        if cid not in cats:
            continue
        cat = cats[cid]
        cat["chapters"].sort(key=lambda c: (len(c["number"]), c["number"]))
        categories.append(cat)

    return {
        "module": MODULE_ID,
        "moduleTitle": "Neuroscience",
        "moduleCode": "205",
        "textbookEdition": "Module 205 Neuroscience MCQ Bank (compiled question bank + answer key, 236-page PDF)",
        "textbookSourceFile": "module205_new-3.pdf",
        "contentKind": "mcq",  # drives "MCQ Questions" instead of "End-of-Module" wording in the UI
        "showWrittenTab": True,  # Written section exists but stays inactive (see library.js)
        "categories": categories,
    }


def letter_options(opts_dict):
    # opts_dict preserves source insertion order (A, B, C, ... possibly E-H)
    return [{"id": letter.lower(), "text": text} for letter, text in opts_dict.items()]


def grading_fields(answer_status):
    """Mirrors build_question_bank_v2.py's gradingStatus/reviewStatus pairing.
    'printed' = a confirmed answer was printed in the source -> Ready.
    'unverified_in_source' / 'cancelled' = no confirmed answer -> Review
    (practice-only, excluded from the scored denominator, never presented
    as having a confirmed correct answer)."""
    if answer_status == "printed":
        return "Ready", "verified"
    return "Review", "needs_review"


def bank_record(q):
    gradingStatus, reviewStatus = grading_fields(q["answer_status"])
    subject = q["subject"]
    figures = [f"data/figures/{fn}" for fn in q.get("figures", [])]
    figure_label_only = not q["options"]  # "Options are the lettered points marked on the figure" cases
    if figure_label_only:
        gradingStatus, reviewStatus = "Review", "needs_review"
    note = q.get("_manual_fix")
    if figure_label_only:
        fig_note = (
            "This question's original options are labelled points on a diagram, not selectable "
            "text options; practice only, excluded from scoring. The source's printed answer "
            f"letter was '{q.get('answer_letter')}'."
        )
        note = f"{note} {fig_note}" if note else fig_note
    return {
        "id": q["code"],
        "module": MODULE_ID,
        "text": q["question_text"],
        "options": letter_options(q["options"]),
        "correctOptionId": None if figure_label_only else (q["answer_letter"].lower() if q.get("answer_letter") else None),
        "category": cat_id(subject),
        "chapter": chapter_id(subject, q["chapter_num"]),
        "sectionId": section_id(chapter_id(subject, q["chapter_num"]), q.get("section") or "General"),
        "sourceExam": None,  # this is the question bank itself, not tied to one historical paper
        "academicYear": None,
        "examDate": None,
        "batch": None,
        "originalSourceFile": "module205_new-3.pdf",
        "originalQuestionNumber": q["printed_number"],
        "textbookEdition": "Module 205 Neuroscience MCQ Bank (compiled question bank + answer key, 236-page PDF)",
        "gradingStatus": gradingStatus,
        "coverageLabel": None,  # no textbook cross-reference exists for this source; left undetermined, never invented
        "coverageGroup": None,
        "bookPages": [str(q["page"])],  # page in module205_new-3.pdf itself (the source document)
        "evidence": None,  # no explanation/rationale is present in this source beyond the answer key
        "reviewNote": note,
        "conditionalAlternatives": [],
        "allowAbstention": False,
        "isMultipleAnswerOrException": False,
        "deepseekComparison": None,
        "reviewStatus": reviewStatus,
        # --- Module 205-specific structured metadata (extends, never replaces, the shared fields above) ---
        "questionCode": q["code"],
        "topicCode": q.get("topic_code"),
        "section": q.get("section"),
        "tags": q.get("tags", []),
        "historicalBatches": q.get("batches_mentioned", []),
        "sourcePdfPage": q["page"],
        "answerVerificationStatus": q["answer_status"],  # 'printed' | 'unverified_in_source' | 'cancelled'
        "hasFigure": bool(figures),
        "figures": figures,
    }


def exam_record(x):
    gradingStatus, reviewStatus = grading_fields(x["answer_status"])
    figures = [f"data/figures/{fn}" for fn in x.get("figures", [])]
    batch = x["batch"]
    source_exam_label = f"Module 205 — Previous Exam — Batch {batch}"
    figure_label_only = not x["options"]
    if figure_label_only:
        gradingStatus, reviewStatus = "Review", "needs_review"

    note = None
    if x.get("cancelled"):
        note = "This question was marked CANCELLED in the source exam reprint; no answer key entry exists for it."
    elif figure_label_only:
        note = (
            "This question's original options are labelled points on a diagram, not selectable "
            "text options; practice only, excluded from scoring. The source's printed answer "
            f"letter was '{x.get('answer_letter')}'."
        )

    return {
        "id": f"M205-EX-B{batch}-L{x['local_number']}",
        "module": MODULE_ID,
        "text": x["question_text"],
        "options": letter_options(x["options"]),
        "correctOptionId": None if (figure_label_only or x.get("cancelled")) else (x["answer_letter"].lower() if x.get("answer_letter") else None),
        # Deliberately NOT classified by subject/chapter: exam reprints are kept distinguishable
        # from the bank's own subject classification, per the integration brief, rather than
        # guessed from subject_in_exam free text.
        "category": None,
        "chapter": None,
        "sectionId": None,
        "sourceExam": source_exam_label,
        "academicYear": None,
        "examDate": None,
        "batch": batch,
        "originalSourceFile": "module205_new-3.pdf",
        "originalQuestionNumber": x["local_number"],
        "textbookEdition": "Module 205 Neuroscience MCQ Bank (compiled question bank + answer key, 236-page PDF)",
        "gradingStatus": "Review" if x.get("cancelled") else gradingStatus,
        "coverageLabel": None,
        "coverageGroup": None,
        "bookPages": [str(x["page"])],
        "evidence": None,
        "reviewNote": note,
        "conditionalAlternatives": [],
        "allowAbstention": False,
        "isMultipleAnswerOrException": False,
        "deepseekComparison": None,
        "reviewStatus": "needs_review" if x.get("cancelled") else reviewStatus,
        "questionCode": None,
        "topicCode": None,
        "section": x.get("subject_in_exam"),
        "tags": [],
        "historicalBatches": [batch],
        "sourcePdfPage": x["page"],
        "answerVerificationStatus": "cancelled" if x.get("cancelled") else x["answer_status"],
        "hasFigure": bool(figures),
        "figures": figures,
        # --- exam-entry-only fields ---
        "refCode": x.get("ref_code"),
        "cancelled": bool(x.get("cancelled")),
        "figureReproductionNote": x.get("figure_reproduction_note"),
    }


def build_sources_entries(exam_entries):
    by_batch = {}
    for x in exam_entries:
        by_batch.setdefault(x["batch"], []).append(x)
    entries = []
    for batch, rows in sorted(by_batch.items()):
        entries.append(
            {
                "module": MODULE_ID,
                "batch": batch,
                "label": f"Module 205 — Previous Exam — Batch {batch}",
                "academicYear": None,
                "examDate": None,
                "importedCount": len(rows),
                "questionsFile": "module205_new-3.pdf",
                "answerKeyFile": "module205_new-3.pdf (embedded answer key)",
            }
        )
    return entries


def main():
    questions_raw = load("questions_final.json")
    exam_raw = load("exam_entries_final.json")
    banners = load("chapter_banners.json")

    chapters_path = os.path.join(APP_DATA, "chapters.json")
    questions_path = os.path.join(APP_DATA, "questions.json")
    sources_path = os.path.join(APP_DATA, "sources.json")

    with open(chapters_path, encoding="utf-8") as f:
        chapters = json.load(f)
    with open(questions_path, encoding="utf-8") as f:
        questions = json.load(f)
    with open(sources_path, encoding="utf-8") as f:
        sources = json.load(f)

    # Replace only the "205" slice in each file; leave 101/102 untouched.
    chapters[MODULE_ID] = build_chapters_entry(banners, questions_raw)

    questions = [q for q in questions if q.get("module") != MODULE_ID]
    new_bank = [bank_record(q) for q in questions_raw]
    new_exam = [exam_record(x) for x in exam_raw]
    questions.extend(new_bank)
    questions.extend(new_exam)

    sources = [s for s in sources if s.get("module") != MODULE_ID]
    sources.extend(build_sources_entries(exam_raw))

    with open(chapters_path, "w", encoding="utf-8") as f:
        json.dump(chapters, f, ensure_ascii=False, indent=1)
        f.write("\n")
    with open(questions_path, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=1)
        f.write("\n")
    with open(sources_path, "w", encoding="utf-8") as f:
        json.dump(sources, f, ensure_ascii=False, indent=1)
        f.write("\n")

    # ---- validation printout ----
    ids = [q["id"] for q in questions]
    dupes = {i for i in ids if ids.count(i) > 1}
    print("Module 205 bank records:", len(new_bank))
    print("Module 205 exam-entry records:", len(new_exam))
    print("Total questions.json records (all modules):", len(questions))
    print("Duplicate ids across whole file:", len(dupes), sorted(dupes)[:10])
    ready = sum(1 for q in new_bank + new_exam if q["gradingStatus"] == "Ready")
    review = sum(1 for q in new_bank + new_exam if q["gradingStatus"] == "Review")
    print(f"Module 205 Ready: {ready}, Review: {review} (sum {ready + review} of {len(new_bank) + len(new_exam)})")
    with_figs = sum(1 for q in new_bank + new_exam if q["hasFigure"])
    print("Module 205 records with a figure:", with_figs)
    mismatches = [
        q["id"] for q in new_bank + new_exam
        if q["correctOptionId"] and q["correctOptionId"] not in [o["id"] for o in q["options"]]
    ]
    print("Answer-letter-not-in-options mismatches:", len(mismatches), mismatches[:10])


if __name__ == "__main__":
    main()
