export class DoctrineEngine {
  #byId = new Map();
  #byTopic = new Map();
  #ready = false;
  get ready() { return this.#ready; }
  load(entries = []) {
    this.#byId = new Map(entries.map((e) => [e.id, e]));
    this.#byTopic = new Map();
    for (const e of entries) {
      for (const t of e.relatedTopics || []) {
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
  forChapter(chapter, limit = 5) {
    const ch = Number(chapter);
    return this.all()
      .filter((d) => (d.supportingRefs || []).some((r) => String(r).includes(`proverbs.${ch}`)))
      .slice(0, limit);
  }
}
export const doctrineEngine = new DoctrineEngine();
