import docx, re, json, sys
from docx.table import Table
from docx.text.paragraph import Paragraph

# Module 103 batches 197/199 use "a- option" dashes instead of 101/102's "a. option"
# dots — the "-" is included here as a third accepted separator (checked to not
# collide with any existing 101/102 option text).
OPT_RE = re.compile(r'(?:^|\n|;\s*)\s*([a-dA-D])[\.\)\-]\s*')
QNUM_RE = re.compile(r'^(\d+)\.\s+(.*)$', re.DOTALL)
# Module 103 Batch 198 Q45: the scan cropped the question number itself, leaving a
# "[45; number cropped]" annotation in its place instead of "45.". Recognized here so
# the numbered parser treats it as question 45 instead of silently skipping the whole
# paragraph (which would desync every following question number for the rest of the
# batch). Rewritten to the normal "45. <rest>" shape before QNUM_RE ever sees it.
CROPPED_NUM_RE = re.compile(r'^\[(\d+);[^\]]*\]\s*(.*)$', re.DOTALL)


def split_options(block):
    """block: text after the stem, containing a./b./c./d. in any line/semicolon layout"""
    matches = list(OPT_RE.finditer(block))
    if len(matches) < 4:
        return None
    opts = {}
    for i, m in enumerate(matches):
        letter = m.group(1).lower()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(block)
        text = block[start:end].strip()
        text = text.rstrip(';').strip()
        text = re.sub(r'\s+', ' ', text)
        opts[letter] = text
    if set(opts.keys()) != {"a", "b", "c", "d"}:
        return None
    return opts


def options_from_table(table):
    """Handles the rare case where a question's a)/b)/c)/d) options are laid out as
    a comparison table (one row per option, >=2 columns) instead of plain paragraphs,
    e.g. Module 102 2023-11-30 Q33 (receptor-per-tissue comparison table)."""
    rows = [[c.text.strip() for c in r.cells] for r in table.rows]
    if not rows:
        return None
    header = rows[0]
    data_rows = rows[1:]
    opts = {}
    for row in data_rows:
        if not row:
            continue
        m = re.match(r'^([a-dA-D])[\.\)]?$', row[0].strip())
        if not m:
            return None
        letter = m.group(1).lower()
        # join the remaining columns with their header label, e.g.
        # "Cardiac muscle cells: β1; Bronchial smooth muscle cells: β2; Vascular smooth muscle cells: α2"
        parts = []
        for col_idx in range(1, len(row)):
            col_name = header[col_idx] if col_idx < len(header) else f"col{col_idx}"
            parts.append(f"{col_name}: {row[col_idx]}")
        opts[letter] = "; ".join(parts)
    if set(opts.keys()) != {"a", "b", "c", "d"}:
        return None
    return opts


def iter_body_items(doc):
    """Yield ('p', Paragraph) / ('tbl', Table) in true document order (paragraphs and
    tables can be interleaved in a .docx body)."""
    for child in doc.element.body.iterchildren():
        if child.tag.endswith('}p'):
            yield ('p', Paragraph(child, doc))
        elif child.tag.endswith('}tbl'):
            yield ('tbl', Table(child, doc))


def parse_numbered_with_tables(path):
    """Generic parser for 'N. stem' paragraphs whose options are either inline in the
    same paragraph, in following a)/b)/c)/d) paragraphs (one block or separate
    paragraphs), or — rarely — laid out as a table immediately after the stem."""
    doc = docx.Document(path)
    items = [it for it in iter_body_items(doc) if not (it[0] == 'p' and not it[1].text.strip())]
    return _parse_numbered_items(items, path)


def _parse_numbered_items(items, path):
    out = []
    i = 0
    n = len(items)
    expected_next = 1
    while i < n:
        kind, obj = items[i]
        if kind != 'p':
            i += 1
            continue
        text = obj.text
        cm = CROPPED_NUM_RE.match(text)
        if cm and int(cm.group(1)) == expected_next:
            text = f"{cm.group(1)}. {cm.group(2)}"
        m = QNUM_RE.match(text)
        if m and int(m.group(1)) == expected_next:
            num = int(m.group(1))
            stem_and_maybe_opts = m.group(2)
            opts = split_options(stem_and_maybe_opts)
            if opts:
                stem = OPT_RE.split(stem_and_maybe_opts)[0].strip()
                out.append({"number": num, "stem": stem, "options": opts})
                expected_next += 1
                i += 1
                continue
            stem = stem_and_maybe_opts.strip()
            # look ahead: a table immediately after the stem (before any following
            # question-numbered paragraph) takes priority over paragraph options
            j = i + 1
            if j < n and items[j][0] == 'tbl':
                opts = options_from_table(items[j][1])
                if opts:
                    out.append({"number": num, "stem": stem, "options": opts})
                    expected_next += 1
                    i = j + 1
                    continue
            # otherwise gather following paragraphs until the next question number
            collected = []
            j = i + 1
            while j < n:
                k2, o2 = items[j]
                if k2 == 'tbl':
                    j += 1
                    continue
                nxt_m = QNUM_RE.match(o2.text)
                if nxt_m and int(nxt_m.group(1)) == expected_next + 1:
                    break
                collected.append(o2.text)
                j += 1
                if len(collected) >= 6:
                    break
            block = "\n".join(collected)
            opts = split_options(block)
            if opts is None:
                print(f"WARN numbered q{num}: could not parse options in {path}", file=sys.stderr)
                i = j
                expected_next += 1
                continue
            out.append({"number": num, "stem": stem, "options": opts})
            expected_next += 1
            i = j
        else:
            i += 1
    return out


