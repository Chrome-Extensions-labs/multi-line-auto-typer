chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pasteCustomList",
    title: "Paste word list",
    contexts: ["editable"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "pasteCustomList") {
    chrome.storage.sync.get(["customWordList"], (data) => {
      const text = data.customWordList || "";
      const words = text.split("\n").map((word) => word.trim()).filter((word) => word.length > 0);

      if (words.length === 0) {
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (list) => {
          const el = document.activeElement;
          if (!el) {
            return;
          }

          const simulateInput = (word) => {
            const inputEvent = new InputEvent("input", {
              data: word,
              inputType: "insertText",
              bubbles: true,
              cancelable: true
            });

            el.value = word;
            el.dispatchEvent(inputEvent);

            el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, bubbles: true }));
          };

          for (const word of list) {
            simulateInput(word);
            await new Promise((resolve) => setTimeout(resolve, 39));
          }
        },
        args: [words]
      });
    });
  }
});
