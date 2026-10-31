import docx, re, json, sys
from docx.table import Table
from docx.text.paragraph import Paragraph

OPT_RE = re.compile(r'(?:^|\n|;\s*)\s*([a-dA-D])[\.\)]\s*')
QNUM_RE = re.compile(r'^(\d+)\.\s+(.*)$', re.DOTALL)


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
}

if __name__ == "__main__":
    result = {}
    ok = True
    for module, cfg in MODULES.items():
        result[module] = {}
        for batch, path in cfg["files"].items():
            qs = cfg["parsers"][batch](path)
            result[module][batch] = qs
            exp = cfg["expected"][batch]
            status = "OK" if len(qs) == exp else "MISMATCH"
            if status == "MISMATCH":
                ok = False
            print(f"Module {module} Batch {batch}: parsed {len(qs)} / expected {exp}  [{status}]")
    with open("scripts2/questions_raw.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    if not ok:
        sys.exit(1)
