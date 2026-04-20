// Создаем пункт меню при установке расширения
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pasteCustomList",
    title: "Вставить список слов",
    contexts: ["editable"]
  });
});

// Обработка клика по контекстному меню
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "pasteCustomList") {
    
    // Получаем сохраненный текст
    chrome.storage.sync.get(["customWordList"], (data) => {
      const text = data.customWordList || "";
      
      // Разбиваем текст на строки, убираем пробелы по краям и отфильтровываем пустые строки
      const words = text.split('\n').map(w => w.trim()).filter(w => w.length > 0);
      
      if (words.length === 0) return;

      // Выполняем скрипт вставки на активной странице
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (list) => {
          const el = document.activeElement;
          if (!el) return;

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
            await new Promise((r) => setTimeout(r, 39));
          }
        },
        args: [words]
      });
    });
  }
});