import { getAttempts } from "../store.js";
import { getQuestionById, getChapterMeta } from "../data.js";
import { escapeHtml, navigate } from "../router.js";
import { saveInProgress, clearInProgress } from "../store.js";
import { t } from "../i18n.js";

export function renderMistakes(root) {
  const attempts = getAttempts();
  const mistakeMap = new Map();
  for (const attempt of attempts) {
    for (const [qid, r] of Object.entries(attempt.responses || {})) {
      if (r.wasCorrect === false && !mistakeMap.has(qid)) {
        mistakeMap.set(qid, { selected: r.selected, attemptId: attempt.id });
      }
    }
  }
  const questions = Array.from(mistakeMap.keys())
    .map((id) => getQuestionById(id))
    .filter((q) => q && q.gradingStatus === "Ready"); // only questions that actually counted against the score

  if (!questions.length) {
    root.innerHTML = `<div class="container-narrow"><div class="empty-state card"><div class="icon">✅</div><h2>${t("mistakes.emptyTitle")}</h2><p>${t("mistakes.emptyDesc")}</p><a class="btn btn-primary" href="#/setup/101" data-nav-link>${t("mistakes.startPracticing")}</a></div></div>`;
    return;
  }

  root.innerHTML = `
    <div class="container">
      <h1>${t("mistakes.title")}</h1>
      <p class="section-sub">${questions.length} ${t("mistakes.subtitle")}</p>
      <div class="card" style="margin-bottom:16px;">
        <button class="btn btn-primary" id="practice-mistakes-btn" type="button">${t("mistakes.practiceBtn")}</button>
      </div>
      <div class="card">
        ${questions
          .map((q) => {
            const cm = q.chapter ? getChapterMeta(q.chapter) : null;
            return `<div class="review-item">
              <div style="font-size:12px;color:var(--text-faint);margin-bottom:6px;">${cm ? escapeHtml(cm.categoryName + " — " + cm.title) : escapeHtml(q.category || t("common.uncategorized"))}</div>
              <p style="font-weight:600;" dir="ltr">${escapeHtml(q.text)}</p>
              <div class="alert alert-teal" dir="ltr">${t("mistakes.recommendedAnswer")}: <strong>${q.correctOptionId ? q.correctOptionId.toUpperCase() : "—"}</strong> — ${escapeHtml(q.options.find((o) => o.id === q.correctOptionId)?.text || "")}</div>
            </div>`;
          })
          .join("")}
      </div>
    </div>
  `;

  root.querySelector("#practice-mistakes-btn").addEventListener("click", () => {
    clearInProgress();
    const attempt = {
      id: "attempt_" + Date.now(),
      startedAt: new Date().toISOString(),
      questionIds: questions.map((q) => q.id),
      responses: {},
      currentIndex: 0,
      explanationMode: "immediate",
      timerMode: "untimed",
      timerMinutes: 60,
      timerEndsAt: null,
      setupSummary: { mode: "mistakes-review" },
    };
    saveInProgress(attempt);
    navigate("/exam/take");
  });
}
