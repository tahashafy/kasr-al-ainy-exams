import { getAttemptById, getSettings } from "../store.js";
import { getQuestionById, getChapterMeta, getCategoryMeta } from "../data.js";
import { escapeHtml } from "../router.js";
import { buildNotices, coverageLabelText, hasQuestionMeta, renderQuestionMetaRow } from "./examTake.js";
import { t } from "../i18n.js";

export function renderExamResults(root, params) {
  const attempt = getAttemptById(params.id);
  if (!attempt) {
    root.innerHTML = `<div class="container-narrow"><div class="empty-state card"><div class="icon">🔍</div><h2>${t("results.notFoundTitle")}</h2><p>${t("results.notFoundDesc")}</p><a class="btn btn-primary" href="#/history" data-nav-link>${t("results.viewHistory")}</a></div></div>`;
    return;
  }
  const questions = attempt.questionIds.map((id) => getQuestionById(id)).filter(Boolean);
  const s = attempt.score;

  const weakness = buildWeaknessSummary(questions, attempt.responses);
  const attemptModuleId = questions[0]?.module || "101";

  root.innerHTML = `
    <div class="container">
      <div class="breadcrumb"><a href="#/" data-nav-link>${t("nav.home")}</a> / <a href="#/history" data-nav-link>${t("nav.history")}</a> / ${t("results.breadcrumb")}</div>

      <div class="card">
        <div class="score-hero">
          ${s.eligible > 0
            ? `<div class="score-ring">${s.scorePercentage.toFixed(1)}<small>%</small></div>
               <p style="margin-top:6px;">${s.correct}/${s.eligible} ${t("results.gradedCorrect")}${s.excludedUnverified > 0 ? ` ${s.excludedUnverified} ${t("results.excludedNote")}` : ""}</p>`
            : `<div class="score-ring" style="font-size:22px;">${t("results.practiceCompleted")}</div>
               <p style="margin-top:6px;">${t("results.noneEligible")}</p>`}
          ${attempt.timeExpired ? `<span class="badge badge-gray" style="margin-left:6px;">${t("results.timeExpired")}</span>` : ""}
        </div>
        <div class="stat-grid">
          <div class="stat-tile"><div class="num">${s.totalQuestions}</div><div class="label">${t("results.statTotal")}</div></div>
          <div class="stat-tile"><div class="num">${s.correct}</div><div class="label">${t("results.statCorrect")}</div></div>
          <div class="stat-tile"><div class="num">${s.incorrect}</div><div class="label">${t("results.statIncorrect")}</div></div>
          <div class="stat-tile"><div class="num">${s.unanswered}</div><div class="label">${t("results.statUnanswered")}</div></div>
          <div class="stat-tile"><div class="num">${s.abstained}</div><div class="label">${t("results.statAbstained")}</div></div>
          <div class="stat-tile"><div class="num">${s.excludedUnverified}</div><div class="label">${t("results.statExcluded")}</div></div>
        </div>
        <p style="font-size:12px;margin-top:16px;color:var(--text-faint);">${t("results.scoreFormula")}</p>
      </div>

      ${weakness.length
        ? `<div class="card">
            <h2 class="section-title">${t("results.focusTitle")}</h2>
            <p class="section-sub">${t("results.focusDesc")}</p>
            ${weakness
              .map(
                (w) => `
              <div style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:5px;">
                  <strong>${escapeHtml(w.label)}</strong>
                  <span style="color:var(--text-muted);">${w.missed}/${w.total} ${t("results.focusMissed")}</span>
                </div>
                <div class="progress-bar"><div style="width:${Math.round((w.missed / w.total) * 100)}%;background:var(--red-600);"></div></div>
              </div>`
              )
              .join("")}
            <a class="btn btn-secondary" href="#/setup/${attemptModuleId}" data-nav-link>${t("results.revisionBtn")}</a>
          </div>`
        : ""}

      <div class="card">
        <h2 class="section-title">${t("results.reviewTitle")}</h2>
        ${questions.map((q, i) => renderReviewItem(q, attempt.responses[q.id], i)).join("")}
      </div>
    </div>
  `;
}

function buildWeaknessSummary(questions, responses) {
  const byChapter = new Map();
  for (const q of questions) {
    if (q.gradingStatus !== "Ready") continue;
    const r = responses[q.id];
    const key = q.chapter || q.category || "uncategorized";
    const label = q.chapter
      ? (() => {
          const cm = getChapterMeta(q.chapter);
          return cm ? `${cm.categoryName} — ${cm.title}` : key;
        })()
      : q.category
      ? getCategoryMeta(q.category)?.name || key
      : t("common.uncategorized");
    if (!byChapter.has(key)) byChapter.set(key, { label, total: 0, missed: 0 });
    const entry = byChapter.get(key);
    entry.total++;
    const wasMissed = r && (r.wasCorrect === false || r.selected == null);
    if (wasMissed) entry.missed++;
  }
  return Array.from(byChapter.values())
    .filter((e) => e.missed > 0)
    .sort((a, b) => b.missed / b.total - a.missed / a.total)
    .slice(0, 6);
}

