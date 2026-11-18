// Loaded only by the local Node preview server, never by the published static site.
(() => {
  let revision = null;
  let checking = false;

  async function checkForChanges() {
    if (checking) return;
    checking = true;
    try {
      const response = await fetch("/__preview_revision", { cache: "no-store" });
      if (!response.ok) return;
      const current = (await response.json()).revision;
      if (revision !== null && current !== revision) {
        window.location.reload();
        return;
      }
      revision = current;
    } catch (_) {
      // Keep the page usable while the local server is restarting.
    } finally {
      checking = false;
    }
  }

  checkForChanges();
  setInterval(checkForChanges, 1500);
})();
