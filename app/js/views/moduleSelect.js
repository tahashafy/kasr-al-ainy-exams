import { t } from "../i18n.js";
import { getAvailableModuleIds } from "../data.js";

// Declarative module roster for this picker screen — add a new module here
// (and to chapters.json/questions.json via its own import script) rather
// than hardcoding another card. `available: false` renders a disabled
// "Coming Soon" card exactly like the others, with no functional route yet.
const MODULE_CARDS = [
  { id: "101", descKey: "modules.m101desc", sourceKey: "modules.m101source", available: true },
  { id: "102", descKey: "modules.m102desc", sourceKey: "modules.m102source", available: true },
  { id: "205", descKey: "modules.m205desc", sourceKey: "modules.m205source", available: true },
  { id: "103", descKey: "modules.m103desc", sourceKey: "modules.m103source", available: true },
];

export function renderModuleSelect(root) {
  const availableModuleIds = getAvailableModuleIds();
  const cards = MODULE_CARDS.map((m) => {
    const isAvailable = m.available && availableModuleIds.includes(m.id);
    const icon = m.id;
    if (!isAvailable) {
      return `
        <div class="choice-card disabled" aria-disabled="true">
          <div class="choice-icon">${icon}</div>
          <h3>${t("module.label", { n: m.id })}</h3>
          <p>${t(m.descKey)}</p>
          <span class="badge badge-amber" style="margin-top:14px;">${t("home.comingSoon")}</span>
        </div>`;
    }
    return `
      <a class="choice-card" href="#/module/${m.id}" data-nav-link>
        <div class="choice-icon">${icon}</div>
        <h3>${t("module.label", { n: m.id })}</h3>
        <p>${t(m.descKey)}</p>
        ${m.sourceKey ? `<p style="font-size:12.5px;color:var(--text-muted);margin-top:6px;"><strong>${t("modules.sourceLabel")}:</strong> ${t(m.sourceKey)}</p>` : ""}
        <span class="badge badge-green" style="margin-top:14px;">${t("home.available")}</span>
      </a>`;
  }).join("");

  root.innerHTML = `
    <div class="container">
      <div class="breadcrumb"><a href="#/" data-nav-link>${t("nav.home")}</a> / ${t("modules.breadcrumb")}</div>
      <h1>${t("modules.title")}</h1>
      <p class="section-sub">${t("modules.subtitle")}</p>
      <div class="grid grid-3">${cards}</div>
    </div>
  `;
}
