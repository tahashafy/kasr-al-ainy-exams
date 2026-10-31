import { loadData } from "./data.js";
import { registerRoute, registerNotFound, startRouter } from "./router.js";
import { getSettings, saveSettings, initStore, isRemoteEnabled, getAccessCode, switchAccessCode } from "./store.js";
import { hasStoredAccessCode } from "./identity.js";
import { setLang, applyStaticTranslations, t } from "./i18n.js";
import { renderHome } from "./views/home.js";
import { renderModuleSelect } from "./views/moduleSelect.js";
import { renderLibrary101 } from "./views/library101.js";
import { renderExamSetup } from "./views/examSetup.js";
import { renderExamTake } from "./views/examTake.js";
import { renderExamResults } from "./views/examResults.js";
import { renderMistakes } from "./views/mistakes.js";
import { renderBookmarks } from "./views/bookmarks.js";
import { renderHistory } from "./views/history.js";
import { renderAbout } from "./views/about.js";

const root = document.getElementById("main-content");

function applyTheme() {
  const settings = getSettings();
  document.documentElement.setAttribute("data-theme", settings.theme);
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  const settings = getSettings();
  const next = settings.theme === "dark" ? "light" : "dark";
  saveSettings({ theme: next });
  applyTheme();
});

document.getElementById("lang-toggle").addEventListener("click", () => {
  const settings = getSettings();
  const next = settings.lang === "ar" ? "en" : "ar";
  saveSettings({ lang: next });
  setLang(next);
  applyStaticTranslations();
  location.reload(); // simplest correct way to re-render every view in the new language
});

function renderAccessCodeModal({ firstRun } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const code = getAccessCode();
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${t("accessCode.title")}">
      <h2>${firstRun ? t("accessCode.welcomeTitle") : t("accessCode.title")}</h2>
      <p>${t("accessCode.descBase")} ${
        firstRun ? `<strong>${t("accessCode.saveNow")}</strong>` : ""
      } ${t("accessCode.descOther")}</p>
      <div style="display:flex;gap:8px;align-items:center;margin:16px 0;">
        <input type="text" id="code-display" value="${code}" readonly dir="ltr" style="font-weight:700;letter-spacing:0.03em;text-align:center;" />
        <button class="btn btn-secondary btn-sm" id="copy-code-btn" type="button">${t("accessCode.copyBtn")}</button>
      </div>
      <details style="margin-bottom:16px;">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--text-muted);">${t("accessCode.switchSummary")}</summary>
        <div style="margin-top:10px;display:flex;gap:8px;">
          <input type="text" id="switch-code-input" placeholder="${t("accessCode.switchPlaceholder")}" dir="ltr" />
          <button class="btn btn-secondary btn-sm" id="switch-code-btn" type="button">${t("accessCode.switchBtn")}</button>
        </div>
        <p id="switch-code-error" style="color:var(--red-600);font-size:12.5px;margin-top:6px;display:none;"></p>
      </details>
      <div style="display:flex;justify-content:flex-end;">
        <button class="btn btn-primary" id="close-code-modal">${firstRun ? t("accessCode.firstRunDone") : t("accessCode.done")}</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector("#copy-code-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      backdrop.querySelector("#copy-code-btn").textContent = t("accessCode.copiedBtn");
    } catch (e) {
      backdrop.querySelector("#code-display").select();
    }
  });
  backdrop.querySelector("#close-code-modal").addEventListener("click", () => backdrop.remove());
  backdrop.querySelector("#switch-code-btn").addEventListener("click", async () => {
    const input = backdrop.querySelector("#switch-code-input").value;
    const errEl = backdrop.querySelector("#switch-code-error");
    const result = await switchAccessCode(input);
    if (!result.ok) {
      errEl.textContent = result.error;
      errEl.style.display = "block";
      return;
    }
    backdrop.remove();
    location.reload(); // simplest correct way to re-render every view against the newly-loaded data
  });
}

function setupAccessCodeUI() {
  const btn = document.getElementById("access-code-btn");
  if (!isRemoteEnabled()) return; // local-only mode: no multi-device identity concept needed
  btn.style.display = "";
  btn.addEventListener("click", () => renderAccessCodeModal({ firstRun: false }));
  if (!hasStoredAccessCode()) {
    renderAccessCodeModal({ firstRun: true });
  }
}

async function main() {
  applyTheme();
  setLang(getSettings().lang || "en");
  applyStaticTranslations();
  try {
    await loadData();
  } catch (err) {
    root.innerHTML = `<div class="container"><div class="card error-card"><h2>${t("error.loadFailedTitle")}</h2><p dir="ltr">${String(err)}</p></div></div>`;
    return;
  }
  await initStore();
  setupAccessCodeUI();

  registerRoute("/", (r) => renderHome(r));
  registerRoute("/exams", (r) => renderModuleSelect(r));
  registerRoute("/module/:id", (r, p) => (p.id === "101" ? renderLibrary101(r) : renderComingSoon(r, p.id)));
  registerRoute("/setup/:id", (r, p) => (p.id === "101" ? renderExamSetup(r) : renderComingSoon(r, p.id)));
  registerRoute("/exam/take", (r) => renderExamTake(r));
  registerRoute("/results/:id", (r, p) => renderExamResults(r, p));
  registerRoute("/mistakes", (r) => renderMistakes(r));
  registerRoute("/bookmarks", (r) => renderBookmarks(r));
  registerRoute("/history", (r) => renderHistory(r));
  registerRoute("/about", (r) => renderAbout(r));
  registerNotFound((r) => {
    r.innerHTML = `<div class="container-narrow"><div class="empty-state card"><div class="icon">❓</div><h2>${t("notFound.title")}</h2><a class="btn btn-primary" href="#/" data-nav-link>${t("notFound.goHome")}</a></div></div>`;
  });

  startRouter(root);
}

function renderComingSoon(r, id) {
  r.innerHTML = `<div class="container-narrow"><div class="empty-state card"><div class="icon">🚧</div><h2>${t("comingSoon.title", { id })}</h2><p>${t("comingSoon.desc")}</p><a class="btn btn-primary" href="#/exams" data-nav-link>${t("comingSoon.backBtn")}</a></div></div>`;
}

main();
