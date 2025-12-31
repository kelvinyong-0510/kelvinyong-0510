const DEFAULT_TRIGGER = "/invoice";
const DEFAULT_SNIPPET = "Person In Charge:\nCompany Name:";
const STORAGE_KEYS = {
  shortcut: "savedShortcut",
  snippet: "savedSnippet",
};

let activeTrigger = DEFAULT_TRIGGER;
let activeSnippet = DEFAULT_SNIPPET;

function setConfig({ shortcut, snippet }) {
  if (typeof shortcut === "string" && shortcut.trim()) {
    activeTrigger = shortcut;
  } else {
    activeTrigger = DEFAULT_TRIGGER;
  }

  if (typeof snippet === "string" && snippet.trim()) {
    activeSnippet = snippet;
  } else {
    activeSnippet = DEFAULT_SNIPPET;
  }
}

async function loadConfig() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    const data = await chrome.storage.local.get({
      [STORAGE_KEYS.shortcut]: DEFAULT_TRIGGER,
      [STORAGE_KEYS.snippet]: DEFAULT_SNIPPET,
    });
    setConfig({
      shortcut: data[STORAGE_KEYS.shortcut],
      snippet: data[STORAGE_KEYS.snippet],
    });
    return;
  }

  const shortcut = localStorage.getItem(STORAGE_KEYS.shortcut);
  const snippet = localStorage.getItem(STORAGE_KEYS.snippet);
  setConfig({ shortcut, snippet });
}

if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }

    const shortcut =
      changes[STORAGE_KEYS.shortcut]?.newValue ?? activeTrigger;
    const snippet = changes[STORAGE_KEYS.snippet]?.newValue ?? activeSnippet;
    setConfig({ shortcut, snippet });
  });
}

loadConfig();

function isTextInput(target) {
  return (
    target instanceof HTMLInputElement &&
    (!target.type || target.type.toLowerCase() === "text")
  );
}

function isEditable(target) {
  return (
    target instanceof HTMLTextAreaElement ||
    isTextInput(target) ||
    target.isContentEditable
  );
}

function getEditableRoot(target) {
  if (target instanceof HTMLTextAreaElement || isTextInput(target)) {
    return target;
  }

  if (target.isContentEditable) {
    return target;
  }

  if (target instanceof Element) {
    return target.closest("[contenteditable='true']");
  }

  return null;
}

function getTextBeforeCursor(target) {
  if (target instanceof HTMLTextAreaElement || isTextInput(target)) {
    return target.value.slice(0, target.selectionStart || 0);
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return "";
  }

  const range = selection.getRangeAt(0);
  if (!target.contains(range.endContainer)) {
    return "";
  }

  const beforeRange = range.cloneRange();
  beforeRange.selectNodeContents(target);
  beforeRange.setEnd(range.endContainer, range.endOffset);
  return beforeRange.toString();
}

function createRangeFromOffsets(root, startOffset, endOffset) {
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let currentNode = walker.nextNode();
  let currentIndex = 0;
  let startSet = false;

  while (currentNode) {
    const nodeLength = currentNode.nodeValue.length;
    const nextIndex = currentIndex + nodeLength;

    if (!startSet && startOffset <= nextIndex) {
      range.setStart(currentNode, Math.max(0, startOffset - currentIndex));
      startSet = true;
    }

    if (startSet && endOffset <= nextIndex) {
      range.setEnd(currentNode, Math.max(0, endOffset - currentIndex));
      return range;
    }

    currentIndex = nextIndex;
    currentNode = walker.nextNode();
  }

  range.selectNodeContents(root);
  range.collapse(false);
  return range;
}

function insertTextAtCursorTextControl(target, text, triggerLength) {
  const selectionStart = target.selectionStart || 0;
  const selectionEnd = target.selectionEnd || selectionStart;
  const triggerStart = selectionStart - triggerLength;

  if (triggerStart < 0) {
    return;
  }

  const before = target.value.slice(0, triggerStart);
  const after = target.value.slice(selectionEnd);
  const nextValue = `${before}${text}${after}`;
  const nextCursor = before.length + text.length;

  target.value = nextValue;
  target.setSelectionRange(nextCursor, nextCursor);
}

function insertTextAtCursorContentEditable(target, text, triggerLength) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (!target.contains(range.endContainer)) {
    return;
  }

  const beforeRange = range.cloneRange();
  beforeRange.selectNodeContents(target);
  beforeRange.setEnd(range.endContainer, range.endOffset);
  const cursorIndex = beforeRange.toString().length;
  const triggerStart = cursorIndex - triggerLength;

  if (triggerStart < 0) {
    return;
  }

  const replaceRange = createRangeFromOffsets(
    target,
    triggerStart,
    cursorIndex
  );
  replaceRange.deleteContents();
  selection.removeAllRanges();
  selection.addRange(replaceRange);

  if (document.queryCommandSupported?.("insertText")) {
    document.execCommand("insertText", false, text);
    return;
  }

  const lines = text.split("\n");
  const fragment = document.createDocumentFragment();
  let lastNode = null;
  lines.forEach((line, index) => {
    if (line) {
      lastNode = document.createTextNode(line);
      fragment.appendChild(lastNode);
    }

    if (index < lines.length - 1) {
      lastNode = document.createElement("br");
      fragment.appendChild(lastNode);
    }
  });

  replaceRange.insertNode(fragment);

  const newRange = document.createRange();
  if (lastNode) {
    newRange.setStartAfter(lastNode);
    newRange.collapse(true);
  } else {
    newRange.selectNodeContents(target);
    newRange.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(newRange);
}

function insertSnippetAtCursor(target, text, triggerLength) {
  if (target instanceof HTMLTextAreaElement || isTextInput(target)) {
    insertTextAtCursorTextControl(target, text, triggerLength);
    return;
  }

  if (target.isContentEditable) {
    insertTextAtCursorContentEditable(target, text, triggerLength);
  }
}

function handleInputEvent(event) {
  const editableTarget = getEditableRoot(event.target);
  if (!editableTarget || !isEditable(editableTarget)) {
    return;
  }

  const textBeforeCursor = getTextBeforeCursor(editableTarget);
  const lastWordMatch = textBeforeCursor.match(/(\S+)$/);
  const lastWord = lastWordMatch ? lastWordMatch[1] : "";

  if (lastWord === activeTrigger) {
    insertSnippetAtCursor(
      editableTarget,
      activeSnippet,
      activeTrigger.length
    );
  }
}

document.addEventListener("input", handleInputEvent);
document.addEventListener("keyup", handleInputEvent);
