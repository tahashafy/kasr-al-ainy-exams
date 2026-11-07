"""Keyword-based category/chapter classifier for Module 103 (BMS 103 — Biomedical
Sciences & Musculoskeletal Sciences). Mirrors classify_102.py's approach exactly: a
reasonable automated first pass built from the two source books' own chapter lists and
standard terminology for each chapter — NOT hand-verified question-by-question.

Chapter structure for Anatomy/Physiology/Histology comes from the department textbook
(103_BMS_Published.pdf)'s own table of contents. The Biochemistry chapter list comes
from Dr. Hisham Esmat's Biochemistry book instead (its own chapter list), since the
department book's Biochemistry section is blank for this academic year and that
category's questions are answered from Hisham's book — see IMPLEMENTATION_REPORT.md.
"""

import re

CATEGORY_KEYWORDS = {
    "m103-anat": [
        "thigh", "femur", "femoral", "quadriceps", "sartorius", "adductor", "gluteal",
        "gluteus", "hamstring", "biceps femoris", "semitendinosus", "semimembranosus",
        "popliteal", "leg", "tibia", "tibial", "fibula", "fibular", "peroneal",
        "gastrocnemius", "soleus", "foot", "ankle", "tarsal", "metatarsal", "phalan",
        "plantar", "dorsiflex", "plantarflex", "inversion", "eversion", "hip joint",
        "knee joint", "patella", "cruciate ligament", "meniscus", "sciatic", "obturator",
        "saphenous", "dermatome", "cutaneous supply", "vein of the lower limb",
        "varicose vein", "limb bud", "limb development", "congenital limb", "retinaculum",
        "inguinal ligament", "lacunar ligament", "femoral ring", "femoral sheath",
        "femoral canal", "adductor canal", "popliteal fossa", "cribriform fascia",
        "iliotibial tract", "piriformis", "obturator internus", "quadratus femoris",
    ],
    "m103-phys": [
        "membrane potential", "resting membrane potential", "action potential",
        "na+-k+ pump", "sodium-potassium pump", "equilibrium potential", "nernst",
        "depolarization", "repolarization", "hyperpolarization", "refractory period",
        "chronaxie", "rheobase", "local response", "all or none", "nerve fiber",
        "nerve conduction", "saltatory conduction", "myelin", "neuromuscular junction",
        "neuromuscular transmission", "end plate potential", "acetylcholine",
        "acetylcholinesterase", "myasthenia gravis", "motor unit", "sliding filament",
        "sarcomere", "sarcoplasmic reticulum", "troponin", "tropomyosin", "actin",
        "myosin", "cross bridge", "muscle twitch", "tetanus", "treppe", "staircase",
        "isometric contraction", "isotonic contraction", "muscle fatigue",
        "slow twitch", "fast twitch", "red muscle fiber", "white muscle fiber",
        "smooth muscle", "excitation contraction coupling", "plasticity of smooth muscle",
        "latch bridge", "pacemaker potential", "passive transport", "active transport",
        "osmosis", "diffusion", "facilitated diffusion", "membrane permeability",
        "icf", "ecf", "intracellular fluid", "extracellular fluid", "extracellular cation",
        "electrotonic potential", "excitability of the nerve", "excitability",
        "does not depolarize the area behind",
    ],
    "m103-hist": [
        "hyaline cartilage", "elastic cartilage", "fibrocartilage", "chondrocyte",
        "chondroblast", "perichondrium", "lacuna", "cell nest", "ground substance",
        "osteocyte", "osteoblast", "osteoclast", "osteon", "haversian", "lamellar bone",
        "spongy bone", "compact bone", "periosteum", "endosteum", "volkmann",
        "bone matrix", "epiphyseal cartilage", "zone of calcification", "intervertebral disc",
        "myofiber", "myofibril", "skeletal muscle fiber", "cardiac muscle fiber",
        "intercalated disc", "purkinje muscle fiber", "triad", "m line", "perimysium",
        "endomysium", "epimysium", "epidermis", "dermis", "papillary dermis",
        "sebaceous gland", "sweat gland", "hair follicle", "melanocyte", "keratinocyte",
        "langerhans cell", "merkel cell", "skin", "integument", "mitotic figures",
    ],
    "m103-bio": [
        "atp", "bioenergetics", "exergonic", "endergonic", "free energy", "thermogenin",
        "uncoupler", "oxidative phosphorylation", "electron transport chain",
        "respiratory chain", "chemiosmotic", "cytochrome", "complex i", "complex iv",
        "citric acid cycle", "tca cycle", "krebs cycle", "isocitrate dehydrogenase",
        "alpha-ketoglutarate", "succinate", "fumarate", "oxaloacetate", "glycolysis",
        "gluconeogenesis", "glycogen", "glycogenolysis", "glycogenesis",
        "hexokinase", "glucokinase", "pyruvate kinase", "pyruvate dehydrogenase",
        "pyruvate carboxylase", "pentose phosphate pathway", "hmp shunt", "nadph",
        "fructose", "galactose", "glut", "glucose transporter", "von gierke",
        "fatty acid", "beta oxidation", "triacylglycerol", "triglyceride", "lipolysis",
        "ketone body", "ketogenesis", "cholesterol", "lipoprotein", "hdl", "ldl",
        "chylomicron", "carnitine", "lipogenesis", "cyclooxygenase", "refsum",
        "amino acid", "transamination", "deamination", "urea cycle", "nitrogen balance",
        "ammonia", "hyperammonemia", "homocysteine", "cystathionine", "phenylketonuria",
        "tetrahydrobiopterin", "glycine", "cysteine", "gaba", "carcinoid",
        "heme", "porphyrin", "bilirubin", "jaundice", "heme synthesis", "lead poisoning",
        "purine", "pyrimidine", "uric acid", "gout", "xanthine oxidase", "lesch-nyhan",
        "hgprt", "ribonucleotide reductase", "vitamin", "thiamine", "pyridoxal",
        "folate", "folic acid", "cobalamin", "vitamin b12", "vitamin d", "vitamin a",
        "vitamin k", "vitamin b1", "vitamin b9", "pellagra", "clotting factor",
        "insulin", "glucagon", "diabetes", "hyperglycemia", "glycation", "nitrogen",
        "gluconeogenic", "low energy bond", "high energy bond", "porphyria",
        "adrenaline", "noradrenaline", "catecholamine", "tyrosine", "phenylpyruvate",
        "niacin", "renal threshold for glucose", "glucose reabsorption",
    ],
}

