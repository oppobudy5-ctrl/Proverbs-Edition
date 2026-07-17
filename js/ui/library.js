// =============================================================================
// library.js — Halaman "Koleksi": Statistik, Bookmark, Favorit, Jurnal,
// Riwayat, dan Pencapaian dalam satu tampilan bertab.
// =============================================================================
import { el, $, toast } from "../dom.js";
import { go } from "../router.js";
import { getPlanByDay } from "../plan.js";
import { fmtDateID } from "../date-helper.js";
import { formatDuration } from "../reading-time.js";
import { dashboardView } from "./dashboard.js";
import {
  listBookmarks, updateBookmark, removeBookmark, BOOKMARK_TYPES, BOOKMARK_CATEGORIES,
} from "../bookmark.js";
import { listFavorites, removeFavorite, FAVORITE_TYPES } from "../favorites.js";
import { listHistory } from "../history.js";
import { achievementList } from "../achievement.js";
import { listEntries, removeEntry, clearAllEntries } from "../journal/store.js";
import { searchJournal, listAllTags } from "../journal/search.js";
import {
  exportJournalJSON,
  exportJournalMarkdown,
  exportJournalText,
  downloadTextFile,
  printJournalAsPdf,
} from "../journal/export.js";
import { importJournalJSON } from "../journal/import.js";
import { renderJournalInsights } from "./journal-insights.js";
import { renderGrowthTimeline } from "./growth-timeline.js";
import {
  revokeJournalAiConsent,
  clearJournalAiConsent,
  isJournalAiConsentGranted,
} from "../journal/consent.js";

const TABS = [
  { id: "stats", label: "Statistik", render: () => dashboardView() },
  { id: "bookmarks", label: "Bookmark", render: bookmarksView },
  { id: "favorites", label: "Favorit", render: favoritesView },
  { id: "journal", label: "Jurnal", render: journalView },
  { id: "insights", label: "Insight", render: () => renderJournalInsights() },
  { id: "timeline", label: "Timeline", render: () => renderGrowthTimeline() },
  { id: "history", label: "Riwayat", render: historyView },
  { id: "achievements", label: "Pencapaian", render: achievementsView },
];

let activeTab = "stats";

function emptyState(icon, title, desc, ctaLabel) {
  return el("div", { class: "empty" },
    el("div", { class: "empty-icon" }, icon),
    el("h3", {}, title),
    el("p", {}, desc),
    ctaLabel
      ? el("button", { class: "btn primary", "data-route": "home" }, ctaLabel)
      : null
  );
}

function dayTitle(day) {
  const plan = getPlanByDay(day);
  return plan ? `${plan.book} ${plan.chapter} \u00b7 ${plan.title}` : `Hari ${day}`;
}

// ---- Bookmark ---------------------------------------------------------------
function bookmarksView() {
  const items = listBookmarks().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  if (!items.length) {
    return emptyState("\u{1F4D6}", "Belum ada bookmark", "Simpan pasal, renungan, atau ayat emas favoritmu agar mudah ditemukan kembali.", "Mulai membaca");
  }
  const wrap = el("div", { class: "coll-list" });
  items.forEach((b) => wrap.append(bookmarkRow(b, wrap)));
  return wrap;
}

