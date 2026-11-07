import docx, re, json, sys

# --- Module 101 "Book Verified Answer Key" format -----------------------------------
# Question header and stem share one paragraph: "Question N  B<batch>-Q<n>\n<stem>"
Q_RE_101 = re.compile(r'^Question\s+(\d+)\s+(B\d+-Q\d+)\n(.*)$', re.DOTALL)
ANS_RE_101 = re.compile(r'^Answer\s+([A-D])\.\s*(.*)$', re.DOTALL)
BOOK_NOTCOVERED_RE = re.compile(r'^Book Not covered in the department book\.\s*(.*)$', re.DOTALL)
BOOK_LABEL_RE_101 = re.compile(r'^Book\s+(Direct|Calculated|Inferred|Partial)\s*\|\s*Pages?\s+([^:]+):\s*(.*)$', re.DOTALL)
REVIEW_RE_101 = re.compile(r'^Review\s+(.*?)\s*Grading:\s*(Ready|Review)\.?\s*$', re.DOTALL)
CHOICES_RE = re.compile(r'Choices requiring consideration:\s*([A-D](?:\s*/\s*[A-D])*)\.')


def parse_101(batch, path):
    d = docx.Document(path)
    paras = [p.text for p in d.paragraphs]
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
        qm = Q_RE_101.match(p)
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
            am = ANS_RE_101.match(p)
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
            bl = BOOK_LABEL_RE_101.match(p)
            if bl:
                current["coverageLabel"] = bl.group(1)
                pages_raw = bl.group(2).strip()
                pages = [x.strip() for x in re.split(r',', pages_raw) if x.strip()]
                current["pages"] = pages
                current["evidence"] = bl.group(3).strip()
                i += 1
                continue
            rv = REVIEW_RE_101.match(p)
            if rv:
                review_text = rv.group(1).strip()
                grading = rv.group(2)
                current["reviewNote"] = review_text
                current["gradingStatus"] = grading
                cm = CHOICES_RE.search(review_text)
                current["conditionalAlternatives"] = [x.strip() for x in cm.group(1).split("/")] if cm else []
                i += 1
                continue
        i += 1
    if current:
        questions.append(current)
    return questions


# --- Module 102 "Book Verified Answer Key" format ------------------------------------
# Question header is its own paragraph: "Question N  <StableId>" (StableId e.g.
# "E20200115-Q001"); the stem is either on the SAME paragraph after a newline (as in
# batch 20241128) or is the NEXT paragraph (as in the other four 102 batches).
QHDR_RE_102 = re.compile(r'^Question\s+(\d+)\s+(\S+)(?:\n(.*))?$', re.DOTALL)
ANS_RE_102 = re.compile(r'^Answer\s+([A-D](?:\s*/\s*[A-D])*)\.\s*(.*)$', re.DOTALL)
BOOK_LABEL_RE_102 = re.compile(
    r'^Book\s+(Direct|Calculated|Inferred|Partial)\s*\|\s*Page(?:\(s\))?s?\s+([^:]+):\s*(.*)$', re.DOTALL)
REVIEW_RE_102 = re.compile(r'^Review\s+(.*?)\s*Grading:\s*(Ready|Review)\.\s*(.*)$', re.DOTALL)


