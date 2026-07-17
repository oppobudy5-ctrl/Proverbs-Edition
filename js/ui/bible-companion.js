import { $, el } from "../dom.js";
import { announce } from "../a11y.js";
import { go } from "../router.js";
import { AIService } from "../../src/ai/ai-service.js";
import { aiError, aiLoading } from "./ai-dialog.js";

export function renderBibleCompanion({ book = "proverbs", chapter = 1 } = {}) {
  const section = el("section", {
    class: "section day-section",
    "aria-labelledby": "companion-title",
  });
  const controls = el("div", { class: "reading" }, aiLoading("Memuat daftar kitab…"));
  const output = el("div", { "aria-live": "polite", "aria-busy": "true" }, aiLoading("Memuat Bible Companion…"));

  section.append(
    el("div", { class: "hero" },
      el("div", { class: "hero-eyebrow" }, el("span", { class: "dot" }), "Canonical Intelligence Layer"),
      el("h1", { id: "companion-title" }, "Bible Companion"),
      el("p", { class: "hero-sub" }, "Jelajahi struktur kanonik 66 kitab. Konten pasal dimuat hanya bila tersedia."),
    ),
    controls,
    output,
  );
  $("#app")?.append(section);
  void mountControls();

  async function mountControls() {
    const response = await AIService.books();
    if (!response.success || !Array.isArray(response.books)) {
      controls.replaceChildren(aiError(response.error?.message || "Daftar kitab tidak tersedia."));
      output.removeAttribute("aria-busy");
      return;
    }

    const books = response.books;
    const selected = books.find((item) => item.slug === book || item.bookId === book)
      || books.find((item) => item.slug === "proverbs")
      || books[0];
    const safeChapter = clampChapter(chapter, selected.chapterCount);

    const bookSelect = el("select", {
      class: "reader-vselect",
      id: "companion-book",
      "aria-label": "Pilih kitab",
      onchange: (event) => go("companion", { book: event.target.value, chapter: 1 }),
    });
    appendBookOptions(bookSelect, books, selected.slug);

    const chapterSelect = el("select", {
      class: "reader-vselect",
      id: "companion-chapter",
      "aria-label": "Pilih pasal",
      onchange: (event) => go("companion", { book: selected.slug, chapter: Number(event.target.value) }),
    });
    appendChapterOptions(chapterSelect, selected.chapterCount, safeChapter);

    controls.replaceChildren(
      el("div", { class: "reading-head" },
        el("div", {},
          el("div", { class: "eyebrow" }, "Book Navigator"),
          el("h2", {}, `${selected.names?.id || selected.slug} ${safeChapter}`),
        ),
      ),
      el("div", { class: "journal-actions", role: "group", "aria-label": "Pilih kitab dan pasal" },
        el("label", { class: "journal-field" },
          el("span", { class: "journal-label" }, "Kitab"),
          bookSelect,
        ),
        el("label", { class: "journal-field" },
          el("span", { class: "journal-label" }, "Pasal"),
          chapterSelect,
        ),
      ),
      selected.available && selected.slug === "proverbs"
        ? el("button", {
            type: "button",
            class: "btn primary",
            onclick: () => go("day", { day: safeChapter }),
          }, "Buka bacaan Amsal")
        : el("p", { class: "reader-note", role: "status" },
            "Metadata kanonik tersedia. Teks dan materi pasal kitab ini belum tersedia offline.",
          ),
    );

    await loadCompanion(selected, safeChapter);
  }

  async function loadCompanion(selected, safeChapter) {
    output.setAttribute("aria-busy", "true");
    output.replaceChildren(aiLoading(`Menyusun Companion ${selected.names?.id || selected.slug} ${safeChapter}…`));
    const response = await AIService.companion({
      book: selected.slug,
      chapter: safeChapter,
      cache: true,
    });
    output.removeAttribute("aria-busy");
    if (!response.success || !response.companion) {
      output.replaceChildren(aiError(response.error?.message || "Bible Companion tidak tersedia."));
      return;
    }
    output.replaceChildren(...renderCompanionCards(response.companion));
    announce(`Bible Companion ${selected.names?.id || selected.slug} ${safeChapter} siap`);
  }
}

function renderCompanionCards(companion) {
  const book = companion.book;
  const overview = el("article", { class: "reading ai-assist-card" },
    el("div", { class: "eyebrow" }, "Book Overview"),
    el("h2", {}, book.names?.id || book.slug),
    el("p", {}, `${book.names?.en || ""} · ${book.testament} · ${book.category || book.genre} · ${book.chapterCount} pasal`),
    el("p", {}, `Penulis: ${(book.authors || []).join(", ") || "Belum tersedia"}`),
    el("p", {}, `Periode: ${book.period || "Belum tersedia"}`),
    el("p", {}, `Bahasa utama: ${book.language || "Belum tersedia"}`),
    companion.status_message ? el("p", { class: "reader-note", role: "status" }, companion.status_message) : null,
  );

  const summary = el("article", { class: "reading ai-assist-card" },
    el("div", { class: "eyebrow" }, "Book Summary"),
    el("h2", {}, companion.chapter ? `Pasal ${companion.chapter}` : "Ringkasan kitab"),
    el("p", {}, companion.summary || companion.overview || "Ringkasan belum tersedia dalam Knowledge Base."),
    companion.purpose ? el("p", {}, `Tujuan: ${companion.purpose}`) : null,
    companion.themes?.length ? el("p", {}, `Tema: ${companion.themes.join(" · ")}`) : null,
    companion.historical_context ? el("p", {}, companion.historical_context) : null,
  );

  const references = el("article", { class: "reading ai-assist-card" },
    el("div", { class: "eyebrow" }, "Cross Book References"),
    el("h2", {}, "Hubungan kanonik"),
    companion.cross_book_references?.length
      ? el("ul", { class: "ai-crossref-list" },
          ...companion.cross_book_references.map((ref) =>
            el("li", { class: "ai-crossref-item" },
              el("strong", {}, `${ref.source} → ${ref.target}`),
              ref.reason ? el("p", {}, ref.reason) : null,
            ),
          ),
        )
      : el("p", {}, "Belum ada referensi lintas kitab yang tervalidasi untuk konteks ini."),
  );

  const guidance = el("article", { class: "reading ai-assist-card" },
    el("div", { class: "eyebrow" }, "Bible Companion"),
    el("h2", {}, "Penerapan dan doa"),
    el("p", {}, companion.application || "Penerapan belum tersedia."),
    companion.prayer ? el("blockquote", { class: "pull" }, companion.prayer) : null,
  );
  return [overview, summary, references, guidance];
}

function appendBookOptions(select, books, selectedSlug) {
  for (const testament of ["OT", "NT"]) {
    const group = el("optgroup", { label: testament === "OT" ? "Perjanjian Lama" : "Perjanjian Baru" });
    for (const book of books.filter((item) => item.testament === testament)) {
      group.append(el("option", {
        value: book.slug,
        selected: book.slug === selectedSlug ? "selected" : undefined,
      }, `${book.names?.id || book.slug}${book.available ? "" : " · metadata"}`));
    }
    select.append(group);
  }
}

function appendChapterOptions(select, count, selectedChapter) {
  for (let chapter = 1; chapter <= count; chapter += 1) {
    select.append(el("option", {
      value: String(chapter),
      selected: chapter === selectedChapter ? "selected" : undefined,
    }, `Pasal ${chapter}`));
  }
}

function clampChapter(value, max) {
  const chapter = Number(value);
  if (!Number.isInteger(chapter) || chapter < 1) return 1;
  return Math.min(chapter, Number(max) || 1);
}
