export class SymbolEngine {
  #byId = new Map();
  #byTopic = new Map();
  #ready = false;
  get ready() { return this.#ready; }
  load(entries = []) {
    this.#byId = new Map(entries.map((e) => [e.id, e]));
    this.#byTopic = new Map();
    for (const e of entries) {
      for (const t of e.topics || []) {
        if (!this.#byTopic.has(t)) this.#byTopic.set(t, []);
        this.#byTopic.get(t).push(e);
      }
    }
    this.#ready = true;
    return this;
  }
  get(id) { return this.#byId.get(id) || null; }
  all() { return [...this.#byId.values()]; }
  byTopic(topicId, limit = 8) {
    const key = String(topicId || "").replace(/^topic:/, "");
    return (this.#byTopic.get(key) || []).slice(0, limit);
  }
  forChapter(chapter, limit = 6) {
    const needle = `proverbs.${chapter}`;
    return this.all()
      .filter((s) => (s.references || []).some((r) => String(r).includes(needle)))
      .slice(0, limit);
  }
}
export const symbolEngine = new SymbolEngine();