def parse_102(batch, path):
    d = docx.Document(path)
    paras = [p.text for p in d.paragraphs]
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
        p = paras[i].strip()
        if not p:
            i += 1
            continue
        qm = QHDR_RE_102.match(p)
        if qm and qm.group(2).startswith(("E", "B")) and "-Q" in qm.group(2):
            if current:
                questions.append(current)
            num = int(qm.group(1))
            stable_id = qm.group(2)
            stem = (qm.group(3) or "").strip()
            current = {"number": num, "stableId": stable_id, "stem": stem}
            i += 1
            if not current["stem"]:
                # stem is the next non-empty paragraph
                while i < n and not paras[i].strip():
                    i += 1
                if i < n:
                    current["stem"] = paras[i].strip()
                    i += 1
            continue
        if current is not None:
            am = ANS_RE_102.match(p)
            if am:
                current["answerLetter"] = am.group(1).replace(" ", "")
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
            bl = BOOK_LABEL_RE_102.match(p)
            if bl:
                current["coverageLabel"] = bl.group(1)
                pages_raw = bl.group(2).strip()
                pages = [x.strip() for x in re.split(r'[,\-–]', pages_raw) if x.strip()]
                current["pages"] = pages
                current["evidence"] = bl.group(3).strip()
                i += 1
                continue
            rv = REVIEW_RE_102.match(p)
            if rv:
                review_text = rv.group(1).strip()
                grading = rv.group(2)
                deepseek_tail = rv.group(3).strip()
                current["reviewNote"] = review_text
                current["gradingStatus"] = grading
                dm = re.search(r'DeepSeek comparison:\s*(Agree|Disagree|Unresolved|Not supplied)', deepseek_tail)
                current["deepseekComparison"] = dm.group(1) if dm else None
                cm = CHOICES_RE.search(review_text)
                current["conditionalAlternatives"] = [x.strip() for x in cm.group(1).split("/")] if cm else []
                pm = re.search(r'\b([A-D])\s+is kept as the primary answer', review_text)
                current["primaryLetterOverride"] = pm.group(1) if pm else None
                i += 1
                continue
        i += 1
    if current:
        questions.append(current)
    return questions


# --- Module 103 "Book Verified Answer Key" format ------------------------------------
# Header/stem format is identical to Module 101's EXCEPT that batches 197/198 print the
# header, stable id and stem all on ONE line/paragraph ("Question N B197-Q001 <stem>",
# single spaces, no newline) instead of 101's "Question N  B<batch>-Q<n>\n<stem>" (two
# spaces, then a newline). This regex accepts either shape.
Q_RE_103 = re.compile(r'^Question\s+(\d+)\s+(B\d+-Q\d+)\s*\n?\s*(.*)$', re.DOTALL)
# Strips a leading "[45; number cropped] " style scan-defect annotation from a stem so
# it reads cleanly for students — applied identically here and in extract_questions.py
# so both sides still produce the exact same stem text for cross-validation.
CROP_STEM_RE = re.compile(r'^\[\d+;[^\]]*\]\s*')
# Answer line can be "None" (no option as written — see review note) or multi-letter
# ("A / D"), in addition to the normal single letter.
ANS_RE_103 = re.compile(r'^Answer\s+(None|[A-D](?:\s*/\s*[A-D])*)\.\s*(.*)$', re.DOTALL)
# 103's own "not covered" wording is slightly different from 101's ("Book Not covered:"
# vs 101's "Book Not covered in the department book."). One real outlier line in Batch
# 198 ("Book Not covered | Page 58: ...") cites a page even though the label is "Not
# covered" (the book gives related-but-incomplete info) — the optional "| Page(s) N"
# group below absorbs that without changing the Not-covered classification.
BOOK_NOTCOVERED_RE_103 = re.compile(r'^Book Not covered(?:\s*\|\s*Pages?\s+([^:]+))?:\s*(.*)$', re.DOTALL)
# A sixth "Book" line variant beyond the five standard labels: Biochemistry questions
# the department textbook has no usable text for at all were instead checked against
# Dr. Hisham Esmat's Biochemistry book (prepared for Batch 199, AY 2025-2026). Page
# citations here are sometimes followed by a parenthetical aside before the colon
# ("Page 3 (Dr. Hisham Esmat's Biochemistry book...): ...") and sometimes go straight
# to the colon ("Page 5: ...") — the pages group stops at the first "(" or ":" either
# way so digits from the parenthetical (e.g. "prepared for Batch 199, ... 2025-2026")
# never leak into the extracted page numbers.
BOOK_HISHAM_RE_103 = re.compile(
    r'^Book Covered in Dr\.\s*Hisham Esmat book\s*\|\s*Pages?\s+([^:(]+?)\s*(?:\([^)]*\)\s*)?:\s*(.*)$', re.DOTALL)
