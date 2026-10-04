import test from "node:test";
import assert from "node:assert/strict";
import { loadSettings, saveProfileState } from "../src/shared/storage.js";

const syncData = { customWordList: "legacy\nwords" };
const localData = {};
let onContextClick;
let injected;
const keyEvents = [];

const area = (data) => ({
  get(keys, callback) {
    callback(Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, data[key]])));
  },
  set(values, callback) {
    Object.assign(data, values);
    callback();
  }
});

globalThis.chrome = {
  runtime: { lastError: null, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
  storage: { sync: area(syncData), local: area(localData) },
  contextMenus: {
    removeAll(callback) { callback(); },
    create() {},
    onClicked: { addListener(callback) { onContextClick = callback; } }
  },
  scripting: {
    async executeScript(options) {
      injected = options;
      return [{ result: await options.func(...options.args) }];
    }
  },
  debugger: {
    async attach() {},
    async sendCommand(_target, method, params) {
      assert.equal(method, "Input.dispatchKeyEvent");
      keyEvents.push(params);
    },
    async detach() {}
  },
  action: {
    async setBadgeText() {},
    async setBadgeBackgroundColor() {},
    async setTitle() {}
  }
};

class FakeInput {
  constructor() {
    this._value = "";
    this.events = [];
  }
  get value() { return this._value; }
  set value(value) { this._value = value; }
  focus() {}
  dispatchEvent(event) {
    this.events.push(event);
    return true;
  }
}

globalThis.HTMLInputElement = FakeInput;
globalThis.HTMLTextAreaElement = class {};
globalThis.HTMLElement = class {};
globalThis.InputEvent = class {
  constructor(type, options) { this.type = type; this.options = options; }
};
globalThis.KeyboardEvent = class {
  constructor(type, options) { this.type = type; this.key = options.key; }
};

await import("../src/background/service-worker.js");

test("imports the previous list into the default profile", async () => {
  const settings = await loadSettings();
  assert.equal(settings.profiles[0].wordList, "legacy\nwords");
  assert.equal(settings.activeProfileId, "default");
  assert.equal(settings.pressEnter, true);
});

test("uses the selected profile and joins words when Enter is disabled", async () => {
  await saveProfileState({
    activeProfileId: "second",
    profiles: [
      { id: "default", name: "Default", wordList: "wrong" },
      { id: "second", name: "Second", wordList: "one\ntwo" }
    ]
  });
  syncData.pressEnter = false;
  syncData.insertionDelayMs = 0;
  syncData.enterDelayMs = 0;
  const field = new FakeInput();
  globalThis.document = { activeElement: field };

  await onContextClick({ menuItemId: "pasteCustomList", frameId: 3 }, { id: 9 });

  assert.equal(field.value, "one two");
  assert.equal(keyEvents.length, 0);
  assert.deepEqual(injected.target, { tabId: 9, frameIds: [3] });
});

test("sends a browser Enter keydown and keyup after each entry", async () => {
  syncData.pressEnter = true;
  const field = new FakeInput();
  globalThis.document = { activeElement: field };

  await onContextClick({ menuItemId: "pasteCustomList", frameId: 0 }, { id: 9 });

  assert.equal(field.value, "two");
  assert.deepEqual(keyEvents.map((event) => event.type), ["keyDown", "keyUp", "keyDown", "keyUp"]);
  assert.equal(keyEvents[0].key, "Enter");
});
