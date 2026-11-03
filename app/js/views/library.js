import { getChapters, getExamSources, filterQuestions, getModuleContentKind, getModuleShowWrittenTab } from "../data.js";
import { escapeHtml } from "../router.js";
import { t } from "../i18n.js";

export function renderLibrary(root, moduleId) {
  const chapters = getChapters(moduleId);
  const sources = getExamSources(moduleId);
  const contentKind = getModuleContentKind(moduleId); // 'eom' | 'mcq'
  const showWrittenTab = getModuleShowWrittenTab(moduleId);

  const categoryCards = chapters.categories
    .map((cat) => {
      const all = filterQuestions({ module: moduleId, categories: [cat.id] });
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

  const breadcrumbLabel = contentKind === "mcq" ? t("lib.breadcrumbMcq") : t("lib.breadcrumbEom");
  const libraryTitle = contentKind === "mcq" ? t("lib.libraryTitleMcq") : t("lib.libraryTitle");
  const libraryDesc = contentKind === "mcq" ? t("lib.libraryDescMcq") : t("lib.libraryDesc");

  const writtenCard = showWrittenTab
    ? `
      <div class="card disabled" aria-disabled="true" style="margin-bottom:16px;">
        <h2 class="section-title">${t("home.writtenTitle")}</h2>
        <p class="section-sub">${t("home.writtenDesc")}</p>
        <span class="badge badge-amber" style="margin-top:6px;">${t("home.comingSoon")}</span>
      </div>`
    : "";

  root.innerHTML = `
    <div class="container">
      <div class="breadcrumb"><a href="#/" data-nav-link>${t("nav.home")}</a> / <a href="#/exams" data-nav-link>${breadcrumbLabel}</a> / ${t("module.label", { n: moduleId })}</div>
      <h1>${t(`module${moduleId}.fullTitle`)}</h1>
      <p class="section-sub">${escapeHtml(chapters.textbookEdition)}</p>

      <div class="grid grid-4" style="margin-bottom:24px;">${categoryCards}</div>

      <div class="card" style="margin-bottom:16px;">
        <h2 class="section-title">${t("lib.startTitle")}</h2>
        <p class="section-sub">${t("lib.startDesc")}</p>
        <a class="btn btn-primary" href="#/setup/${moduleId}" data-nav-link>${t("lib.startBtn")}</a>
      </div>

      ${writtenCard}

      <div class="card">
        <h2 class="section-title">${libraryTitle}</h2>
        <p class="section-sub">${libraryDesc}</p>
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
