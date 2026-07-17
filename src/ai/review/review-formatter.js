/**
 * review-formatter.js — Maps CanonicalContext DTO + optional LLM prose
 * onto the immutable ReviewOutput schema.
 *
 * No UI dependency. No AI engine calls.
 */

/**
 * @typedef {Object} ReviewOutput
 * @property {string}   summary
 * @property {string[]} strengths
 * @property {string[]} missing_points
 * @property {string}   application
 * @property {{ref:string,text:string,translation?:string}|null} memory_verse
 * @property {Array<{source:string,target:string,reason?:string}>} cross_references
 * @property {string}   historical_context
 * @property {string[]} themes
 * @property {string}   wisdom
 * @property {string}   encouragement
 * @property {string}   prayer
 * @property {string}   next_step
 * @property {string}   reflection_question
 * @property {number}   confidence
 * @property {Array}    citations
 * @property {string}   provider
 * @property {string}   timestamp
 * @property {boolean}  canonical_only   — true when LLM prose was unavailable
 */

/**
 * Build a ReviewOutput from a CanonicalContext DTO and an optional
 * LLM result object (from AIController reflection intent).
 *
 * @param {object} ctx      - Frozen CanonicalContext DTO
 * @param {object} [llm]    - Optional AIController result { content, provider }
 * @param {object} [opts]   - { mode: "review"|"mentor", reflectionText: string }
 * @returns {Readonly<ReviewOutput>}
 */
export function formatReview(ctx, llm = null, opts = {}) {
  const mode = opts.mode === "mentor" ? "mentor" : "review";
  const hasLlm = llm && typeof llm.content === "string" && llm.content.trim().length > 0;

  // ── Themes: prefer topics, fallback to theme/themes ────────────────────────
  const themes = _deriveThemes(ctx);

  // ── Memory verse ────────────────────────────────────────────────────────────
  const memory_verse = ctx.goldenVerse
    ? Object.freeze({ ...ctx.goldenVerse })
    : null;

  // ── Cross references ────────────────────────────────────────────────────────
  const cross_references = Object.freeze(
    (ctx.crossrefs || []).slice(0, 6).map((r) =>
      Object.freeze({
        source: r.source || "",
        target: r.target || "",
        reason: r.reason || r.why || "",
        confidence: r.confidence ?? null,
      }),
    ),
  );

  // ── Historical context ──────────────────────────────────────────────────────
  const historical_context = _deriveHistorical(ctx);

  // ── Wisdom patterns ─────────────────────────────────────────────────────────
  const wisdom = _deriveWisdom(ctx);

  // ── Application / practices ─────────────────────────────────────────────────
  const application = _deriveApplication(ctx);

  // ── Prayer ──────────────────────────────────────────────────────────────────
  const prayer = ctx.prayer || _derivePrayer(ctx);

  // ── Canonical summary ───────────────────────────────────────────────────────
  const summary = ctx.summary || _deriveSummary(ctx);

  // ── Parse LLM prose for structured sections when available ──────────────────
  let strengths = [];
  let missing_points = [];
  let encouragement = "";
  let next_step = "";
  let reflection_question = "";

  if (hasLlm) {
    const parsed = _parseLlmProse(llm.content, mode);
    strengths = parsed.strengths;
    missing_points = parsed.missing_points;
    encouragement = parsed.encouragement;
    next_step = parsed.next_step;
    reflection_question = parsed.reflection_question;
  } else {
    // Canonical-only fallback
    strengths = _canonicalStrengths(ctx);
    missing_points = [];
    encouragement = ctx.challenge || "";
    next_step = _canonicalNextStep(ctx);
    reflection_question = _canonicalReflectionQuestion(ctx);
  }

  return Object.freeze({
    summary,
    strengths: Object.freeze(strengths),
    missing_points: Object.freeze(missing_points),
    application,
    memory_verse,
    cross_references,
    historical_context,
    themes: Object.freeze(themes),
    wisdom,
    encouragement,
    prayer,
    next_step,
    reflection_question,
    confidence: typeof ctx.confidence === "number" ? ctx.confidence : 0,
    citations: Object.freeze(
      (ctx.citations || []).map((c) => Object.freeze({ ...c })),
    ),
    provider: llm?.provider || "local",
    timestamp: new Date().toISOString(),
    canonical_only: !hasLlm,
  });
}

// ── Private helpers ──────────────────────────────────────────────────────────

function _deriveThemes(ctx) {
  // Use topics as primary source; theme/themes as fallback
  const fromTopics = (ctx.topics || [])
    .slice(0, 5)
    .map((t) => t.name || t.id)
    .filter(Boolean);
  if (fromTopics.length) return fromTopics;

  const fromApplication = ctx.application?.invitation
    ? [ctx.application.invitation]
    : [];

  const fromThemes = Array.isArray(ctx.themes) ? ctx.themes.slice(0, 3) : [];
  const fromTheme = ctx.theme ? [ctx.theme] : [];

  return [...fromThemes, ...fromTheme, ...fromApplication].slice(0, 5);
}

