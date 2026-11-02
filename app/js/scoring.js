// Pure, dependency-free scoring engine for Module 101 MCQ attempts.
// Kept isolated from UI/presentation code so it can be unit tested directly
// with Node's built-in test runner (see /tests/scoring.test.js) and reused
// identically in the browser.

/**
 * @typedef {Object} ScoringQuestion
 * @property {string} id
 * @property {('verified'|'needs_review')} reviewStatus
 * @property {('in_syllabus'|'out_of_syllabus'|'needs_review')} syllabusStatus
 * @property {string|null} correctOptionId - 'a'|'b'|'c'|'d'|null when unverified
 */

/**
 * @typedef {Object} ResponseEntry
 * @property {('a'|'b'|'c'|'d'|'abstain'|null)} selected
 * @property {boolean} [markedForReview]
 */

/**
 * Score a completed (or in-progress) attempt.
 *
 * Rules (see Project spec sections 9 & 10):
 *  - Questions whose reviewStatus is not 'verified' are never gradable:
 *    they are excluded from the denominator entirely and the attempt is
 *    flagged provisional. This covers imported historical questions whose
 *    answer key / syllabus status has not yet been confirmed against the
 *    current textbook.
 *  - Among gradable (verified) questions:
 *      - selecting "I choose not to answer this question" (abstain) removes
 *        the question from the denominator. Every question offers this
 *        choice (examTake.js renders it unconditionally) — a student who
 *        isn't confident, including on a question the book doesn't cover,
 *        can abstain rather than guess, with no effect on their score.
 *      - an unanswered verified question counts as incorrect in the
 *        eligible denominator (explicit default scoring policy).
 *      - answered verified questions are graded correct/incorrect normally.
 *  - If there are zero eligible (gradable, non-abstained) questions the
 *    score percentage is null ("No graded questions"), never a division by
 *    zero.
 *
 * @param {ScoringQuestion[]} questions
 * @param {Record<string, ResponseEntry>} responses keyed by question id
 * @returns {{
 *   totalQuestions:number, correct:number, incorrect:number, unanswered:number,
 *   abstained:number, excludedUnverified:number, eligible:number,
 *   scorePercentage: number|null, isProvisional: boolean, markedForReview:number
 * }}
 */
export function scoreAttempt(questions, responses) {
  // Guard against duplicate or missing-id questions corrupting the count.
  const seen = new Set();
  const uniqueQuestions = [];
  for (const q of questions || []) {
    if (!q || !q.id || seen.has(q.id)) continue;
    seen.add(q.id);
    uniqueQuestions.push(q);
  }

  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  let abstained = 0;
  let excludedUnverified = 0;
  let markedForReview = 0;

  for (const q of uniqueQuestions) {
    const r = (responses && responses[q.id]) || { selected: null };
    if (r.markedForReview) markedForReview++;

    if (q.reviewStatus !== "verified" || !q.correctOptionId) {
      excludedUnverified++;
      continue;
    }

    if (r.selected === "abstain") {
      abstained++;
      continue;
    }

    if (r.selected == null) {
      unanswered++;
      incorrect++; // unanswered verified questions count as incorrect
      continue;
    }

    if (r.selected === q.correctOptionId) {
      correct++;
    } else {
      incorrect++;
    }
  }

  const eligible = correct + incorrect;
  const scorePercentage = eligible > 0 ? (correct / eligible) * 100 : null;

  return {
    totalQuestions: uniqueQuestions.length,
    correct,
    incorrect,
    unanswered,
    abstained,
    excludedUnverified,
    eligible,
    scorePercentage,
    isProvisional: excludedUnverified > 0,
    markedForReview,
  };
}

/**
 * Compute the count of questions eligible to be drawn into an exam given
 * the student's builder selections, without yet starting an attempt.
 * @param {ScoringQuestion[]} pool
 * @param {{includeNeedsReview?: boolean}} opts
 */
export function countEligiblePoolQuestions(pool, opts = {}) {
  const includeNeedsReview = !!opts.includeNeedsReview;
  return (pool || []).filter((q) => includeNeedsReview || q.reviewStatus === "verified").length;
}

/**
 * Determine the submission summary counts shown on the confirmation modal.
 * @param {ScoringQuestion[]} questions
 * @param {Record<string, ResponseEntry>} responses
 */
export function submissionSummary(questions, responses) {
  let answered = 0;
  let unanswered = 0;
  let markedForReview = 0;
  for (const q of questions || []) {
    const r = (responses && responses[q.id]) || { selected: null };
    if (r.selected != null) answered++;
    else unanswered++;
    if (r.markedForReview) markedForReview++;
  }
  return {
    total: (questions || []).length,
    answered,
    unanswered,
    markedForReview,
  };
}
