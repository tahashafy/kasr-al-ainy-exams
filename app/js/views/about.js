import { getExamSources } from "../data.js";
import { escapeHtml } from "../router.js";
import { clearAllData, isRemoteEnabled, getAccessCode } from "../store.js";
import { t } from "../i18n.js";

export function renderAbout(root) {
  const sources = getExamSources();
  const remote = isRemoteEnabled();
  root.innerHTML = `
    <div class="container-narrow">
      <h1>${t("about.title")}</h1>
      <div class="card">
        <h2 class="section-title">${t("about.whatTitle")}</h2>
        <p>${t("about.whatDesc")}</p>
      </div>
      <div class="card">
        <h2 class="section-title">${t("about.howTitle")}</h2>
        <p>${t("about.howIntro")}</p>
        <ul style="color:var(--text-muted);font-size:13.5px;">
          <li>${t("about.gradingStatusDesc")}</li>
          <li>${t("about.coverageDesc")}</li>
        </ul>
        <p style="font-size:12.5px;color:var(--text-muted);">${t("about.howNote")}</p>
      </div>
      <div class="card">
        <h2 class="section-title">${t("about.sourcesTitle")}</h2>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>${t("about.colPaper")}</th><th>${t("about.colYear")}</th><th>${t("about.colImported")}</th><th>${t("about.colGradingStatus")}</th></tr></thead>
            <tbody>
              ${sources
                .map(
                  (s) => `<tr>
                  <td dir="ltr">${escapeHtml(s.label)}</td>
                  <td>${escapeHtml(s.academicYear || "—")}</td>
                  <td>${s.count}</td>
                  <td><span class="badge badge-green">${s.readyCount} ${t("about.readyBadge")}</span> ${s.reviewCount ? `<span class="badge badge-amber">${s.reviewCount} ${t("about.reviewBadge")}</span>` : ""}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h2 class="section-title">${t("about.privacyTitle")}</h2>
        ${
          remote
            ? `<p>${t("about.privacyRemoteDesc")}</p>
               <p style="font-size:13px;"><strong>${t("about.accessCodeLabel")}</strong> <code dir="ltr">${escapeHtml(getAccessCode())}</code></p>`
            : `<p>${t("about.privacyLocalDesc")}</p>`
        }
        <button class="btn btn-danger btn-sm" id="clear-data-btn" type="button">${t("about.clearBtn")}${remote ? t("about.clearBtnServerSuffix") : ""}</button>
      </div>
    </div>
  `;
  root.querySelector("#clear-data-btn").addEventListener("click", () => {
    if (confirm(t("about.clearConfirm"))) {
      clearAllData();
      alert(t("about.clearedAlert"));
      location.reload();
    }
  });
}
