const textarea = document.getElementById("wordList");
const saveBtn = document.getElementById("saveBtn");
const statusDiv = document.getElementById("status");

// При открытии окна загружаем сохраненный текст из storage
chrome.storage.sync.get(["customWordList"], (data) => {
  if (data.customWordList) {
    textarea.value = data.customWordList;
  }
});

// Сохраняем текст по клику
saveBtn.addEventListener("click", () => {
  const text = textarea.value;
  chrome.storage.sync.set({ customWordList: text }, () => {
    statusDiv.textContent = "Список сохранен!";
    setTimeout(() => {
      statusDiv.textContent = "";
    }, 2000);
  });
});