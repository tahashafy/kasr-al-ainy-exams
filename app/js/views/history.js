import { getAttempts } from "../store.js";
import { escapeHtml } from "../router.js";
import { t } from "../i18n.js";

export function renderHistory(root) {
  const attempts = getAttempts();
  if (!attempts.length) {
    root.innerHTML = `<div class="container-narrow"><div class="empty-state card"><div class="icon">🗂️</div><h2>${t("history.emptyTitle")}</h2><p>${t("history.emptyDesc")}</p><a class="btn btn-primary" href="#/setup/101" data-nav-link>${t("mistakes.startPracticing")}</a></div></div>`;
    return;
  }

  root.innerHTML = `
    <div class="container">
      <h1>${t("history.title")}</h1>
      <p class="section-sub">${attempts.length} ${t("history.subtitle")}</p>
      <div class="card">
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>${t("history.colDate")}</th><th>${t("history.colSource")}</th><th>${t("history.colQuestions")}</th><th>${t("history.colScore")}</th><th>${t("history.colStatus")}</th><th></th></tr></thead>
            <tbody>
              ${attempts
                .map((a) => {
                  const date = new Date(a.finishedAt || a.startedAt).toLocaleString();
                  const sourceLabel =
                    a.setupSummary?.mode === "paper"
                      ? a.setupSummary.sourceExam
                      : a.setupSummary?.mode === "mistakes-review"
                      ? t("history.mistakesReview")
                      : t("history.customMix");
                  const scoreText = a.score.eligible > 0 ? `${a.score.scorePercentage.toFixed(1)}%` : "—";
                  return `<tr>
                    <td>${date}</td>
                    <td dir="ltr">${escapeHtml(sourceLabel || "—")}</td>
                    <td>${a.score.totalQuestions}</td>
                    <td>${scoreText}</td>
                    <td>${a.score.isProvisional ? `<span class="badge badge-amber">+${a.score.excludedUnverified} practice only</span>` : `<span class="badge badge-green">${t("history.fullyGraded")}</span>`}</td>
                    <td><a href="#/results/${a.id}" data-nav-link>${t("history.viewLink")}</a></td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
