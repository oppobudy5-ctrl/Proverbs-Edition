export class TimelineEngine {
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
  forChapter(chapter, limit = 4) {
    const needle = `proverbs.${chapter}`;
    return this.all()
      .filter((e) => (e.references || []).some((r) => String(r).includes(needle)))
      .slice(0, limit);
  }
  byEpoch(epoch) {
    return this.all().filter((e) => e.epoch === epoch);
  }
}
export const timelineEngine = new TimelineEngine();