def _parse_numbered_items_any_order(items, path):
    """Same option-gathering logic as `_parse_numbered_items`, except a question-start
    paragraph is matched by its OWN printed number (not required to equal a running
    `expected_next` counter). Needed for Module 103 Batch 199, whose paragraphs are
    transcribed in a scrambled (non-sequential) order — e.g. ...29, 30, 47, 48, ...,
    54, 39, 40, ..., 46, 31, 32, ... — even though every individual paragraph carries
    its own correct printed number. Verified this is a real property of that source
    file, not a parsing bug: every number 1-120 appears exactly once, just not in
    document order."""
    out = []
    i = 0
    n = len(items)
    seen = set()
    while i < n:
        kind, obj = items[i]
        if kind != 'p':
            i += 1
            continue
        text = obj.text
        cm = CROPPED_NUM_RE.match(text)
        if cm:
            text = f"{cm.group(1)}. {cm.group(2)}"
        m = QNUM_RE.match(text)
        if m and int(m.group(1)) not in seen:
            num = int(m.group(1))
            stem_and_maybe_opts = m.group(2)
            opts = split_options(stem_and_maybe_opts)
            if opts:
                stem = OPT_RE.split(stem_and_maybe_opts)[0].strip()
                out.append({"number": num, "stem": stem, "options": opts})
                seen.add(num)
                i += 1
                continue
            stem = stem_and_maybe_opts.strip()
            j = i + 1
            if j < n and items[j][0] == 'tbl':
                opts = options_from_table(items[j][1])
                if opts:
                    out.append({"number": num, "stem": stem, "options": opts})
                    seen.add(num)
                    i = j + 1
                    continue
            collected = []
            j = i + 1
            while j < n:
                k2, o2 = items[j]
                if k2 == 'tbl':
                    j += 1
                    continue
                nxt_text = o2.text
                nxt_cm = CROPPED_NUM_RE.match(nxt_text)
                if nxt_cm:
                    nxt_text = f"{nxt_cm.group(1)}. {nxt_cm.group(2)}"
                nxt_m = QNUM_RE.match(nxt_text)
                if nxt_m:
                    break
                collected.append(o2.text)
                j += 1
                if len(collected) >= 6:
                    break
            block = "\n".join(collected)
            opts = split_options(block)
            if opts is None:
                print(f"WARN numbered q{num}: could not parse options in {path}", file=sys.stderr)
                i = j
                seen.add(num)
                continue
            out.append({"number": num, "stem": stem, "options": opts})
            seen.add(num)
            i = j
        else:
            i += 1
    return out


def parse_194(path):
    """Module 101 Batch 194 has no printed question numbers in the source file."""
    d = docx.Document(path)
    paras = [p.text for p in d.paragraphs if p.text.strip()]
    start_idx = 0
    for i, p in enumerate(paras):
        if p.startswith("Questions ("):
            start_idx = i + 1
            break
    qparas = paras[start_idx:]
    out = []
    for i, p in enumerate(qparas, start=1):
        lines = p.split("\n")
        stem = lines[0].strip()
        rest = "\n".join(lines[1:])
        opts = split_options(rest)
        if opts is None:
            print(f"WARN 194 q{i}: could not parse options", file=sys.stderr)
            continue
        out.append({"number": i, "stem": stem, "options": opts})
    return out


def parse_103(path):
    """Module 103's question papers are structurally the same as 101/102's (one
    numbered paragraph per question, a./b./c./d. options) EXCEPT that three of the
    five batches (195/196/197) have numbered exam-instruction paragraphs
    ('1. All questions are mandatory.', '2. ...', '3. ...') right before the real
    question list, which would otherwise be silently consumed as fake questions 1-3
    and permanently desync `expected_next` so the real Q1/Q2/... never match again.
    Fix: every one of the 5 batches has a 'Transcription note.' paragraph immediately
    before the real Q1 (verified directly against all 5 source files) — only the
    paragraphs/tables after it are handed to the shared numbered-question parser.
    Batches 198/199 don't have the instructions problem, but skipping the marker is
    harmless for them too, so one code path covers all five.

    Uses the order-agnostic variant of the shared parser (matches each paragraph's
    own printed number rather than requiring strict document-order sequencing) —
    Batch 199's paragraphs turned out to be transcribed in a scrambled order (see
    `_parse_numbered_items_any_order`'s docstring); harmless for the other four
    batches, which are in plain sequential order."""
    doc = docx.Document(path)
    items = [it for it in iter_body_items(doc) if not (it[0] == 'p' and not it[1].text.strip())]
    start_idx = 0
    for i, (kind, obj) in enumerate(items):
        if kind == 'p' and obj.text.strip().startswith("Transcription note."):
            start_idx = i + 1
            break
    return _parse_numbered_items_any_order(items[start_idx:], path)


