/* Compatibility for student-app bookmarks from before the separate landing page. */
(() => {
  const appPages = new Set([
    "home", "diagnosis", "map", "simulation", "projects", "discovery",
    "recommendation", "portfolio", "profile", "onboarding", "auth",
  ]);
  function continueAppBookmark() {
    const route = window.location.hash.slice(1).split("?")[0];
    if (route === "region") { window.location.replace("/app/#home"); return; }
    if (appPages.has(route)) {
      window.location.replace("/app/" + window.location.search + window.location.hash);
    }
  }
  continueAppBookmark();
  window.addEventListener("hashchange", continueAppBookmark);
})();
