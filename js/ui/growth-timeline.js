// =============================================================================
// growth-timeline.js — Timeline pertumbuhan rohani (lokal).
// =============================================================================
import { el } from "../dom.js";
import { fmtDateID } from "../date-helper.js";
import { go } from "../router.js";
import { buildGrowthTimeline } from "../journal/timeline.js";

const KIND_LABEL = {
  reading: "Bacaan",
  journal: "Jurnal",
  prayer: "Doa",
  gratitude: "Syukur",
  challenge: "Tantangan",
  achievement: "Pencapaian",
};

export function renderGrowthTimeline(options = {}) {
  const events = buildGrowthTimeline({ limit: options.limit || 60 });
  if (!events.length) {
    return el("div", { class: "empty" },
      el("p", {}, "Timeline masih kosong. Baca, tulis jurnal, atau selesaikan hari untuk mulai mengisi."),
    );
  }
  const list = el("div", { class: "growth-timeline", role: "list" });
  events.forEach((ev) => {
    const row = el("div", {
      class: `growth-item kind-${ev.kind}`,
      role: "listitem",
      tabindex: ev.day != null ? "0" : undefined,
      onclick: ev.day != null ? () => go("day", { day: ev.day }) : undefined,
      onkeydown: ev.day != null
        ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("day", { day: ev.day }); } }
        : undefined,
    },
      el("div", { class: "growth-kind" }, KIND_LABEL[ev.kind] || ev.kind),
      el("div", { class: "growth-body" },
        el("div", { class: "growth-title" }, ev.icon ? `${ev.icon} ${ev.title}` : ev.title),
        ev.detail ? el("p", { class: "growth-detail" }, ev.detail) : null,
        el("div", { class: "growth-when" }, fmtDateID((ev.at || "").slice(0, 10))),
      ),
    );
    list.append(row);
  });
  return list;
}
