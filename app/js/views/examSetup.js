import { getChapters, getChaptersForCategories, getExamSources, filterQuestions, drawExamQuestions } from "../data.js";
import { escapeHtml, navigate } from "../router.js";
import { saveInProgress, clearInProgress } from "../store.js";
import { t } from "../i18n.js";

const COVERAGE_OPTIONS = [
  { id: null, labelKey: "setup.coverageAll" },
  { id: "book-supported", labelKey: "setup.coverageBookSupported" },
  { id: "partial", labelKey: "setup.coveragePartial" },
  { id: "not-covered", labelKey: "setup.coverageNotCovered" },
];

const state = {
  mode: "custom", // 'custom' | 'paper'
  selectedCategories: [],
  selectedChapters: [],
  sourceExam: null,
  coverageGroup: null, // null = All Questions (default); otherwise one of COVERAGE_OPTIONS ids
  showAdvanced: false,
  countMode: "all", // 'all' | 'fixed'
  fixedCount: 40,
  explanationMode: "after-submit", // 'immediate' | 'after-submit'
  timerMode: "untimed", // 'untimed' | 'timed'
  timerMinutes: 60,
};

function resetState(chapters) {
  state.mode = "custom";
  state.selectedCategories = chapters.categories.map((c) => c.id);
  state.selectedChapters = [];
  state.sourceExam = null;
  state.coverageGroup = null;
  state.showAdvanced = false;
  state.countMode = "all";
  state.fixedCount = 40;
  state.explanationMode = "after-submit";
  state.timerMode = "untimed";
  state.timerMinutes = 60;
}

function fullPaperCount(sources, sourceExam) {
  const s = sources.find((s) => s.label === sourceExam);
  return s ? s.count : 0;
}

function eligibleQuestions(moduleId) {
  if (state.mode === "paper") {
    if (!state.sourceExam) return [];
    return filterQuestions({ module: moduleId, sourceExam: state.sourceExam, coverageGroup: state.coverageGroup });
  }
  if (state.selectedCategories.length === 0) return []; // spec: at least one category required
  return filterQuestions({
    module: moduleId,
    categories: state.selectedCategories,
    chapters: state.selectedChapters.length ? state.selectedChapters : undefined,
    coverageGroup: state.coverageGroup,
  });
}

export function renderExamSetup(root, moduleId) {
  const chapters = getChapters(moduleId);
  const sources = getExamSources(moduleId);
  resetState(chapters);
  clearInProgress();
  paint(root, moduleId, chapters, sources);
}

