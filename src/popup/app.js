import { DEFAULTS } from "../shared/constants.js";
import { parseWordList, sanitizeDelay } from "../shared/list.js";
import { loadSettings, saveSettings } from "../shared/storage.js";

const root = document.documentElement;
const textarea = document.getElementById("wordList");
const saveBtn = document.getElementById("saveBtn");
const statusDiv = document.getElementById("status");
const themeToggle = document.getElementById("themeToggle");
const delayInput = document.getElementById("delayMs");
const skipDuplicatesInput = document.getElementById("skipDuplicates");
const wordCountDiv = document.getElementById("wordCount");

let statusTimerId;

const showStatus = (message, timeoutMs = 2500) => {
  clearTimeout(statusTimerId);
  statusDiv.textContent = message;

  if (timeoutMs > 0) {
    statusTimerId = window.setTimeout(() => {
      statusDiv.textContent = "";
    }, timeoutMs);
  }
};

const applyTheme = (theme) => {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  root.setAttribute("data-theme", normalizedTheme);

  if (normalizedTheme === "light") {
    themeToggle.textContent = "🌙";
    themeToggle.setAttribute("aria-label", "Switch to dark theme");
  } else {
    themeToggle.textContent = "☀️";
    themeToggle.setAttribute("aria-label", "Switch to light theme");
  }
};

const updateWordCount = () => {
  const parsedWords = parseWordList(textarea.value, {
    skipDuplicates: skipDuplicatesInput.checked
  });
  wordCountDiv.textContent = `${parsedWords.length} items ready`;
};

const initialize = async () => {
  const settings = await loadSettings();

  textarea.value = settings.wordList;
  delayInput.value = String(settings.insertionDelayMs);
  skipDuplicatesInput.checked = settings.skipDuplicates;
  applyTheme(settings.theme);
  updateWordCount();
};

saveBtn.addEventListener("click", async () => {
  const delayMs = sanitizeDelay(delayInput.value);

  await saveSettings({
    wordList: textarea.value,
    insertionDelayMs: delayMs,
    skipDuplicates: skipDuplicatesInput.checked
  });

  delayInput.value = String(delayMs);
  updateWordCount();
  showStatus("Settings saved");
});

textarea.addEventListener("input", updateWordCount);
skipDuplicatesInput.addEventListener("change", updateWordCount);

delayInput.addEventListener("blur", () => {
  delayInput.value = String(sanitizeDelay(delayInput.value));
});

themeToggle.addEventListener("click", async () => {
  const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  await saveSettings({ theme: nextTheme });
});

initialize().catch(() => {
  applyTheme(DEFAULTS.theme);
  showStatus("Unable to load saved settings", 4000);
});
