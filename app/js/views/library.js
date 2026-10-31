import { getChapters, getExamSources, filterQuestions } from "../data.js";
import { escapeHtml } from "../router.js";
import { t } from "../i18n.js";

export function renderLibrary101(root) {
  const chapters = getChapters();
  const sources = getExamSources();

  const categoryCards = chapters.categories
    .map((cat) => {
      const all = filterQuestions({ categories: [cat.id] });
      const readyCount = all.filter((q) => q.gradingStatus === "Ready").length;
      return `
      <div class="card">
        <h3>${escapeHtml(cat.name)}</h3>
        <p style="font-size:13px;">${cat.chapters.length} ${t("lib.chaptersWord")} · ${all.length} ${t("lib.questionsInBank")} (${readyCount} ${t("lib.graded")})</p>
      </div>`;
    })
    .join("");

  const sourceRows = sources
    .map(
      (s) => `
      <tr>
        <td>${escapeHtml(s.label)}</td>
        <td>${escapeHtml(s.academicYear || "—")}</td>
        <td>${escapeHtml(s.examDate || "—")}</td>
        <td>${s.count}</td>
        <td><span class="badge badge-green">${s.readyCount} ${t("about.readyBadge")}</span> ${s.reviewCount ? `<span class="badge badge-amber">${s.reviewCount} ${t("about.reviewBadge")}</span>` : ""}</td>
      </tr>`
    )
    .join("");

  root.innerHTML = `
    <div class="container">
      <div class="breadcrumb"><a href="#/" data-nav-link>${t("nav.home")}</a> / <a href="#/exams" data-nav-link>${t("lib.breadcrumbEom")}</a> / ${t("module.label", { n: "101" })}</div>
      <h1>${t("module101.fullTitle")}</h1>
      <p class="section-sub">${escapeHtml(chapters.textbookEdition)}</p>

      <div class="grid grid-4" style="margin-bottom:24px;">${categoryCards}</div>

      <div class="card" style="margin-bottom:16px;">
        <h2 class="section-title">${t("lib.startTitle")}</h2>
        <p class="section-sub">${t("lib.startDesc")}</p>
        <a class="btn btn-primary" href="#/setup/101" data-nav-link>${t("lib.startBtn")}</a>
      </div>

      <div class="card">
        <h2 class="section-title">${t("lib.libraryTitle")}</h2>
        <p class="section-sub">${t("lib.libraryDesc")}</p>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>${t("lib.colPaper")}</th><th>${t("lib.colYear")}</th><th>${t("lib.colDate")}</th><th>${t("lib.colImported")}</th><th>${t("lib.colStatus")}</th></tr></thead>
            <tbody>${sourceRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