function renderReviewItem(q, response, i) {
  const r = response || { selected: null };
  const chapterMeta = q.chapter ? getChapterMeta(q.chapter) : null;
  const isGraded = q.gradingStatus === "Ready";
  let statusBadge;
  if (!isGraded) {
    statusBadge = `<span class="badge badge-gray">${t("results.practiceOnlyBadge")}</span>`;
  } else if (r.selected === "abstain") {
    statusBadge = `<span class="badge badge-gray">${t("results.abstainedBadge")}</span>`;
  } else if (r.selected == null) {
    statusBadge = `<span class="badge badge-red">${t("results.unansweredBadge")}</span>`;
  } else if (r.wasCorrect) {
    statusBadge = `<span class="badge badge-green">${t("results.correctBadge")}</span>`;
  } else {
    statusBadge = `<span class="badge badge-red">${t("results.incorrectBadge")}</span>`;
  }
  const answerOpt = q.options.find((o) => o.id === q.correctOptionId);
  const notices = buildNotices(q);
  const pages = (q.bookPages || []).join(", ");
  const showMeta = !!getSettings().showQuestionMeta;

  return `
    <div class="review-item">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
        <strong style="font-size:13px;color:var(--text-faint);">Q${i + 1}</strong>
        <div>${statusBadge}</div>
      </div>
      ${showMeta && hasQuestionMeta(q) ? renderQuestionMetaRow(q) : ""}
      <p style="font-weight:600;color:var(--text);margin-bottom:10px;" dir="ltr">${escapeHtml(q.text)}</p>
      <div class="options" dir="ltr">
        ${q.options
          .map((opt) => {
            let cls = "option";
            if (opt.id === q.correctOptionId) cls += " correct";
            else if (r.selected === opt.id) cls += " incorrect";
            return `<div class="${cls}"><span class="option-letter">${opt.id.toUpperCase()}</span><span>${escapeHtml(opt.text)}</span></div>`;
          })
          .join("")}
      </div>
      <div class="alert alert-teal" style="margin-top:12px;">
        <strong>${t("take.recommendedAnswer")}: <span dir="ltr">${q.correctOptionId ? q.correctOptionId.toUpperCase() : "—"}${answerOpt ? `. ${escapeHtml(answerOpt.text)}` : ""}</span></strong>
        <p style="margin:8px 0 0;color:inherit;" dir="ltr">${escapeHtml(q.evidence || "No book evidence recorded.")}</p>
        ${notices.length ? `<p style="margin:8px 0 0;font-size:12.5px;font-weight:600;">${notices.map(escapeHtml).join(" · ")}</p>` : ""}
        <div style="margin-top:6px;font-size:12px;opacity:0.85;">
          ${chapterMeta ? `${escapeHtml(chapterMeta.categoryName)} — Ch. ${escapeHtml(chapterMeta.number)}: ${escapeHtml(chapterMeta.title)} · ` : ""}
          ${q.sourceExam ? `Source: ${escapeHtml(q.sourceExam)}` : ""}
        </div>
        <details style="margin-top:10px;">
          <summary style="cursor:pointer;font-weight:600;font-size:13px;">${t("take.viewSourceDetails")}</summary>
          <div style="margin-top:8px;font-size:13px;line-height:1.5;">
            <p><strong>${t("take.bookCoverage")}:</strong> ${escapeHtml(coverageLabelText(q.coverageLabel))}</p>
            ${pages ? `<p><strong>${t("take.bookPages")}${q.bookPages.length > 1 ? "s" : ""}:</strong> <span dir="ltr">${escapeHtml(pages)}</span> ${t("take.pdfPageNote")}</p>` : ""}
            ${q.conditionalAlternatives && q.conditionalAlternatives.length ? `<p><strong>${t("take.conditionalAlt")}:</strong> <span dir="ltr">${q.conditionalAlternatives.map(escapeHtml).join(" / ")}</span></p>` : ""}
            ${q.reviewNote ? `<p><strong>${t("take.reasoningNote")}:</strong> <span dir="ltr">${escapeHtml(q.reviewNote)}</span></p>` : ""}
            <p><strong>${t("take.gradingStatus")}:</strong> ${isGraded ? t("take.gradingReady") : t("take.gradingReview")} ${t("take.notOfficial")}</p>
          </div>
        </details>
      </div>
    </div>`;
}
