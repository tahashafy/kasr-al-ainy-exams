import docx, re, json, sys

FILES = {
    "194": "/mnt/user-data/uploads/101/EOM/Module101_Batch194_Book_Verified_Answer_Key.docx",
    "195": "/mnt/user-data/uploads/101/EOM/Module101_Batch195_Book_Verified_Answer_Key.docx",
    "196": "/mnt/user-data/uploads/101/EOM/Module101_Batch196_Book_Verified_Answer_Key.docx",
    "198": "/mnt/user-data/uploads/101/EOM/Module101_Batch198_Book_Verified_Answer_Key.docx",
    "199": "/mnt/user-data/uploads/101/EOM/Module101_Batch199_Book_Verified_Answer_Key.docx",
}
EXPECTED = {"194": 48, "195": 120, "196": 120, "198": 120, "199": 120}

Q_RE = re.compile(r'^Question\s+(\d+)\s+(B\d+-Q\d+)\n(.*)$', re.DOTALL)
ANS_RE = re.compile(r'^Answer\s+([A-D])\.\s*(.*)$', re.DOTALL)
BOOK_NOTCOVERED_RE = re.compile(r'^Book Not covered in the department book\.\s*(.*)$', re.DOTALL)
BOOK_LABEL_RE = re.compile(r'^Book\s+(Direct|Calculated|Inferred|Partial)\s*\|\s*Pages?\s+([^:]+):\s*(.*)$', re.DOTALL)
REVIEW_RE = re.compile(r'^Review\s+(.*?)\s*Grading:\s*(Ready|Review)\.?\s*$', re.DOTALL)
CHOICES_RE = re.compile(r'Choices requiring consideration:\s*([A-D](?:\s*/\s*[A-D])*)\.')

def parse_file(batch, path):
    d = docx.Document(path)
    paras = [p.text for p in d.paragraphs]
    # find index of "Answers and evidence" marker, start reading from there
    start = 0
    for i, p in enumerate(paras):
        if p.strip() == "Answers and evidence":
            start = i + 1
            break
    questions = []
    i = start
    n = len(paras)
    current = None
    while i < n:
        p = paras[i]
        qm = Q_RE.match(p)
        if qm:
            if current:
                questions.append(current)
            num = int(qm.group(1))
            stable_id = qm.group(2)
            stem = qm.group(3).strip()
            current = {"number": num, "stableId": stable_id, "stem": stem}
            i += 1
            continue
        if current is not None:
            am = ANS_RE.match(p)
            if am:
                current["answerLetter"] = am.group(1)
                current["answerText"] = am.group(2).strip()
                i += 1
                continue
            nc = BOOK_NOTCOVERED_RE.match(p)
            if nc:
                current["coverageLabel"] = "Not covered"
                current["pages"] = []
                current["evidence"] = nc.group(1).strip()
                i += 1
                continue
            bl = BOOK_LABEL_RE.match(p)
            if bl:
                current["coverageLabel"] = bl.group(1)
                pages_raw = bl.group(2).strip()
                pages = [x.strip() for x in re.split(r',', pages_raw) if x.strip()]
                current["pages"] = pages
                current["evidence"] = bl.group(3).strip()
                i += 1
                continue
            rv = REVIEW_RE.match(p)
            if rv:
                review_text = rv.group(1).strip()
                grading = rv.group(2)
                current["reviewNote"] = review_text
                current["gradingStatus"] = grading
                cm = CHOICES_RE.search(review_text)
                if cm:
                    current["conditionalAlternatives"] = [x.strip() for x in cm.group(1).split("/")]
                else:
                    current["conditionalAlternatives"] = []
                i += 1
                continue
        i += 1
    if current:
        questions.append(current)
    return questions

if __name__ == "__main__":
    result = {}
    for batch, path in FILES.items():
        qs = parse_file(batch, path)
        result[batch] = qs
        exp = EXPECTED[batch]
        missing_fields = [q["number"] for q in qs if not all(k in q for k in ("answerLetter","coverageLabel","gradingStatus"))]
        status = "OK" if len(qs) == exp and not missing_fields else "MISMATCH"
        print(f"Batch {batch}: parsed {len(qs)} / expected {exp}  missing_fields={missing_fields}  [{status}]")
    with open("/home/claude/med-exam-app/scripts2/answer_keys_raw.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
