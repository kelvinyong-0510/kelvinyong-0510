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

  const getActiveEditable = () => {
    const activeElement = document.activeElement;
    if (activeElement && (isTextInput(activeElement) || activeElement.tagName === "TEXTAREA")) {
      return activeElement;
    }

    if (activeElement && isContentEditable(activeElement)) {
      return activeElement;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const anchorNode = selection.anchorNode;
    if (!anchorNode) {
      return null;
    }

    if (anchorNode.nodeType === Node.ELEMENT_NODE) {
      return anchorNode.closest?.("[contenteditable='true']") ?? null;
    }

    return anchorNode.parentElement?.closest("[contenteditable='true']") ?? null;
  };

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

  const normalizeReplacement = (element, replacement) =>
    isTextInput(element) ? replacement.replace(/\n/g, " ") : replacement;

  const getPreviousTextNode = (node) => {
    let current = node;
    while (current) {
      if (current.previousSibling) {
        current = current.previousSibling;
        while (current && current.lastChild) {
          current = current.lastChild;
        }
      } else {
        current = current.parentNode;
      }

      if (current?.nodeType === Node.TEXT_NODE) {
        return current;
      }
    }
    return null;
  };

  const deleteCharactersFromRange = (range, count) => {
    let remaining = count;
    let currentNode = range.startContainer;
    let currentOffset = range.startOffset;

    while (remaining > 0 && currentNode) {
      if (currentNode.nodeType === Node.TEXT_NODE) {
        const available = currentOffset;
        const removeCount = Math.min(remaining, available);
        if (removeCount > 0) {
          const start = currentOffset - removeCount;
          currentNode.deleteData(start, removeCount);
          remaining -= removeCount;
          currentOffset = start;
        }
      }

      if (remaining > 0) {
        currentNode = getPreviousTextNode(currentNode);
        currentOffset = currentNode?.textContent?.length ?? 0;
      }
    }
  };

  const insertContentEditableText = (range, text) => {
    const parts = text.split("\n");
    const fragment = document.createDocumentFragment();
    parts.forEach((part, index) => {
      fragment.appendChild(document.createTextNode(part));
      if (index < parts.length - 1) {
        fragment.appendChild(document.createElement("br"));
      }
    });
    range.insertNode(fragment);
    range.collapse(false);
  };

  const dispatchInputEvent = (element) => {
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText" })
    );
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
    deleteCharactersFromRange(range, shortcut.length);
    const insertedText = normalizedReplacement + endWith;
    const inserted = document.execCommand?.("insertText", false, insertedText);
    if (!inserted) {
      insertContentEditableText(range, insertedText);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    dispatchInputEvent(element);
  };

  let isReplacing = false;

  const handleExpansion = (event, endWith) => {
    const activeElement = getActiveEditable();
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

    isReplacing = true;
    try {
      replaceShortcut(activeElement, shortcut, snippet.content, endWith);
    } finally {
      window.setTimeout(() => {
        isReplacing = false;
      }, 0);
    }
  };

  const handleKeydown = (event) => {
    if (![" ", "Enter", "Tab"].includes(event.key)) {
      return;
    }
    const endWith = event.key === " " ? " " : event.key === "Enter" ? "\n" : "";
    handleExpansion(event, endWith);
  };

  const handleBeforeInput = (event) => {
    if (event.inputType === "insertText" && event.data === " ") {
      handleExpansion(event, " ");
      return;
    }

    if (event.inputType === "insertParagraph") {
      handleExpansion(event, "\n");
    }
  };

  const handleInput = (event) => {
    if (isReplacing || event.isComposing) {
      return;
    }
    handleExpansion(null, "");
  };


  loadSnippets();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes[STORAGE_KEY]) {
      updateCache(changes[STORAGE_KEY].newValue);
    }
  });

  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("beforeinput", handleBeforeInput, true);
  document.addEventListener("input", handleInput, true);
})();