CHAPTER_KEYWORDS = {
    # --- Anatomy (department textbook) ---------------------------------------------
    "m103-anat-1": ["thigh", "femoral triangle", "femoral sheath", "femoral canal",
                    "femoral ring", "adductor canal", "sartorius", "quadriceps",
                    "rectus femoris", "vastus", "adductor longus", "adductor brevis",
                    "adductor magnus", "gracilis", "pectineal ligament", "lacunar ligament",
                    "inguinal ligament", "cribriform fascia", "lymph node of thigh"],
    "m103-anat-2": ["gluteal region", "gluteus maximus", "gluteus medius", "gluteus minimus",
                    "piriformis", "obturator internus", "quadratus femoris",
                    "superior gluteal nerve", "inferior gluteal nerve", "gemellus",
                    "iliotibial tract", "tensor fasciae latae", "limping gait",
                    "lurching gait", "intramuscular injection"],
    "m103-anat-3": ["biceps femoris", "semitendinosus", "semimembranosus", "hamstring",
                    "back of thigh", "sciatic nerve"],
    "m103-anat-4": ["popliteal fossa", "popliteal artery", "popliteal vein",
                    "popliteus", "roof of the popliteal fossa", "sural communicating"],
    "m103-anat-5": ["leg", "tibialis anterior", "tibialis posterior", "gastrocnemius",
                    "soleus", "fibular artery", "peroneal artery", "anterior tibial nerve",
                    "deep peroneal nerve", "superficial peroneal nerve", "sural nerve",
                    "tibial collateral ligament", "crossed superficially"],
    "m103-anat-6": ["foot", "dorsalis pedis", "plantar nerve", "plantar aponeurosis",
                    "lumbrical", "abductor hallucis", "adductor hallucis",
                    "flexor hallucis", "foot drop", "medial longitudinal arch",
                    "spring ligament", "peroneus tertius", "peroneus longus", "peroneus brevis",
                    "extensor retinaculum", "metatarsal", "phalanx", "little toe", "big toe"],
    "m103-anat-7": ["knee joint", "hip joint", "ankle joint", "patella", "cruciate ligament",
                    "meniscus", "unlocking of the knee", "talocalcaneonavicular",
                    "calcaneocuboid", "talocalcaneal", "talofibular", "inversion of foot",
                    "eversion", "deltoid ligament", "overextension of the hip",
                    "lateral displacement of the patella", "ligamentum teres"],
    "m103-anat-8": ["dermatome", "cutaneous supply", "saphenous nerve", "sural nerve",
                    "skin of the medial side", "skin sensation", "obturator nerve skin"],
    "m103-anat-9": ["saphenous vein", "varicose vein", "vein of the lower limb",
                    "venous drainage of the leg", "popliteal vein"],
    "m103-anat-10": ["limb bud", "limb development", "congenital limb anomaly",
                      "apical ectodermal ridge", "short digits", "limb anomaly"],
    # --- Physiology — Nerve and Muscle (department textbook) ------------------------
    "m103-phys-1": ["cell membrane", "membrane permeability", "na+-k+ pump",
                     "sodium-potassium pump", "osmosis", "diffusion",
                     "facilitated diffusion", "active transport", "passive transport",
                     "membrane transport", "icf", "ecf", "intracellular fluid",
                     "extracellular fluid", "extracellular cation", "main cation"],
    "m103-phys-2": ["resting membrane potential", "action potential", "equilibrium potential",
                     "nernst", "depolarization", "repolarization", "hyperpolarization",
                     "refractory period", "chronaxie", "rheobase", "local response",
                     "nerve fiber", "nerve conduction", "firing level", "excitability",
                     "nerve impulse", "electrotonic potential", "excitability of the nerve",
                     "does not depolarize the area behind"],
    "m103-phys-3": ["neuromuscular junction", "neuromuscular transmission",
                     "end plate potential", "acetylcholine", "acetylcholinesterase",
                     "myasthenia gravis", "motor unit"],
    "m103-phys-4": ["sliding filament", "sarcomere", "sarcoplasmic reticulum", "troponin",
                     "tropomyosin", "actin", "myosin", "cross bridge", "muscle twitch",
                     "tetanus", "treppe", "staircase phenomenon", "isometric contraction",
                     "isotonic contraction", "muscle fatigue", "slow twitch", "fast twitch",
                     "red muscle fiber", "white muscle fiber", "skeletal muscle contraction",
                     "atpase", "m line", "muscle fiber nuclei"],
    "m103-phys-5": ["smooth muscle", "excitation contraction coupling in smooth",
                     "plasticity of smooth muscle", "latch bridge", "pacemaker potential",
                     "smooth muscle contraction", "intravesical pressure", "urinary bladder"],
    # --- Histology (department textbook) --------------------------------------------
    "m103-hist-1": ["hyaline cartilage", "elastic cartilage", "fibrocartilage",
                     "chondrocyte", "chondroblast", "perichondrium", "cell nest",
                     "lacuna", "ground substance", "epiphyseal cartilage",
                     "zone of calcification", "intervertebral disc"],
    "m103-hist-2": ["osteocyte", "osteoblast", "osteoclast", "osteon",
                     "haversian system", "lamellar bone", "spongy bone", "compact bone",
                     "periosteum", "endosteum", "volkmann canal", "bone matrix",
                     "bone cell", "central canal"],
    "m103-hist-3": ["myofiber", "myofibril", "skeletal muscle fiber", "cardiac muscle fiber",
                     "intercalated disc", "purkinje muscle fiber", "triad tubular system",
                     "perimysium", "endomysium", "epimysium", "striation",
                     "nuclei of the skeletal muscle"],
    "m103-hist-4": ["epidermis", "dermis", "papillary dermis", "sebaceous gland",
                     "sweat gland", "hair follicle", "melanocyte", "keratinocyte",
                     "langerhans cell", "merkel cell", "mitotic figures in the epidermis",
                     "vitally stained", "tennis-racquet", "mitotic figures"],
    # --- Biochemistry (Dr. Hisham Esmat's Biochemistry book) ------------------------
    "m103-bio-1": ["bioenergetics", "exergonic", "endergonic", "free energy",
                    "thermogenin", "uncoupler", "oxidative phosphorylation",
                    "electron transport chain", "respiratory chain", "chemiosmotic",
                    "cytochrome", "complex i", "complex iv", "proton gradient",
                    "gas poisoning", "cyanide", "carbon monoxide", "aspirin poisoning",
                    "hyperthermia from aspirin", "low energy bond", "high energy bond"],
    "m103-bio-2": ["citric acid cycle", "tca cycle", "krebs cycle", "isocitrate dehydrogenase",
                    "alpha-ketoglutarate dehydrogenase", "succinate dehydrogenase",
                    "fumarate", "oxaloacetate", "citrate synthase", "fluoroacetate",
                    "substrate-level phosphorylation", "regulation of tca cycle"],
    "m103-bio-3": ["glycolysis", "gluconeogenesis", "glycogen", "glycogenolysis",
                    "glycogenesis", "hexokinase", "glucokinase", "pyruvate kinase",
                    "pyruvate dehydrogenase", "pyruvate carboxylase",
                    "pentose phosphate pathway", "hmp shunt", "nadph",
                    "fructose", "galactose", "glucose transporter", "glut",
                    "von gierke", "fructose-1,6-bisphosphatase", "hereditary fructose intolerance",
                    "galactosemia", "blood glucose", "fluoride blood sample", "glucosuria",
                    "advanced glycation", "gluconeogenic", "renal threshold for glucose",
                    "glucose reabsorption"],
    "m103-bio-4": ["fatty acid", "beta oxidation", "triacylglycerol", "triglyceride",
                    "lipolysis", "ketone body", "ketogenesis", "cholesterol",
                    "lipoprotein", "hdl", "ldl", "chylomicron", "carnitine",
                    "lipogenesis", "cyclooxygenase", "refsum", "depot fat",
                    "cholesterol synthesis", "familial hypercholesterolemia",
                    "lipoprotein(a)", "coronary heart disease", "acyl-coa dehydrogenase",
                    "7a-hydroxylase", "bile acid"],
    "m103-bio-5": ["nitrogen balance", "positive nitrogen balance", "protein turnover",
                    "urea cycle", "ammonia", "hyperammonemia", "rate limiting enzyme of urea",
                    "liver cirrhosis", "blood clotting factor"],
    "m103-bio-6": ["amino acid", "transamination", "deamination", "homocysteine",
                    "cystathionine", "phenylketonuria", "tetrahydrobiopterin",
                    "glycine", "cysteine", "gaba", "carcinoid", "argentaffin",
                    "l-amino acid", "amino acid degradation", "essential amino acid",
                    "adrenaline", "noradrenaline", "catecholamine", "tyrosine",
                    "phenylpyruvate"],
    "m103-bio-7": ["well fed state", "fasting", "metabolic integration", "insulin",
                    "glucagon", "diabetes mellitus", "hyperglycemia", "c-peptide",
                    "glycation end product", "aldose reductase", "vascular complication",
                    "fed state"],
    "m103-bio-8": ["heme", "porphyrin", "porphyria", "bilirubin", "jaundice", "heme synthesis",
                    "lead poisoning", "conjugated bilirubin", "unconjugated bilirubin",
                    "sterobilin", "acholuric jaundice", "pyridoxal phosphate heme"],
    "m103-bio-9": ["purine", "pyrimidine", "uric acid", "gout", "xanthine oxidase",
                    "lesch-nyhan", "hgprt", "ribonucleotide reductase", "hyperuricemia"],
    "m103-bio-10": ["vitamin", "thiamine", "pyridoxal", "folate", "folic acid",
                     "cobalamin", "vitamin b12", "vitamin d", "vitamin a", "vitamin k",
                     "vitamin b1", "vitamin b9", "pellagra", "folate trap",
                     "calcium absorption", "bone calcification", "obstructive jaundice vitamin",
                     "antibiotic vitamin deficiency", "niacin"],
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
    prefix = (category or "") + "-"
    best_id, best_score = None, 0
    for ch_id, kws in CHAPTER_KEYWORDS.items():
        if not ch_id.startswith(prefix):
            continue
        score = _score(text_lower, kws)
        if score > best_score:
            best_id, best_score = ch_id, score
    return best_id, best_score