function paint(root, moduleId, chapters, sources) {
  const pool = eligibleQuestions(moduleId);
  const readyInPool = pool.filter((q) => q.gradingStatus === "Ready").length;
  const chapterOptions = getChaptersForCategories(moduleId, state.selectedCategories);
  const isFullPaper = state.mode === "paper" && state.sourceExam && !state.coverageGroup && pool.length === fullPaperCount(sources, state.sourceExam);
  const paperLabel = state.mode === "paper" ? (state.sourceExam ? (isFullPaper ? t("setup.fullPastExamLabel") : t("setup.filteredPracticeSetLabel")) : null) : null;

  root.innerHTML = `
    <div class="container-narrow">
      <div class="breadcrumb"><a href="#/" data-nav-link>${t("nav.home")}</a> / <a href="#/module/${moduleId}" data-nav-link>${t("module.label", { n: moduleId })}</a> / ${t("setup.breadcrumb")}</div>
      <h1>${t("setup.title")}</h1>
      <p class="section-sub">${t("setup.subtitle")}</p>

      <div class="card">
        <h2 class="section-title">${t("setup.sourceTitle")}</h2>
        <div class="chip-group" style="margin-bottom:16px;">
          <button class="chip ${state.mode === "custom" ? "selected" : ""}" data-mode="custom" type="button">${t("setup.customMode")}</button>
          <button class="chip ${state.mode === "paper" ? "selected" : ""}" data-mode="paper" type="button">${t("setup.paperMode")}</button>
        </div>

        <div id="mode-custom" style="${state.mode !== "custom" ? "display:none" : ""}">
          <label>${t("setup.categoriesLabel")}</label>
          <div class="chip-group" id="category-chips" style="margin-bottom:8px;">
            ${chapters.categories
              .map(
                (c) =>
                  `<button class="chip ${state.selectedCategories.includes(c.id) ? "selected" : ""}" data-cat="${c.id}" type="button">${escapeHtml(c.name)}</button>`
              )
              .join("")}
          </div>
          <div style="margin-bottom:16px;">
            <button class="btn btn-ghost btn-sm" id="select-all-cats" type="button">${t("setup.selectAll")}</button>
            <button class="btn btn-ghost btn-sm" id="clear-cats" type="button">${t("setup.clearSelection")}</button>
          </div>

          <label>${t("lib.chaptersWord").replace(/^./, (c) => c.toUpperCase())} ${state.selectedCategories.length === 0 ? t("setup.chaptersLabelPick") : t("setup.chaptersLabelOptional")}</label>
          <div class="chip-group" id="chapter-chips" style="margin-bottom:8px;">
            ${chapterOptions
              .map(
                (ch) =>
                  `<button class="chip ${state.selectedChapters.includes(ch.id) ? "selected" : ""}" data-chapter="${ch.id}" type="button" title="${escapeHtml(ch.categoryName)}">${escapeHtml(ch.categoryName)} ${escapeHtml(ch.number)} — ${escapeHtml(ch.title)}</button>`
              )
              .join("") || `<span style="color:var(--text-faint);font-size:13px;">${t("setup.noCategories")}</span>`}
          </div>
          ${chapterOptions.length ? `<div style="margin-bottom:8px;"><button class="btn btn-ghost btn-sm" id="clear-chapters" type="button">${t("setup.clearChapters")}</button></div>` : ""}
        </div>

        <div id="mode-paper" style="${state.mode !== "paper" ? "display:none" : ""}">
          <label>${t("setup.paperLabel")}</label>
          <select id="paper-select">
            <option value="">${t("setup.paperSelectPlaceholder")}</option>
            ${sources
              .map(
                (s) =>
                  `<option value="${escapeHtml(s.label)}" ${state.sourceExam === s.label ? "selected" : ""}>${escapeHtml(s.label)} (${s.count} Qs)</option>`
              )
              .join("")}
          </select>
          <p style="font-size:12.5px;margin-top:8px;">${t("setup.paperOrderNote")}</p>
          ${paperLabel ? `<p style="font-size:12.5px;margin-top:4px;"><strong>${t(paperLabel === "Filtered Practice Set" ? "setup.filteredPracticeSetLabel" : "setup.fullPastExamLabel")}</strong>${paperLabel === "Filtered Practice Set" ? t("setup.filteredNote") : ""}</p>` : ""}
        </div>
      </div>

      <div class="card">
        <button class="btn btn-ghost btn-sm" id="toggle-advanced" type="button">${state.showAdvanced ? "▾" : "▸"} ${t("setup.advanced")}</button>
        <div id="advanced-filters" style="${state.showAdvanced ? "" : "display:none"}margin-top:12px;">
          <label>${t("setup.coverageLabel")}</label>
          <div class="chip-group">
            ${COVERAGE_OPTIONS.map(
              (o) =>
                `<button class="chip ${state.coverageGroup === o.id ? "selected" : ""}" data-coverage="${o.id ?? ""}" type="button">${escapeHtml(t(o.labelKey))}</button>`
            ).join("")}
          </div>
          <p style="font-size:12.5px;color:var(--text-muted);margin-top:8px;">${t("setup.coverageNote")}</p>
        </div>
      </div>

      <div class="card" id="count-card" style="${state.mode === "paper" ? "display:none" : ""}">
        <h2 class="section-title">${t("setup.countTitle")}</h2>
        <div class="chip-group" style="margin-bottom:12px;">
          <button class="chip ${state.countMode === "all" ? "selected" : ""}" data-count-mode="all" type="button">${t("setup.allEligible")}</button>
          <button class="chip ${state.countMode === "fixed" ? "selected" : ""}" data-count-mode="fixed" type="button">${t("setup.customNumber")}</button>
        </div>
        <div id="fixed-count-row" style="${state.countMode !== "fixed" ? "display:none" : ""}">
          <input type="number" id="fixed-count-input" min="1" max="${Math.max(pool.length, 1)}" value="${state.fixedCount}" />
        </div>
      </div>

      <div class="card">
        <h2 class="section-title">${t("setup.settingsTitle")}</h2>
        <div class="grid grid-2">
          <div>
            <label>${t("setup.explanationsLabel")}</label>
            <select id="explanation-mode">
              <option value="after-submit" ${state.explanationMode === "after-submit" ? "selected" : ""}>${t("setup.examMode")}</option>
              <option value="immediate" ${state.explanationMode === "immediate" ? "selected" : ""}>${t("setup.practiceMode")}</option>
            </select>
          </div>
          <div>
            <label>${t("setup.timerLabel")}</label>
            <select id="timer-mode">
              <option value="untimed" ${state.timerMode === "untimed" ? "selected" : ""}>${t("setup.untimed")}</option>
              <option value="timed" ${state.timerMode === "timed" ? "selected" : ""}>${t("setup.timed")}</option>
            </select>
          </div>
        </div>
        <div id="timer-minutes-row" style="${state.timerMode !== "timed" ? "display:none" : ""}margin-top:12px;">
          <label>${t("setup.minutesLabel")}</label>
          <input type="number" id="timer-minutes-input" min="5" max="240" value="${state.timerMinutes}" />
          <p style="font-size:12px;margin-top:6px;">${t("setup.minutesNote")}</p>
        </div>
      </div>

      <div class="card" style="box-shadow:var(--shadow-lg);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <strong style="font-size:15px;">${pool.length} ${t("setup.eligibleCount")}</strong>
            <div style="font-size:12.5px;color:var(--text-muted);">${readyInPool} ${t("setup.readyWord")} · ${pool.length - readyInPool} ${t("setup.practiceOnlyWord")}</div>
          </div>
          <button class="btn btn-primary" id="start-exam-btn" type="button" ${pool.length === 0 ? "disabled" : ""}>${t("setup.startBtn")}</button>
        </div>
        ${pool.length === 0 ? `<p class="alert alert-red" style="margin-top:14px;">${t("setup.noneMatch")}</p>` : ""}
      </div>
    </div>
  `;

  // ----- Wire up events -----
  root.querySelectorAll("[data-mode]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.mode = btn.dataset.mode;
      paint(root, moduleId, chapters, sources);
    })
  );
  root.querySelectorAll("[data-cat]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.cat;
      const idx = state.selectedCategories.indexOf(id);
      if (idx >= 0) state.selectedCategories.splice(idx, 1);
      else state.selectedCategories.push(id);
      state.selectedChapters = state.selectedChapters.filter((chId) =>
        getChaptersForCategories(moduleId, state.selectedCategories).some((c) => c.id === chId)
      );
      paint(root, moduleId, chapters, sources);
    })
  );
  const selectAllBtn = root.querySelector("#select-all-cats");
  if (selectAllBtn) selectAllBtn.addEventListener("click", () => { state.selectedCategories = chapters.categories.map((c) => c.id); paint(root, moduleId, chapters, sources); });
  const clearCatsBtn = root.querySelector("#clear-cats");
  if (clearCatsBtn) clearCatsBtn.addEventListener("click", () => { state.selectedCategories = []; state.selectedChapters = []; paint(root, moduleId, chapters, sources); });
  const clearChaptersBtn = root.querySelector("#clear-chapters");
  if (clearChaptersBtn) clearChaptersBtn.addEventListener("click", () => { state.selectedChapters = []; paint(root, moduleId, chapters, sources); });

  root.querySelectorAll("[data-chapter]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.chapter;
      const idx = state.selectedChapters.indexOf(id);
      if (idx >= 0) state.selectedChapters.splice(idx, 1);
      else state.selectedChapters.push(id);
      paint(root, moduleId, chapters, sources);
    })
  );

  const paperSelect = root.querySelector("#paper-select");
  if (paperSelect) paperSelect.addEventListener("change", (e) => { state.sourceExam = e.target.value || null; paint(root, moduleId, chapters, sources); });

  const toggleAdvanced = root.querySelector("#toggle-advanced");
  if (toggleAdvanced) toggleAdvanced.addEventListener("click", () => { state.showAdvanced = !state.showAdvanced; paint(root, moduleId, chapters, sources); });
  root.querySelectorAll("[data-coverage]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.coverageGroup = btn.dataset.coverage || null;
      paint(root, moduleId, chapters, sources);
    })
  );

  root.querySelectorAll("[data-count-mode]").forEach((btn) =>
    btn.addEventListener("click", () => { state.countMode = btn.dataset.countMode; paint(root, moduleId, chapters, sources); })
  );
  const fixedCountInput = root.querySelector("#fixed-count-input");
  if (fixedCountInput) fixedCountInput.addEventListener("input", (e) => { state.fixedCount = parseInt(e.target.value, 10) || 1; });

  const explanationSelect = root.querySelector("#explanation-mode");
  if (explanationSelect) explanationSelect.addEventListener("change", (e) => { state.explanationMode = e.target.value; });
  const timerModeSelect = root.querySelector("#timer-mode");
  if (timerModeSelect) timerModeSelect.addEventListener("change", (e) => { state.timerMode = e.target.value; paint(root, moduleId, chapters, sources); });
  const timerMinutesInput = root.querySelector("#timer-minutes-input");
  if (timerMinutesInput) timerMinutesInput.addEventListener("input", (e) => { state.timerMinutes = parseInt(e.target.value, 10) || 60; });

  const startBtn = root.querySelector("#start-exam-btn");
  if (startBtn) startBtn.addEventListener("click", () => startExam(moduleId, chapters, sources));
}

