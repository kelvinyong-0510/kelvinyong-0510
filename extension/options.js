const form = document.getElementById("snippet-form");
const snippetIdInput = document.getElementById("snippet-id");
const shortcutInput = document.getElementById("snippet-shortcut");
const titleInput = document.getElementById("snippet-title");
const contentInput = document.getElementById("snippet-content");
const listElement = document.getElementById("snippet-list");
const emptyState = document.getElementById("empty-state");
const formTitle = document.getElementById("form-title");
const cancelButton = document.getElementById("cancel-button");

const STORAGE_KEY = "snippets";

const getSnippets = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEY]: [] }, (data) => {
      resolve(data[STORAGE_KEY]);
    });
  });

const saveSnippets = (snippets) =>
  new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: snippets }, resolve);
  });

const resetForm = () => {
  snippetIdInput.value = "";
  shortcutInput.value = "";
  titleInput.value = "";
  contentInput.value = "";
  formTitle.textContent = "Add Snippet";
  cancelButton.hidden = true;
};

const populateForm = (snippet) => {
  snippetIdInput.value = snippet.id;
  shortcutInput.value = snippet.shortcut ?? "";
  titleInput.value = snippet.title;
  contentInput.value = snippet.content;
  formTitle.textContent = "Edit Snippet";
  cancelButton.hidden = false;
};

const renderSnippets = (snippets) => {
  listElement.innerHTML = "";

  if (!snippets.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  snippets.forEach((snippet) => {
    const card = document.createElement("li");
    card.className = "snippet-card";

    const title = document.createElement("h3");
    title.textContent = snippet.shortcut || snippet.title;

    if (snippet.title && snippet.title !== snippet.shortcut) {
      const label = document.createElement("p");
      label.className = "snippet-title";
      label.textContent = snippet.title;
      card.append(title, label);
    } else {
      card.append(title);
    }

    const content = document.createElement("pre");
    content.textContent = snippet.content;

    const actions = document.createElement("div");
    actions.className = "snippet-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => populateForm(snippet));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.className = "danger";
    deleteButton.addEventListener("click", async () => {
      const updated = snippets.filter((item) => item.id !== snippet.id);
      await saveSnippets(updated);
      renderSnippets(updated);
      if (snippetIdInput.value === snippet.id) {
        resetForm();
      }
    });

    actions.append(editButton, deleteButton);
    card.append(content, actions);
    listElement.append(card);
  });
};

const init = async () => {
  const snippets = await getSnippets();
  renderSnippets(snippets);
};

const normalizeShortcut = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const snippets = await getSnippets();
  const id = snippetIdInput.value || crypto.randomUUID();
  const shortcut = normalizeShortcut(shortcutInput.value);

  if (!shortcut) {
    shortcutInput.focus();
    return;
  }

  const duplicate = snippets.find(
    (snippet) => snippet.shortcut === shortcut && snippet.id !== id
  );
  if (duplicate) {
    window.alert(`Shortcut "${shortcut}" is already in use.`);
    shortcutInput.focus();
    return;
  }

  const nextSnippet = {
    id,
    shortcut,
    title: titleInput.value.trim(),
    content: contentInput.value.trim(),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = snippets.findIndex((snippet) => snippet.id === id);

  if (existingIndex >= 0) {
    snippets[existingIndex] = { ...snippets[existingIndex], ...nextSnippet };
  } else {
    snippets.unshift(nextSnippet);
  }

  await saveSnippets(snippets);
  renderSnippets(snippets);
  resetForm();
});

cancelButton.addEventListener("click", resetForm);

init();
