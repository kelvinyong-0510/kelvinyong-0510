
const INVOICE_TRIGGER = "/invoice";
const INVOICE_SNIPPET =
  "Person In Charge:\nCompany Name:";

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
  lines.forEach((line, index) => {
    if (line) {
      fragment.appendChild(document.createTextNode(line));
    }

    if (index < lines.length - 1) {
      fragment.appendChild(document.createElement("br"));
    }
  });

  replaceRange.insertNode(fragment);

  const newRange = document.createRange();
  newRange.selectNodeContents(target);
  newRange.collapse(false);
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

  if (lastWord === INVOICE_TRIGGER) {
    insertSnippetAtCursor(
      editableTarget,
      INVOICE_SNIPPET,
      INVOICE_TRIGGER.length
    );
  }
}

document.addEventListener("input", handleInputEvent);
document.addEventListener("keyup", handleInputEvent);
