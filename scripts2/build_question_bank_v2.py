"""Merges the extracted question text + book-verified answer keys into
app/data/questions.json / sources.json, for all modules (currently 101 and 102).

IMPORTANT about Module 101 category/chapter assignment: the original keyword classifier
used for Module 101 (scripts/build_question_bank.py, referenced in git history) is not
checked into this repo and its exact keyword lists are lost. To avoid silently
reclassifying/reshuffling the 355 already-shipped Module 101 questions' category/chapter
fields on every rebuild, this script REUSES the category/chapter already recorded for
each Module 101 question id in the current app/data/questions.json rather than
re-running a classifier against it. Module 101's questions.json is therefore the source
of truth for its own classification; only Module 102 runs a fresh classifier (see
scripts2/classify_102.py).
"""
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
from classify_102 import classify_category as classify_category_102, classify_chapter as classify_chapter_102

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DATA = os.path.join(ROOT, "app", "data")

QR = json.load(open(os.path.join(ROOT, "scripts2", "questions_raw.json"), encoding="utf-8"))
AK = json.load(open(os.path.join(ROOT, "scripts2", "answer_keys_raw.json"), encoding="utf-8"))
chapters_by_module = json.load(open(os.path.join(APP_DATA, "chapters.json"), encoding="utf-8"))

# Previous build's output, used only to preserve Module 101's existing category/chapter
# assignments (see module docstring above).
PREV_PATH = os.path.join(APP_DATA, "questions.json")
prev_by_id = {}
if os.path.exists(PREV_PATH):
    for q in json.load(open(PREV_PATH, encoding="utf-8")):
        prev_by_id[q["id"]] = q

BATCH_META = {
    "101": {
        "194": {"academicYear": "2020-2021", "examDate": "2020-12-24",
                "questionsFile": "Batch194_questions.docx",
                "keyFile": "Module101_Batch194_Book_Verified_Answer_Key.docx"},
        "195": {"academicYear": "2021-2022", "examDate": "2021-12-18",
                "questionsFile": "Batch195_questions.docx",
                "keyFile": "Module101_Batch195_Book_Verified_Answer_Key.docx"},
        "196": {"academicYear": "2022-2023", "examDate": "2022-12-10",
                "questionsFile": "Batch196_questions.docx",
                "keyFile": "Module101_Batch196_Book_Verified_Answer_Key.docx"},
        "198": {"academicYear": "2024-2025", "examDate": "2024-12-05",
                "questionsFile": "Batch198_questions.docx",
                "keyFile": "Module101_Batch198_Book_Verified_Answer_Key.docx"},
        "199": {"academicYear": "2025-2026", "examDate": "2025-11-20",
                "questionsFile": "Batch199_questions.docx",
                "keyFile": "Module101_Batch199_Book_Verified_Answer_Key.docx"},
    },
    "102": {
        "20200115": {"academicYear": "2019-2020", "examDate": "2020-01-15",
                      "questionsFile": "20200115_questions.docx",
                      "keyFile": "Module102_20200115_Book_Verified_Answer_Key.docx"},
        "20201220": {"academicYear": "2020-2021", "examDate": "2020-12-20",
                      "questionsFile": "20201220_questions.docx",
                      "keyFile": "Module102_20201220_Book_Verified_Answer_Key.docx"},
        "20211226": {"academicYear": "2021-2022", "examDate": "2021-12-26",
                      "questionsFile": "20211226_questions.docx",
                      "keyFile": "Module102_20211226_Book_Verified_Answer_Key.docx"},
        "20231130": {"academicYear": "2023-2024", "examDate": "2023-11-30",
                      "questionsFile": "20231130_questions.docx",
                      "keyFile": "Module102_20231130_Book_Verified_Answer_Key.docx"},
        "20241128": {"academicYear": "2024-2025", "examDate": "2024-11-28",
                      "questionsFile": "20241128_questions.docx",
                      "keyFile": "Module102_20241128_Book_Verified_Answer_Key.docx"},
    },
}

COVERAGE_GROUP = {
    "Direct": "book-supported",
    "Calculated": "book-supported",
    "Inferred": "book-supported",
    "Partial": "partial",
    "Not covered": "not-covered",
}

LABEL_PREFIX = {"101": "Module 101 — End-of-Module Examination", "102": "Module 102 — End-of-Module Examination"}

all_questions = []
sources = []
unclassified = []

