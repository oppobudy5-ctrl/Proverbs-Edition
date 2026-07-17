export function formatReasoningOutput({
  question,
  intent,
  evidence,
  themeReasoning,
  response,
  validation,
  canonicalFallback,
}) {
  const providerContent = String(response?.content || "").trim();
  const useFallback = !providerContent || !validation.valid || validation.status === "blocked";
  const summary = useFallback ? canonicalFallback : providerContent;
  const references = validation.citations.length
    ? validation.citations
    : evidence.citations;
  const application = evidence.challenge
    || evidence.application?.invitation
    || evidence.application?.practices?.[0]
    || "";
  const nextStep = evidence.application?.practices?.[0]
    || evidence.challenge
    || application
    || "";
  const citation = references[0]
    ? Object.freeze({ ...references[0] })
    : null;
  const memoryVerse = evidence.memory_verse
    ? Object.freeze({ ...evidence.memory_verse })
    : null;

  const reasoning = buildEvidencePath({ intent, evidence, themeReasoning, validation });
  const reasoningMetadata = Object.freeze({
    intent: intent.intent,
    intent_confidence: intent.confidence,
    theme: themeReasoning.themes[0] || "",
    themes: Object.freeze([...themeReasoning.themes]),
    knowledge_source: evidence.metadata?.source || "cil",
    historical_context_used: Boolean(evidence.historical_context),
    cross_references_used: evidence.cross_references.length,
    confidence: chooseConfidence(response?.confidence, validation, evidence),
    reasoning_path: Object.freeze(reasoning.map((step) => step.stage)),
    context_used: Object.freeze([...evidence.context_used]),
    references_used: Object.freeze(
      references.map((item) => item.display || item.canonicalId).filter(Boolean),
    ),
    canonical_only: useFallback,
    degraded: evidence.degraded,
    availability: evidence.availability,
    validation_status: validation.status,
    question_length: String(question || "").length,
  });

  return Object.freeze({
    summary,
    answer: summary,
    reasoning,
    themes: Object.freeze([...themeReasoning.themes]),
    theme_path: Object.freeze([...themeReasoning.path]),
    historical_context: evidence.historical_context,
    cross_references: Object.freeze(evidence.cross_references.map((item) => Object.freeze({ ...item }))),
    application,
    prayer: evidence.prayer || "",
    memory_verse: memoryVerse,
    next_step: nextStep,
    citation,
    citations: Object.freeze(references.map((item) => Object.freeze({ ...item }))),
    confidence: reasoningMetadata.confidence,
    provider: useFallback ? "local" : response?.provider || "unknown",
    timestamp: new Date().toISOString(),
    reasoning_metadata: reasoningMetadata,
    guardrails: response?.guardrails || Object.freeze({
      status: validation.status,
      checks: validation.checks,
      warnings: validation.warnings,
      inventedRefs: Object.freeze([]),
    }),
    validation,
    explainability: Object.freeze({
      intent: reasoningMetadata.intent,
      intent_confidence: reasoningMetadata.intent_confidence,
      reasoning_path: reasoningMetadata.reasoning_path,
      context_used: reasoningMetadata.context_used,
      references_used: reasoningMetadata.references_used,
      canonical_only: reasoningMetadata.canonical_only,
      degraded: reasoningMetadata.degraded,
      question_length: reasoningMetadata.question_length,
    }),
  });
}

function buildEvidencePath({ intent, evidence, themeReasoning, validation }) {
  const steps = [
    {
      stage: "intent",
      explanation: `Pertanyaan diklasifikasikan sebagai ${intent.intent}.`,
      evidence: intent.markers,
    },
    {
      stage: "canonical_context",
      explanation: evidence.reference
        ? `Konteks utama: ${evidence.reference}.`
        : "Konteks kitab tersedia tanpa pasal spesifik.",
      evidence: evidence.context_used,
    },
  ];

  if (themeReasoning.themes.length) {
    steps.push({
      stage: "theme_analysis",
      explanation: `Tema kanonik yang relevan: ${themeReasoning.path.join(" → ")}.`,
      evidence: themeReasoning.themes,
    });
  }
  if (evidence.historical_context) {
    steps.push({
      stage: "historical_context",
      explanation: "Konteks historis kanonik dipakai sebagai batasan penafsiran.",
      evidence: [evidence.historical_context],
    });
  }
  if (evidence.cross_references.length) {
    steps.push({
      stage: "cross_references",
      explanation: `${evidence.cross_references.length} hubungan ayat digunakan sebagai dukungan.`,
      evidence: evidence.cross_references.map((item) => `${item.source} → ${item.target}`),
    });
  }
  if (evidence.memory_verse?.ref) {
    steps.push({
      stage: "memory_verse",
      explanation: `Ayat pilihan: ${evidence.memory_verse.ref}.`,
      evidence: [evidence.memory_verse.ref],
    });
  }
  steps.push({
    stage: "canonical_validation",
    explanation: `Validasi kanonik: ${validation.status}.`,
    evidence: validation.checks.map((check) => `${check.id}:${check.pass ? "pass" : "fail"}`),
  });

  return Object.freeze(steps.map((step) => Object.freeze({
    ...step,
    evidence: Object.freeze([...(step.evidence || [])]),
  })));
}

function chooseConfidence(providerConfidence, validation, evidence) {
  let score = Number.isFinite(providerConfidence) ? providerConfidence : 0;
  if (!score && evidence.citations.length) score = 70;
  if (validation.status === "insufficient_context") score = Math.min(score || 40, 50);
  if (validation.status === "blocked" || validation.status === "invalid_context") score = 0;
  return Math.max(0, Math.min(100, score));
}