HISHAM_SOURCE_LABEL = "Dr. Hisham Esmat's Biochemistry book (prepared for Batch 199, academic year 2025–2026)"
# Used to classify a Hisham-book Book line's actual coverage strength from its own
# prose (see `finalize()` below). "partial" alone false-positived on real cases like
# "...gout as PRPP synthetase overactivity, partial or complete HGPRTase deficiency
# (Lesch-Nyhan syndrome)..." — a clinical term, not a coverage assessment — so that
# specific phrase is excluded. "infer(red|ence)" catches both "inferred from..." and
# "...supported ... only by inference from...", both seen verbatim in the real data.
HISHAM_PARTIAL_RE = re.compile(r'partial(?!\s+or\s+complete)', re.IGNORECASE)
HISHAM_INFERRED_RE = re.compile(r'infer(?:red|ence)', re.IGNORECASE)


def parse_103(batch, path):
    d = docx.Document(path)
    paras = [p.text for p in d.paragraphs]
    start = 0
    for i, p in enumerate(paras):
        if p.strip() == "Answers and evidence":
            start = i + 1
            break
    questions = []
    i = start
    n = len(paras)
    current = None

    def finalize(q):
        # Hisham-book coverage lines don't print one of the five standard labels
        # directly; classify from the evidence/review prose the same way a human
        # reading it would — "partial"/"inferred" language downgrades it from the
        # Direct default. Checked against ~230 real Hisham-sourced records before
        # trusting this (see IMPLEMENTATION_REPORT.md).
        if q.get("bookSource") == "hisham_esmat":
            combined = (q.get("evidence") or "") + " " + (q.get("reviewNote") or "")
            if HISHAM_PARTIAL_RE.search(combined):
                q["coverageLabel"] = "Partial"
            elif HISHAM_INFERRED_RE.search(combined):
                q["coverageLabel"] = "Inferred"
            else:
                q["coverageLabel"] = "Direct"
        # "Answer None." means no literal option is correct as transcribed (a printing
        # defect in the exam itself, per the review note) — there is no correct option
        # to score against, so this can never be "Ready" regardless of what the
        # source's own Grading line says (mirrors Module 205's figure-label-only
        # precedent: force Review rather than silently mis-scoring).
        if q.get("answerLetter") == "None":
            q["gradingStatus"] = "Review"

    while i < n:
        p = paras[i]
        qm = Q_RE_103.match(p)
        if qm:
            if current:
                finalize(current)
                questions.append(current)
            num = int(qm.group(1))
            stable_id = qm.group(2)
            stem = CROP_STEM_RE.sub("", qm.group(3).strip()).strip()
            current = {"number": num, "stableId": stable_id, "stem": stem,
                       "bookSource": "department", "bookSourceLabel": None}
            i += 1
            continue
        if current is not None:
            am = ANS_RE_103.match(p)
            if am:
                current["answerLetter"] = am.group(1).replace(" ", "")
                current["answerText"] = am.group(2).strip()
                i += 1
                continue
            hb = BOOK_HISHAM_RE_103.match(p)
            if hb:
                pages_raw = hb.group(1)
                current["pages"] = re.findall(r'\d+', pages_raw)
                current["evidence"] = hb.group(2).strip()
                current["bookSource"] = "hisham_esmat"
                current["bookSourceLabel"] = HISHAM_SOURCE_LABEL
                current["coverageLabel"] = "Direct"  # refined in finalize() once the full Review text is known
                i += 1
                continue
            nc = BOOK_NOTCOVERED_RE_103.match(p)
            if nc:
                pages_raw = nc.group(1)
                current["coverageLabel"] = "Not covered"
                current["pages"] = re.findall(r'\d+', pages_raw) if pages_raw else []
                current["evidence"] = nc.group(2).strip()
                current["bookSource"] = "department"
                current["bookSourceLabel"] = None
                i += 1
                continue
            bl = BOOK_LABEL_RE_101.match(p)
            if bl:
                current["coverageLabel"] = bl.group(1)
                pages_raw = bl.group(2).strip()
                pages = [x.strip() for x in re.split(r',', pages_raw) if x.strip()]
                current["pages"] = pages
                current["evidence"] = bl.group(3).strip()
                current["bookSource"] = "department"
                current["bookSourceLabel"] = None
                i += 1
                continue
            rv = REVIEW_RE_101.match(p)
            if rv:
                review_text = rv.group(1).strip()
                grading = rv.group(2)
                current["reviewNote"] = review_text
                current["gradingStatus"] = grading
                cm = CHOICES_RE.search(review_text)
                current["conditionalAlternatives"] = [x.strip() for x in cm.group(1).split("/")] if cm else []
                i += 1
                continue
        i += 1
    if current:
        finalize(current)
        questions.append(current)
    return questions


