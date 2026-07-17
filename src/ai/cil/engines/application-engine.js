export class ApplicationEngine {
  #byChapter = new Map();
  #byId = new Map();
  #ready = false;
  get ready() { return this.#ready; }
  load(entries = []) {
    this.#byId = new Map(entries.map((e) => [e.id, e]));
    this.#byChapter = new Map(entries.map((e) => [Number(e.chapter), e]));
    this.#ready = true;
    return this;
  }
  get(id) { return this.#byId.get(id) || null; }
  forChapter(chapter) { return this.#byChapter.get(Number(chapter)) || null; }
  byDomain(domain, limit = 10) {
    return [...this.#byId.values()].filter((a) => (a.domains || []).includes(domain)).slice(0, limit);
  }
  all() { return [...this.#byId.values()]; }
}
export const applicationEngine = new ApplicationEngine();
