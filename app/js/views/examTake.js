import { getQuestionById, getChapterMeta } from "../data.js";
import { escapeHtml, navigate } from "../router.js";
import { getInProgress, saveInProgress, clearInProgress, saveAttempt, toggleBookmark, isBookmarked, getSettings, saveSettings } from "../store.js";
import { scoreAttempt, submissionSummary } from "../scoring.js";
import { t } from "../i18n.js";

let timerInterval = null;

export function renderExamTake(root) {
  const attempt = getInProgress();
  if (!attempt || !attempt.questionIds || !attempt.questionIds.length) {
    root.innerHTML = `
      <div class="container-narrow">
        <div class="empty-state card">
          <div class="icon">🗒️</div>
          <h2>${t("take.noExamTitle")}</h2>
          <p>${t("take.noExamDesc")}</p>
          <a class="btn btn-primary" href="#/exams" data-nav-link>${t("take.buildExam")}</a>
        </div>
      </div>`;
    return;
  }
  paint(root, attempt);
}

function questionsOf(attempt) {
  return attempt.questionIds.map((id) => getQuestionById(id)).filter(Boolean);
}

function paint(root, attempt) {
  clearInterval(timerInterval);
  const questions = questionsOf(attempt);
  const total = questions.length;
  const idx = Math.min(attempt.currentIndex, total - 1);
  const q = questions[idx];
  const response = attempt.responses[q.id] || { selected: null, markedForReview: false };
  const chapterMeta = q.chapter ? getChapterMeta(q.chapter) : null;
  const showMeta = !!getSettings().showQuestionMeta;

  const answeredCount = Object.values(attempt.responses).filter((r) => r.selected != null).length;

  root.innerHTML = `
    <div class="container">
      <div class="exam-topbar">
        <div>
          <strong>Question ${idx + 1} of ${total}</strong>
          <span style="color:var(--text-muted);font-size:13px;margin-left:10px;">${answeredCount} ${t("take.answered")}</span>
        </div>
        <div style="display:flex;align-items:center;gap:16px;">
          ${attempt.timerMode === "timed" ? `<span class="timer" id="exam-timer">--:--</span>` : `<span class="badge badge-gray">${t("take.untimed")}</span>`}
          <button class="btn btn-secondary btn-sm" id="exit-exam-btn" type="button">${t("take.saveExit")}</button>
        </div>
      </div>

      <div class="exam-shell">
        <div>
          <div class="card question-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
              <div class="qnum">QUESTION ${idx + 1}
                ${q.category ? `<span class="badge badge-gray" style="margin-left:8px;">${escapeHtml(chapterMeta ? chapterMeta.categoryName : q.category)}</span>` : ""}
              </div>
              <div style="display:flex;gap:8px;">
                ${hasQuestionMeta(q) ? `<button class="btn btn-ghost btn-sm" id="toggle-meta-btn" type="button" aria-pressed="${showMeta}" title="${t("take.showMetaHint")}">${showMeta ? t("take.hideMeta") : t("take.showMeta")}</button>` : ""}
                <button class="btn btn-ghost btn-sm" id="bookmark-btn" type="button" aria-pressed="${isBookmarked(q.id)}" title="${t("take.bookmarkHint")}">
                  ${isBookmarked(q.id) ? t("take.bookmarked") : t("take.bookmark")}
                </button>
              </div>
            </div>
            ${showMeta && hasQuestionMeta(q) ? renderQuestionMetaRow(q) : ""}
            ${q.coverageLabel === "Not covered" ? `<p class="alert alert-amber" style="font-size:12.5px;font-weight:600;margin:10px 0;" dir="ltr">⚠️ ${t("take.noticeNotCovered")}</p>` : ""}
            <p class="question-text" dir="ltr">${escapeHtml(q.text)}</p>
            ${q.hasFigure && q.figures && q.figures.length ? q.figures.map((src) => `<img src="${escapeHtml(src)}" alt="${t("take.figureAlt")}" style="max-width:100%;border:1px solid var(--border);border-radius:8px;margin:10px 0;" />`).join("") : ""}
            <div class="options" role="radiogroup" aria-label="${t("take.answerOptionsAria")}" dir="ltr">
              ${q.options
                .map((opt) => {
                  const isSelected = response.selected === opt.id;
                  let cls = "option" + (isSelected ? " selected" : "");
                  let revealClasses = "";
                  const showFeedback = response.selected != null && (attempt.explanationMode === "immediate" || response.revealed);
                  if (showFeedback && q.correctOptionId) {
                    if (opt.id === q.correctOptionId) revealClasses = " correct";
                    else if (isSelected) revealClasses = " incorrect";
                  }
                  return `<div class="${cls}${revealClasses}" data-option="${opt.id}" role="radio" aria-checked="${isSelected}" tabindex="0">
                    <span class="option-letter">${opt.id.toUpperCase()}</span>
                    <span>${escapeHtml(opt.text)}</span>
                  </div>`;
                })
                .join("")}
              <div class="option abstain${response.selected === "abstain" ? " selected" : ""}" data-option="abstain" role="radio" aria-checked="${response.selected === "abstain"}" tabindex="0">
                <span class="option-letter">—</span>
                <span>${t("take.abstainOption")}</span>
              </div>
            </div>
            ${
              response.selected != null && (attempt.explanationMode === "immediate" || response.revealed)
                ? renderExplanation(q, chapterMeta)
                : ""
            }
          </div>

          <div class="exam-footer-nav">
            <button class="btn btn-secondary" id="prev-btn" type="button" ${idx === 0 ? "disabled" : ""}>${t("take.prev")}</button>
            <button class="btn btn-secondary" id="mark-review-btn" type="button" title="${t("take.markReviewHint")}">${response.markedForReview ? t("take.unmarkReview") : t("take.markReview")}</button>
            ${idx < total - 1
              ? `<button class="btn btn-primary" id="next-btn" type="button">${t("take.next")}</button>`
              : `<button class="btn btn-primary" id="submit-btn" type="button">${t("take.submit")}</button>`}
          </div>
        </div>

        <aside class="card sidebar-card">
          <h3 style="font-size:14px;">${t("take.navigatorTitle")}</h3>
          <div class="qgrid">
            ${questions
              .map((qq, i) => {
                const r = attempt.responses[qq.id];
                const cls = ["", i === idx ? "current" : "", r && r.selected != null ? "answered" : "", r && r.markedForReview ? "marked" : ""].join(" ");
                return `<button type="button" class="${cls}" data-goto="${i}" title="Question ${i + 1}">${i + 1}</button>`;
              })
              .join("")}
          </div>
          <div class="legend">
            <span><span class="legend-dot" style="background:var(--teal-50);border:1.5px solid var(--teal-400)"></span>${t("take.legendAnswered")}</span>
            <span><span class="legend-dot" style="background:var(--amber-500)"></span>${t("take.legendMarked")}</span>
            <span><span class="legend-dot" style="background:var(--surface);border:1.5px solid var(--navy-800)"></span>${t("take.legendCurrent")}</span>
          </div>
          <p style="font-size:11.5px;color:var(--text-faint);margin-top:8px;">${t("take.markReviewScopeNote")}</p>
          <button class="btn btn-primary btn-block" id="submit-sidebar-btn" type="button" style="margin-top:18px;">${t("take.submit")}</button>
        </aside>
      </div>
    </div>
  `;

  // Option selection
  root.querySelectorAll("[data-option]").forEach((el) => {
    const activate = () => {
      const val = el.dataset.option;
      const r = attempt.responses[q.id] || {};
      r.selected = val;
      if (attempt.explanationMode === "immediate") r.revealed = true;
      attempt.responses[q.id] = r;
      saveInProgress(attempt);
      paint(root, attempt);
    };
    el.addEventListener("click", activate);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  root.querySelector("#bookmark-btn").addEventListener("click", () => {
    toggleBookmark(q.id);
    paint(root, attempt);
  });
  const toggleMetaBtn = root.querySelector("#toggle-meta-btn");
  if (toggleMetaBtn) toggleMetaBtn.addEventListener("click", () => {
    saveSettings({ showQuestionMeta: !getSettings().showQuestionMeta });
    paint(root, attempt);
  });
  const markBtn = root.querySelector("#mark-review-btn");
  markBtn.addEventListener("click", () => {
    const r = attempt.responses[q.id] || { selected: null };
    r.markedForReview = !r.markedForReview;
    attempt.responses[q.id] = r;
    saveInProgress(attempt);
    paint(root, attempt);
  });

  const prevBtn = root.querySelector("#prev-btn");
  if (prevBtn) prevBtn.addEventListener("click", () => goTo(root, attempt, idx - 1));
  const nextBtn = root.querySelector("#next-btn");
  if (nextBtn) nextBtn.addEventListener("click", () => goTo(root, attempt, idx + 1));
  root.querySelectorAll("[data-goto]").forEach((btn) =>
    btn.addEventListener("click", () => goTo(root, attempt, parseInt(btn.dataset.goto, 10)))
  );

  const submitBtn = root.querySelector("#submit-btn");
  if (submitBtn) submitBtn.addEventListener("click", () => showSubmitConfirm(root, attempt));
  root.querySelector("#submit-sidebar-btn").addEventListener("click", () => showSubmitConfirm(root, attempt));

  root.querySelector("#exit-exam-btn").addEventListener("click", () => {
    saveInProgress(attempt);
    const firstQ = getQuestionById(attempt.questionIds[0]);
    navigate(`/module/${firstQ?.module || "101"}`);
  });

  // Keyboard navigation: left/right arrows, 1-5/a-e for options
  const keyHandler = (e) => {
    if (e.target.matches("input,select,textarea")) return;
    if (e.key === "ArrowRight" && idx < total - 1) goTo(root, attempt, idx + 1);
    if (e.key === "ArrowLeft" && idx > 0) goTo(root, attempt, idx - 1);
  };
  document.addEventListener("keydown", keyHandler, { once: true });

  // Timer
  if (attempt.timerMode === "timed") {
    const timerEl = () => root.querySelector("#exam-timer");
    const tick = () => {
      const remainingMs = attempt.timerEndsAt - Date.now();
      const el = timerEl();
      if (!el) return;
      if (remainingMs <= 0) {
        clearInterval(timerInterval);
        el.textContent = "00:00";
        autoSubmit(root, attempt);
        return;
      }
      const totalSec = Math.floor(remainingMs / 1000);
      const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
      const s = String(totalSec % 60).padStart(2, "0");
      el.textContent = `${m}:${s}`;
      el.classList.toggle("low-time", totalSec < 120);
    };
    tick();
    timerInterval = setInterval(tick, 1000);
  }
}

/** Whether this question carries any source-identifier metadata (question
 * code, program/source tags, historical batch mentions) worth a toggle —
 * modules without this data (101/102) simply never show the control. */
export function hasQuestionMeta(q) {
  return !!(q.questionCode || (q.tags && q.tags.length) || (q.historicalBatches && q.historicalBatches.length));
}

/** Renders the identifiers printed beside this question in its original
 * source (code, program/source tags like IPKA/COMMON/DEPT BOOK, and which
 * exam batches it's on record as having appeared in) — shown only when the
 * student has switched the "Show question info" toggle on. */
export function renderQuestionMetaRow(q) {
  const parts = [];
  if (q.questionCode) parts.push(`<span class="badge badge-gray" dir="ltr">${escapeHtml(q.questionCode)}</span>`);
  for (const tag of q.tags || []) parts.push(`<span class="badge badge-teal" dir="ltr">${escapeHtml(tag)}</span>`);
  if (q.historicalBatches && q.historicalBatches.length) {
    parts.push(
      `<span class="badge badge-gray" dir="ltr">${t("take.metaBatches")} ${q.historicalBatches.map(escapeHtml).join(" · ")}</span>`
    );
  }
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;">${parts.join("")}</div>`;
}

export function coverageLabelText(label) {
  const key = {
    Direct: "take.covDirect",
    Calculated: "take.covCalculated",
    Inferred: "take.covInferred",
    Partial: "take.covPartial",
    "Not covered": "take.noticeNotCovered",
  }[label];
  return key ? t(key) : label;
}
// Kept for any external callers expecting the old export name/shape.
export const COVERAGE_LABEL_TEXT = new Proxy({}, { get: (_, label) => coverageLabelText(label) });

export function buildNotices(q) {
  const notices = [];
  if (q.conditionalAlternatives && q.conditionalAlternatives.length) {
    notices.push(t("take.noticeMultiple"));
  }
  if (q.coverageLabel === "Partial") {
    notices.push(t("take.noticePartial"));
  } else if (q.coverageLabel === "Not covered") {
    notices.push(t("take.noticeNotCovered"));
  }
  if (q.gradingStatus === "Review") {
    notices.push(t("take.noticePracticeOnly"));
  }
  return notices;
}

function renderExplanation(q, chapterMeta) {
  const chapterLine = chapterMeta
    ? `${escapeHtml(chapterMeta.categoryName)} — Chapter ${escapeHtml(chapterMeta.number)}: ${escapeHtml(chapterMeta.title)}`
    : "Chapter mapping pending review";
  const letter = q.correctOptionId ? q.correctOptionId.toUpperCase() : "—";
  const answerOpt = q.options.find((o) => o.id === q.correctOptionId);
  const notices = buildNotices(q);
  const pages = (q.bookPages || []).join(", ");

  return `
    <div class="alert alert-teal" style="margin-top:18px;">
      <strong>${t("take.recommendedAnswer")}: <span dir="ltr">${letter}${answerOpt ? `. ${escapeHtml(answerOpt.text)}` : ""}</span></strong>
      <p style="margin:8px 0 0;color:inherit;" dir="ltr">${escapeHtml(q.evidence || "No book evidence recorded.")}</p>
      ${notices.length ? `<p style="margin:8px 0 0;font-size:12.5px;font-weight:600;">${notices.map(escapeHtml).join(" · ")}</p>` : ""}
      <p style="margin:8px 0 0;font-size:12.5px;opacity:0.85;">${chapterLine}${q.sourceExam ? ` · Source: ${escapeHtml(q.sourceExam)}` : ""}</p>
      <details style="margin-top:10px;">
        <summary style="cursor:pointer;font-weight:600;font-size:13px;">${t("take.viewSourceDetails")}</summary>
        <div style="margin-top:8px;font-size:13px;line-height:1.5;">
          <p><strong>${t("take.bookCoverage")}:</strong> ${escapeHtml(coverageLabelText(q.coverageLabel))}</p>
          ${pages ? `<p><strong>${t("take.bookPages")}${q.bookPages.length > 1 ? "s" : ""}:</strong> <span dir="ltr">${escapeHtml(pages)}</span> ${t("take.pdfPageNote")}</p>` : ""}
          ${q.conditionalAlternatives && q.conditionalAlternatives.length ? `<p><strong>${t("take.conditionalAlt")}:</strong> <span dir="ltr">${q.conditionalAlternatives.map(escapeHtml).join(" / ")}</span></p>` : ""}
          ${q.reviewNote ? `<p><strong>${t("take.reasoningNote")}:</strong> <span dir="ltr">${escapeHtml(q.reviewNote)}</span></p>` : ""}
          <p><strong>${t("take.gradingStatus")}:</strong> ${q.gradingStatus === "Ready" ? t("take.gradingReady") : t("take.gradingReview")} ${t("take.notOfficial")}</p>
          <p style="opacity:0.8;" dir="ltr">Reference: ${escapeHtml(q.textbookEdition)}.</p>
        </div>
      </details>
    </div>`;
}

function goTo(root, attempt, newIndex) {
  attempt.currentIndex = newIndex;
  saveInProgress(attempt);
  paint(root, attempt);
}

function showSubmitConfirm(root, attempt) {
  const questions = questionsOf(attempt);
  const summary = submissionSummary(questions, attempt.responses);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${t("take.confirmSubmissionAria")}">
      <h2>${t("take.confirmTitle")}</h2>
      <div class="stat-grid" style="margin:16px 0;">
        <div class="stat-tile"><div class="num">${summary.total}</div><div class="label">${t("take.statTotal")}</div></div>
        <div class="stat-tile"><div class="num">${summary.answered}</div><div class="label">${t("take.statAnswered")}</div></div>
        <div class="stat-tile"><div class="num">${summary.unanswered}</div><div class="label">${t("take.statUnanswered")}</div></div>
        <div class="stat-tile"><div class="num">${summary.markedForReview}</div><div class="label">${t("take.statMarked")}</div></div>
      </div>
      ${summary.unanswered > 0 ? `<p class="alert alert-amber">${t("take.unansweredWarning", { n: summary.unanswered })}</p>` : ""}
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-secondary" id="cancel-submit">${t("take.returnToExam")}</button>
        <button class="btn btn-primary" id="confirm-submit">${t("take.confirmSubmit")}</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector("#cancel-submit").addEventListener("click", () => backdrop.remove());
  backdrop.querySelector("#confirm-submit").addEventListener("click", () => {
    backdrop.remove();
    finalizeSubmission(attempt);
  });
}

function autoSubmit(root, attempt) {
  finalizeSubmission(attempt, true);
}

let submitted = false;
function finalizeSubmission(attempt, timeExpired = false) {
  if (submitted) return; // guard against double submission
  submitted = true;
  clearInterval(timerInterval);
  const questions = questionsOf(attempt);
  const scored = scoreAttempt(questions, attempt.responses);

  const responsesOut = {};
  for (const q of questions) {
    const r = attempt.responses[q.id] || { selected: null };
    let wasCorrect = null;
    if (r.selected && r.selected !== "abstain" && q.correctOptionId) {
      wasCorrect = r.selected === q.correctOptionId;
    }
    responsesOut[q.id] = { selected: r.selected ?? null, markedForReview: !!r.markedForReview, wasCorrect };
  }

  const finishedAttempt = {
    id: attempt.id,
    startedAt: attempt.startedAt,
    finishedAt: new Date().toISOString(),
    timeExpired,
    setupSummary: attempt.setupSummary,
    explanationMode: attempt.explanationMode,
    questionIds: attempt.questionIds,
    responses: responsesOut,
    score: scored,
  };
  saveAttempt(finishedAttempt);
  clearInProgress();
  submitted = false;
  navigate(`/results/${finishedAttempt.id}`);
}
