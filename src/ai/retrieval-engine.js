import { AI_CONFIG } from "../../config/ai.config.js";
import { canonicalContextGateway, initCIL } from "./cil/index.js";

/**
 * Compatibility delegate — retrieval now routes through CIL.
 * CONTENT is only used inside the gateway's explicit degraded fallback.
 */
export class RetrievalEngine {
  constructor({ gateway = canonicalContextGateway } = {}) {
    this.gateway = gateway;
    this.ready = false;
  }

  async initialize(options = {}) {
    await initCIL(options);
    this.ready = true;
    return this;
  }

  async retrieve(query, options = {}) {
    if (!this.ready) await this.initialize(options.init || {});
    const rows = await this.gateway.retrieve(query, {
      chapter: options.chapter,
      day: options.day,
      limit: options.limit || AI_CONFIG.retrievalLimit,
      intent: options.intent,
    });
    return rows.map((row) => ({
      document: {
        id: row.id,
        day: row.day,
        chapter: row.chapter,
        book: row.book,
        title: row.title,
        theme: row.theme,
        summary: row.summary,
        goldenVerse: row.goldenVerse,
        keywords: row.keywords,
      },
      score: row.score,
      reasons: row.reasons || ["cil"],
    }));
  }

  async byChapter(chapter) {
    return this.retrieve("", { chapter, limit: 1 });
  }

  async byKeyword(keyword, options = {}) {
    return this.retrieve(keyword, options);
  }
}

export const retrievalEngine = new RetrievalEngine();
