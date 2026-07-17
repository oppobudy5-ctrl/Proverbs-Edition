import assert from "node:assert/strict";

class MemoryStorage {
  #values = new Map();

  get length() { return this.#values.size; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  clear() { this.#values.clear(); }
}

class ThrowingStorage {
  get length() { throw storageError("SecurityError"); }
  key() { throw storageError("SecurityError"); }
  getItem() { throw storageError("SecurityError"); }
  setItem() { throw storageError("QuotaExceededError"); }
  removeItem() { throw storageError("SecurityError"); }
  clear() { throw storageError("SecurityError"); }
}

function storageError(name) {
  const error = new Error(`Simulated ${name}`);
  error.name = name;
  return error;
}

function installStorage(storage) {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
    writable: true,
  });
}

installStorage(new MemoryStorage());

const {
  Store,
  Bookmarks,
  getMainVersion,
  getSecondaryVersion,
  getReaderLayout,
  setMainVersion,
  setSecondaryVersion,
  setReaderLayout,
  consumeLegacyBookmarkNotice,
} = await import("../js/store.js");
const {
  readJSON,
  readValue,
  writeJSON,
  writeValue,
  removeKey,
  listKeys,
} = await import("../js/safe-store.js");

// Normal storage.
const normal = new MemoryStorage();
installStorage(normal);
Store.save({ done: {}, quiz: {}, lastVisit: null, streak: 2 });
assert.equal(Store.load().streak, 2);
Store.markRead(1);
assert.ok(Store.load().done[1]);
Store.markQuiz(1, 4, 5);
assert.equal(Store.load().quiz[1].score, 4);
Bookmarks.add(1, 1);
assert.equal(Bookmarks.has(1), true);
Bookmarks.remove(1);
assert.equal(Bookmarks.has(1), false);

// Existing raw-string preference format remains backward compatible.
setMainVersion("tb");
setSecondaryVersion("kjv");
setReaderLayout("cols");
assert.equal(normal.getItem("bibleTime.mainVersion"), "tb");
assert.equal(normal.getItem("bibleTime.secondaryVersion"), "kjv");
assert.equal(normal.getItem("bibleTime.readerLayout"), "cols");
assert.equal(getMainVersion(), "tb");
assert.equal(getSecondaryVersion(), "kjv");
assert.equal(getReaderLayout(), "cols");

// Corrupted and valid-but-wrong-shape storage falls back safely.
normal.setItem("bibleTime.proverbs.progress.v2", "{not-json");
assert.deepEqual(Store.load(), { done: {}, quiz: {}, lastVisit: null, streak: 0 });
normal.setItem("bibleTime.proverbs.progress.v2", "42");
assert.deepEqual(Store.load(), { done: {}, quiz: {}, lastVisit: null, streak: 0 });
normal.setItem("bibleTime.proverbs.progress.v2", JSON.stringify({ done: [], quiz: null, streak: "bad" }));
assert.deepEqual(Store.load(), { done: {}, quiz: {}, lastVisit: null, streak: 0 });
normal.setItem("bibleTime.proverbs.bookmarks.v2", "{\"wrong\":true}");
assert.deepEqual(Bookmarks.load(), []);

// Serialization failure must be contained.
const circular = {};
circular.self = circular;
assert.doesNotThrow(() => Store.save(circular));
assert.equal(writeJSON("circular", circular), false);

// QuotaExceededError / Safari Private Mode / blocked storage.
installStorage(new ThrowingStorage());
assert.doesNotThrow(() => Store.save({ done: {}, quiz: {}, streak: 1 }));
const inMemoryState = Store.markRead(2);
assert.ok(inMemoryState.done[2], "state hasil operasi tetap hidup walau persist gagal");
assert.doesNotThrow(() => Store.markQuiz(2, 5, 5));
assert.doesNotThrow(() => Bookmarks.save([{ day: 2, book: "Amsal", chapter: 2 }]));
assert.doesNotThrow(() => Bookmarks.add(2, 2));
assert.doesNotThrow(() => Bookmarks.remove(2));
assert.doesNotThrow(() => setMainVersion("tb"));
assert.doesNotThrow(() => setSecondaryVersion("kjv"));
assert.doesNotThrow(() => setReaderLayout("cols"));
assert.doesNotThrow(() => consumeLegacyBookmarkNotice());
assert.deepEqual(Store.load(), { done: {}, quiz: {}, lastVisit: null, streak: 0 });
assert.deepEqual(Bookmarks.load(), []);
assert.equal(writeJSON("x", {}), false);
assert.equal(writeValue("x", "value"), false);
assert.equal(readValue("x", "fallback"), "fallback");
assert.deepEqual(readJSON("x", { safe: true }), { safe: true });
assert.deepEqual(listKeys(), []);
assert.doesNotThrow(() => removeKey("x"));

// Unknown write errors are also contained.
installStorage({
  get length() { return 0; },
  key() { return null; },
  getItem() { return null; },
  setItem() { throw new Error("unknown storage failure"); },
  removeItem() { throw new Error("unknown storage failure"); },
});
assert.doesNotThrow(() => Store.save({ done: {}, quiz: {} }));
assert.doesNotThrow(() => Bookmarks.save([]));
assert.equal(writeValue("x", "value"), false);

console.log("VALID: storage normal, corrupted, blocked, quota, security, dan serialization failure aman.");
