import docx, re, json, sys

FILES = {
    "194": "/mnt/user-data/uploads/101/EOM/1-Module101_EOM_2020-2021_Batch194_Round1_Dec2020-24-12-2020.docx",
    "195": "/mnt/user-data/uploads/101/EOM/2-Module101_EOM_Batch195_2021-2022.docx",
    "196": "/mnt/user-data/uploads/101/EOM/3-Module101_EOM_Batch196_2022-2023.docx",
    "198": "/mnt/user-data/uploads/101/EOM/5-Batch 198 5-12-2024.docx",
    "199": "/mnt/user-data/uploads/101/EOM/6-Module101_EOM_Batch199_2025-2026.docx",
}
EXPECTED = {"194": 48, "195": 120, "196": 120, "198": 120, "199": 120}

OPT_RE = re.compile(r'(?:^|\n|;\s*)\s*([a-dA-D])[\.\)]\s*')

def split_options(block):
    """block: text after the stem, containing a./b./c./d. in any line/semicolon layout"""
    # normalize semicolons that separate inline options into newlines
    matches = list(OPT_RE.finditer(block))
    if len(matches) < 4:
        return None
    opts = {}
    for i, m in enumerate(matches):
        letter = m.group(1).lower()
        start = m.end()
        end = matches[i+1].start() if i+1 < len(matches) else len(block)
        text = block[start:end].strip()
        text = text.rstrip(';').strip()
        text = re.sub(r'\s+', ' ', text)
        opts[letter] = text
    if set(opts.keys()) != {"a","b","c","d"}:
        return None
    return opts

def parse_194(path):
    d = docx.Document(path)
    paras = [p.text for p in d.paragraphs if p.text.strip()]
    # skip header paragraphs until "Questions (unanswered and cleaned):"
    start_idx = 0
    for i,p in enumerate(paras):
        if p.startswith("Questions ("):
            start_idx = i+1
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

def parse_numbered(path):
    """Generic parser for files where paragraphs are 'N. stem' optionally followed by
    either one paragraph with inline a./b./c./d. or separate a./b./c./d. paragraphs,
    OR the stem paragraph itself already contains all options inline."""
    d = docx.Document(path)
    paras = [p.text for p in d.paragraphs if p.text.strip()]
    qnum_re = re.compile(r'^(\d+)\.\s+(.*)$', re.DOTALL)
    out = []
    i = 0
    n = len(paras)
    expected_next = 1
    while i < n:
        m = qnum_re.match(paras[i])
        if m and int(m.group(1)) == expected_next:
            num = int(m.group(1))
            stem_and_maybe_opts = m.group(2)
            # does this paragraph already contain options?
            opts = split_options(stem_and_maybe_opts)
            if opts:
                stem = OPT_RE.split(stem_and_maybe_opts)[0].strip()
                out.append({"number": num, "stem": stem, "options": opts})
                expected_next += 1
                i += 1
                continue
            # else: options are in following paragraphs (could be one block or 4 separate)
            stem = stem_and_maybe_opts.strip()
            # gather paragraphs until next question number or 4 options collected
            collected = []
            j = i + 1
            while j < n:
                nxt_m = qnum_re.match(paras[j])
                if nxt_m and int(nxt_m.group(1)) == expected_next + 1:
                    break
                collected.append(paras[j])
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

PARSERS = {
    "194": parse_194,
    "195": parse_numbered,
    "196": parse_numbered,
    "198": parse_numbered,
    "199": parse_numbered,
}

if __name__ == "__main__":
    result = {}
    for batch, path in FILES.items():
        qs = PARSERS[batch](path)
        result[batch] = qs
        exp = EXPECTED[batch]
        status = "OK" if len(qs) == exp else "MISMATCH"
        print(f"Batch {batch}: parsed {len(qs)} / expected {exp}  [{status}]")
    with open("/home/claude/med-exam-app/scripts2/questions_raw.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