function bookmarkRow(b, wrap) {
  const meta = BOOKMARK_TYPES[b.type] || BOOKMARK_TYPES.chapter;
  const row = el("div", { class: "coll-item" });
  const editor = el("div", { class: "coll-edit" });
  editor.hidden = true;

  const nameInput = el("input", { class: "coll-input", type: "text", value: b.name || "", placeholder: "Nama bookmark (opsional)", maxlength: "60" });
  const catSelect = el("select", { class: "coll-select", "aria-label": "Kategori bookmark" },
    ...BOOKMARK_CATEGORIES.map((c) => el("option", c === b.category ? { value: c, selected: "selected" } : { value: c }, c))
  );
  editor.append(
    el("label", { class: "coll-edit-field" }, el("span", {}, "Nama"), nameInput),
    el("label", { class: "coll-edit-field" }, el("span", {}, "Kategori"), catSelect),
    el("div", { class: "coll-edit-actions" },
      el("button", { class: "btn primary", onclick: () => {
        updateBookmark(b.id, { name: nameInput.value.trim(), category: catSelect.value });
        toast("Bookmark diperbarui");
        row.replaceWith(bookmarkRow({ ...b, name: nameInput.value.trim(), category: catSelect.value }, wrap));
      } }, "Simpan"),
      el("button", { class: "btn ghost", onclick: () => { editor.hidden = true; } }, "Batal")
    )
  );

  row.append(
    el("div", { class: "coll-main", role: "button", tabindex: "0",
      onclick: () => go("day", { day: b.day }),
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("day", { day: b.day }); } } },
      el("span", { class: "coll-badge" }, meta.icon),
      el("div", { class: "coll-body" },
        el("div", { class: "coll-title" }, b.name?.trim() || dayTitle(b.day)),
        el("div", { class: "coll-sub" },
          el("span", { class: "coll-tag" }, meta.label),
          el("span", { class: "coll-tag alt" }, b.category || "Umum"),
          el("span", {}, fmtDateID((b.createdAt || "").slice(0, 10)))
        )
      )
    ),
    el("div", { class: "coll-actions" },
      el("button", { class: "icon-btn", title: "Edit", "aria-label": "Edit bookmark", onclick: () => { editor.hidden = !editor.hidden; } }, "\u270E"),
      el("button", { class: "icon-btn danger", title: "Hapus", "aria-label": "Hapus bookmark", onclick: () => { removeBookmark(b.id); row.remove(); if (!wrap.children.length) wrap.replaceWith(bookmarksView()); toast("Bookmark dihapus"); } }, "\u{1F5D1}")
    ),
    editor
  );
  return row;
}

// ---- Favorit ----------------------------------------------------------------
function favoritesView() {
  const items = listFavorites();
  if (!items.length) {
    return emptyState("\u2764\uFE0F", "Belum ada favorit", "Tandai ayat, renungan, atau tantangan yang ingin kamu simpan sebagai favorit.", "Jelajahi hari ini");
  }
  const wrap = el("div", { class: "coll-list" });
  items.forEach((f) => {
    const meta = FAVORITE_TYPES[f.type] || FAVORITE_TYPES.verse;
    const row = el("div", { class: "coll-item" },
      el("div", { class: "coll-main", role: "button", tabindex: "0",
        onclick: () => go("day", { day: f.day }),
        onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("day", { day: f.day }); } } },
        el("span", { class: "coll-badge" }, meta.icon),
        el("div", { class: "coll-body" },
          el("div", { class: "coll-title" }, `${meta.label} \u00b7 ${dayTitle(f.day)}`),
          f.text ? el("div", { class: "coll-quote" }, `\u201C${f.text}\u201D`) : null
        )
      ),
      el("div", { class: "coll-actions" },
        el("button", { class: "icon-btn danger", title: "Hapus favorit", "aria-label": "Hapus favorit", onclick: () => { removeFavorite(f.type, f.day); row.remove(); if (!wrap.children.length) wrap.replaceWith(favoritesView()); toast("Favorit dihapus"); } }, "\u{1F5D1}")
      )
    );
    wrap.append(row);
  });
  return wrap;
}

