// Minimal hash router. Routes are registered as {pattern, render}.
// Pattern segments starting with ":" are captured as params.

const routes = [];
let notFoundHandler = null;
let rootEl = null;

export function registerRoute(pattern, render) {
  routes.push({ pattern, render, segments: pattern.split("/").filter(Boolean) });
}

export function registerNotFound(render) {
  notFoundHandler = render;
}

function matchRoute(path) {
  const segments = path.split("/").filter(Boolean);
  for (const route of routes) {
    if (route.segments.length !== segments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < segments.length; i++) {
      const rs = route.segments[i];
      if (rs.startsWith(":")) params[rs.slice(1)] = decodeURIComponent(segments[i]);
      else if (rs !== segments[i]) { ok = false; break; }
    }
    if (ok) return { route, params };
  }
  return null;
}

export function navigate(path) {
  if (location.hash.slice(1) === path) {
    handleRoute();
  } else {
    location.hash = path;
  }
}

async function handleRoute() {
  const path = location.hash.slice(1) || "/";
  const match = matchRoute(path);
  rootEl.setAttribute("aria-busy", "true");
  window.scrollTo(0, 0);
  try {
    if (match) {
      await match.route.render(rootEl, match.params);
    } else if (notFoundHandler) {
      await notFoundHandler(rootEl);
    }
  } catch (err) {
    console.error("Route render failed", err);
    rootEl.innerHTML = `<div class="container"><div class="card error-card"><h2>Something went wrong</h2><p>${escapeHtml(
      String(err && err.message ? err.message : err)
    )}</p></div></div>`;
  }
  rootEl.removeAttribute("aria-busy");
  document.querySelectorAll("[data-nav-link]").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("href") === `#${path}`);
  });
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function startRouter(root) {
  rootEl = root;
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}