# Known, manually-verified fixes for scan-damage/transcription typos that the shared
# parser can locate but can't reconstruct the correct option wording for on its own.
# Only the listed letters are overridden (others keep whatever the parser produced).
KNOWN_OPTION_FIXES = {
    # Module 103 Batch 198 Q45 had its question number AND the first letter of each of
    # its four options cropped off the top of the scanned page; the Book Verified
    # Answer Key's own Review note for B198-Q045 explicitly states the reconstructed
    # wording after visually re-inspecting the scan — applied here rather than guessed.
    ("103", "198", 45): {"a": "More mitochondria", "b": "Anaerobic pathway", "c": "Few glycogens", "d": "Abundant myoglobin"},
    # Module 103 Batch 197 Q35: options b and d both read "... of high" in the source
    # docx ("Posterior cutaneous nerve of high.", "Lateral cutaneous nerve of high.") —
    # a transcription typo dropping the leading "t" of "thigh" (nowhere else in any of
    # the 5 batches does "of high" appear outside this one question). The Book Verified
    # Answer Key's own Answer/Book lines both independently confirm "of thigh" is the
    # intended wording ("Answer B. Posterior cutaneous nerve of thigh." / evidence
    # "the book lists the posterior cutaneous nerve of thigh..."), so corrected here
    # rather than left as a nonsensical option for students.
    ("103", "197", 35): {"b": "Posterior cutaneous nerve of thigh", "d": "Lateral cutaneous nerve of thigh"},
}

MODULES = {
    "101": {
        "files": {
            "194": "source_docs/101/questions/Batch194_questions.docx",
            "195": "source_docs/101/questions/Batch195_questions.docx",
            "196": "source_docs/101/questions/Batch196_questions.docx",
            "198": "source_docs/101/questions/Batch198_questions.docx",
            "199": "source_docs/101/questions/Batch199_questions.docx",
        },
        "expected": {"194": 48, "195": 120, "196": 120, "198": 120, "199": 120},
        "parsers": {
            "194": parse_194,
            "195": parse_numbered_with_tables,
            "196": parse_numbered_with_tables,
            "198": parse_numbered_with_tables,
            "199": parse_numbered_with_tables,
        },
    },
    "102": {
        "files": {
            "20200115": "source_docs/102/questions/20200115_questions.docx",
            "20201220": "source_docs/102/questions/20201220_questions.docx",
            "20211226": "source_docs/102/questions/20211226_questions.docx",
            "20231130": "source_docs/102/questions/20231130_questions.docx",
            "20241128": "source_docs/102/questions/20241128_questions.docx",
        },
        "expected": {"20200115": 96, "20201220": 96, "20211226": 120, "20231130": 120, "20241128": 120},
        "parsers": {
            "20200115": parse_numbered_with_tables,
            "20201220": parse_numbered_with_tables,
            "20211226": parse_numbered_with_tables,
            "20231130": parse_numbered_with_tables,
            "20241128": parse_numbered_with_tables,
        },
    },
    "103": {
        "files": {
            "195": "source_docs/103/questions/Batch195_questions.docx",
            "196": "source_docs/103/questions/Batch196_questions.docx",
            "197": "source_docs/103/questions/Batch197_questions.docx",
            "198": "source_docs/103/questions/Batch198_questions.docx",
            "199": "source_docs/103/questions/Batch199_questions.docx",
        },
        "expected": {"195": 120, "196": 120, "197": 120, "198": 120, "199": 120},
        "parsers": {
            "195": parse_103,
            "196": parse_103,
            "197": parse_103,
            "198": parse_103,
            "199": parse_103,
        },
    },
}

if __name__ == "__main__":
    result = {}
    ok = True
    for module, cfg in MODULES.items():
        result[module] = {}
        for batch, path in cfg["files"].items():
            qs = cfg["parsers"][batch](path)
            for q in qs:
                fix = KNOWN_OPTION_FIXES.get((module, batch, q["number"]))
                if fix:
                    q["options"].update(fix)
            result[module][batch] = qs
            exp = cfg["expected"][batch]
            numbers = [q["number"] for q in qs]
            numbers_ok = len(numbers) == len(set(numbers)) and (set(numbers) == set(range(1, exp + 1)))
            status = "OK" if len(qs) == exp and numbers_ok else "MISMATCH"
            if status == "MISMATCH":
                ok = False
            print(f"Module {module} Batch {batch}: parsed {len(qs)} / expected {exp}  [{status}]")
    with open("scripts2/questions_raw.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    if not ok:
        sys.exit(1)
