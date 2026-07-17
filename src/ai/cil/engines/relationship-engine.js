/**
 * Typed relationship queries with editorial "why related" explanations.
 */
export class RelationshipEngine {
  #edges = [];
  #byFrom = new Map();
  #byTo = new Map();
  #ready = false;

  get ready() {
    return this.#ready;
  }

  load(edges = []) {
    this.#edges = edges.slice();
    this.#byFrom = new Map();
    this.#byTo = new Map();
    for (const edge of this.#edges) {
      push(this.#byFrom, edge.from, edge);
      push(this.#byTo, edge.to, edge);
    }
    this.#ready = true;
    return this;
  }

  related(nodeId, { relation, limit = 20 } = {}) {
    const outgoing = this.#byFrom.get(nodeId) || [];
    const incoming = this.#byTo.get(nodeId) || [];
    let edges = [...outgoing, ...incoming];
    if (relation) edges = edges.filter((e) => e.relation === relation);
    return edges
      .slice()
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, limit)
      .map((edge) => ({
        ...edge,
        why: edge.why || explain(edge.relation),
        otherId: edge.from === nodeId ? edge.to : edge.from,
        direction: edge.from === nodeId ? "out" : "in",
      }));
  }

  whyRelated(a, b) {
    const hits = this.#edges.filter(
      (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a),
    );
    return hits.map((edge) => ({
      relation: edge.relation,
      why: edge.why || explain(edge.relation),
      weight: edge.weight || 0,
    }));
  }

  byType(relation, limit = 50) {
    return this.#edges.filter((e) => e.relation === relation).slice(0, limit);
  }

  all() {
    return this.#edges.slice();
  }
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function explain(relation) {
  const map = {
    parallel: "Teks berjalan paralel secara tematik atau verbal.",
    thematic: "Berbagi tema teologis yang sama.",
    amplification: "Teks sasaran memperluas atau menerapkan teks sumber.",
    fulfillment: "Resepsi yang melihat pemenuhan atau gema kristologis.",
    contrast: "Menyoroti perbedaan atau tegangan yang mendidik.",
    quotation: "Kutipan langsung atau hampir langsung.",
    "child-of": "Relasi hierarki ontologi topik.",
    "has-topic": "Dokumen/pasal terkait topik ini.",
    supports: "Referensi pendukung doktrin.",
    contrasts: "Referensi atau simbol yang kontras.",
    "applies-to": "Penerapan praktis untuk unit kanonik.",
  };
  return map[relation] || "Relasi kanonik tersimpan dalam graf pengetahuan.";
}

export const relationshipEngine = new RelationshipEngine();
