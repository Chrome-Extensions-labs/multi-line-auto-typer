import { DEFAULTS } from "./constants.js";

export const parseWordList = (rawText, { skipDuplicates = DEFAULTS.skipDuplicates } = {}) => {
  if (typeof rawText !== "string") {
    return [];
  }

  const uniqueItems = new Set();
  const parsedItems = [];

  for (const line of rawText.split(/\r?\n/)) {
    const normalizedLine = line.trim();
    if (!normalizedLine) {
      continue;
    }

    if (skipDuplicates) {
      if (uniqueItems.has(normalizedLine)) {
        continue;
      }
      uniqueItems.add(normalizedLine);
    }

    parsedItems.push(normalizedLine);

    if (parsedItems.length >= DEFAULTS.maxEntries) {
      break;
    }
  }

  return parsedItems;
};

export const sanitizeDelay = (value, fallback = DEFAULTS.insertionDelayMs) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(Math.round(parsed), 5000);
};
