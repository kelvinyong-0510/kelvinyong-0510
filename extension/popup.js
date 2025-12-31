const form = document.getElementById("snippet-form");
const snippetIdInput = document.getElementById("snippet-id");
const triggerInput = document.getElementById("snippet-trigger");
const contentInput = document.getElementById("snippet-content");
const enabledInput = document.getElementById("snippet-enabled");
const listElement = document.getElementById("snippet-list");
const emptyState = document.getElementById("empty-state");
const formTitle = document.getElementById("form-title");
const cancelButton = document.getElementById("cancel-button");
const jsonArea = document.getElementById("json-area");
const exportButton = document.getElementById("export-button");
const importButton = document.getElementById("import-button");
const message = document.getElementById("message");

const normalizeTrigger = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith(";") ? trimmed : `;${trimmed}`;
};

const resetForm = () => {
  snippetIdInput.value = "";
  triggerInput.value = "";
  contentInput.value = "";
  enabledInput.checked = true;
  formTitle.textContent = "Add Snippet";
  cancelButton.hidden = true;
};

const populateForm = (snippet) => {
  snippetIdInput.value = snippet.id;
  triggerInput.value = snippet.trigger;
  contentInput.value = snippet.content;
  enabledInput.checked = snippet.enabled;
  formTitle.textContent = "Edit Snippet";
  cancelButton.hidden = false;
};

const setMessage = (text) => {
  message.textContent = text;
  if (text) {
    window.setTimeout(() => {
      message.textContent = "";
    }, 3000);
  }
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
    title.textContent = snippet.trigger;

    const content = document.createElement("pre");
    content.textContent = snippet.content;

    const actions = document.createElement("div");
    actions.className = "snippet-actions";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.textContent = snippet.enabled ? "Disable" : "Enable";
    toggleButton.addEventListener("click", async () => {
      const updated = snippets.map((item) =>
        item.id === snippet.id ? { ...item, enabled: !item.enabled } : item
      );
      await window.snippetStorage.setSnippets(updated);
      renderSnippets(updated);
    });

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
      await window.snippetStorage.setSnippets(updated);
      renderSnippets(updated);
      if (snippetIdInput.value === snippet.id) {
        resetForm();
      }
    });

    actions.append(toggleButton, editButton, deleteButton);
    card.append(title, content, actions);
    listElement.append(card);
  });
};

const loadSnippets = async () => {
  const snippets = await window.snippetStorage.getSnippets();
  renderSnippets(snippets);
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const snippets = await window.snippetStorage.getSnippets();
  const trigger = normalizeTrigger(triggerInput.value);

  if (!trigger) {
    triggerInput.focus();
    return;
  }

  const duplicate = snippets.find(
    (snippet) => snippet.trigger === trigger && snippet.id !== snippetIdInput.value
  );
  if (duplicate) {
    setMessage(`Trigger "${trigger}" is already in use.`);
    triggerInput.focus();
    return;
  }

  const id = snippetIdInput.value || crypto.randomUUID();
  const nextSnippet = {
    id,
    trigger,
    content: contentInput.value,
    enabled: enabledInput.checked,
  };

  const existingIndex = snippets.findIndex((snippet) => snippet.id === id);
  if (existingIndex >= 0) {
    snippets[existingIndex] = { ...snippets[existingIndex], ...nextSnippet };
  } else {
    snippets.unshift(nextSnippet);
  }

  await window.snippetStorage.setSnippets(snippets);
  renderSnippets(snippets);
  resetForm();
});

cancelButton.addEventListener("click", resetForm);

exportButton.addEventListener("click", async () => {
  const json = await window.snippetStorage.exportSnippets();
  jsonArea.value = json;
  jsonArea.select();
  document.execCommand("copy");
  setMessage("Snippets exported to clipboard.");
});

importButton.addEventListener("click", async () => {
  if (!jsonArea.value.trim()) {
    setMessage("Paste JSON to import.");
    return;
  }

  try {
    const snippets = await window.snippetStorage.importSnippets(jsonArea.value);
    renderSnippets(snippets);
    setMessage("Snippets imported.");
  } catch (error) {
    setMessage(error.message);
  }
});

loadSnippets();
