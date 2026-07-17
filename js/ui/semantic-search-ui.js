// =============================================================================
// semantic-search-ui.js — Panel hasil Semantic Search (kalender & reusable).
// =============================================================================
import { el } from "../dom.js";
import { AIService } from "../../src/ai/ai-service.js";
import { announce } from "../a11y.js";
import { onLeave } from "../lifecycle.js";
import { go } from "../router.js";
import { highlight } from "../search.js";

const FILTERS = [
  { id: "all", label: "Semua" },
  { id: "chapter", label: "Pasal" },
  { id: "topic", label: "Topik" },
  { id: "faq", label: "FAQ" },
  { id: "dictionary", label: "Kamus" },
  { id: "golden-verse", label: "Ayat" },
  { id: "prayer", label: "Doa" },
  { id: "reflection", label: "Refleksi" },
];

/**
 * Mount semantic search UI into a host element.
 * @returns {{ destroy: Function, setQuery: Function }}
 */
export function mountSemanticSearch(host, options = {}) {
  let timer = 0;
  let suggestTimer = 0;
  let activeFilter = "all";
  let lastQuery = "";
  let destroyed = false;

  const status = el("span", { class: "search-status", "aria-live": "polite" }, "");
  const suggestBox = el("div", { class: "sem-suggest", hidden: true, role: "listbox", "aria-label": "Saran pencarian" });
  const chips = el("div", { class: "sem-chips" });
  const filters = el("div", { class: "sem-filters", role: "toolbar", "aria-label": "Filter hasil" });
  const results = el("div", { class: "sem-results", "aria-live": "polite" });
  const related = el("div", { class: "sem-related" });

  const input = el("input", {
    type: "search",
    class: "search-input",
    placeholder: options.placeholder || "Coba: “Saya bingung mengambil keputusan”…",
    "aria-label": options.ariaLabel || "Pencarian semantik Alkitab",
    "aria-autocomplete": "list",
    "aria-controls": "sem-suggest-list",
    autocomplete: "off",
  });
  suggestBox.id = "sem-suggest-list";

  const favBtn = el("button", {
    type: "button",
    class: "btn ghost sem-fav",
    "aria-pressed": "false",
    "aria-label": "Simpan pencarian",
    title: "Simpan pencarian",
    onclick: () => {
      if (!lastQuery) return;
      const { favorited } = AIService.toggleFavoriteSearch(lastQuery);
      favBtn.setAttribute("aria-pressed", favorited ? "true" : "false");
      favBtn.setAttribute("aria-label", favorited ? "Hapus pencarian dari favorit" : "Simpan pencarian");
      favBtn.textContent = favorited ? "★ Disimpan" : "☆ Simpan";
      announce(favorited ? "Pencarian disimpan" : "Pencarian dihapus dari favorit");
      renderPrefChips();
    },
  }, "☆ Simpan");

  FILTERS.forEach((f) => {
    const btn = el("button", {
      type: "button",
      class: "sem-filter" + (f.id === "all" ? " is-active" : ""),
      "data-filter": f.id,
      onclick: () => {
        activeFilter = f.id;
        filters.querySelectorAll(".sem-filter").forEach((b) => b.classList.toggle("is-active", b.dataset.filter === activeFilter));
        if (lastQuery) runSearch(lastQuery);
      },
    }, f.label);
    filters.appendChild(btn);
  });

  const bar = el("div", { class: "search-bar sem-search-bar" }, input, status, favBtn);
  const wrap = el("div", { class: "sem-search" }, bar, suggestBox, chips, filters, results, related);
  host.appendChild(wrap);
  renderPrefChips();

  input.addEventListener("input", () => {
    const query = input.value.trim();
    clearTimeout(timer);
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => refreshSuggestions(query), 80);
    timer = setTimeout(() => runSearch(query), 140);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      suggestBox.hidden = true;
      input.blur();
    }
  });

  async function refreshSuggestions(query) {
    if (destroyed) return;
    if (!query) {
      suggestBox.hidden = true;
      suggestBox.innerHTML = "";
      return;
    }
    try {
      const items = await AIService.suggestSearch(query, { limit: 6 });
      suggestBox.innerHTML = "";
      if (!items.length) {
        suggestBox.hidden = true;
        return;
      }
      items.forEach((item) => {
        const row = el("button", {
          type: "button",
          class: "sem-suggest-item",
          role: "option",
          onclick: () => {
            input.value = item.value;
            suggestBox.hidden = true;
            runSearch(item.value);
          },
        },
          el("span", { class: "sem-suggest-type" }, item.type),
          el("span", {}, item.label),
        );
        suggestBox.appendChild(row);
      });
      suggestBox.hidden = false;
    } catch {
      suggestBox.hidden = true;
    }
  }

  async function runSearch(query) {
    if (destroyed) return;
    lastQuery = query;
    favBtn.setAttribute("aria-pressed", AIService.isFavoriteSearch(query) ? "true" : "false");
    favBtn.textContent = AIService.isFavoriteSearch(query) ? "★ Disimpan" : "☆ Simpan";
    if (!query) {
      status.textContent = "";
      results.innerHTML = "";
      related.innerHTML = "";
      options.onClear?.();
      return;
    }
    status.textContent = "Mencari…";
    try {
      const type = activeFilter === "all" ? undefined : activeFilter;
      const response = await AIService.semanticSearch(query, {
        limit: 12,
        type,
        chapter: options.chapter,
        related: true,
      });
      if (destroyed) return;
      status.textContent = `${response.results.length} hasil · ${response.tookMs} ms · ${labelIntent(response.analysis?.intent)}`;
      renderResults(response);
      renderRelated(response.related);
      options.onResults?.(response);
      announce(`${response.results.length} hasil pencarian`);
    } catch (error) {
      status.textContent = "Pencarian lokal belum siap";
      results.innerHTML = "";
      results.appendChild(el("p", { class: "sem-empty" }, "Knowledge Base belum termuat. Mode kata kunci tetap tersedia di kalender."));
      options.onError?.(error);
    }
  }

  function renderResults(response) {
    results.innerHTML = "";
    if (!response.results.length) {
      results.appendChild(el("p", { class: "sem-empty" }, "Tidak ada hasil. Coba konsep lain atau situasi hidup yang berbeda."));
      return;
    }
    response.results.forEach((item) => {
      const card = el("article", { class: "sem-card" },
        el("div", { class: "sem-card-top" },
          el("span", { class: "sem-ref" }, item.reference || item.title),
          el("span", { class: "sem-conf", title: "Kepercayaan" }, `${Math.round(item.confidence * 100)}%`),
        ),
        el("h3", { class: "sem-title", html: highlight(item.title, response.query) }),
        el("p", { class: "sem-snippet" }, item.snippet || ""),
        el("p", { class: "sem-reason" }, el("strong", {}, "Mengapa: "), item.reason || ""),
        item.topics?.length
          ? el("div", { class: "sem-topics" }, ...item.topics.slice(0, 4).map((t) => el("span", { class: "chip" }, t)))
          : null,
        Number.isFinite(item.chapter)
          ? el("button", {
            type: "button",
            class: "btn ghost",
            onclick: () => {
              AIService.recordSearchClick({ type: item.type });
              go("day", { day: item.chapter });
            },
          }, `Buka Amsal ${item.chapter}`)
          : null,
      );
      results.appendChild(card);
    });
  }

  function renderRelated(bucket) {
    related.innerHTML = "";
    if (!bucket) return;
    const sections = [
      ["Topik terkait", bucket.topics],
      ["Ayat / rujukan", [...(bucket.verses || []), ...(bucket.references || [])]],
      ["Mirip", bucket.similar],
      ["Doa", bucket.prayers],
      ["Tantangan", bucket.challenges],
    ];
    const wrapRel = el("div", { class: "sem-related-inner" });
    let any = false;
    for (const [label, items] of sections) {
      if (!items?.length) continue;
      any = true;
      wrapRel.appendChild(el("div", { class: "sem-related-block" },
        el("div", { class: "eyebrow" }, label),
        el("div", { class: "sem-related-list" },
          ...items.slice(0, 5).map((item) => el("button", {
            type: "button",
            class: "chip",
            onclick: () => {
              const q = item.label || item.ref || "";
              input.value = q;
              runSearch(q);
            },
          }, item.label || item.ref || item.id)),
        ),
      ));
    }
    if (any) {
      related.appendChild(el("div", { class: "eyebrow" }, "Lihat juga"));
      related.appendChild(wrapRel);
    }
  }

  function renderPrefChips() {
    chips.innerHTML = "";
    const recent = AIService.getRecentSearches().slice(0, 5);
    const favs = AIService.getFavoriteSearches().slice(0, 5);
    if (recent.length) {
      chips.appendChild(el("span", { class: "sem-chip-label" }, "Terbaru"));
      recent.forEach((q) => chips.appendChild(chipButton(q)));
    }
    if (favs.length) {
      chips.appendChild(el("span", { class: "sem-chip-label" }, "Favorit"));
      favs.forEach((q) => chips.appendChild(chipButton(q)));
    }
    // Popular starters
    ["Saya bingung mengambil keputusan", "Mengendalikan lidah", "Hikmat", "Takut akan Tuhan"].forEach((q) => {
      chips.appendChild(chipButton(q, "popular"));
    });
  }

  function chipButton(query, kind = "recent") {
    return el("button", {
      type: "button",
      class: `chip sem-chip sem-chip-${kind}`,
      onclick: () => {
        input.value = query;
        runSearch(query);
      },
    }, query);
  }

  function setQuery(query) {
    input.value = query || "";
    runSearch(String(query || "").trim());
  }

  const offLeave = onLeave(() => {
    destroyed = true;
    clearTimeout(timer);
    clearTimeout(suggestTimer);
  });

  return {
    destroy() {
      destroyed = true;
      offLeave?.();
      clearTimeout(timer);
      clearTimeout(suggestTimer);
      wrap.remove();
    },
    setQuery,
    focus() { input.focus(); },
  };
}

function labelIntent(intent) {
  const map = {
    natural_language: "bahasa alami",
    concept: "konsep",
    life_situation: "situasi hidup",
    question: "pertanyaan",
    related: "terkait",
    keyword: "kata kunci",
  };
  return map[intent] || "semantik";
}
