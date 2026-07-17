// =============================================================================
// ai-reflection-panel.js — Consent + asisten refleksi AI untuk jurnal.
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

  function renderMain() {
    const runBtn = el("button", {
      type: "button",
      class: "btn primary",
      onclick: async () => {
        const entry = getEntry?.() || {};
        const text = [entry.body, entry.gratitude, entry.actionPlan, ...(entry.prayer?.requests || [])]
          .filter(Boolean)
          .join("\n")
          .trim();
        if (!text) {
          toast("Tulis jurnal dulu sebelum meminta bantuan AI");
          return;
        }
        if (!isJournalAiConsentGranted()) {
          renderConsentGate();
          return;
        }
        status.textContent = "Menyusun refleksi…";
        out.replaceChildren(status);
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
          const answer = String(result?.content || result?.answer || result?.text || "").trim();
          status.textContent = "";
          const answerNode = el("div", { class: "journal-ai-answer" },
            el("p", { class: "journal-label" }, "Ringkasan & refleksi AI"),
            el("div", { class: "journal-ai-body" }, answer || "AI tidak mengembalikan teks. Coba lagi."),
          );
          out.replaceChildren(
            answerNode,
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
          answerNode.scrollIntoView({ behavior: "smooth", block: "nearest" });
          announce("Ringkasan dan refleksi AI sudah siap");
        } catch (err) {
          status.textContent = "";
          out.replaceChildren(
            el("p", { class: "journal-ai-error" }, err?.userMessage || err?.message || "Gagal meminta bantuan AI"),
          );
        }
      },
    }, "Bantu refleksi (AI)");

    const reviewBtn = el("button", {
      type: "button",
      class: "btn",
      "aria-label": "Review renungan dengan Reflection Engine",
      onclick: async () => {
        const entry = getEntry?.() || {};
        const text = [entry.body, entry.gratitude, entry.actionPlan]
          .filter(Boolean)
          .join("\n")
          .trim();
        if (!text) {
          toast("Tulis renungan/jurnal dulu sebelum meminta review");
          return;
        }
        if (!isJournalAiConsentGranted()) {
          renderConsentGate();
          return;
        }
        status.textContent = "Meninjau renungan…";
        out.replaceChildren(status);
        try {
          const result = await AIService.reflect({
            day: entry.day,
            chapter: entry.chapter,
            book: entry.book,
            question: `Review renungan berikut dan berikan dorongan pastoral serta pertanyaan lanjutan:\n\n${text.slice(0, 2500)}`,
          });
          recordJournalAiAssist();
          const answer = String(result?.content || result?.answer || result?.text || "").trim();
          status.textContent = "";
          const answerNode = el("div", { class: "journal-ai-answer" },
            el("p", { class: "journal-label" }, "Review Renungan"),
            el("div", { class: "journal-ai-body" }, answer || "Review belum tersedia."),
          );
          out.replaceChildren(answerNode);
          answerNode.scrollIntoView({ behavior: "smooth", block: "nearest" });
          announce("Review renungan siap");
        } catch (err) {
          status.textContent = "";
          out.replaceChildren(
            el("p", { class: "journal-ai-error" }, err?.userMessage || err?.message || "Gagal mereview renungan"),
          );
        }
      },
    }, "Review Renungan");

    host.replaceChildren(
      el("div", { class: "journal-ai-panel" },
        el("h3", { class: "journal-subhead" }, "Asisten refleksi AI"),
        el("p", { class: "journal-note" }, "Izin aktif. AI hanya memakai teks jurnal yang kamu kirim sekarang."),
        el("div", { class: "journal-actions" },
          runBtn,
          reviewBtn,
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
