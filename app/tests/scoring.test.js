import test from "node:test";
import assert from "node:assert/strict";
import { scoreAttempt, countEligiblePoolQuestions, submissionSummary } from "../js/scoring.js";

function vq(id, correct, overrides = {}) {
  return {
    id,
    reviewStatus: "verified",
    syllabusStatus: "in_syllabus",
    correctOptionId: correct,
    ...overrides,
  };
}
function nq(id, overrides = {}) {
  return {
    id,
    reviewStatus: "needs_review",
    syllabusStatus: "needs_review",
    correctOptionId: null,
    ...overrides,
  };
}

test("all questions answered correctly", () => {
  const qs = [vq("q1", "a"), vq("q2", "b"), vq("q3", "c")];
  const r = {
    q1: { selected: "a" },
    q2: { selected: "b" },
    q3: { selected: "c" },
  };
  const res = scoreAttempt(qs, r);
  assert.equal(res.correct, 3);
  assert.equal(res.incorrect, 0);
  assert.equal(res.eligible, 3);
  assert.equal(res.scorePercentage, 100);
  assert.equal(res.isProvisional, false);
});

test("all questions answered incorrectly", () => {
  const qs = [vq("q1", "a"), vq("q2", "b")];
  const r = { q1: { selected: "b" }, q2: { selected: "a" } };
  const res = scoreAttempt(qs, r);
  assert.equal(res.correct, 0);
  assert.equal(res.incorrect, 2);
  assert.equal(res.scorePercentage, 0);
});

test("mixture of answered and unanswered — unanswered counts as incorrect", () => {
  const qs = [vq("q1", "a"), vq("q2", "b"), vq("q3", "c"), vq("q4", "d")];
  const r = {
    q1: { selected: "a" }, // correct
    q2: { selected: "a" }, // incorrect
    q3: { selected: null }, // unanswered
    // q4 missing entirely from responses -> treated as unanswered
  };
  const res = scoreAttempt(qs, r);
  assert.equal(res.correct, 1);
  assert.equal(res.incorrect, 3);
  assert.equal(res.unanswered, 2);
  assert.equal(res.eligible, 4);
  assert.equal(res.scorePercentage, 25);
});

test("example from spec: 20 Q, 2 out-of-syllabus abstained -> denominator 18", () => {
  const qs = [];
  for (let i = 1; i <= 18; i++) qs.push(vq("q" + i, "a"));
  qs.push(vq("oos1", "a", { syllabusStatus: "out_of_syllabus" }));
  qs.push(vq("oos2", "a", { syllabusStatus: "out_of_syllabus" }));
  const r = {};
  for (let i = 1; i <= 18; i++) r["q" + i] = { selected: "a" };
  r.oos1 = { selected: "abstain" };
  r.oos2 = { selected: "abstain" };
  const res = scoreAttempt(qs, r);
  assert.equal(res.eligible, 18);
  assert.equal(res.correct, 18);
  assert.equal(res.abstained, 2);
  assert.equal(res.scorePercentage, 100);
});

test("one or more deliberately abstained questions excluded from denominator", () => {
  const qs = [vq("q1", "a"), vq("q2", "b", { syllabusStatus: "out_of_syllabus" })];
  const r = { q1: { selected: "a" }, q2: { selected: "abstain" } };
  const res = scoreAttempt(qs, r);
  assert.equal(res.eligible, 1);
  assert.equal(res.abstained, 1);
  assert.equal(res.scorePercentage, 100);
});

test("answering an out-of-syllabus question instead of abstaining counts it normally", () => {
  const qs = [vq("q1", "a", { syllabusStatus: "out_of_syllabus" })];
  const r = { q1: { selected: "a" } };
  const res = scoreAttempt(qs, r);
  assert.equal(res.eligible, 1);
  assert.equal(res.correct, 1);
});

test("zero eligible questions -> scorePercentage is null, not NaN/Infinity", () => {
  const qs = [nq("n1"), nq("n2")];
  const r = { n1: { selected: "abstain" }, n2: { selected: null } };
  const res = scoreAttempt(qs, r);
  assert.equal(res.eligible, 0);
  assert.equal(res.scorePercentage, null);
  assert.equal(res.isProvisional, true);
});

test("questions with unverified answer keys are excluded from grading and flag attempt provisional", () => {
  const qs = [vq("q1", "a"), nq("n1")];
  const r = { q1: { selected: "a" }, n1: { selected: "a" } };
  const res = scoreAttempt(qs, r);
  assert.equal(res.eligible, 1);
  assert.equal(res.excludedUnverified, 1);
  assert.equal(res.isProvisional, true);
  assert.equal(res.scorePercentage, 100);
});

test("duplicate question ids are only counted once", () => {
  const qs = [vq("q1", "a"), vq("q1", "a")];
  const r = { q1: { selected: "a" } };
  const res = scoreAttempt(qs, r);
  assert.equal(res.totalQuestions, 1);
  assert.equal(res.eligible, 1);
});

test("missing question id is skipped defensively", () => {
  const qs = [vq("q1", "a"), { id: null, reviewStatus: "verified", correctOptionId: "a" }];
  const r = { q1: { selected: "a" } };
  const res = scoreAttempt(qs, r);
  assert.equal(res.totalQuestions, 1);
});

test("a paper with no available eligible questions reports 'no graded questions' state", () => {
  const res = scoreAttempt([], {});
  assert.equal(res.totalQuestions, 0);
  assert.equal(res.eligible, 0);
  assert.equal(res.scorePercentage, null);
  assert.equal(res.isProvisional, false);
});

test("countEligiblePoolQuestions respects includeNeedsReview toggle", () => {
  const pool = [vq("q1", "a"), vq("q2", "a"), nq("n1")];
  assert.equal(countEligiblePoolQuestions(pool, { includeNeedsReview: false }), 2);
  assert.equal(countEligiblePoolQuestions(pool, { includeNeedsReview: true }), 3);
});

test("submissionSummary counts answered/unanswered/marked-for-review", () => {
  const qs = [vq("q1", "a"), vq("q2", "a"), vq("q3", "a")];
  const r = {
    q1: { selected: "a", markedForReview: true },
    q2: { selected: null },
  };
  const summary = submissionSummary(qs, r);
  assert.equal(summary.total, 3);
  assert.equal(summary.answered, 1);
  assert.equal(summary.unanswered, 2);
  assert.equal(summary.markedForReview, 1);
});

test("marking a question for review does not affect its grading", () => {
  const qs = [vq("q1", "a")];
  const r = { q1: { selected: "a", markedForReview: true } };
  const res = scoreAttempt(qs, r);
  assert.equal(res.correct, 1);
  assert.equal(res.markedForReview, 1);
});
