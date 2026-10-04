import { CONTEXT_MENU_ID, DEFAULTS } from "../shared/constants.js";
import { parseWordList, sanitizeDelay } from "../shared/list.js";
import { loadSettings } from "../shared/storage.js";

const delay = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));
const activeRuns = new Set();

const ensureContextMenu = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Paste word list",
      contexts: ["editable"]
    });
  });
};

const setFieldText = async (tabId, frameId, text, joinEntries) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    func: (value, asBlock) => {
      const element = document.activeElement;
      if (!element) return false;

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        if (element.disabled || element.readOnly) return false;
        const text = asBlock && element instanceof HTMLInputElement
          ? value.replaceAll("\n", " ") : value;
        element.focus();
        const prototype = Object.getPrototypeOf(element);
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (setter) setter.call(element, text);
        else element.value = text;
        element.dispatchEvent(new InputEvent("input", {
          data: text,
          inputType: "insertText",
          bubbles: true,
          cancelable: true
        }));
        return true;
      }

      if (element instanceof HTMLElement && element.isContentEditable) {
        element.focus();
        element.textContent = value;
        element.dispatchEvent(new InputEvent("input", {
          data: value,
          inputType: "insertText",
          bubbles: true,
          cancelable: true
        }));
        return true;
      }
      return false;
    },
    args: [text, joinEntries]
  });
  return results?.[0]?.result === true;
};

const pressRealEnter = async (tabId) => {
  const target = { tabId };
  const key = {
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13
  };
  await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
    ...key,
    type: "keyDown",
    text: "\r",
    unmodifiedText: "\r"
  });
  await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
    ...key,
    type: "keyUp"
  });
};

const insertWords = async (tabId, frameId, words, delayMs, enterDelayMs, pressEnter) => {
  if (!pressEnter) {
    await setFieldText(tabId, frameId, words.join("\n"), true);
    return;
  }

  const target = { tabId };
  await chrome.debugger.attach(target, "1.3");
  try {
    for (const [index, word] of words.entries()) {
      if (!(await setFieldText(tabId, frameId, word, false))) break;
      if (enterDelayMs > 0) await delay(enterDelayMs);
      await pressRealEnter(tabId);
      if (index < words.length - 1) await delay(delayMs);
    }
  } finally {
    await chrome.debugger.detach(target);
  }
};

chrome.runtime.onInstalled.addListener(ensureContextMenu);
chrome.runtime.onStartup.addListener(ensureContextMenu);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || tab?.id == null || activeRuns.has(tab.id)) return;
  activeRuns.add(tab.id);
  try {
    const settings = await loadSettings();
    const activeProfile = settings.profiles.find((profile) => profile.id === settings.activeProfileId);
    const words = parseWordList(activeProfile?.wordList, { skipDuplicates: settings.skipDuplicates });
    if (words.length === 0) return;

    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    await chrome.action.setTitle({ tabId: tab.id, title: "List settings" });
    await insertWords(
      tab.id,
      info.frameId ?? 0,
      words,
      sanitizeDelay(settings.insertionDelayMs),
      sanitizeDelay(settings.enterDelayMs, DEFAULTS.enterDelayMs),
      settings.pressEnter
    );
  } catch (error) {
    console.error("Could not insert word list:", error);
    await Promise.allSettled([
      chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#c62828" }),
      chrome.action.setBadgeText({ tabId: tab.id, text: "ERR" }),
      chrome.action.setTitle({ tabId: tab.id, title: `Insertion failed: ${error.message}` })
    ]);
  } finally {
    activeRuns.delete(tab.id);
  }
});
