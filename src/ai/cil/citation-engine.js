import { canonicalEngine } from "./engines/canonical-engine.js";

/**
 * Parse and verify Scripture citations against canon registry + allowed context.
 */
export class CitationEngine {
  constructor({ canon = canonicalEngine } = {}) {
    this.canon = canon;
  }

  /**
   * Extract reference-like strings from free text (ID/EN/abbreviated).
   */
  extract(text) {
    const src = String(text || "");
    const pattern =
      /\b((?:[1-3]\s*)?(?:Amsal|Ams|Prov(?:erbs)?|Pr|Mazmur|Mzm|Ps(?:alm)?s?|Pengkhotbah|Pkh|Eccl|Matius|Mat|Matt|Mt|Roma|Rm|Rom|Yakobus|Yak|Jas|James|Ibrani|Ibr|Heb|Efesus|Ef|Eph|Filipi|Flp|Phil|Kolose|Kol|Col|Galatia|Gal|1\s*Kor(?:intus)?|1Cor|2\s*Kor(?:intus)?|2Cor|2\s*Tes(?:alonika)?|2Thess|1\s*Petrus|1Pet))\s+\d+(?::\d+(?:\s*[-–]\s*\d+)?)?\b/giu;
    const found = [];
    const seen = new Set();
    let match;
    while ((match = pattern.exec(src))) {
      const display = match[0].replace(/\s+/g, " ").trim();
      if (seen.has(display.toLowerCase())) continue;
      seen.add(display.toLowerCase());
      found.push(display);
    }
    return found;
  }

  parse(display) {
    return this.canon.parseReference(display);
  }

  verify(display, { allowedCitations = [], requireAllowed = false } = {}) {
    const parsed = this.parse(display);
    if (!parsed) {
      return { ok: false, display, reason: "unresolvable", invented: true };
    }
    if (parsed.status === "production") {
      const book = this.canon.getBook(parsed.bookId);
      if (book && (parsed.chapter < 1 || parsed.chapter > book.chapterCount)) {
        return { ok: false, display, reason: "impossible-chapter", invented: true, parsed };
      }
    }
    const allowed = new Set(
      (allowedCitations || []).map((c) => String(c.canonicalId || c.display || c).toLowerCase()),
    );
    const keys = [parsed.canonicalId, parsed.display, `${parsed.bookName} ${parsed.chapter}`]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    const inAllowed = keys.some((k) => allowed.has(k)) ||
      [...allowed].some((a) => keys.some((k) => a.includes(k) || k.includes(a)));
    if (requireAllowed && allowed.size && !inAllowed) {
      return { ok: false, display, reason: "outside-context", invented: true, parsed };
    }
    return {
      ok: true,
      display: parsed.display,
      canonicalId: parsed.canonicalId,
      bookId: parsed.bookId,
      chapter: parsed.chapter,
      verse: parsed.verse,
      status: parsed.status,
      verified: true,
      inAllowedContext: inAllowed || !allowed.size,
    };
  }

  verifyText(text, options = {}) {
    const displays = this.extract(text);
    const citations = displays.map((d) => this.verify(d, options));
    return {
      citations,
      inventedRefs: citations.filter((c) => !c.ok).map((c) => c.display),
      verified: citations.filter((c) => c.ok),
    };
  }
}

export const citationEngine = new CitationEngine();
