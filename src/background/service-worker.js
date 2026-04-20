import { CONTEXT_MENU_ID } from "../shared/constants.js";
import { parseWordList, sanitizeDelay } from "../shared/list.js";
import { loadSettings } from "../shared/storage.js";

const delay = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

const ensureContextMenu = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Paste word list",
      contexts: ["editable"]
    });
  });
};

const injectTypingSequence = async (tabId, words, delayMs) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: async (items, cadenceMs) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const activeElement = document.activeElement;

      if (!activeElement || items.length === 0) {
        return;
      }

      const dispatchEnterKey = (targetElement) => {
        targetElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
        targetElement.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
      };

      const updateInputValue = (targetElement, value) => {
        const prototype = Object.getPrototypeOf(targetElement);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

        if (descriptor?.set) {
          descriptor.set.call(targetElement, value);
        } else {
          targetElement.value = value;
        }

        targetElement.dispatchEvent(new InputEvent("input", {
          data: value,
          inputType: "insertText",
          bubbles: true,
          cancelable: true
        }));
      };

      const updateContentEditable = (targetElement, value) => {
        targetElement.focus();
        targetElement.textContent = value;
        targetElement.dispatchEvent(new InputEvent("input", {
          data: value,
          inputType: "insertText",
          bubbles: true,
          cancelable: true
        }));
      };

      for (const item of items) {
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          activeElement.focus();
          updateInputValue(activeElement, item);
          dispatchEnterKey(activeElement);
        } else if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
          updateContentEditable(activeElement, item);
          dispatchEnterKey(activeElement);
        } else {
          return;
        }

        await sleep(cadenceMs);
      }
    },
    args: [words, delayMs]
  });
};

chrome.runtime.onInstalled.addListener(ensureContextMenu);
chrome.runtime.onStartup.addListener(ensureContextMenu);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) {
    return;
  }

  const settings = await loadSettings();
  const words = parseWordList(settings.wordList, { skipDuplicates: settings.skipDuplicates });

  if (words.length === 0) {
    return;
  }

  const delayMs = sanitizeDelay(settings.insertionDelayMs);

  try {
    await injectTypingSequence(tab.id, words, delayMs);
  } catch {
    await delay(50);
  }
});
