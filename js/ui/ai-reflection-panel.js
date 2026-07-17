// =============================================================================
// ai-reflection-panel.js — Consent + asisten refleksi AI untuk jurnal.
// Phase 004: wired to Review Engine (AIService.review) and Bible Mentor
//            (AIService.mentor) in addition to the existing reflect assistant.
// =============================================================================
import { el, toast } from "../dom.js";
import { announce } from "../a11y.js";
import {
  JOURNAL_AI_CONSENT_COPY,
  isJournalAiConsentGranted,
  grantJournalAiConsent,
  revokeJournalAiConsent,
} from "../journal/consent.js";
import { suggestTags } from "../journal/tags.js";
import { recordJournalAiAssist } from "../journal/analytics.js";
import { AIService } from "../../src/ai/ai-service.js";

export function mountAiReflectionPanel(host, { getEntry, onApplyDraft } = {}) {
  if (!host) return;

  const out = el("div", { class: "journal-ai-out", "aria-live": "polite" });
  const status = el("p", { class: "journal-ai-status" }, "");

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showStatus(msg) {
    status.textContent = msg;
    out.replaceChildren(status);
  }

  function showError(msg) {
    status.textContent = "";
    out.replaceChildren(
      el("p", { class: "journal-ai-error" }, msg || "Terjadi kesalahan AI. Coba lagi."),
    );
  }

  function showAnswer(label, content) {
    status.textContent = "";
    const node = el("div", { class: "journal-ai-answer" },
      el("p", { class: "journal-label" }, label),
      el("div", { class: "journal-ai-body" }, content || "AI tidak mengembalikan teks."),
    );
    out.replaceChildren(node);
    node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return node;
  }

  /**
   * Render structured ReviewOutput (Phase 004) into the output area.
   */
  function showReviewOutput(label, reviewOutput) {
    status.textContent = "";

    const sections = [];

    if (reviewOutput.summary) {
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Ringkasan"),
          el("p", {}, reviewOutput.summary),
        ),
      );
    }

    if (reviewOutput.memory_verse) {
      const v = reviewOutput.memory_verse;
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Ayat Hafalan"),
          el("blockquote", { class: "journal-ai-verse" },
            el("p", {}, v.text || ""),
            el("cite", {}, v.ref || ""),
          ),
        ),
      );
    }

    if (reviewOutput.themes && reviewOutput.themes.length) {
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Tema"),
          el("p", {}, reviewOutput.themes.join(" · ")),
        ),
      );
    }

    if (reviewOutput.strengths && reviewOutput.strengths.length) {
      const items = reviewOutput.strengths.map((s) => el("li", {}, s));
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Kekuatan Renungan"),
          el("ul", { class: "journal-ai-list" }, ...items),
        ),
      );
    }

    if (reviewOutput.missing_points && reviewOutput.missing_points.length) {
      const items = reviewOutput.missing_points.map((s) => el("li", {}, s));
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Perlu Diperdalam"),
          el("ul", { class: "journal-ai-list" }, ...items),
        ),
      );
    }

    if (reviewOutput.application) {
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Penerapan Praktis"),
          el("p", {}, reviewOutput.application),
        ),
      );
    }

    if (reviewOutput.wisdom) {
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Hikmat"),
          el("p", {}, reviewOutput.wisdom),
        ),
      );
    }

    if (reviewOutput.historical_context) {
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Konteks Sejarah"),
          el("p", {}, reviewOutput.historical_context),
        ),
      );
    }

    if (reviewOutput.cross_references && reviewOutput.cross_references.length) {
      const items = reviewOutput.cross_references
        .slice(0, 5)
        .map((r) => el("li", {}, `${r.source} → ${r.target}${r.reason ? " — " + r.reason : ""}`));
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Referensi Silang"),
          el("ul", { class: "journal-ai-list" }, ...items),
        ),
      );
    }

    if (reviewOutput.encouragement) {
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Dorongan"),
          el("p", {}, reviewOutput.encouragement),
        ),
      );
    }

    if (reviewOutput.prayer) {
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Doa"),
          el("p", { class: "journal-ai-prayer" }, reviewOutput.prayer),
        ),
      );
    }

    if (reviewOutput.next_step) {
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Langkah Berikutnya"),
          el("p", {}, reviewOutput.next_step),
        ),
      );
    }

    if (reviewOutput.reflection_question) {
      sections.push(
        el("div", { class: "journal-ai-section" },
          el("p", { class: "journal-label" }, "Pertanyaan Refleksi"),
          el("p", { class: "journal-ai-question" }, reviewOutput.reflection_question),
        ),
      );
    }

    const node = el("div", { class: "journal-ai-answer" },
      el("p", { class: "journal-label" }, label),
      ...sections,
    );
    out.replaceChildren(node);
    node.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function extractText(entry) {
    return [entry.body, entry.gratitude, entry.actionPlan, ...(entry.prayer?.requests || [])]
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  function extractReviewText(entry) {
    return [entry.body, entry.gratitude, entry.actionPlan]
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  // ── Consent gate ───────────────────────────────────────────────────────────

  function renderConsentGate() {
    host.replaceChildren(
      el("div", { class: "journal-ai-panel" },
        el("h3", { class: "journal-subhead" }, "Asisten refleksi AI"),
        el("p", { class: "journal-note" }, JOURNAL_AI_CONSENT_COPY),
        el("div", { class: "journal-actions" },
          el("button", {
            type: "button",
            class: "btn primary",
            onclick: () => {
              grantJournalAiConsent();
              toast("Izin AI untuk jurnal diaktifkan");
              announce("Izin AI untuk jurnal diaktifkan");
              renderMain();
            },
          }, "Izinkan AI"),
          el("button", {
            type: "button",
            class: "btn ghost",
            onclick: () => {
              const entry = getEntry?.() || {};
              const tags = suggestTags(entry);
              out.replaceChildren(
                el("p", {}, "Tanpa AI — saran tag lokal:"),
                tags.length
                  ? el("p", {}, tags.join(", "))
                  : el("p", {}, "Belum ada saran tag dari teks saat ini."),
              );
              if (!host.contains(out)) host.append(out);
            },
          }, "Tolak — pakai saran lokal saja"),
        ),
        out,
      ),
    );
  }

  // ── Main panel ─────────────────────────────────────────────────────────────

  function renderMain() {
    // Button: Bantu refleksi (AI) — uses reflectJournal
    const runBtn = el("button", {
      type: "button",
      class: "btn primary",
      onclick: async () => {
        const entry = getEntry?.() || {};
        const text = extractText(entry);
        if (!text) { toast("Tulis jurnal dulu sebelum meminta bantuan AI"); return; }
        if (!isJournalAiConsentGranted()) { renderConsentGate(); return; }
        showStatus("Menyusun refleksi…");
        try {
          const result = await AIService.reflectJournal({
            text,
            day: entry.day,
            chapter: entry.chapter,
            book: entry.book,
            entryId: entry.id,
            tags: entry.tags,
          });
          recordJournalAiAssist();
          if (result.success === false) {
            showError(result.error?.message || result.content || "Gagal meminta bantuan AI");
            return;
          }
          const answer = String(result?.content || result?.answer || result?.text || "").trim();
          const answerNode = showAnswer("Ringkasan & refleksi AI", answer || "AI tidak mengembalikan teks. Coba lagi.");
          out.append(
            el("div", { class: "journal-actions" },
              el("button", {
                type: "button",
                class: "btn ghost",
                onclick: () => {
                  onApplyDraft?.({ questions: true });
                  toast("AI tidak menimpa jurnal kecuali kamu menyalin manual");
                },
              }, "Saya tetap menulis sendiri"),
              el("button", {
                type: "button",
                class: "btn ghost",
                onclick: () => {
                  revokeJournalAiConsent();
                  toast("Izin AI dicabut");
                  renderConsentGate();
                },
              }, "Cabut izin AI"),
            ),
          );
          announce("Ringkasan dan refleksi AI sudah siap");
        } catch (err) {
          showError(err?.userMessage || err?.message || "Gagal meminta bantuan AI");
        }
      },
    }, "Bantu refleksi (AI)");

    // Button: Review AI — Phase 004 Review Engine
    const reviewBtn = el("button", {
      type: "button",
      class: "btn",
      "aria-label": "Review renungan dengan AI Review Engine",
      onclick: async () => {
        const entry = getEntry?.() || {};
        const text = extractReviewText(entry);
        if (!text && !entry.chapter && !entry.day) {
          toast("Tulis renungan/jurnal dulu sebelum meminta review");
          return;
        }
        if (!isJournalAiConsentGranted()) { renderConsentGate(); return; }
        showStatus("Meninjau renungan…");
        try {
          const result = await AIService.review({
            text,
            day: entry.day,
            chapter: entry.chapter,
            book: entry.book,
            journalConsent: true,
          });
          recordJournalAiAssist();
          if (result.success === false) {
            showError(result.error?.message || result.content || "Gagal mereview renungan");
            return;
          }
          if (result.review) {
            showReviewOutput("Review Renungan", result.review);
          } else {
            showAnswer("Review Renungan", result.content || "Review belum tersedia.");
          }
          announce("Review renungan siap");
        } catch (err) {
          showError(err?.userMessage || err?.message || "Gagal mereview renungan");
        }
      },
    }, "Review AI");

    // Button: Bible Mentor — Phase 004 mentor mode
    const mentorBtn = el("button", {
      type: "button",
      class: "btn",
      "aria-label": "Bible Mentor: bimbingan alkitabiah personal",
      onclick: async () => {
        const entry = getEntry?.() || {};
        const text = extractReviewText(entry);
        if (!isJournalAiConsentGranted()) { renderConsentGate(); return; }
        showStatus("Mempersiapkan Bible Mentor…");
        try {
          const result = await AIService.mentor({
            text,
            day: entry.day,
            chapter: entry.chapter,
            book: entry.book,
            journalConsent: true,
          });
          recordJournalAiAssist();
          if (result.success === false) {
            showError(result.error?.message || result.content || "Bible Mentor tidak tersedia saat ini");
            return;
          }
          if (result.review) {
            showReviewOutput("Bible Mentor", result.review);
          } else {
            showAnswer("Bible Mentor", result.content || "Bimbingan belum tersedia.");
          }
          announce("Bimbingan Bible Mentor sudah siap");
        } catch (err) {
          showError(err?.userMessage || err?.message || "Bible Mentor tidak tersedia saat ini");
        }
      },
    }, "Bible Mentor");

    host.replaceChildren(
      el("div", { class: "journal-ai-panel" },
        el("h3", { class: "journal-subhead" }, "Asisten refleksi AI"),
        el("p", { class: "journal-note" }, "Izin aktif. AI hanya memakai teks jurnal yang kamu kirim sekarang."),
        el("div", { class: "journal-actions" },
          runBtn,
          reviewBtn,
          mentorBtn,
          el("button", {
            type: "button",
            class: "btn ghost",
            onclick: () => {
              revokeJournalAiConsent();
              toast("Izin AI dicabut");
              renderConsentGate();
            },
          }, "Cabut izin"),
        ),
        out,
      ),
    );
  }

  if (isJournalAiConsentGranted()) renderMain();
  else renderConsentGate();
}
