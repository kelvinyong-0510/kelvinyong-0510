(() => {
  if (window.__snippetManagerInjected) {
    return;
  }
  window.__snippetManagerInjected = true;

  const TRIGGER_PATTERN = /(^|\s)(;[^\s]+)$/;
  const COMPOSER_SELECTOR =
    'div[contenteditable="true"][role="textbox"][data-tab]';

  const snippetMap = new Map();
  let isReplacing = false;

  const isContentEditable = (element) =>
    element?.isContentEditable && !element.closest("[contenteditable='false']");

  const findComposer = (element) => {
    if (!element) {
      return null;
    }

    if (element.matches?.(COMPOSER_SELECTOR)) {
      return element;
    }

    const candidate = element.closest?.(COMPOSER_SELECTOR);
    if (candidate) {
      return candidate;
    }

    if (isContentEditable(element)) {
      return element;
    }

    return null;
  };

  const getActiveComposer = () => {
    const active = document.activeElement;
    const fromActive = findComposer(active);
    if (fromActive) {
      return fromActive;
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
      return findComposer(anchorNode);
    }

    return findComposer(anchorNode.parentElement);
  };

  const getTextBeforeCursor = (composer) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return "";
    }

    const range = selection.getRangeAt(0);
    if (!composer.contains(range.startContainer)) {
      return "";
    }

    const preRange = range.cloneRange();
    preRange.selectNodeContents(composer);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString();
  };

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

  const replaceTrigger = (composer, trigger, content, endWith) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    deleteCharactersFromRange(range, trigger.length);

    const insertedText = content + endWith;
    const inserted = document.execCommand?.("insertText", false, insertedText);
    if (!inserted) {
      insertContentEditableText(range, insertedText);
    }

    selection.removeAllRanges();
    selection.addRange(range);
    dispatchInputEvent(composer);
  };

  const expandIfMatched = (event, endWith) => {
    if (isReplacing) {
      return;
    }

    const composer = getActiveComposer();
    if (!composer) {
      return;
    }

    const textBefore = getTextBeforeCursor(composer);
    const match = textBefore.match(TRIGGER_PATTERN);
    if (!match) {
      return;
    }

    const trigger = match[2];
    const snippet = snippetMap.get(trigger);
    if (!snippet || !snippet.enabled) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    isReplacing = true;
    try {
      replaceTrigger(composer, trigger, snippet.content, endWith);
    } finally {
      window.setTimeout(() => {
        isReplacing = false;
      }, 0);
    }
  };

  const handleKeydown = (event) => {
    if (event.isComposing) {
      return;
    }

    if (![(" "), "Enter", "Tab"].includes(event.key)) {
      return;
    }

    const endWith = event.key === " " ? " " : event.key === "Enter" ? "\n" : "";
    expandIfMatched(event, endWith);
  };

  const handleBeforeInput = (event) => {
    if (event.inputType === "insertText" && event.data === " ") {
      expandIfMatched(event, " ");
      return;
    }

    if (event.inputType === "insertParagraph") {
      expandIfMatched(event, "\n");
    }
  };

  const loadSnippets = async () => {
    if (!window.snippetStorage) {
      return;
    }
    const snippets = await window.snippetStorage.getSnippets();
    snippetMap.clear();
    snippets.forEach((snippet) => {
      if (snippet.trigger) {
        snippetMap.set(snippet.trigger, snippet);
      }
    });
  };

  const handleStorageChange = async () => {
    await loadSnippets();
  };

  loadSnippets();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" && areaName !== "local") {
      return;
    }
    if (changes.snippets) {
      handleStorageChange();
    }
  });

  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("beforeinput", handleBeforeInput, true);
})();
