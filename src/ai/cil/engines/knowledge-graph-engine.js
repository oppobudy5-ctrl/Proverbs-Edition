/**
 * Book-agnostic knowledge graph: nodes, filtered neighbors, paths, subgraphs.
 */
export class KnowledgeGraphEngine {
  #nodes = new Map();
  #adj = new Map();
  #ready = false;
  static MAX_DEPTH = 4;

  get ready() {
    return this.#ready;
  }

  load({ nodes = [], edges = [] } = {}) {
    this.#nodes = new Map(nodes.map((n) => [n.id, n]));
    this.#adj = new Map();
    for (const edge of edges) {
      push(this.#adj, edge.from, { ...edge, dir: "out" });
      push(this.#adj, edge.to, { ...edge, dir: "in" });
    }
    this.#ready = true;
    return this;
  }

  getNode(id) {
    return this.#nodes.get(id) || null;
  }

  neighbors(nodeId, { types, relations, limit = 20 } = {}) {
    let edges = this.#adj.get(nodeId) || [];
    if (relations?.length) edges = edges.filter((e) => relations.includes(e.relation));
    const out = [];
    for (const edge of edges) {
      const otherId = edge.from === nodeId ? edge.to : edge.from;
      const node = this.#nodes.get(otherId);
      if (!node) continue;
      if (types?.length && !types.includes(node.type)) continue;
      out.push({ node, edge, otherId });
      if (out.length >= limit) break;
    }
    return out;
  }

  path(fromId, toId, { maxDepth = 3 } = {}) {
    const depth = Math.min(maxDepth, KnowledgeGraphEngine.MAX_DEPTH);
    if (!this.#nodes.has(fromId) || !this.#nodes.has(toId)) return null;
    if (fromId === toId) return [fromId];
    const queue = [[fromId]];
    const seen = new Set([fromId]);
    while (queue.length) {
      const path = queue.shift();
      if (path.length > depth) continue;
      const last = path[path.length - 1];
      for (const { otherId } of this.neighbors(last, { limit: 50 })) {
        if (seen.has(otherId)) continue;
        const next = [...path, otherId];
        if (otherId === toId) return next;
        seen.add(otherId);
        queue.push(next);
      }
    }
    return null;
  }

  subgraph(seedIds = [], { depth = 1, limit = 40 } = {}) {
    const d = Math.min(depth, KnowledgeGraphEngine.MAX_DEPTH);
    const nodeIds = new Set(seedIds.filter((id) => this.#nodes.has(id)));
    let frontier = [...nodeIds];
    for (let i = 0; i < d; i += 1) {
      const next = [];
      for (const id of frontier) {
        for (const { otherId } of this.neighbors(id, { limit: 12 })) {
          if (nodeIds.size >= limit) break;
          if (!nodeIds.has(otherId)) {
            nodeIds.add(otherId);
            next.push(otherId);
          }
        }
      }
      frontier = next;
    }
    const nodes = [...nodeIds].map((id) => this.#nodes.get(id)).filter(Boolean);
    const edges = [];
    for (const id of nodeIds) {
      for (const { edge, otherId } of this.neighbors(id, { limit: 30 })) {
        if (nodeIds.has(otherId) && edge.from === id) edges.push(edge);
      }
    }
    return { nodes, edges };
  }
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

export const knowledgeGraphEngine = new KnowledgeGraphEngine();