for module, batches in BATCH_META.items():
    chapters = chapters_by_module[module]
    for batch, meta in batches.items():
        qmap = {q["number"]: q for q in QR[module][batch]}
        akeys = AK[module][batch]
        count = 0
        for a in akeys:
            num = a["number"]
            q = qmap[num]
            full_text = q["stem"] + " " + " ".join(q["options"].values())

            if module == "101":
                prev = prev_by_id.get(a["stableId"])
                cat = prev["category"] if prev else None
                chap = prev["chapter"] if prev else None
                if not prev:
                    unclassified.append(a["stableId"])
            else:
                cat, cat_score = classify_category_102(full_text)
                chap, chap_score = (None, 0)
                if cat:
                    chap, chap_score = classify_chapter_102(full_text, cat)
                    if chap_score < 1:
                        chap = None
                if not cat:
                    unclassified.append(a["stableId"])

            options = [{"id": letter, "text": q["options"][letter]} for letter in ["a", "b", "c", "d"]]
            letters = [x.strip().lower() for x in a["answerLetter"].split("/")]
            override = (a.get("primaryLetterOverride") or "").lower() or None
            correct = override if override else letters[0]
            # any letter besides the chosen primary one is an equally-defensible
            # alternative; merge with whatever "Choices requiring consideration" already
            # produced, de-duplicated, preserving order.
            extra_alts = [x for x in letters if x != correct]
            conditional = list(a.get("conditionalAlternatives", []))
            for x in extra_alts:
                xu = x.upper()
                if xu not in conditional and x not in conditional:
                    conditional.append(xu)
            is_multi_or_exception = len(letters) > 1 or bool(re.search(r'\b(NOT|EXCEPT)\b', q["stem"]))

            record = {
                "id": a["stableId"],
                "module": module,
                "text": q["stem"],
                "options": options,
                "correctOptionId": correct,
                "category": cat,
                "chapter": chap,
                "sourceExam": f"{LABEL_PREFIX[module]} — Batch {batch} — Academic Year {meta['academicYear']}" if module == "101"
                              else f"Module 102 Examination — {meta['examDate']} — Academic Year {meta['academicYear']}",
                "academicYear": meta["academicYear"],
                "examDate": meta["examDate"],
                "batch": batch,
                "originalSourceFile": meta["questionsFile"],
                "originalQuestionNumber": num,
                "textbookEdition": chapters["textbookEdition"],
                "gradingStatus": a["gradingStatus"],
                "coverageLabel": a["coverageLabel"],
                "coverageGroup": COVERAGE_GROUP[a["coverageLabel"]],
                "bookPages": a["pages"],
                "evidence": a["evidence"],
                "reviewNote": a.get("reviewNote", ""),
                "conditionalAlternatives": conditional,
                "allowAbstention": a["gradingStatus"] == "Review",
                "isMultipleAnswerOrException": is_multi_or_exception,
                "deepseekComparison": a.get("deepseekComparison"),
                # Derived alias of gradingStatus, kept only so scoring.js (already fully
                # tested) never had to change — see CLAUDE.md. Keep these two in sync.
                "reviewStatus": "verified" if a["gradingStatus"] == "Ready" else "needs_review",
            }
            all_questions.append(record)
            count += 1
        sources.append({
            "module": module,
            "batch": batch,
            "label": (f"Batch {batch} — {meta['academicYear']} End-of-Module Exam" if module == "101"
                      else f"Module 102 — {meta['examDate']} End-of-Module Exam"),
            "academicYear": meta["academicYear"],
            "examDate": meta["examDate"],
            "importedCount": count,
            "questionsFile": meta["questionsFile"],
            "answerKeyFile": meta["keyFile"],
        })

print(f"Total: {len(all_questions)}")
for module in BATCH_META:
    qs = [q for q in all_questions if q["module"] == module]
    print(f"--- Module {module}: {len(qs)} ---")
    print("Grading:", dict(Counter(q["gradingStatus"] for q in qs)))
    print("Coverage:", dict(Counter(q["coverageLabel"] for q in qs)))
    print("Category:", dict(Counter(q["category"] or "UNCLASSIFIED" for q in qs)))
    print("With chapter:", sum(1 for q in qs if q["chapter"]), "/", len(qs))
print("Unclassified ids:", unclassified)

with open(os.path.join(APP_DATA, "questions.json"), "w", encoding="utf-8") as f:
    json.dump(all_questions, f, ensure_ascii=False, indent=1)
with open(os.path.join(APP_DATA, "sources.json"), "w", encoding="utf-8") as f:
    json.dump(sources, f, ensure_ascii=False, indent=1)