MODULES = {
    "101": {
        "files": {
            "194": "source_docs/101/book_verified_answer_keys/Module101_Batch194_Book_Verified_Answer_Key.docx",
            "195": "source_docs/101/book_verified_answer_keys/Module101_Batch195_Book_Verified_Answer_Key.docx",
            "196": "source_docs/101/book_verified_answer_keys/Module101_Batch196_Book_Verified_Answer_Key.docx",
            "198": "source_docs/101/book_verified_answer_keys/Module101_Batch198_Book_Verified_Answer_Key.docx",
            "199": "source_docs/101/book_verified_answer_keys/Module101_Batch199_Book_Verified_Answer_Key.docx",
        },
        "expected": {"194": 48, "195": 120, "196": 120, "198": 120, "199": 120},
        "parser": parse_101,
    },
    "102": {
        "files": {
            "20200115": "source_docs/102/book_verified_answer_keys/Module102_20200115_Book_Verified_Answer_Key.docx",
            "20201220": "source_docs/102/book_verified_answer_keys/Module102_20201220_Book_Verified_Answer_Key.docx",
            "20211226": "source_docs/102/book_verified_answer_keys/Module102_20211226_Book_Verified_Answer_Key.docx",
            "20231130": "source_docs/102/book_verified_answer_keys/Module102_20231130_Book_Verified_Answer_Key.docx",
            "20241128": "source_docs/102/book_verified_answer_keys/Module102_20241128_Book_Verified_Answer_Key.docx",
        },
        "expected": {"20200115": 96, "20201220": 96, "20211226": 120, "20231130": 120, "20241128": 120},
        "parser": parse_102,
    },
    "103": {
        "files": {
            "195": "source_docs/103/book_verified_answer_keys/Module103_Batch195_Book_Verified_Answer_Key.docx",
            "196": "source_docs/103/book_verified_answer_keys/Module103_Batch196_Book_Verified_Answer_Key.docx",
            "197": "source_docs/103/book_verified_answer_keys/Module103_Batch197_Book_Verified_Answer_Key.docx",
            "198": "source_docs/103/book_verified_answer_keys/Module103_Batch198_Book_Verified_Answer_Key.docx",
            "199": "source_docs/103/book_verified_answer_keys/Module103_Batch199_Book_Verified_Answer_Key.docx",
        },
        "expected": {"195": 120, "196": 120, "197": 120, "198": 120, "199": 120},
        "parser": parse_103,
    },
}

if __name__ == "__main__":
    result = {}
    ok = True
    for module, cfg in MODULES.items():
        result[module] = {}
        for batch, path in cfg["files"].items():
            qs = cfg["parser"](batch, path)
            result[module][batch] = qs
            exp = cfg["expected"][batch]
            missing_fields = [q["number"] for q in qs if not all(k in q for k in ("answerLetter", "coverageLabel", "gradingStatus"))]
            status = "OK" if len(qs) == exp and not missing_fields else "MISMATCH"
            if status == "MISMATCH":
                ok = False
            print(f"Module {module} Batch {batch}: parsed {len(qs)} / expected {exp}  missing_fields={missing_fields}  [{status}]")
    with open("scripts2/answer_keys_raw.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    if not ok:
        sys.exit(1)
