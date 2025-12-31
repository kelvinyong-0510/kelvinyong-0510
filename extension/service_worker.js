chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ snippets: [] }, (data) => {
    if (!Array.isArray(data.snippets)) {
      chrome.storage.sync.set({ snippets: [] });
    }
  });
});
