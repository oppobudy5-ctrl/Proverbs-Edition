// =============================================================================
// CIL — Canonical Intelligence Layer
// Book-agnostic engines + Canonical Context Gateway for all AI paths.
// =============================================================================

export { createCanonicalContext } from "./canonical-context.js";
export { CanonicalEngine, canonicalEngine } from "./engines/canonical-engine.js";
export { TopicEngine, topicEngine } from "./engines/topic-engine.js";
export { RelationshipEngine, relationshipEngine } from "./engines/relationship-engine.js";
export { KnowledgeGraphEngine, knowledgeGraphEngine } from "./engines/knowledge-graph-engine.js";
export { DoctrineEngine, doctrineEngine } from "./engines/doctrine-engine.js";
export { CharacterEngine, characterEngine } from "./engines/character-engine.js";
export { TimelineEngine, timelineEngine } from "./engines/timeline-engine.js";
export { SymbolEngine, symbolEngine } from "./engines/symbol-engine.js";
export { WisdomEngine, wisdomEngine } from "./engines/wisdom-engine.js";
export { ApplicationEngine, applicationEngine } from "./engines/application-engine.js";
export { CitationEngine, citationEngine } from "./citation-engine.js";
export { scoreCanonicalConfidence } from "./confidence.js";
export { TheologicalGuardrails, theologicalGuardrails } from "./theological-guardrails.js";
export { toLegacyAIContext } from "./compatibility-adapter.js";
export {
  CanonicalContextGateway,
  canonicalContextGateway,
  initCIL,
  getCILServices,
} from "./gateway.js";