function _deriveHistorical(ctx) {
  if (!ctx.historical || ctx.historical.length === 0) return "";
  return ctx.historical
    .slice(0, 3)
    .map((h) => h.summary || h.name || "")
    .filter(Boolean)
    .join(" | ");
}

function _deriveWisdom(ctx) {
  if (ctx.wisdomPatterns && ctx.wisdomPatterns.length) {
    return ctx.wisdomPatterns
      .slice(0, 3)
      .map((w) => w.summary || w.name || "")
      .filter(Boolean)
      .join(" ");
  }
  // Check interpretiveNotes for wisdom discernmentNote
  if (ctx.interpretiveNotes && ctx.interpretiveNotes.length) {
    const note = ctx.interpretiveNotes.find((n) => n.type === "wisdom" || n.discernmentNote);
    if (note) return note.discernmentNote || note.note || "";
  }
  return "";
}

function _deriveApplication(ctx) {
  if (!ctx.application) return "";
  const inv = ctx.application.invitation || "";
  const practices = (ctx.application.practices || []).slice(0, 3).join("; ");
  return [inv, practices].filter(Boolean).join(" — ");
}

function _derivePrayer(ctx) {
  // Fallback: use reflection prompts or challenge
  if (ctx.reflection && ctx.reflection.length) {
    return ctx.reflection[0] || "";
  }
  return ctx.challenge || "";
}

function _deriveSummary(ctx) {
  const titlePart = ctx.title ? `${ctx.title}: ` : "";
  return titlePart + (ctx.theme || ctx.themes?.[0] || "Renungan pasal ini.");
}

function _canonicalStrengths(ctx) {
  const strengths = [];
  if (ctx.application?.invitation) strengths.push(ctx.application.invitation);
  if (ctx.goldenVerse?.ref) strengths.push(`Mengangkat ayat kunci: ${ctx.goldenVerse.ref}`);
  return strengths.slice(0, 3);
}

function _canonicalNextStep(ctx) {
  if (ctx.application?.practices?.length) return ctx.application.practices[0];
  if (ctx.challenge) return ctx.challenge;
  return "";
}

function _canonicalReflectionQuestion(ctx) {
  if (ctx.faq && ctx.faq.length) return ctx.faq[0]?.question || "";
  if (ctx.reflection && ctx.reflection.length) return ctx.reflection[0] || "";
  return "";
}

/**
 * Extract structured sections from LLM prose using simple heuristics.
 * The LLM may or may not use explicit headings — we do a best-effort parse.
 */
function _parseLlmProse(text, mode) {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const strengths = [];
  const missing_points = [];
  let encouragement = "";
  let next_step = "";
  let reflection_question = "";

  let section = "general";

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (/kekuatan|strength|positif|baik/i.test(lower)) {
      section = "strengths";
      continue;
    }
    if (/kekurangan|yang kurang|belum|missing|perlu ditambah/i.test(lower)) {
      section = "missing";
      continue;
    }
    if (/dorongan|encouragement|semangat|keep going|tetap/i.test(lower)) {
      section = "encouragement";
      continue;
    }
    if (/langkah|next step|tindakan|praktis/i.test(lower)) {
      section = "next_step";
      continue;
    }
    if (/pertanyaan|question|refleksi lanjutan/i.test(lower)) {
      section = "question";
      continue;
    }

    const isBullet = /^[-•*\d.]\s+/.test(line);
    const content = line.replace(/^[-•*\d.]\s+/, "").trim();

    switch (section) {
      case "strengths":
        if (content) strengths.push(content);
        break;
      case "missing":
        if (content) missing_points.push(content);
        break;
      case "encouragement":
        encouragement = (encouragement ? encouragement + " " : "") + content;
        break;
      case "next_step":
        if (!next_step && content) next_step = content;
        break;
      case "question":
        if (!reflection_question && content) reflection_question = content;
        break;
      default:
        // For mentor mode, treat the first substantial paragraph as encouragement
        if (mode === "mentor" && !encouragement && content.length > 40 && !isBullet) {
          encouragement = content;
        }
    }
  }

  // Fallback: if no structured sections parsed, pull from the whole text
  if (!encouragement) {
    const firstLong = lines.find((l) => l.length > 60);
    encouragement = firstLong || "";
  }
  if (!reflection_question) {
    const question = lines.find((l) => l.includes("?"));
    reflection_question = question || "";
  }

  return {
    strengths: strengths.slice(0, 5),
    missing_points: missing_points.slice(0, 5),
    encouragement,
    next_step,
    reflection_question,
  };
}
