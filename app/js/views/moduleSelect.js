import { t } from "../i18n.js";

export function renderModuleSelect(root) {
  root.innerHTML = `
    <div class="container">
      <div class="breadcrumb"><a href="#/" data-nav-link>${t("nav.home")}</a> / ${t("home.eomTitle")}</div>
      <h1>${t("modules.title")}</h1>
      <p class="section-sub">${t("modules.subtitle")}</p>
      <div class="grid grid-3">
        <a class="choice-card" href="#/module/101" data-nav-link>
          <div class="choice-icon">101</div>
          <h3>${t("module.label", { n: "101" })}</h3>
          <p>${t("modules.m101desc")}</p>
          <span class="badge badge-green" style="margin-top:14px;">${t("home.available")}</span>
        </a>
        <a class="choice-card" href="#/module/102" data-nav-link>
          <div class="choice-icon">102</div>
          <h3>${t("module.label", { n: "102" })}</h3>
          <p>${t("modules.m102desc")}</p>
          <span class="badge badge-green" style="margin-top:14px;">${t("home.available")}</span>
        </a>
        <div class="choice-card disabled" aria-disabled="true">
          <div class="choice-icon">103</div>
          <h3>${t("module.label", { n: "103" })}</h3>
          <p>${t("modules.m103desc")}</p>
          <span class="badge badge-amber" style="margin-top:14px;">${t("home.comingSoon")}</span>
        </div>
      </div>
    </div>
  `;
}
