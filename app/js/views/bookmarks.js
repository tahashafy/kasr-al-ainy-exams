import { getBookmarks, toggleBookmark } from "../store.js";
import { getQuestionById, getChapterMeta } from "../data.js";
import { escapeHtml } from "../router.js";
import { t } from "../i18n.js";

export function renderBookmarks(root) {
  const ids = getBookmarks();
  const questions = ids.map((id) => getQuestionById(id)).filter(Boolean);

  if (!questions.length) {
    root.innerHTML = `<div class="container-narrow"><div class="empty-state card"><div class="icon">⭐</div><h2>${t("bookmarks.emptyTitle")}</h2><p>${t("bookmarks.emptyDesc")}</p><a class="btn btn-primary" href="#/exams" data-nav-link>${t("mistakes.startPracticing")}</a></div></div>`;
    return;
  }

  root.innerHTML = `
    <div class="container">
      <h1>${t("bookmarks.title")}</h1>
      <p class="section-sub">${questions.length} ${t("bookmarks.subtitle")}</p>
      <div class="card">
        ${questions
          .map((q) => {
            const cm = q.chapter ? getChapterMeta(q.chapter) : null;
            return `<div class="review-item">
              <div style="display:flex;justify-content:space-between;gap:10px;">
                <div style="font-size:12px;color:var(--text-faint);margin-bottom:6px;">${cm ? escapeHtml(cm.categoryName + " — " + cm.title) : escapeHtml(q.category || t("common.uncategorized"))}</div>
                <button class="btn btn-ghost btn-sm" data-unmark="${q.id}" type="button">${t("bookmarks.remove")}</button>
              </div>
              <p style="font-weight:600;" dir="ltr">${escapeHtml(q.text)}</p>
              <div class="options" dir="ltr">
                ${q.options.map((opt) => `<div class="option${q.correctOptionId === opt.id ? " correct" : ""}"><span class="option-letter">${opt.id.toUpperCase()}</span><span>${escapeHtml(opt.text)}</span></div>`).join("")}
              </div>
            </div>`;
          })
          .join("")}
      </div>
    </div>
  `;

  root.querySelectorAll("[data-unmark]").forEach((btn) =>
    btn.addEventListener("click", () => {
      toggleBookmark(btn.dataset.unmark);
      renderBookmarks(root);
    })
  );
}
