// =============================================================================
// ai-lesson-assist.js — UI integrasi AI pada halaman Lesson (Phase 001).
// Hanya memanggil AIService / CIL yang sudah ada — tanpa engine/prompt baru.
// =============================================================================
import { el, toast } from "../dom.js";
import { announce } from "../a11y.js";
import { go } from "../router.js";
import { AIService } from "../../src/ai/ai-service.js";
import { AIDebug } from "../../src/ai/ai-utils.js";
import { mountSemanticSearch } from "./semantic-search-ui.js";
import {
  openAiDialog,
  aiLoading,
  aiError,
  aiAnswerBlock,
  aiReasoningBasis,
  extractAiText,
} from "./ai-dialog.js";

/**
 * Mount panel AI Lesson: toolbar + kartu Summary / Crossrefs / Wisdom.
 */
export function mountAiLessonAssist(host, { plan, content } = {}) {
  if (!host || !plan) return;

  const chapter = plan.chapter;
  const day = plan.day;
  const chapterLabel = `${plan.book} ${chapter}`;
  const baseOpts = { chapter, day, book: plan.book };

  const summaryBody = el("div", { class: "ai-card-body", "aria-live": "polite" },
    el("p", { class: "ai-card-empty" }, "Ketuk “Buat ringkasan” untuk meminta ringkasan AI pasal ini."),
  );
  const crossBody = el("div", { class: "ai-card-body", "aria-live": "polite" },
    el("p", { class: "ai-card-empty" }, "Memuat referensi silang\u2026"),
  );
  const wisdomBody = el("div", { class: "ai-card-body", "aria-live": "polite" },
    el("p", { class: "ai-card-empty" }, "Ketuk “Minta hikmat” untuk saran penerapan yang hati-hati."),
  );

  const toolbar = el("div", {
    class: "ai-assist-toolbar",
    role: "toolbar",
    "aria-label": "Bantuan AI untuk pasal ini",
  },
    toolBtn("Ringkas AI", () => runSummary({ auto: false }), "Buat ringkasan AI pasal ini"),
    toolBtn("Tanyakan AI", () => openAskDialog(), "Tanyakan sesuatu tentang pasal ini"),
    toolBtn("Jelaskan", () => runExplain(), "Jelaskan isi pasal ini"),
    toolBtn("Wisdom Coach", () => runWisdom({ auto: false }), "Minta bimbingan hikmat dari pasal ini"),
    toolBtn("Cari Hikmat", () => openSearchDialog(), "Buka pencarian semantik"),
  );

  const summaryCard = el("div", { class: "reading ai-assist-card" },
    el("div", { class: "reading-head" },
      el("div", { class: "eyebrow" }, "Ringkasan AI"),
      el("button", {
        type: "button",
        class: "btn ghost",
        "aria-label": "Buat ringkasan AI",
        onclick: () => runSummary({ auto: false }),
      }, "Buat ringkasan"),
    ),
    el("h3", { class: "ai-card-title" }, `Ringkasan ${chapterLabel}`),
    summaryBody,
  );

  const crossCard = el("div", { class: "reading ai-assist-card" },
    el("div", { class: "eyebrow" }, "Referensi Silang"),
    el("h3", { class: "ai-card-title" }, "Ayat & tema terkait"),
    crossBody,
  );

  const wisdomCard = el("div", { class: "reading ai-assist-card" },
    el("div", { class: "reading-head" },
      el("div", { class: "eyebrow" }, "Wisdom Coach"),
      el("button", {
        type: "button",
        class: "btn ghost",
        "aria-label": "Minta bimbingan hikmat",
        onclick: () => runWisdom({ auto: false }),
      }, "Minta hikmat"),
    ),
    el("h3", { class: "ai-card-title" }, "Penerapan hati-hati"),
    wisdomBody,
  );

  host.replaceChildren(
    el("section", { class: "ai-assist", "aria-label": "Bantuan AI" },
      el("div", { class: "ai-assist-intro" },
        el("span", { class: "eyebrow" }, "Bantuan AI"),
        el("p", { class: "ai-assist-note" },
          "Fitur ini memakai Canonical Intelligence Layer lokal. Provider production (OpenAI / Gemini / Ollama / Claude / Azure) dipilih lewat Pengaturan; tanpa kunci server, sistem memakai mock/offline kanonik.",
        ),
      ),
      toolbar,
      summaryCard,
      crossCard,
      wisdomCard,
    ),
  );

  loadCrossRefs();

  function toolBtn(label, onClick, ariaLabel) {
    return el("button", {
      type: "button",
      class: "btn ghost",
      "aria-label": ariaLabel || label,
      onclick: onClick,
    }, label);
  }

  async function runSummary({ auto } = {}) {
    summaryBody.replaceChildren(aiLoading("Menyusun ringkasan AI\u2026"));
    summaryBody.setAttribute("aria-busy", "true");
    try {
      const result = await AIService.summarize({
        ...baseOpts,
        title: content?.title || plan.title,
        question: `Ringkas ${chapterLabel} secara pastoral dan praktis.`,
      });
      const text = extractAiText(result);
      summaryBody.replaceChildren(aiAnswerBlock(null, text || "Ringkasan belum tersedia."));
      announce("Ringkasan AI siap");
      if (!auto) summaryCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      summaryBody.replaceChildren(aiError(err?.userMessage || err?.message || "Gagal membuat ringkasan AI"));
    } finally {
      summaryBody.removeAttribute("aria-busy");
    }
  }

  async function runExplain() {
    const dlg = openAiDialog({
      title: "Jelaskan pasal",
      subtitle: chapterLabel,
    });
    dlg.setBody(aiLoading("Menjelaskan pasal\u2026"));
    try {
      const result = await AIService.reason(
        `Jelaskan tema dan pesan utama ${chapterLabel}${content?.title ? ` (“${content.title}”)` : ""} untuk pembaca awam.`,
        baseOpts,
      );
      dlg.setBody(
        aiAnswerBlock("Penjelasan", extractAiText(result)),
        aiReasoningBasis(result),
      );
      announce("Penjelasan AI siap");
    } catch (err) {
      dlg.setBody(aiError(err?.userMessage || err?.message || "Gagal menjelaskan pasal"));
    }
  }

  async function runWisdom({ auto } = {}) {
    wisdomBody.replaceChildren(aiLoading("Menyusun bimbingan hikmat\u2026"));
    wisdomBody.setAttribute("aria-busy", "true");
    try {
      const result = await AIService.wisdom({
        ...baseOpts,
        title: content?.title || plan.title,
      });
      wisdomBody.replaceChildren(aiAnswerBlock(null, extractAiText(result) || "Bimbingan belum tersedia."));
      announce("Wisdom Coach siap");
      if (!auto) wisdomCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      wisdomBody.replaceChildren(aiError(err?.userMessage || err?.message || "Gagal meminta Wisdom Coach"));
    } finally {
      wisdomBody.removeAttribute("aria-busy");
    }
  }

  function openAskDialog() {
    const input = el("textarea", {
      class: "journal-input ai-ask-input",
      rows: "3",
      placeholder: `Contoh: Apa arti takut akan TUHAN di ${chapterLabel}?`,
      "aria-label": "Pertanyaan tentang pasal ini",
    });
    const out = el("div", { class: "ai-ask-out", "aria-live": "polite" });
    const askBtn = el("button", {
      type: "button",
      class: "btn primary",
      onclick: async () => {
        const q = input.value.trim();
        if (!q) {
          toast("Tulis pertanyaan terlebih dahulu");
          return;
        }
        askBtn.disabled = true;
        out.replaceChildren(aiLoading("Menyusun jawaban\u2026"));
        try {
          const result = await AIService.ask(q, {
            ...baseOpts,
            onToken(_token, full) {
              out.replaceChildren(aiAnswerBlock("Jawaban", full));
            },
          });
          out.replaceChildren(
            aiAnswerBlock("Jawaban", extractAiText(result)),
            aiReasoningBasis(result),
          );
          AIDebug.log("Response Rendered", `Ask This Chapter · ${result?.provider || "local"} · ${result?.metadata?.validation_status || "n/a"}`);
          announce("Jawaban AI siap");
        } catch (err) {
          out.replaceChildren(aiError(err?.userMessage || err?.message || "Gagal meminta jawaban AI"));
        } finally {
          askBtn.disabled = false;
        }
      },
    }, "Kirim pertanyaan");

    const dlg = openAiDialog({
      title: "Tanyakan AI",
      subtitle: `${chapterLabel} · Ask This Chapter`,
      initialFocus: input,
    });
    dlg.setBody(
      el("p", { class: "ai-assist-note" }, "Ajukan pertanyaan tentang pasal ini. Jawaban diground ke konteks kanonik lokal."),
      el("label", { class: "journal-field" },
        el("span", { class: "journal-label" }, "Pertanyaan"),
        input,
      ),
      el("div", { class: "journal-actions" }, askBtn),
      out,
    );
  }

  function openSearchDialog() {
    const hostEl = el("div", { class: "ai-search-host" });
    const dlg = openAiDialog({
      title: "Cari Hikmat",
      subtitle: "Semantic Search · offline-first",
    });
    dlg.setBody(hostEl);
    const ctl = mountSemanticSearch(hostEl, {
      placeholder: `Cari tema terkait ${chapterLabel}\u2026`,
      ariaLabel: "Pencarian semantik dari halaman lesson",
    });
    const prevClose = dlg.close;
    // Wrap close so search listeners are cleaned up.
    dlg.modal.querySelector(".reader-close")?.addEventListener("click", () => ctl?.destroy?.());
    dlg.overlay.addEventListener("click", (e) => {
      if (e.target === dlg.overlay) ctl?.destroy?.();
    });
    void prevClose;
    requestAnimationFrame(() => ctl?.focus?.());
  }

  async function loadCrossRefs() {
    crossBody.replaceChildren(aiLoading("Memuat referensi silang\u2026"));
    try {
      const ctx = await AIService.buildCanonicalContext(baseOpts);
      const refs = Array.isArray(ctx?.crossrefs) ? ctx.crossrefs : [];
      if (!refs.length) {
        crossBody.replaceChildren(
          el("p", { class: "ai-card-empty" }, "Belum ada referensi silang untuk pasal ini di Knowledge Base."),
        );
        return;
      }
      const list = el("ul", { class: "ai-crossref-list" });
      refs.slice(0, 12).forEach((ref) => {
        const target = String(ref.target || ref.source || "");
        const dayMatch = target.match(/Amsal\s+(\d+)/i);
        const targetDay = dayMatch ? Number(dayMatch[1]) : null;
        const why = ref.reason || ref.why || ref.relationshipType || "";
        const row = el("li", { class: "ai-crossref-item" },
          el("div", { class: "ai-crossref-main" },
            el("strong", {}, target || "Referensi"),
            why ? el("p", {}, why) : null,
          ),
          targetDay && targetDay !== chapter
            ? el("button", {
              type: "button",
              class: "btn ghost",
              "aria-label": `Buka ${target}`,
              onclick: () => go("day", { day: targetDay }),
            }, "Buka")
            : null,
        );
        list.append(row);
      });
      crossBody.replaceChildren(list);
    } catch (err) {
      crossBody.replaceChildren(aiError(err?.userMessage || err?.message || "Gagal memuat referensi silang"));
    }
  }
}
