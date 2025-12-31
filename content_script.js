let cachedSnippets = [];

const loadSnippets = () => {
  chrome.storage.sync.get({ snippets: [] }, (result) => {
    cachedSnippets = Array.isArray(result.snippets) ? result.snippets : [];
  });
};

const findMatchingSnippet = (input) => {
  if (!input) {
    return null;
  }

  return cachedSnippets.find((snippet) => snippet?.trigger === input) || null;
};

const applySnippet = (input) => {
  const snippet = findMatchingSnippet(input);
  if (!snippet) {
    return;
  }

  // TODO: Implement snippet replacement logic.
};

loadSnippets();

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "snippetsUpdated") {
    cachedSnippets = Array.isArray(message.snippets)
      ? message.snippets
      : [];
  }
});
