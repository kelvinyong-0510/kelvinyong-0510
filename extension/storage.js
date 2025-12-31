(() => {
  const STORAGE_KEY = "snippets";
  let resolvedArea = null;

  const normalizeSnippet = (snippet) => {
    if (!snippet || typeof snippet !== "object") {
      return null;
    }

    const trigger = String(
      snippet.trigger ?? snippet.shortcut ?? ""
    ).trim();
    const content = String(snippet.content ?? "");
    const enabled = snippet.enabled !== false;

    if (!trigger) {
      return null;
    }

    return {
      trigger,
      content,
      enabled,
    };
  };

  const resolveArea = () =>
    new Promise((resolve) => {
      if (resolvedArea) {
        resolve(resolvedArea);
        return;
      }

      if (!chrome?.storage?.sync) {
        resolvedArea = chrome.storage.local;
        resolve(resolvedArea);
        return;
      }

      chrome.storage.sync.get({ [STORAGE_KEY]: [] }, () => {
        if (chrome.runtime.lastError) {
          resolvedArea = chrome.storage.local;
        } else {
          resolvedArea = chrome.storage.sync;
        }
        resolve(resolvedArea);
      });
    });

  const getSnippets = async () => {
    const area = await resolveArea();
    return new Promise((resolve) => {
      area.get({ [STORAGE_KEY]: [] }, (data) => {
        const raw = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
        const normalized = raw
          .map(normalizeSnippet)
          .filter((snippet) => snippet);
        resolve(normalized);
      });
    });
  };

  const setSnippets = async (snippets) => {
    const area = await resolveArea();
    return new Promise((resolve) => {
      area.set({ [STORAGE_KEY]: snippets }, () => {
        if (chrome.runtime.lastError && area !== chrome.storage.local) {
          chrome.storage.local.set({ [STORAGE_KEY]: snippets }, resolve);
          return;
        }
        resolve();
      });
    });
  };

  const exportSnippets = async () => {
    const snippets = await getSnippets();
    return JSON.stringify(snippets, null, 2);
  };

  const importSnippets = async (payload) => {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid JSON: expected an array of snippets.");
    }
    const normalized = parsed
      .map(normalizeSnippet)
      .filter((snippet) => snippet);
    await setSnippets(normalized);
    return normalized;
  };

  window.snippetStorage = {
    getSnippets,
    setSnippets,
    exportSnippets,
    importSnippets,
  };
})();
