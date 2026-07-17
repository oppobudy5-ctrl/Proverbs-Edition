/**
 * Topic ontology traversal: parent / children / related / opposite.
 */
export class TopicEngine {
  #byId = new Map();
  #ready = false;

  get ready() {
    return this.#ready;
  }

  load(topics = []) {
    this.#byId = new Map();
    for (const topic of topics) {
      const id = normalizeTopicId(topic.id);
      this.#byId.set(id, {
        ...topic,
        id,
        legacyId: topic.id,
        parentTopic: topic.parentTopic ? normalizeTopicId(topic.parentTopic) : null,
        childTopics: (topic.childTopics || []).map(normalizeTopicId),
        relatedTopics: (topic.relatedTopics || []).map(normalizeTopicId),
        opposites: (topic.opposites || []).map(normalizeTopicId),
      });
    }
    this.#ready = true;
    return this;
  }

  get(topicId) {
    return this.#byId.get(normalizeTopicId(topicId)) || null;
  }

  parent(topicId) {
    const topic = this.get(topicId);
    return topic?.parentTopic ? this.get(topic.parentTopic) : null;
  }

  children(topicId) {
    const topic = this.get(topicId);
    return (topic?.childTopics || []).map((id) => this.get(id)).filter(Boolean);
  }

  related(topicId, { includeOpposites = true } = {}) {
    const topic = this.get(topicId);
    if (!topic) return [];
    const ids = new Set([...(topic.relatedTopics || [])]);
    if (includeOpposites) for (const id of topic.opposites || []) ids.add(id);
    return [...ids].map((id) => this.get(id)).filter(Boolean);
  }

  opposites(topicId) {
    const topic = this.get(topicId);
    return (topic?.opposites || []).map((id) => this.get(id)).filter(Boolean);
  }

  traverse(topicId, { depth = 2, limit = 20 } = {}) {
    const start = this.get(topicId);
    if (!start) return [];
    const out = [];
    const seen = new Set([start.id]);
    let frontier = [start.id];
    for (let d = 0; d < depth && out.length < limit; d += 1) {
      const next = [];
      for (const id of frontier) {
        const node = this.get(id);
        if (!node) continue;
        const neighbors = [
          node.parentTopic,
          ...(node.childTopics || []),
          ...(node.relatedTopics || []),
          ...(node.opposites || []),
        ].filter(Boolean);
        for (const n of neighbors) {
          if (seen.has(n)) continue;
          seen.add(n);
          const topic = this.get(n);
          if (!topic) continue;
          out.push({ topic, depth: d + 1 });
          next.push(n);
          if (out.length >= limit) break;
        }
      }
      frontier = next;
    }
    return out;
  }

  forChapter(chapter, limit = 8) {
    const ch = Number(chapter);
    const scored = [];
    for (const topic of this.#byId.values()) {
      if ((topic.relatedChapters || []).includes(ch)) {
        scored.push(topic);
      }
    }
    return scored.slice(0, limit);
  }

  all() {
    return [...this.#byId.values()];
  }
}

function normalizeTopicId(id) {
  const raw = String(id || "").trim();
  if (!raw) return "";
  return raw.startsWith("topic:") ? raw : `topic:${raw}`;
}

export const topicEngine = new TopicEngine();
