const openOptionsButton = document.getElementById("open-options");

openOptionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
