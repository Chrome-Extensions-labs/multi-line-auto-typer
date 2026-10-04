import { DEFAULTS, STORAGE_KEYS } from "./constants.js";
import { sanitizeDelay } from "./list.js";

const read = (area, keys) => new Promise((resolve, reject) => {
  area.get(keys, (result) => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message));
    else resolve(result);
  });
});

const write = (area, values) => new Promise((resolve, reject) => {
  area.set(values, () => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message));
    else resolve();
  });
});

const normalizeProfileState = (value) => {
  const seen = new Set();
  const profiles = Array.isArray(value?.profiles) ? value.profiles.flatMap((profile) => {
    if (typeof profile?.id !== "string" || !profile.id || seen.has(profile.id)) return [];
    seen.add(profile.id);
    return [{
      id: profile.id,
      name: typeof profile.name === "string" && profile.name.trim() ? profile.name.trim().slice(0, 50) : "Profile",
      wordList: typeof profile.wordList === "string" ? profile.wordList : ""
    }];
  }) : [];

  if (profiles.length === 0) profiles.push({ id: "default", name: "Default", wordList: "" });

  return {
    profiles,
    activeProfileId: profiles.some((profile) => profile.id === value?.activeProfileId)
      ? value.activeProfileId : profiles[0].id
  };
};

export const loadSettings = async () => {
  const [syncData, localData] = await Promise.all([
    read(chrome.storage.sync, [
      STORAGE_KEYS.wordList,
      STORAGE_KEYS.theme,
      STORAGE_KEYS.insertionDelayMs,
      STORAGE_KEYS.enterDelayMs,
      STORAGE_KEYS.skipDuplicates,
      STORAGE_KEYS.pressEnter
    ]),
    read(chrome.storage.local, [STORAGE_KEYS.profileState])
  ]);

  let profileState;
  if (localData[STORAGE_KEYS.profileState]) {
    profileState = normalizeProfileState(localData[STORAGE_KEYS.profileState]);
  } else {
    profileState = normalizeProfileState(null);
    profileState.profiles[0].wordList = typeof syncData[STORAGE_KEYS.wordList] === "string"
      ? syncData[STORAGE_KEYS.wordList] : "";
    await write(chrome.storage.local, { [STORAGE_KEYS.profileState]: profileState });
  }

  return {
    ...profileState,
    theme: syncData[STORAGE_KEYS.theme] === "light" ? "light" : DEFAULTS.theme,
    insertionDelayMs: sanitizeDelay(syncData[STORAGE_KEYS.insertionDelayMs]),
    enterDelayMs: sanitizeDelay(syncData[STORAGE_KEYS.enterDelayMs], DEFAULTS.enterDelayMs),
    skipDuplicates: Boolean(syncData[STORAGE_KEYS.skipDuplicates]),
    pressEnter: syncData[STORAGE_KEYS.pressEnter] !== false
  };
};

export const saveProfileState = (value) => write(chrome.storage.local, {
  [STORAGE_KEYS.profileState]: normalizeProfileState(value)
});

export const saveSettings = async (settings) => {
  const toStore = {};

  if (settings.theme === "light" || settings.theme === "dark") {
    toStore[STORAGE_KEYS.theme] = settings.theme;
  }
  if (settings.insertionDelayMs !== undefined) {
    toStore[STORAGE_KEYS.insertionDelayMs] = sanitizeDelay(settings.insertionDelayMs);
  }
  if (settings.enterDelayMs !== undefined) {
    toStore[STORAGE_KEYS.enterDelayMs] = sanitizeDelay(settings.enterDelayMs, DEFAULTS.enterDelayMs);
  }
  if (settings.skipDuplicates !== undefined) {
    toStore[STORAGE_KEYS.skipDuplicates] = Boolean(settings.skipDuplicates);
  }
  if (settings.pressEnter !== undefined) {
    toStore[STORAGE_KEYS.pressEnter] = Boolean(settings.pressEnter);
  }

  if (Object.keys(toStore).length) await write(chrome.storage.sync, toStore);
};
