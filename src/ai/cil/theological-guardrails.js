import { citationEngine } from "./citation-engine.js";
import { scoreCanonicalConfidence } from "./confidence.js";

const ABSOLUTE_PATTERNS = [
  /\bpasti berhasil\b/i,
  /\bharus selalu\b/i,
  /\btanpa kecuali\b/i,
  /\bjaminan mutlak\b/i,
  /\balways succeed\b/i,
  /\bmust always\b/i,
];

const GUARDED_INTENTS = new Set(["qa", "reflection", "journal-reflection", "search", "summary", "wisdom"]);

/**
 * Post-provider theological validation + safe local fallback.
 */
export class TheologicalGuardrails {
  constructor({ citations = citationEngine } = {}) {
    this.citations = citations;
  }

  isGuardedIntent(intent) {
    return GUARDED_INTENTS.has(String(intent || ""));
  }

  validate(content, context = {}, options = {}) {
    const text = String(content || "");
    const intent = options.intent || context.intent || "";
    const requiresScripture = ["qa", "reflection", "journal-reflection", "search", "summary"].includes(intent);
    const citationResult = this.citations.verifyText(text, {
      allowedCitations: context.allowedCitations || context.citations || [],
      requireAllowed: true,
    });

    const checks = [];
    const warnings = [];

    const hasVerified = citationResult.verified.length > 0 || (context.citations || []).length > 0;
    checks.push({
      id: "scripture-support",
      pass: !requiresScripture || hasVerified || citationResult.citations.length === 0,
      detail: hasVerified ? "verified-or-context" : "none",
    });

    const inventedRefs = citationResult.inventedRefs;
    checks.push({
      id: "no-invented-refs",
      pass: inventedRefs.length === 0,
      detail: inventedRefs.join(", ") || "ok",
    });

    const notes = context.interpretiveNotes || [];
    const acknowledgesViews = notes.length === 0 || notes.some((n) => text.toLowerCase().includes(String(n).toLowerCase().slice(0, 24))) || /tafsiran|interpretasi|pandangan|tradisi/i.test(text);
    checks.push({
      id: "acknowledge-interpretations",
      pass: acknowledgesViews,
      detail: notes.length ? "required" : "n/a",
    });
    if (notes.length && !acknowledgesViews) warnings.push("Konteks memiliki catatan interpretasi yang perlu diakui.");

    const absoluteLanguage = ABSOLUTE_PATTERNS.some((re) => re.test(text));
    const appIntent = intent === "reflection" || intent === "journal-reflection" || intent === "wisdom";
    checks.push({
      id: "non-absolute-application",
      pass: !appIntent || !absoluteLanguage,
      detail: absoluteLanguage ? "absolute-language" : "ok",
    });

    checks.push({
      id: "confidence-disclosure",
      pass: true,
      detail: "attached-by-runtime",
    });

    const failed = checks.filter((c) => !c.pass);
    const status = failed.length === 0 ? "pass" : inventedRefs.length ? "refuse" : "warn";

    const confidence = scoreCanonicalConfidence({
      coverageScore: context.coverage?.score,
      crossrefCount: context.crossrefs?.length || 0,
      commentaryCount: context.commentary?.length || 0,
      historicalCount: context.historical?.length || 0,
      semanticScore: context.metadata?.semanticScore,
      degraded: context.degraded,
      inventedRefs: inventedRefs.length,
      missingScripture: requiresScripture && !hasVerified && citationResult.citations.length === 0,
      requiresScripture,
      absoluteLanguage,
      hasBook: !!context.book,
      hasChapter: !!context.chapter,
      hasTopics: (context.topics || []).length > 0,
      hasDoctrines: (context.doctrines || []).length > 0,
      hasApplication: !!context.application,
      hasGoldenVerse: !!context.goldenVerse,
    });

    let finalContent = text;
    let usedFallback = false;
    if (status === "refuse" || (requiresScripture && !hasVerified && citationResult.citations.length === 0 && !(context.citations || []).length)) {
      finalContent = this.buildSafeFallback(context);
      usedFallback = true;
    } else if (requiresScripture && citationResult.citations.length === 0 && (context.citations || []).length) {
      const cite = context.citations[0];
      finalContent = `${text.trim()}\n\n(Referensi konteks: ${cite.display || cite.canonicalId})`;
    }

    return Object.freeze({
      status: usedFallback ? "fallback" : status,
      checks: Object.freeze(checks),
      warnings: Object.freeze(warnings),
      inventedRefs: Object.freeze(inventedRefs),
      citations: Object.freeze(citationResult.verified.length ? citationResult.verified : (context.citations || []).slice()),
      confidence: confidence.score,
      confidenceComponents: confidence.components,
      content: finalContent,
      usedFallback,
    });
  }

  buildSafeFallback(context = {}) {
    const parts = [];
    parts.push("Berikut ringkasan berbasis konteks kanonik lokal (tanpa klaim di luar data tersedia):");
    if (context.title || context.theme) {
      parts.push(`Tema: ${context.title || ""} — ${context.theme || ""}`.trim());
    }
    if (context.summary) parts.push(context.summary);
    if (context.goldenVerse?.ref || context.goldenVerse?.text) {
      parts.push(`Ayat emas: ${context.goldenVerse.ref || ""} ${context.goldenVerse.text || ""}`.trim());
    }
    const cites = (context.citations || context.allowedCitations || []).slice(0, 3)
      .map((c) => c.display || c.canonicalId || c)
      .filter(Boolean);
    if (cites.length) parts.push(`Rujukan terverifikasi: ${cites.join("; ")}`);
    if (context.application?.invitation) {
      parts.push(`Undangan penerapan (non-absolut): ${context.application.invitation}`);
    }
    parts.push("Jika data doktrin/sejarah tidak tersedia dalam konteks, klaim tersebut sengaja tidak ditambahkan.");
    return parts.filter(Boolean).join("\n\n");
  }
}

export const theologicalGuardrails = new TheologicalGuardrails();