// ---- Jurnal -----------------------------------------------------------------
function journalView() {
  const root = el("div", { class: "journal-lib" });
  const listHost = el("div", { class: "journal-lib-list" });
  const qInput = el("input", {
    class: "journal-search-input",
    type: "search",
    placeholder: "Cari kata, tag, pasal…",
    "aria-label": "Cari jurnal",
  });
  const typeFilter = el("select", { class: "journal-select", "aria-label": "Filter tipe" },
    el("option", { value: "" }, "Semua tipe"),
    el("option", { value: "reflection" }, "Refleksi"),
    el("option", { value: "prayer" }, "Doa"),
    el("option", { value: "gratitude" }, "Syukur"),
    el("option", { value: "milestone_note" }, "Tonggak"),
  );
  const favOnly = el("label", { class: "journal-fav-filter" },
    el("input", { type: "checkbox", "aria-label": "Hanya favorit" }),
    " Favorit saja",
  );
  const tagFilter = el("select", { class: "journal-select", "aria-label": "Filter tag" },
    el("option", { value: "" }, "Semua tag"),
  );
  listAllTags().forEach((t) => tagFilter.append(el("option", { value: t.tag }, `${t.tag} (${t.count})`)));

  function refresh() {
    const filters = {
      type: typeFilter.value || undefined,
      tag: tagFilter.value || undefined,
      favorite: favOnly.querySelector("input").checked ? true : undefined,
    };
    const items = searchJournal(qInput.value, filters);
    listHost.replaceChildren();
    if (!items.length) {
      listHost.append(
        emptyState("\u270D\uFE0F", "Tidak ada hasil", "Coba ubah filter, atau tulis jurnal baru dari halaman hari.", "Tulis hari ini"),
      );
      return;
    }
    const wrap = el("div", { class: "coll-list" });
    items.forEach((j) => {
      const snip = j.body || j.gratitude || j.actionPlan || j.prayer?.requests?.[0] || "";
      const row = el("div", { class: "coll-item journal-item" },
        el("div", { class: "coll-main", role: "button", tabindex: "0",
          onclick: () => j.day != null && go("day", { day: j.day }),
          onkeydown: (e) => {
            if ((e.key === "Enter" || e.key === " ") && j.day != null) {
              e.preventDefault();
              go("day", { day: j.day });
            }
          } },
          el("span", { class: "coll-badge" }, j.favorite ? "\u2605" : String(j.day ?? "·")),
          el("div", { class: "coll-body" },
            el("div", { class: "coll-title" }, j.title || (j.day != null ? dayTitle(j.day) : (j.book || "Jurnal"))),
            snip ? el("p", { class: "journal-snip" }, snip) : null,
            el("div", { class: "coll-sub" },
              el("span", {}, j.type),
              j.tags?.length ? el("span", { class: "coll-tag alt" }, j.tags.slice(0, 3).join(", ")) : null,
              el("span", {}, "Diperbarui " + fmtDateID((j.updatedAt || "").slice(0, 10))),
            ),
          ),
        ),
        el("div", { class: "coll-actions" },
          el("button", {
            class: "icon-btn danger",
            title: "Hapus catatan",
            "aria-label": "Hapus catatan jurnal",
            onclick: () => {
              if (!confirm("Hapus catatan jurnal ini?")) return;
              removeEntry(j.id);
              refresh();
              toast("Catatan dihapus");
            },
          }, "\u{1F5D1}"),
        ),
      );
      wrap.append(row);
    });
    listHost.append(wrap);
  }

  [qInput, typeFilter, tagFilter].forEach((node) => node.addEventListener("input", refresh));
  favOnly.querySelector("input").addEventListener("change", refresh);

  const exportBar = el("div", { class: "journal-export-bar" },
    el("button", {
      type: "button", class: "btn ghost",
      onclick: () => {
        downloadTextFile(`bibletime-journal-${dateStamp()}.json`, exportJournalJSON(), "application/json");
        toast("Ekspor JSON siap");
      },
    }, "Ekspor JSON"),
    el("button", {
      type: "button", class: "btn ghost",
      onclick: () => {
        downloadTextFile(`bibletime-journal-${dateStamp()}.md`, exportJournalMarkdown(), "text/markdown");
        toast("Ekspor Markdown siap");
      },
    }, "Ekspor MD"),
    el("button", {
      type: "button", class: "btn ghost",
      onclick: () => {
        downloadTextFile(`bibletime-journal-${dateStamp()}.txt`, exportJournalText(), "text/plain");
        toast("Ekspor TXT siap");
      },
    }, "Ekspor TXT"),
    el("button", {
      type: "button", class: "btn ghost",
      onclick: () => {
        if (!printJournalAsPdf()) toast("Izinkan pop-up untuk cetak/PDF");
      },
    }, "Cetak / PDF"),
    el("label", { class: "btn ghost journal-import-btn" },
      "Impor JSON",
      el("input", {
        type: "file",
        accept: "application/json,.json",
        hidden: "hidden",
        onchange: async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const { count } = await importJournalJSON(text, { merge: true });
            toast(`Impor ${count} catatan`);
            refresh();
          } catch (err) {
            toast(err?.message || "Gagal impor");
          }
          e.target.value = "";
        },
      }),
    ),
  );

  const dangerBar = el("div", { class: "journal-danger-bar" },
    el("button", {
      type: "button",
      class: "btn ghost",
      onclick: () => {
        if (!listEntries().length) {
          toast("Jurnal sudah kosong");
          return;
        }
        if (confirm("Ekspor JSON dulu sebelum menghapus seluruh jurnal?")) {
          downloadTextFile(`bibletime-journal-backup-${dateStamp()}.json`, exportJournalJSON(), "application/json");
        }
        if (confirm("Hapus SELURUH jurnal di perangkat ini?")) {
          clearAllEntries();
          toast("Semua jurnal dihapus");
          refresh();
        }
      },
    }, "Hapus semua jurnal"),
    el("button", {
      type: "button",
      class: "btn ghost",
      onclick: () => {
        if (isJournalAiConsentGranted()) {
          revokeJournalAiConsent();
          toast("Izin AI jurnal dicabut");
        } else {
          clearJournalAiConsent();
          toast("Tidak ada izin AI aktif");
        }
      },
    }, "Cabut izin AI jurnal"),
  );

  root.append(
    el("p", { class: "journal-note" }, "Jurnal privat di perangkatmu. Cari, filter, ekspor, atau impor kapan saja — offline."),
    el("div", { class: "journal-lib-filters" }, qInput, typeFilter, tagFilter, favOnly),
    exportBar,
    dangerBar,
    listHost,
  );
  refresh();
  return root;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

