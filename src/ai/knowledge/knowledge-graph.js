// =============================================================================
// knowledge-graph.js — Graph relasi topik ↔ pasal ↔ ayat ↔ crossref (offline).
// Digunakan Semantic Ranking untuk memperluas dan menjelaskan hasil.
// =============================================================================

import { normalizeText } from "../ai-utils.js";

export class KnowledgeGraph {
  #nodes = new Map();
  #edges = [];
  #byType = new Map();
  #ready = false;

  get ready() {
    return this.#ready;
  }

  /**
   * @param {object} data
   * @param {object[]} data.topics
   * @param {object[]} data.documents
   * @param {object} [data.crossrefs]
   * @param {object} [data.situations]
   */
  build(data = {}) {
    this.#nodes.clear();
    this.#edges = [];
    this.#byType.clear();

    for (const topic of data.topics || []) {
      this.#addNode({ id: `topic:${topic.id}`, type: "topic", label: topic.name, ref: topic.id, meta: topic });
      if (topic.parentTopic) {
        this.#addEdge(`topic:${topic.id}`, `topic:${topic.parentTopic}`, "parent", 0.9);
      }
      for (const child of topic.childTopics || []) {
        this.#addEdge(`topic:${topic.id}`, `topic:${child}`, "child", 0.85);
      }
      for (const verse of topic.relatedVerses || []) {
        const vid = `verse:${normalizeText(verse)}`;
        this.#addNode({ id: vid, type: "verse", label: verse, ref: verse });
        this.#addEdge(`topic:${topic.id}`, vid, "related_verse", 0.8);
      }
      for (const ch of topic.relatedChapters || []) {
        const cid = `chapter:amsal-${ch}`;
        this.#addNode({ id: cid, type: "chapter", label: `Amsal ${ch}`, ref: ch });
        this.#addEdge(`topic:${topic.id}`, cid, "related_chapter", 0.75);
      }
    }

    for (const doc of data.documents || []) {
      const nodeId = `doc:${doc.id}`;
      this.#addNode({
        id: nodeId,
        type: doc.type || "document",
        label: doc.title,
        ref: doc.id,
        meta: { chapter: doc.meta?.chapter, topics: doc.topics || [], references: doc.references || [] },
      });
      for (const topicId of doc.topics || []) {
        this.#addEdge(nodeId, `topic:${topicId}`, "has_topic", 0.7);
      }
      if (Number.isFinite(doc.meta?.chapter)) {
        const cid = `chapter:amsal-${doc.meta.chapter}`;
        this.#addNode({ id: cid, type: "chapter", label: `Amsal ${doc.meta.chapter}`, ref: doc.meta.chapter });
        this.#addEdge(nodeId, cid, "in_chapter", 0.9);
      }
    }

    for (const relation of data.crossrefs?.relations || []) {
      const sourceChapter = parseChapter(relation.source);
      const sid = sourceChapter ? `chapter:amsal-${sourceChapter}` : `ref:${normalizeText(relation.source)}`;
      const tid = `ref:${normalizeText(relation.target)}`;
      this.#addNode({ id: sid, type: sourceChapter ? "chapter" : "reference", label: relation.source, ref: relation.source });
      this.#addNode({ id: tid, type: "reference", label: relation.target, ref: relation.target });
      this.#addEdge(sid, tid, relation.relationshipType || "crossref", relation.confidence ?? 0.7, relation.reason);
      for (const topicId of relation.topics || []) {
        this.#addEdge(sid, `topic:${topicId}`, "xref_topic", 0.6);
      }
    }

    for (const sit of data.situations?.situations || []) {
      const sid = `situation:${sit.id}`;
      this.#addNode({ id: sid, type: "situation", label: sit.label, ref: sit.id, meta: sit });
      for (const topicId of sit.topics || []) {
        this.#addEdge(sid, `topic:${topicId}`, "situation_topic", 0.85, sit.reason);
      }
    }

    this.#ready = true;
    return this;
  }

  neighbors(nodeId, options = {}) {
    const limit = options.limit || 12;
    const types = options.types ? new Set(options.types) : null;
    const out = [];
    for (const edge of this.#edges) {
      let other = null;
      if (edge.from === nodeId) other = edge.to;
      else if (edge.to === nodeId) other = edge.from;
      if (!other) continue;
      const node = this.#nodes.get(other);
      if (!node) continue;
      if (types && !types.has(node.type)) continue;
      out.push({ node, relationship: edge.type, confidence: edge.confidence, reason: edge.reason || "" });
    }
    out.sort((a, b) => b.confidence - a.confidence);
    return out.slice(0, limit);
  }

  expandTopics(topicIds = [], depth = 1) {
    const found = new Set(topicIds);
    let frontier = [...topicIds];
    for (let d = 0; d < depth; d++) {
      const next = [];
      for (const id of frontier) {
        for (const hit of this.neighbors(`topic:${id}`, { types: ["topic"], limit: 8 })) {
          const tid = hit.node.ref;
          if (!found.has(tid)) {
            found.add(tid);
            next.push(tid);
          }
        }
      }
      frontier = next;
    }
    return [...found];
  }

  relatedForChapter(chapter, limit = 8) {
    return this.neighbors(`chapter:amsal-${chapter}`, { limit });
  }

  relatedForTopic(topicId, limit = 8) {
    return this.neighbors(`topic:${topicId}`, { limit });
  }

  getNode(id) {
    return this.#nodes.get(id) || null;
  }

  #addNode(node) {
    if (!this.#nodes.has(node.id)) {
      this.#nodes.set(node.id, Object.freeze(node));
      if (!this.#byType.has(node.type)) this.#byType.set(node.type, []);
      this.#byType.get(node.type).push(node.id);
    }
  }

  #addEdge(from, to, type, confidence = 0.5, reason = "") {
    if (!from || !to) return;
    this.#edges.push(Object.freeze({ from, to, type, confidence, reason }));
  }
}

function parseChapter(reference) {
  const match = String(reference || "").match(/Amsal\s+(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

export const knowledgeGraph = new KnowledgeGraph();
