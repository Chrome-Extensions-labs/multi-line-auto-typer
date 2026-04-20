const root = document.documentElement;
const textarea = document.getElementById("wordList");
const saveBtn = document.getElementById("saveBtn");
const statusDiv = document.getElementById("status");
const themeToggle = document.getElementById("themeToggle");

const applyTheme = (theme) => {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  root.setAttribute("data-theme", normalizedTheme);

  if (normalizedTheme === "light") {
    themeToggle.textContent = "🌙";
    themeToggle.setAttribute("aria-label", "Switch to dark theme");
    return;
  }

  themeToggle.textContent = "☀️";
  themeToggle.setAttribute("aria-label", "Switch to light theme");
};

chrome.storage.sync.get(["customWordList", "theme"], (data) => {
  if (data.customWordList) {
    textarea.value = data.customWordList;
  }

  applyTheme(data.theme);
});

saveBtn.addEventListener("click", () => {
  const text = textarea.value;

  chrome.storage.sync.set({ customWordList: text }, () => {
    statusDiv.textContent = "List saved!";
    setTimeout(() => {
      statusDiv.textContent = "";
    }, 2000);
  });
});

themeToggle.addEventListener("click", () => {
  const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  chrome.storage.sync.set({ theme: nextTheme });
});
