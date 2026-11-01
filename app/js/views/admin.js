// Admin-only usage stats. Not linked from the nav — reached directly at
// #/admin. Gated by a real Firebase Auth login (see remoteSync.js /
// firestore.rules), not just a hidden URL: a signed-out visitor, or anyone
// signed in as something other than the one admin account, gets a
// permission error from Firestore itself when the query runs, regardless
// of what this page's own JS does.
import { isRemoteEnabled, adminSignIn, adminSignOut, onAdminAuthChanged, fetchAllStudentsSummary } from "../store.js";
import { escapeHtml } from "../router.js";
import { t } from "../i18n.js";

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export function renderAdmin(root) {
  if (!isRemoteEnabled()) {
    root.innerHTML = `<div class="container-narrow"><div class="empty-state card"><div class="icon">🔒</div><h2>${t("admin.offTitle")}</h2><p>${t("admin.offDesc")}</p></div></div>`;
    return;
  }

  root.innerHTML = `<div class="container"><div id="admin-area"></div></div>`;
  const area = root.querySelector("#admin-area");
  paintLoggedOut(area); // shown immediately; onAdminAuthChanged below repaints once Firebase reports the real state

  onAdminAuthChanged((user) => {
    if (user) paintLoggedIn(area, user);
    else paintLoggedOut(area);
  });
}

function paintLoggedOut(area) {
  area.innerHTML = `
    <div class="card" style="max-width:420px;margin:40px auto;">
      <h2 class="section-title">${t("admin.loginTitle")}</h2>
      <p class="section-sub">${t("admin.loginDesc")}</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <input type="email" id="admin-email" placeholder="${t("admin.emailPlaceholder")}" dir="ltr" autocomplete="username" />
        <input type="password" id="admin-password" placeholder="${t("admin.passwordPlaceholder")}" dir="ltr" autocomplete="current-password" />
        <button class="btn btn-primary" id="admin-login-btn" type="button">${t("admin.loginBtn")}</button>
        <p id="admin-login-error" style="color:var(--red-600);font-size:12.5px;display:none;"></p>
      </div>
    </div>`;
  const doLogin = async () => {
    const email = area.querySelector("#admin-email").value.trim();
    const password = area.querySelector("#admin-password").value;
    const errEl = area.querySelector("#admin-login-error");
    errEl.style.display = "none";
    const result = await adminSignIn(email, password);
    if (!result.ok) {
      errEl.textContent = result.error;
      errEl.style.display = "block";
    }
    // on success, onAdminAuthChanged's callback repaints the page — nothing else to do here
  };
  area.querySelector("#admin-login-btn").addEventListener("click", doLogin);
  area.querySelector("#admin-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
}

async function paintLoggedIn(area, user) {
  area.innerHTML = `<p>${t("admin.loading")}</p>`;
  const result = await fetchAllStudentsSummary();
  if (!result.ok) {
    area.innerHTML = `<div class="card"><p style="color:var(--red-600);">${escapeHtml(result.error)}</p></div>`;
    return;
  }
  const rows = result.rows.slice().sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
  const usedCount = rows.filter((r) => (r.attemptsCount || 0) > 0).length;

  area.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
      <div>
        <h1 style="margin-bottom:4px;">${t("admin.title")}</h1>
        <p class="section-sub" style="margin:0;" dir="ltr">${escapeHtml(user.email || "")}</p>
      </div>
      <button class="btn btn-secondary btn-sm" id="admin-logout-btn" type="button">${t("admin.logoutBtn")}</button>
    </div>
    <div class="stat-grid" style="margin-bottom:20px;">
      <div class="stat-tile"><div class="num">${rows.length}</div><div class="label">${t("admin.statCodes")}</div></div>
      <div class="stat-tile"><div class="num">${usedCount}</div><div class="label">${t("admin.statUsed")}</div></div>
      <div class="stat-tile"><div class="num">${rows.length - usedCount}</div><div class="label">${t("admin.statUnused")}</div></div>
    </div>
    <div class="card">
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr>
            <th>${t("admin.colCode")}</th>
            <th>${t("admin.colFirstSeen")}</th>
            <th>${t("admin.colLastOpened")}</th>
            <th>${t("admin.colAttempts")}</th>
            <th>${t("admin.colLastAttempt")}</th>
          </tr></thead>
          <tbody>
            ${rows
              .map(
                (r) => `<tr>
              <td dir="ltr" style="font-weight:600;">${escapeHtml(r.code)}</td>
              <td dir="ltr">${fmt(r.createdAt)}</td>
              <td dir="ltr">${fmt(r.lastOpenedAt)}</td>
              <td>${r.attemptsCount || 0}${!r.attemptsCount ? ` <span class="badge badge-gray" style="margin-left:6px;">${t("admin.badgeUnused")}</span>` : ""}</td>
              <td dir="ltr">${fmt(r.lastAttemptAt)}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>`;
  area.querySelector("#admin-logout-btn").addEventListener("click", () => adminSignOut());
}
