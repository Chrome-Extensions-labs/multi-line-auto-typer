import { DEFAULTS } from "../shared/constants.js";
import { parseWordList, sanitizeDelay } from "../shared/list.js";
import { loadSettings, saveProfileState, saveSettings } from "../shared/storage.js";

const root = document.documentElement;
const textarea = document.getElementById("wordList");
const saveBtn = document.getElementById("saveBtn");
const statusDiv = document.getElementById("status");
const themeToggle = document.getElementById("themeToggle");
const delayInput = document.getElementById("delayMs");
const enterDelayInput = document.getElementById("enterDelayMs");
const skipDuplicatesInput = document.getElementById("skipDuplicates");
const pressEnterInput = document.getElementById("pressEnter");
const wordCountDiv = document.getElementById("wordCount");
const profileSelect = document.getElementById("profileSelect");
const profileName = document.getElementById("profileName");
const newProfileBtn = document.getElementById("newProfile");
const duplicateProfileBtn = document.getElementById("duplicateProfile");
const deleteProfileBtn = document.getElementById("deleteProfile");

let state;
let busy = false;
let statusTimerId;

const activeProfile = () => state.profiles.find((profile) => profile.id === state.activeProfileId);

const showStatus = (message, timeoutMs = 2500) => {
  clearTimeout(statusTimerId);
  statusDiv.textContent = message;
  if (timeoutMs > 0) {
    statusTimerId = window.setTimeout(() => { statusDiv.textContent = ""; }, timeoutMs);
  }
};

const applyTheme = (theme) => {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  root.setAttribute("data-theme", normalizedTheme);
  themeToggle.textContent = normalizedTheme === "light" ? "🌙" : "☀️";
  themeToggle.setAttribute("aria-label", normalizedTheme === "light"
    ? "Switch to dark theme" : "Switch to light theme");
};

const updateWordCount = () => {
  const words = parseWordList(textarea.value, { skipDuplicates: skipDuplicatesInput.checked });
  wordCountDiv.textContent = `${words.length} entries ready`;
};

const renderProfile = () => {
  profileSelect.replaceChildren(...state.profiles.map((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    return option;
  }));
  profileSelect.value = state.activeProfileId;
  profileName.value = activeProfile().name;
  textarea.value = activeProfile().wordList;
  deleteProfileBtn.disabled = state.profiles.length === 1;
  updateWordCount();
};

const captureForm = () => {
  const profile = activeProfile();
  profile.name = profileName.value.trim().slice(0, 50) || profile.name;
  profile.wordList = textarea.value;
  state.insertionDelayMs = sanitizeDelay(delayInput.value);
  state.enterDelayMs = sanitizeDelay(enterDelayInput.value, DEFAULTS.enterDelayMs);
  state.skipDuplicates = skipDuplicatesInput.checked;
  state.pressEnter = pressEnterInput.checked;
};

const preferences = () => ({
  insertionDelayMs: state.insertionDelayMs,
  enterDelayMs: state.enterDelayMs,
  skipDuplicates: state.skipDuplicates,
  pressEnter: state.pressEnter
});

const persist = async () => {
  captureForm();
  await Promise.all([
    saveProfileState(state),
    saveSettings(preferences())
  ]);
  delayInput.value = String(state.insertionDelayMs);
  enterDelayInput.value = String(state.enterDelayMs);
};

const runAction = async (action) => {
  if (busy || !state) return;
  busy = true;
  saveBtn.disabled = true;
  profileSelect.disabled = true;
  newProfileBtn.disabled = true;
  duplicateProfileBtn.disabled = true;
  deleteProfileBtn.disabled = true;
  try {
    await action();
  } catch (error) {
    console.error(error);
    showStatus("Could not save changes", 4000);
    renderProfile();
  } finally {
    busy = false;
    saveBtn.disabled = false;
    profileSelect.disabled = false;
    newProfileBtn.disabled = false;
    duplicateProfileBtn.disabled = false;
    deleteProfileBtn.disabled = state.profiles.length === 1;
  }
};

const uniqueName = (base) => {
  const names = new Set(state.profiles.map((profile) => profile.name));
  let candidate = base;
  let number = 2;
  while (names.has(candidate)) candidate = `${base} ${number++}`;
  return candidate;
};

const addProfile = (copyCurrent) => runAction(async () => {
  captureForm();
  const source = activeProfile();
  const profile = {
    id: crypto.randomUUID(),
    name: uniqueName(copyCurrent ? `${source.name} copy` : "New profile"),
    wordList: copyCurrent ? source.wordList : ""
  };
  state.profiles.push(profile);
  state.activeProfileId = profile.id;
  await Promise.all([
    saveProfileState(state),
    saveSettings(preferences())
  ]);
  renderProfile();
  profileName.focus();
  profileName.select();
  showStatus(copyCurrent ? "Profile duplicated" : "Profile created");
});

const initialize = async () => {
  state = await loadSettings();
  delayInput.value = String(state.insertionDelayMs);
  enterDelayInput.value = String(state.enterDelayMs);
  skipDuplicatesInput.checked = state.skipDuplicates;
  pressEnterInput.checked = state.pressEnter;
  applyTheme(state.theme);
  renderProfile();
};

saveBtn.addEventListener("click", () => runAction(async () => {
  await persist();
  renderProfile();
  showStatus("Changes saved");
}));

profileSelect.addEventListener("change", () => {
  const selectedId = profileSelect.value;
  runAction(async () => {
    captureForm();
    state.activeProfileId = selectedId;
    await saveProfileState(state);
    await saveSettings(preferences());
    renderProfile();
    showStatus("Active profile changed");
  });
});

newProfileBtn.addEventListener("click", () => addProfile(false));
duplicateProfileBtn.addEventListener("click", () => addProfile(true));
deleteProfileBtn.addEventListener("click", () => {
  if (state.profiles.length < 2 || !window.confirm(`Delete profile "${activeProfile().name}"?`)) return;
  runAction(async () => {
    captureForm();
    state.profiles = state.profiles.filter((profile) => profile.id !== state.activeProfileId);
    state.activeProfileId = state.profiles[0].id;
    await Promise.all([
      saveProfileState(state),
      saveSettings(preferences())
    ]);
    renderProfile();
    showStatus("Profile deleted");
  });
});

for (const element of [textarea, profileName]) {
  element.addEventListener("input", () => {
    updateWordCount();
    showStatus("Unsaved changes", 0);
  });
}
for (const element of [delayInput, enterDelayInput, skipDuplicatesInput, pressEnterInput]) {
  element.addEventListener("change", () => {
    updateWordCount();
    showStatus("Unsaved changes", 0);
  });
}

delayInput.addEventListener("blur", () => {
  delayInput.value = String(sanitizeDelay(delayInput.value));
});
enterDelayInput.addEventListener("blur", () => {
  enterDelayInput.value = String(sanitizeDelay(enterDelayInput.value, DEFAULTS.enterDelayMs));
});

themeToggle.addEventListener("click", async () => {
  const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  try {
    await saveSettings({ theme: nextTheme });
  } catch (error) {
    console.error(error);
    applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    showStatus("Could not save theme", 4000);
  }
});

initialize().catch((error) => {
  console.error(error);
  applyTheme(DEFAULTS.theme);
  showStatus("Unable to load saved settings", 4000);
});