// ---- Riwayat ----------------------------------------------------------------
function historyView() {
  const items = listHistory();
  if (!items.length) {
    return emptyState("\u23F1\uFE0F", "Belum ada riwayat", "Riwayat membaca dan durasi tiap hari akan muncul di sini seiring kamu membaca.", "Mulai membaca");
  }
  const wrap = el("div", { class: "coll-list" });
  items.forEach((h) => {
    wrap.append(
      el("div", { class: "coll-item" },
        el("div", { class: "coll-main", role: "button", tabindex: "0",
          onclick: () => go("day", { day: h.day }),
          onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("day", { day: h.day }); } } },
          el("span", { class: "coll-badge" }, h.finishedAt ? "\u2705" : "\u{1F4D6}"),
          el("div", { class: "coll-body" },
            el("div", { class: "coll-title" }, dayTitle(h.day)),
            el("div", { class: "coll-sub" },
              el("span", {}, h.finishedAt ? "Selesai \u00b7 " + fmtDateID(h.finishedAt.slice(0, 10)) : "Dibaca"),
              el("span", { class: "coll-tag alt" }, "Durasi " + formatDuration(h.durationMs))
            )
          )
        )
      )
    );
  });
  return wrap;
}

// ---- Pencapaian -------------------------------------------------------------
function achievementsView() {
  const items = achievementList();
  const grid = el("div", { class: "ach-grid" });
  items.forEach((a) => {
    grid.append(
      el("div", { class: "ach-card" + (a.unlocked ? " is-unlocked" : " is-locked") },
        el("span", { class: "ach-icon" }, a.unlocked ? a.icon : "\u{1F512}"),
        el("div", { class: "ach-title" }, a.title),
        el("div", { class: "ach-desc" }, a.desc),
        a.unlocked ? el("div", { class: "ach-when" }, "Terbuka " + fmtDateID((a.at || "").slice(0, 10))) : null
      )
    );
  });
  return grid;
}

// ---- Halaman ----------------------------------------------------------------
export function renderLibrary(params = {}) {
  if (params.tab && TABS.some((t) => t.id === params.tab)) activeTab = params.tab;

  const head = el("div", { class: "cal-head" },
    el("h1", {}, "Koleksi ", el("em", { style: "font-style:italic;color:var(--gold-1)" }, "& Statistik")),
    el("span", { class: "sub" }, "Bookmark, favorit, jurnal, riwayat, dan pencapaianmu")
  );

  const panel = el("div", { class: "lib-panel" });
  const tabbar = el("div", { class: "lib-tabs", role: "tablist", "aria-label": "Kategori koleksi" });

  function activate(id) {
    activeTab = id;
    tabbar.querySelectorAll(".lib-tab").forEach((t) => {
      const on = t.dataset.tab === id;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    panel.innerHTML = "";
    panel.append(TABS.find((t) => t.id === id).render());
  }

  TABS.forEach((t) => {
    const btn = el("button", {
      class: "lib-tab" + (t.id === activeTab ? " is-active" : ""),
      role: "tab", "data-tab": t.id,
      "aria-selected": t.id === activeTab ? "true" : "false",
      tabindex: t.id === activeTab ? "0" : "-1",
      onclick: () => activate(t.id),
      onkeydown: (e) => {
        const ids = TABS.map((x) => x.id);
        const i = ids.indexOf(activeTab);
        if (e.key === "ArrowRight") { e.preventDefault(); activate(ids[(i + 1) % ids.length]); tabbar.querySelector(".lib-tab.is-active").focus(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); activate(ids[(i - 1 + ids.length) % ids.length]); tabbar.querySelector(".lib-tab.is-active").focus(); }
      },
    }, t.label);
    tabbar.append(btn);
  });

  const section = el("section", { class: "section" }, head, tabbar, panel);
  $("#app").appendChild(section);
  activate(activeTab);
}