function startExam(moduleId, chapters, sources) {
  const criteria = {
    module: moduleId,
    categories: state.mode === "custom" ? state.selectedCategories : undefined,
    chapters: state.mode === "custom" && state.selectedChapters.length ? state.selectedChapters : undefined,
    sourceExam: state.mode === "paper" ? state.sourceExam : undefined,
    coverageGroup: state.coverageGroup,
    mode: state.countMode === "fixed" ? "count" : "all",
    count: state.fixedCount,
    shuffle: state.mode !== "paper",
  };
  const questions = drawExamQuestions(criteria);
  if (!questions.length) return;

  const isFullPaper = state.mode === "paper" && state.sourceExam && !state.coverageGroup && questions.length === fullPaperCount(sources, state.sourceExam);

  const attemptInProgress = {
    id: "attempt_" + Date.now(),
    startedAt: new Date().toISOString(),
    questionIds: questions.map((q) => q.id),
    responses: {},
    currentIndex: 0,
    explanationMode: state.explanationMode,
    timerMode: state.timerMode,
    timerMinutes: state.timerMinutes,
    timerEndsAt: state.timerMode === "timed" ? Date.now() + state.timerMinutes * 60000 : null,
    setupSummary: {
      mode: state.mode,
      label: state.mode === "paper" ? (isFullPaper ? "Full Past Exam" : "Filtered Practice Set") : "Custom mix",
      categories: state.selectedCategories.slice(),
      chapters: state.selectedChapters.slice(),
      sourceExam: state.sourceExam,
      coverageGroup: state.coverageGroup,
    },
  };
  saveInProgress(attemptInProgress);
  navigate("/exam/take");
}
