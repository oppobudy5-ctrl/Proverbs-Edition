// =============================================================================
// journal-insights.js — Kartu insight deskriptif.
// =============================================================================
import { el } from "../dom.js";
import { buildJournalInsights } from "../journal/insights.js";

export function renderJournalInsights(options = {}) {
  const insights = buildJournalInsights({ days: options.days || 30 });
  const cards = el("div", { class: "journal-insight-cards" });
  insights.cards.forEach((card) => {
    cards.append(
      el("article", { class: "journal-insight-card" },
        el("p", {}, card.text),
      ),
    );
  });

  const meta = el("div", { class: "journal-insight-meta" },
    el("span", {}, `${insights.entryCount} jurnal`),
    el("span", {}, `${insights.prayerCount} butir doa`),
    el("span", {}, `${insights.gratitudeCount} syukur`),
  );

  return el("div", { class: "journal-insights" },
    el("p", { class: "journal-note" }, "Insight bersifat deskriptif — bukan penilaian kondisi rohani."),
    meta,
    cards,
    insights.themes.length
      ? el("div", { class: "journal-insight-tags" },
        el("span", { class: "journal-label" }, "Tema terdeteksi"),
        ...insights.themes.map((t) => el("span", { class: "journal-tag-chip static" }, `${t.key} (${t.count})`)),
      )
      : null,
  );
}
