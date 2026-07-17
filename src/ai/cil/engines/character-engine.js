export class CharacterEngine {
  #byId = new Map();
  #ready = false;
  get ready() { return this.#ready; }
  load(entries = []) {
    this.#byId = new Map(entries.map((e) => [e.id, e]));
    this.#ready = true;
    return this;
  }
  get(id) { return this.#byId.get(id) || null; }
  all() { return [...this.#byId.values()]; }
  forChapter(chapter, limit = 5) {
    const needle = `proverbs.${chapter}`;
    return this.all()
      .filter((c) => (c.references || []).some((r) => String(r).includes(needle)))
      .slice(0, limit);
  }
  search(query, limit = 8) {
    const q = String(query || "").toLowerCase();
    return this.all()
      .filter((c) => c.name.toLowerCase().includes(q) || (c.roles || []).some((r) => String(r).includes(q)))
      .slice(0, limit);
  }
}
export const characterEngine = new CharacterEngine();
