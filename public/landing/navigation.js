/* Compatibility for student-app bookmarks from before the separate landing page. */
(() => {
  const appPages = new Set([
    "home", "diagnosis", "map", "simulation", "projects", "discovery",
    "region", "recommendation", "portfolio", "profile", "onboarding", "auth",
  ]);
  function continueAppBookmark() {
    const route = window.location.hash.slice(1).split("?")[0];
    if (appPages.has(route)) {
      window.location.replace("/app/" + window.location.search + window.location.hash);
    }
  }
  continueAppBookmark();
  window.addEventListener("hashchange", continueAppBookmark);
})();
