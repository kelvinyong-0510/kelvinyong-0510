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

  const isContentEditable = (element) =>
    element?.isContentEditable && !element.closest("[contenteditable='false']");

  const isEditable = (element) =>
    element &&
    !element.readOnly &&
    !element.disabled &&
    (element.tagName === "TEXTAREA" ||
      isTextInput(element) ||
      isContentEditable(element));

  const getTextBeforeCursor = (element) => {
    if (element.tagName === "TEXTAREA" || isTextInput(element)) {
      return element.value.slice(0, element.selectionStart ?? 0);
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return "";
    }

    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(element);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString();
  };

  const normalizeReplacement = (element, replacement) => {
    if (isTextInput(element)) {
      return replacement.replace(/\n/g, " ");
    }
    return replacement;
  };

  const replaceShortcut = (element, shortcut, replacement, endWith) => {
    const normalizedReplacement = normalizeReplacement(element, replacement);
    if (element.tagName === "TEXTAREA" || isTextInput(element)) {
      const cursorPosition = element.selectionStart ?? 0;
      const startIndex = cursorPosition - shortcut.length;
      element.setRangeText(
        normalizedReplacement + endWith,
        startIndex,
        cursorPosition,
        "end"
      );
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.startOffset < shortcut.length) {
      return;
    }
    range.setStart(range.startContainer, range.startOffset - shortcut.length);
    range.deleteContents();
    range.insertNode(document.createTextNode(normalizedReplacement + endWith));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleExpansion = (event, endWith) => {
    const activeElement = document.activeElement;
    if (!isEditable(activeElement)) {
      return;
    }

    const textBeforeCursor = getTextBeforeCursor(activeElement);
    const match = textBeforeCursor.match(/(^|\s)(\/[^\s]+)$/);

    if (!match) {
      return;
    }

    const shortcut = match[2];
    const snippet = snippetMap.get(shortcut);

    if (!snippet) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    replaceShortcut(activeElement, shortcut, snippet.content, endWith);
  };

  const handleKeydown = (event) => {
    if (![" ", "Enter", "Tab"].includes(event.key)) {
      return;
    }
    const endWith = event.key === " " ? " " : event.key === "Enter" ? "\n" : "";
    handleExpansion(event, endWith);
  };


  loadSnippets();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes[STORAGE_KEY]) {
      updateCache(changes[STORAGE_KEY].newValue);
    }
  });

  document.addEventListener("keydown", handleKeydown);
})();
