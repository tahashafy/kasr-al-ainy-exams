"""Keyword-based category/chapter classifier for Module 102 (INT 102 — Introduction to
Biomedical Sciences). Mirrors the spirit of the (unrecovered) Module 101 classifier
described in CLAUDE.md/IMPLEMENTATION_REPORT.md: a reasonable automated first pass built
from the textbook's own table of contents and standard terminology for each chapter —
NOT hand-verified question-by-question. Chapter boundaries/titles come straight from
102_INT_Published_V2.pdf's own table of contents (see app/data/chapters.json)."""

import re

CATEGORY_KEYWORDS = {
    "biochemistry": [
        "amino acid", "protein", "peptide", "enzyme", "heme", "hemoglobin", "porphyrin",
        "collagen", "elastin", "extracellular matrix", "carbohydrate", "glucose",
        "monosaccharide", "disaccharide", "polysaccharide", "glycosaminoglycan", "lipid",
        "fatty acid", "triglyceride", "cholesterol", "lipoprotein", "phospholipid",
        "nucleotide", "purine", "pyrimidine", "nucleic acid", "dna", "rna", "replication",
        "transcription", "translation", "gene expression", "mutation", "codon", "cell cycle",
        "mitosis", "apoptosis", "oncogene", "tumor suppressor", "chromatin", "enzyme",
        "biochemistry", "metabolism", "coenzyme", "vitamin",
    ],
    "physiology": [
        "sympathetic", "parasympathetic", "autonomic", "ganglion", "acetylcholine",
        "norepinephrine", "adrenergic", "cholinergic", "adrenal medulla", "neurotransmitter",
        "cranial nerve", "vagus", "pupil", "miosis", "mydriasis", "erythrocyte", "rbc",
        "erythropoiesis", "erythropoietin", "anemia", "hemopoietic", "bone marrow",
        "platelet", "coagulation", "clotting factor", "hemostasis", "thrombus", "leukocyte",
        "plasma protein", "fibrinogen", "prothrombin", "hemolysis", "iron absorption",
    ],
}

CHAPTER_KEYWORDS = {
    "bio-1": ["covalent bond", "hydrogen bond", "van der waals", "electronegativity",
              "nutrient", "nutrition", "macronutrient", "micronutrient", "buffer", "ph of"],
    "bio-2": ["amino acid", "zwitterion", "isoelectric point", "essential amino acid",
              "semi-essential", "glycine", "alanine", "cysteine", "methionine", "lysine",
              "arginine", "histidine", "proline", "aspartic acid", "glutamic acid", "serine"],
    "bio-3": ["peptide bond", "primary structure", "secondary structure", "tertiary structure",
              "quaternary structure", "denaturation", "biological value", "alpha helix",
              "beta sheet", "chaperone", "conjugated protein", "simple protein"],
    "bio-4": ["enzyme", "active site", "km", "vmax", "competitive inhibition",
              "noncompetitive inhibition", "allosteric", "cofactor", "coenzyme", "isoenzyme",
              "zymogen", "proenzyme", "catalysis", "substrate"],
    "bio-5": ["heme", "hemoglobin", "porphyrin", "bilirubin", "jaundice", "myoglobin",
              "thalassemia", "sickle cell", "globin", "methemoglobin", "cytochrome",
              "deoxyhemoglobin", "oxyhemoglobin", "2,3-bpg", "hemoglobin f", "hemoglobin a"],
    "bio-6": ["collagen", "elastin", "fibrillin", "marfan", "osteogenesis imperfecta",
              "aggrecan", "proteoglycan", "laminin", "fibronectin", "basement membrane",
              "osteocalcin", "extracellular matrix", "hydroxyproline"],
    "bio-7": ["glucose", "monosaccharide", "disaccharide", "polysaccharide", "glycogen",
              "starch", "cellulose", "glycosaminoglycan", "hyaluronic acid", "heparin",
              "chondroitin", "keratan sulfate", "lactose", "sucrose", "epimer", "anomer",
              "aldose", "ketose", "galactose", "fructose", "mannose", "ribose"],
    "bio-8": ["fatty acid", "triglyceride", "triacylglycerol", "phospholipid", "cholesterol",
              "lipoprotein", "saturated fatty acid", "unsaturated fatty acid",
              "essential fatty acid", "linoleic", "eicosanoid", "prostaglandin",
              "leukotriene", "sphingolipid", "sphingomyelin", "cerebroside", "steroid",
              "bile acid", "lecithin", "plasmalogen", "wax"],
    "bio-9": ["nucleotide", "purine", "pyrimidine", "uric acid", "gout", "allopurinol",
              "adenine", "guanine", "cytosine", "thymine", "uracil", "camp", "second messenger",
              "atp structure"],
    "bio-10": ["double helix", "base pairing", "nucleoside", "chromatin", "histone", "trna",
               "mrna", "rrna", "chargaff", "watson-crick", "nucleic acid"],
    "bio-11": ["dna polymerase", "helicase", "primase", "okazaki", "telomerase", "ligase",
               "replication fork", "semiconservative", "replication", "origin of replication"],
    "bio-12": ["rna polymerase", "promoter", "translation", "ribosome", "codon",
               "genetic code", "splicing", "capping", "polyadenylation", "wobble",
               "initiation factor", "transcription", "sigma factor", "rho factor",
               "spliceosome", "intron", "exon", "peptidyl transferase"],
    "bio-13": ["gene regulation", "operon", "transcription factor", "epigenetic",
               "methylation", "enhancer", "silencer", "alternative splicing",
               "regulation of gene expression"],
    "bio-14": ["cell cycle", "mitosis", "checkpoint", "cyclin", "apoptosis", "p53",
               "oncogene", "tumor suppressor", "bcl-2", "caspase", "s phase", "g1 phase",
               "g2 phase", "cdk"],
    "phys-1": ["erythrocyte", "rbc", "red blood cell", "hemoglobin content", "erythropoiesis",
               "erythropoietin", "anemia", "bone marrow", "platelet", "coagulation",
               "clotting factor", "hemostasis", "thrombus", "thrombocyte", "leukocyte",
               "plasma protein", "fibrinogen", "prothrombin", "hemolysis", "iron absorption",
               "vitamin b12", "folic acid", "blood group", "transfusion", "hemosiderosis",
               "hepcidin", "thrombocytopenia", "purpura", "clotting time"],
    "phys-2": ["sympathetic", "parasympathetic", "autonomic nervous system", "ganglion",
               "acetylcholine", "norepinephrine", "adrenergic", "cholinergic",
               "adrenal medulla", "cranial nerve", "vagus", "pupil", "miosis", "mydriasis",
               "sweat gland", "salivary secretion", "sphincter", "effector organ"],
}


def _score(text_lower, keywords):
    return sum(1 for kw in keywords if kw in text_lower)


def classify_category(text):
    text_lower = text.lower()
    scores = {cat: _score(text_lower, kws) for cat, kws in CATEGORY_KEYWORDS.items()}
    best_cat = max(scores, key=lambda c: scores[c])
    if scores[best_cat] == 0:
        return None, 0
    return best_cat, scores[best_cat]


def classify_chapter(text, category):
    text_lower = text.lower()
    prefix = "bio-" if category == "biochemistry" else "phys-"
    best_id, best_score = None, 0
    for ch_id, kws in CHAPTER_KEYWORDS.items():
        if not ch_id.startswith(prefix):
            continue
        score = _score(text_lower, kws)
        if score > best_score:
            best_id, best_score = ch_id, score
    return best_id, best_score
