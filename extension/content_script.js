(() => {
  if (window.__snippetManagerInjected) {
    return;
  }
  window.__snippetManagerInjected = true;
  console.debug("Snippet Manager content script loaded.");
})();
