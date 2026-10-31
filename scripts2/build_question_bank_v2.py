import json, re, sys
sys.path.insert(0, "/home/claude/med-exam-app/scripts")
from build_question_bank import CATEGORY_KEYWORDS, CHAPTER_KEYWORDS, classify_category, classify_chapter

QR = json.load(open("/home/claude/med-exam-app/scripts2/questions_raw.json", encoding="utf-8"))
AK = json.load(open("/home/claude/med-exam-app/scripts2/answer_keys_raw.json", encoding="utf-8"))
chapters = json.load(open("/home/claude/med-exam-app/data/chapters.json", encoding="utf-8"))

BATCH_META = {
    "194": {"academicYear": "2020-2021", "examDate": "2020-12-24",
            "questionsFile": "Module101_EOM_2020-2021_Batch194_Round1_Dec2020-24-12-2020.docx",
            "keyFile": "Module101_Batch194_Book_Verified_Answer_Key.docx"},
    "195": {"academicYear": "2021-2022", "examDate": "2021-12-18",
            "questionsFile": "Module101_EOM_Batch195_2021-2022.docx",
            "keyFile": "Module101_Batch195_Book_Verified_Answer_Key.docx"},
    "196": {"academicYear": "2022-2023", "examDate": "2022-12-10",
            "questionsFile": "Module101_EOM_Batch196_2022-2023.docx",
            "keyFile": "Module101_Batch196_Book_Verified_Answer_Key.docx"},
    "198": {"academicYear": "2024-2025", "examDate": "2024-12-05",
            "questionsFile": "Batch198_5-12-2024.docx",
            "keyFile": "Module101_Batch198_Book_Verified_Answer_Key.docx"},
    "199": {"academicYear": "2025-2026", "examDate": "2025-11-20",
            "questionsFile": "Module101_EOM_Batch199_2025-2026.docx",
            "keyFile": "Module101_Batch199_Book_Verified_Answer_Key.docx"},
}

COVERAGE_GROUP = {
    "Direct": "book-supported",
    "Calculated": "book-supported",
    "Inferred": "book-supported",
    "Partial": "partial",
    "Not covered": "not-covered",
}

all_questions = []
sources = []
unclassified = []

for batch, meta in BATCH_META.items():
    qmap = {q["number"]: q for q in QR[batch]}
    akeys = AK[batch]
    count = 0
    for a in akeys:
        num = a["number"]
        q = qmap[num]
        full_text = q["stem"] + " " + " ".join(q["options"].values())
        cat, cat_score = classify_category(full_text)
        chap, chap_score = (None, 0)
        if cat:
            chap, chap_score = classify_chapter(full_text, cat)
        if not cat:
            unclassified.append(a["stableId"])

        options = [{"id": letter, "text": q["options"][letter]} for letter in ["a", "b", "c", "d"]]
        letter = a["answerLetter"].lower()

        record = {
            "id": a["stableId"],
            "module": "101",
            "text": q["stem"],
            "options": options,
            "correctOptionId": letter,
            "category": cat,
            "chapter": chap if chap_score >= 1 else None,
            "sourceExam": f"Module 101 — End-of-Module Examination — Batch {batch} — Academic Year {meta['academicYear']}",
            "academicYear": meta["academicYear"],
            "examDate": meta["examDate"],
            "batch": batch,
            "originalSourceFile": meta["questionsFile"],
            "originalQuestionNumber": num,
            "textbookEdition": chapters["textbookEdition"],
            "gradingStatus": a["gradingStatus"],            # "Ready" | "Review"
            "coverageLabel": a["coverageLabel"],             # Direct/Calculated/Inferred/Partial/Not covered
            "coverageGroup": COVERAGE_GROUP[a["coverageLabel"]],
            "bookPages": a["pages"],
            "evidence": a["evidence"],
            "reviewNote": a.get("reviewNote", ""),
            "conditionalAlternatives": a.get("conditionalAlternatives", []),
            "allowAbstention": a["gradingStatus"] == "Review",
            "isMultipleAnswerOrException": False,
        }
        all_questions.append(record)
        count += 1
    sources.append({
        "batch": batch,
        "label": f"Batch {batch} — {meta['academicYear']} End-of-Module Exam",
        "academicYear": meta["academicYear"],
        "examDate": meta["examDate"],
        "importedCount": count,
        "questionsFile": meta["questionsFile"],
        "answerKeyFile": meta["keyFile"],
    })

print(f"Total: {len(all_questions)}")
from collections import Counter
print("Grading:", dict(Counter(q["gradingStatus"] for q in all_questions)))
print("Coverage:", dict(Counter(q["coverageLabel"] for q in all_questions)))
print("Category:", dict(Counter(q["category"] or "UNCLASSIFIED" for q in all_questions)))
print("Unclassified ids:", unclassified)
print("With chapter:", sum(1 for q in all_questions if q["chapter"]), "/", len(all_questions))

import os
OUT = "/home/claude/med-exam-app/app/data"
os.makedirs(OUT, exist_ok=True)
with open(f"{OUT}/questions.json", "w", encoding="utf-8") as f:
    json.dump(all_questions, f, ensure_ascii=False, indent=1)
with open(f"{OUT}/sources.json", "w", encoding="utf-8") as f:
    json.dump(sources, f, ensure_ascii=False, indent=1)
# chapters.json unchanged, still copy to keep app/data self-contained
with open(f"{OUT}/chapters.json", "w", encoding="utf-8") as f:
    json.dump(chapters, f, ensure_ascii=False, indent=1)
