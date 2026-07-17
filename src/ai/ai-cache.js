import { AI_CONFIG } from "../../config/ai.config.js";
import { hashString } from "./ai-utils.js";
import { AI_DB_STORES, requestToPromise } from "./conversation-store.js";

export class AICache {
  constructor({ ttlMs = AI_CONFIG.cacheTtlMs } = {}) {
    this.ttlMs = ttlMs;
  }

  async createKey({ prompt, chapter = null, provider = "unknown" }) {
    return hashString(JSON.stringify({ prompt, chapter, provider }));
  }

  async get(input) {
    const key = typeof input === "string" ? input : await this.createKey(input);
    const record = await requestToPromise(AI_DB_STORES.cache, "readonly", (store) => store.get(key));
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      await this.delete(key);
      return null;
    }
    return Object.freeze({ ...record.value, cached: true, cacheKey: key });
  }

  async set(input, value, options = {}) {
    const key = typeof input === "string" ? input : await this.createKey(input);
    const now = Date.now();
    const record = {
      key,
      value: cloneForStorage(value),
      createdAt: now,
      expiresAt: now + (options.ttlMs ?? this.ttlMs),
    };
    await requestToPromise(AI_DB_STORES.cache, "readwrite", (store) => store.put(record));
    return key;
  }

  async delete(key) {
    await requestToPromise(AI_DB_STORES.cache, "readwrite", (store) => store.delete(key));
  }

  async clearExpired(now = Date.now()) {
    const records = await requestToPromise(AI_DB_STORES.cache, "readonly", (store) => store.getAll());
    const expired = records.filter((record) => record.expiresAt <= now);
    await Promise.all(expired.map((record) => this.delete(record.key)));
    return expired.length;
  }

  async clear() {
    await requestToPromise(AI_DB_STORES.cache, "readwrite", (store) => store.clear());
  }
}

function cloneForStorage(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export const aiCache = new AICache();
