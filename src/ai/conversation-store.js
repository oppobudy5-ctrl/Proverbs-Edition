import { AIError, AI_ERROR_CODES } from "./ai-utils.js";

const DB_NAME = "bibleTime.ai.v1";
const DB_VERSION = 1;
const CONVERSATIONS = "conversations";
const CACHE = "cache";

let dbPromise = null;

export function openAIDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new AIError(
      AI_ERROR_CODES.UNKNOWN,
      "IndexedDB is not available in this environment",
      { userMessage: "Penyimpanan percakapan tidak tersedia pada browser ini.", retryable: false },
    ));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONVERSATIONS)) {
        const store = db.createObjectStore(CONVERSATIONS, { keyPath: "id" });
        store.createIndex("conversationId", "conversationId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("chapter", "chapter", { unique: false });
      }
      if (!db.objectStoreNames.contains(CACHE)) {
        const cache = db.createObjectStore(CACHE, { keyPath: "key" });
        cache.createIndex("expiresAt", "expiresAt", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new AIError(AI_ERROR_CODES.UNKNOWN, "IndexedDB upgrade is blocked", { retryable: false }));
    };
  });
  return dbPromise;
}

export class ConversationStore {
  async add({
    question,
    answer,
    chapter = null,
    provider = "unknown",
    conversationId = createConversationId(),
    timestamp = new Date().toISOString(),
    metadata = {},
  }) {
    if (!String(question || "").trim() || typeof answer !== "string") {
      throw new AIError(AI_ERROR_CODES.INVALID_REQUEST, "Question and answer are required", { retryable: false });
    }
    const record = {
      id: `${conversationId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      question: String(question).trim(),
      answer,
      timestamp,
      chapter: Number.isFinite(Number(chapter)) ? Number(chapter) : null,
      provider,
      metadata: { ...metadata },
    };
    await requestToPromise(CONVERSATIONS, "readwrite", (store) => store.add(record));
    return Object.freeze({ ...record });
  }

  async getConversation(conversationId) {
    const db = await openAIDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CONVERSATIONS, "readonly");
      const index = transaction.objectStore(CONVERSATIONS).index("conversationId");
      const request = index.getAll(conversationId);
      request.onsuccess = () => resolve(request.result.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
      request.onerror = () => reject(request.error);
    });
  }

  async list({ limit = 50, chapter } = {}) {
    const all = await requestToPromise(CONVERSATIONS, "readonly", (store) => store.getAll());
    return all
      .filter((record) => chapter == null || record.chapter === Number(chapter))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, Math.max(1, limit));
  }

  async removeConversation(conversationId) {
    const records = await this.getConversation(conversationId);
    const db = await openAIDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CONVERSATIONS, "readwrite");
      const store = transaction.objectStore(CONVERSATIONS);
      records.forEach((record) => store.delete(record.id));
      transaction.oncomplete = () => resolve(records.length);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clear() {
    await requestToPromise(CONVERSATIONS, "readwrite", (store) => store.clear());
  }
}

export function createConversationId() {
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function requestToPromise(storeName, mode, operation) {
  const db = await openAIDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export const conversationStore = new ConversationStore();
export const AI_DB_STORES = Object.freeze({ conversations: CONVERSATIONS, cache: CACHE });
