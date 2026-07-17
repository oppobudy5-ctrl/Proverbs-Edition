import { AI_CONFIG } from "../../config/ai.config.js";
import { createAIMessage } from "./types/ai-message.js";
import { truncate } from "./ai-utils.js";
import { SUMMARY_PROMPT } from "./prompts/summary.prompt.js";
import { QA_PROMPT } from "./prompts/qa.prompt.js";
import { REFLECTION_PROMPT } from "./prompts/reflection.prompt.js";
import { WISDOM_PROMPT } from "./prompts/wisdom.prompt.js";
import { SEARCH_PROMPT } from "./prompts/search.prompt.js";
import { JOURNAL_REFLECTION_PROMPT } from "./prompts/journal-reflection.prompt.js";

const TEMPLATES = Object.freeze({
  summary: SUMMARY_PROMPT,
  qa: QA_PROMPT,
  explain: QA_PROMPT,
  reflection: REFLECTION_PROMPT,
  "journal-reflection": JOURNAL_REFLECTION_PROMPT,
  wisdom: WISDOM_PROMPT,
  search: SEARCH_PROMPT,
});

const LENGTH_GUIDANCE = Object.freeze({
  short: "Jawaban ringkas, sekitar 1–2 paragraf.",
  medium: "Jawaban sedang, sekitar 3–5 paragraf.",
  long: "Jawaban mendalam namun terstruktur dan tidak bertele-tele.",
});

const CITE_POLICY = [
  "Kebijakan sitasi: kutip HANYA dari daftar allowedCitations / citations dalam konteks.",
  "Jangan mengarang referensi ayat atau klaim doktrin di luar konteks kanonik yang diberikan.",
  "Jika ada interpretiveNotes, akui bahwa ada lebih dari satu tafsiran yang diakui.",
  "Untuk penerapan praktis, hindari bahasa absolut (mis. \"pasti berhasil\", \"harus selalu\").",
].join(" ");

export class PromptBuilder {
  build({ intent = "qa", question = "", context, canonical, settings = {}, metadata = {} } = {}) {
    const template = TEMPLATES[intent] || QA_PROMPT;
    const promptVersion = Number(template.version || 1) + 1; // CIL bump
    const language = settings.language || AI_CONFIG.defaultLanguage;
    const responseLength = settings.responseLength || AI_CONFIG.defaultResponseLength;
    const system = [
      template.system,
      CITE_POLICY,
      `Gunakan bahasa ${language === "en" ? "Inggris" : "Indonesia"}.`,
      LENGTH_GUIDANCE[responseLength] || LENGTH_GUIDANCE.medium,
    ].join("\n");
    const bibleContext = serializeContext(context, canonical);
    const stableMetadata = stablePromptMetadata(metadata);
    const userPrompt = [
      template.instruction,
      "",
      "KONTEKS KANONIK (CIL):",
      bibleContext,
      "",
      `PERTANYAAN/TUGAS: ${question || defaultTask(intent)}`,
      "",
      `METADATA: ${JSON.stringify({ intent, promptVersion, cil: true, ...redactJournalMetadata(stableMetadata) })}`,
    ].join("\n");

    return Object.freeze({
      id: `${template.id}.v${promptVersion}`,
      intent,
      messages: Object.freeze([
        createAIMessage({ role: "system", content: system }),
        createAIMessage({ role: "user", content: userPrompt }),
      ]),
      metadata: Object.freeze({
        intent,
        question,
        promptId: `${template.id}.v${promptVersion}`,
        context: redactJournalExcerpt(context),
        ...redactJournalMetadata(metadata),
      }),
    });
  }
}

function redactJournalExcerpt(context) {
  if (!context || typeof context !== "object") return context;
  if (!context.journalExcerpt) return context;
  return { ...context, journalExcerpt: "[redacted]" };
}

function redactJournalMetadata(metadata = {}) {
  const next = { ...metadata };
  if (next.journalExcerpt) next.journalExcerpt = "[redacted]";
  if (next.context) next.context = redactJournalExcerpt(next.context);
  return next;
}

function stablePromptMetadata(metadata = {}) {
  const {
    requestId: _requestId,
    conversationId: _conversationId,
    timestamp: _timestamp,
    generatedAt: _generatedAt,
    ...stable
  } = metadata;
  return stable;
}

/**
 * Serialize only token-budgeted canonical context — never raw KB.
 */
function serializeContext(context = {}, canonical = null) {
  const meta = context.metadata || {};
  const allowed = canonical?.allowedCitations || meta.allowedCitations || canonical?.citations || meta.citations || [];
  const payload = {
    reference: context.book && context.chapter ? `${context.book} ${context.chapter}` : "",
    day: context.day,
    title: context.title || canonical?.title,
    theme: context.theme || canonical?.theme,
    summary: context.summary || canonical?.summary,
    goldenVerse: context.goldenVerse || canonical?.goldenVerse,
    keywords: context.keywords || canonical?.keywords || [],
    topics: (canonical?.topics || meta.topics || []).slice(0, 8),
    doctrines: (canonical?.doctrines || meta.doctrines || []).slice(0, 5),
    characters: (canonical?.characters || meta.characters || []).slice(0, 5),
    symbols: (canonical?.symbols || meta.symbols || []).slice(0, 6),
    historical: (canonical?.historical || meta.historical || []).slice(0, 4),
    wisdomPatterns: (canonical?.wisdomPatterns || meta.wisdomPatterns || []).slice(0, 4),
    application: canonical?.application || meta.application || null,
    crossrefs: (canonical?.crossrefs || meta.crossrefs || []).slice(0, 6).map((x) => ({
      source: x.source,
      target: x.target,
      type: x.relationshipType,
      why: x.reason || x.why,
    })),
    reflection: context.reflection || canonical?.reflection || [],
    challenge: context.challenge || canonical?.challenge || "",
    interpretiveNotes: (canonical?.interpretiveNotes || meta.interpretiveNotes || []).slice(0, 5),
    allowedCitations: allowed.slice(0, 12).map((c) => c.display || c.canonicalId || c),
    citeOnlyPolicy: true,
    confidence: canonical?.confidence ?? meta.confidence ?? null,
    degraded: Boolean(canonical?.degraded || meta.degraded),
    journalExcerpt: context.journalExcerpt || "",
    retrieved: (context.retrieved || canonical?.retrieved || []).slice(0, 5).map((item) => ({
      day: item.day,
      reference: item.book && item.chapter ? `${item.book} ${item.chapter}` : "",
      title: item.title,
      theme: item.theme,
      summary: item.summary,
    })),
  };
  return truncate(JSON.stringify(payload, null, 2), AI_CONFIG.maxContextCharacters);
}

function defaultTask(intent) {
  if (intent === "summary") return "Ringkas konteks bacaan ini.";
  if (intent === "reflection") return "Bantu saya merenungkan konteks bacaan ini.";
  if (intent === "journal-reflection") return "Bantu merangkum jurnal pengguna dan usulkan pertanyaan refleksi lanjutan.";
  if (intent === "search") return "Sintesis hasil pencarian yang paling relevan.";
  if (intent === "explain") return "Jelaskan konteks bacaan ini dengan bahasa yang mudah dipahami.";
  if (intent === "wisdom") return "Berikan kerangka pertimbangan hikmat berdasarkan konteks ini.";
  return "Jelaskan pesan utama konteks ini.";
}

export const promptBuilder = new PromptBuilder();
