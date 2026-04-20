import { DEFAULTS, STORAGE_KEYS } from "./constants.js";
import { sanitizeDelay } from "./list.js";

const getFromStorage = (keys) => new Promise((resolve) => {
  chrome.storage.sync.get(keys, (result) => resolve(result));
});

const setInStorage = (values) => new Promise((resolve) => {
  chrome.storage.sync.set(values, () => resolve());
});

export const loadSettings = async () => {
  const data = await getFromStorage([
    STORAGE_KEYS.wordList,
    STORAGE_KEYS.theme,
    STORAGE_KEYS.insertionDelayMs,
    STORAGE_KEYS.skipDuplicates
  ]);

  return {
    wordList: typeof data[STORAGE_KEYS.wordList] === "string" ? data[STORAGE_KEYS.wordList] : "",
    theme: data[STORAGE_KEYS.theme] === "light" ? "light" : DEFAULTS.theme,
    insertionDelayMs: sanitizeDelay(data[STORAGE_KEYS.insertionDelayMs]),
    skipDuplicates: Boolean(data[STORAGE_KEYS.skipDuplicates])
  };
};

export const saveSettings = async (settings) => {
  const toStore = {};

  if (typeof settings.wordList === "string") {
    toStore[STORAGE_KEYS.wordList] = settings.wordList;
  }

  if (settings.theme === "light" || settings.theme === "dark") {
    toStore[STORAGE_KEYS.theme] = settings.theme;
  }

  if (settings.insertionDelayMs !== undefined) {
    toStore[STORAGE_KEYS.insertionDelayMs] = sanitizeDelay(settings.insertionDelayMs);
  }

  if (settings.skipDuplicates !== undefined) {
    toStore[STORAGE_KEYS.skipDuplicates] = Boolean(settings.skipDuplicates);
  }

  await setInStorage(toStore);
};
