chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes.snippets) {
    return;
  }

  const updatedSnippets = changes.snippets.newValue || [];

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id === undefined) {
        return;
      }
      chrome.tabs.sendMessage(tab.id, {
        type: "snippetsUpdated",
        snippets: updatedSnippets,
      });
    });
  });
});
