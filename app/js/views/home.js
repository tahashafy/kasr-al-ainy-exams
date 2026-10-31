import { t } from "../i18n.js";

export function renderHome(root) {
  root.innerHTML = `
    <div class="container">
      <div style="max-width:720px;margin:0 auto 32px;text-align:center;">
        <span class="badge badge-teal" style="margin-bottom:12px;">${t("home.badge")}</span>
        <h1 style="margin-top:10px;">${t("home.title")}</h1>
        <p>${t("home.subtitle")}</p>
      </div>
      <div class="grid grid-2">
        <a class="choice-card" href="#/exams" data-nav-link>
          <div class="choice-icon">📘</div>
          <h3>${t("home.eomTitle")}</h3>
          <p>${t("home.eomDesc")}</p>
          <span class="badge badge-green" style="margin-top:14px;">${t("home.available")}</span>
        </a>
        <div class="choice-card disabled" aria-disabled="true">
          <div class="choice-icon">📗</div>
          <h3>${t("home.writtenTitle")}</h3>
          <p>${t("home.writtenDesc")}</p>
          <span class="badge badge-amber" style="margin-top:14px;">${t("home.comingSoon")}</span>
        </div>
      </div>

      <div class="card" style="margin-top:28px;">
        <h2 class="section-title">${t("home.trustTitle")}</h2>
        <p class="section-sub">${t("home.trustDesc")}</p>
        <div class="grid grid-3">
          <div>
            <div class="badge badge-green">${t("home.readyLabel")}</div>
            <p style="margin-top:8px;font-size:13.5px;">${t("home.readyDesc")}</p>
          </div>
          <div>
            <div class="badge badge-amber">${t("home.reviewLabel")}</div>
            <p style="margin-top:8px;font-size:13.5px;">${t("home.reviewDesc")}</p>
          </div>
          <div>
            <div class="badge badge-gray">${t("home.coverageLabel")}</div>
            <p style="margin-top:8px;font-size:13.5px;">${t("home.coverageDesc")}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}
