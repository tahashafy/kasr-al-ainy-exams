// Loads and queries the static question bank / chapter metadata exported by
// scripts/build_question_bank.py. Kept free of DOM code so it is reusable.

let _questions = null;
let _chapters = null;
let _sources = null;

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export async function loadData() {
  if (_questions && _chapters && _sources) return;
  [_questions, _chapters, _sources] = await Promise.all([
    loadJSON("data/questions.json"),
    loadJSON("data/chapters.json"),
    loadJSON("data/sources.json"),
  ]);
}

/** List of module ids that actually have chapter/category taxonomy loaded (i.e. are
 * "lit up", not "Coming Soon"). */
export function getAvailableModuleIds() {
  return Object.keys(_chapters);
}

export function getChapters(moduleId) {
  return _chapters[moduleId];
}

export function getSources() {
  return _sources;
}

export function getCategoryList(moduleId) {
  return _chapters[moduleId].categories.map((c) => ({ id: c.id, name: c.name }));
}

export function getChaptersForCategories(moduleId, categoryIds) {
  return _chapters[moduleId].categories
    .filter((c) => categoryIds.includes(c.id))
    .flatMap((c) => c.chapters.map((ch) => ({ ...ch, categoryId: c.id, categoryName: c.name })));
}

export function getAllQuestions() {
  return _questions;
}

/**
 * Distinct historical exam sources ("papers"), derived from the question
 * bank itself plus the per-batch metadata in sources.json (so it always
 * reflects what was actually imported, never a hand-maintained/possibly-
 * stale list). Each paper reports a Ready/Review breakdown instead of a
 * single verified/unverified flag, since every question in a Book Verified
 * key has a recommended answer — "Review" means "needs a faculty scoring
 * decision", not "no answer".
 * @param {string} [moduleId] - when given, restricts to that module's own
 *   papers (used by the library/exam-setup screens); omitted, returns every
 *   module's papers together (used by the About page's full sources list).
 */
export function getExamSources(moduleId) {
  const map = new Map();
  for (const q of _questions) {
    if (moduleId && q.module !== moduleId) continue;
    if (!map.has(q.sourceExam)) {
      map.set(q.sourceExam, {
        label: q.sourceExam,
        module: q.module,
        academicYear: q.academicYear,
        examDate: q.examDate,
        originalSourceFile: q.originalSourceFile,
        count: 0,
        readyCount: 0,
        reviewCount: 0,
      });
    }
    const entry = map.get(q.sourceExam);
    entry.count++;
    if (q.gradingStatus === "Ready") entry.readyCount++;
    else entry.reviewCount++;
  }
  return Array.from(map.values()).sort(
    (a, b) => a.module.localeCompare(b.module) || (a.academicYear || "").localeCompare(b.academicYear || "")
  );
}

/**
 * Coverage-group membership used by the Advanced filters in the exam
 * builder. "Book Supported" groups Direct/Calculated/Inferred per the
 * spec, while each question's original coverageLabel is preserved
 * separately for the detailed per-question record.
 */
export function coverageGroupOf(q) {
  return q.coverageGroup || "undetermined";
}

/**
 * Core filter used by both the "eligible count" preview and the actual
 * exam draw. Grading status (Ready/Review) is deliberately NOT a pool
 * filter here — Review questions are offered for practice like any other
 * question and are only excluded from the *scoring* denominator at grading
 * time (see scoring.js). coverageGroup is the opt-in "Advanced filters"
 * control for narrowing by book coverage.
 * @param {{
 *   module?: string, categories?: string[], chapters?: string[], sourceExam?: string|null,
 *   coverageGroup?: ('book-supported'|'partial'|'not-covered'|'undetermined')|null
 * }} criteria
 */
export function filterQuestions(criteria = {}) {
  const { module, categories, chapters, sourceExam, coverageGroup } = criteria;
  return _questions.filter((q) => {
    if (module && q.module !== module) return false;
    if (categories && categories.length && !categories.includes(q.category)) return false;
    if (chapters && chapters.length && !chapters.includes(q.chapter)) return false;
    if (sourceExam && q.sourceExam !== sourceExam) return false;
    if (coverageGroup && coverageGroupOf(q) !== coverageGroup) return false;
    return true;
  });
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Draw questions for an exam attempt given builder criteria.
 * @param {object} criteria same shape as filterQuestions, plus:
 *   - mode: 'all' | 'count'
 *   - count: number (used when mode === 'count')
 *   - shuffle: boolean
 *   - preserveOrderForSingleExam: boolean (true when a single historical
 *     paper is selected, to preserve original question order)
 */
export function drawExamQuestions(criteria = {}) {
  let pool = filterQuestions(criteria);
  const isSinglePaper = !!criteria.sourceExam;
  if (isSinglePaper) {
    pool = pool.slice().sort((a, b) => a.originalQuestionNumber - b.originalQuestionNumber);
  } else if (criteria.shuffle !== false) {
    pool = shuffle(pool);
  }
  if (criteria.mode === "count" && criteria.count && criteria.count < pool.length) {
    pool = pool.slice(0, criteria.count);
  }
  return pool;
}

export function getQuestionById(id) {
  return _questions.find((q) => q.id === id) || null;
}

/** Chapter ids are unique across every module's taxonomy (e.g. "hist-1" vs "bio-1"), so
 * this can resolve a chapter without the caller having to know/pass which module it
 * belongs to. */
export function getChapterMeta(chapterId) {
  for (const moduleChapters of Object.values(_chapters)) {
    for (const cat of moduleChapters.categories) {
      const ch = cat.chapters.find((c) => c.id === chapterId);
      if (ch) return { ...ch, categoryId: cat.id, categoryName: cat.name };
    }
  }
  return null;
}

export function getCategoryMeta(categoryId) {
  for (const moduleChapters of Object.values(_chapters)) {
    const cat = moduleChapters.categories.find((c) => c.id === categoryId);
    if (cat) return { id: cat.id, name: cat.name };
  }
  return null;
}
