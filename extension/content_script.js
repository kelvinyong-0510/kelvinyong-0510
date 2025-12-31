(() => {
  if (window.__snippetManagerInjected) {
    return;
  }
  window.__snippetManagerInjected = true;

  const STORAGE_KEY = "snippets";
  const snippetMap = new Map();

  const updateCache = (snippets = []) => {
    snippetMap.clear();
    snippets.forEach((snippet) => {
      if (snippet?.shortcut) {
        snippetMap.set(snippet.shortcut, snippet);
      }
    });
  };

  const loadSnippets = () => {
    chrome.storage.sync.get({ [STORAGE_KEY]: [] }, (data) => {
      updateCache(data[STORAGE_KEY]);
    });
  };

  const isTextInput = (element) => {
    if (!element || element.tagName !== "INPUT") {
      return false;
    }
    const allowedTypes = ["text", "search", "url", "email", "tel", ""];
    return (
      !element.readOnly &&
      !element.disabled &&
      allowedTypes.includes(element.type)
    );
  };

  const isEditable = (element) =>
    element &&
    !element.readOnly &&
    !element.disabled &&
    (element.tagName === "TEXTAREA" || isTextInput(element));

  const handleShortcut = (event) => {
    if (![" ", "Enter", "Tab"].includes(event.key)) {
      return;
    }

    const activeElement = document.activeElement;
    if (!isEditable(activeElement)) {
      return;
    }

    const cursorPosition = activeElement.selectionStart;
    if (cursorPosition == null) {
      return;
    }

    const value = activeElement.value;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/(^|\s)(\/[^\s]+)$/);

    if (!match) {
      return;
    }

    const shortcut = match[2];
    const snippet = snippetMap.get(shortcut);

    if (!snippet) {
      return;
    }

    event.preventDefault();

    const replacement =
      snippet.content + (event.key === " " ? " " : event.key === "Enter" ? "\n" : "");
    const startIndex = cursorPosition - shortcut.length;
    activeElement.setRangeText(replacement, startIndex, cursorPosition, "end");
  };

  loadSnippets();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes[STORAGE_KEY]) {
      updateCache(changes[STORAGE_KEY].newValue);
    }
  });

  document.addEventListener("keydown", handleShortcut);
})();
