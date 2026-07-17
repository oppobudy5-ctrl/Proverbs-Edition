// =============================================================================
// timeline.js — Growth timeline: reading + journal + prayer + achievements.
// =============================================================================
import { listEntries } from "./store.js";
import { listHistory } from "../history.js";
import { achievementList } from "../achievement.js";

export function buildGrowthTimeline({ limit = 80 } = {}) {
  const events = [];

  listHistory().forEach((h) => {
    if (h.finishedAt) {
      events.push({
        id: `read-done-${h.day}`,
        kind: "reading",
        at: h.finishedAt,
        day: h.day,
        title: `Selesai membaca hari ${h.day}`,
        detail: h.durationMs ? `Durasi ${Math.round(h.durationMs / 60000)} mnt` : "",
      });
    } else if (h.lastAt) {
      events.push({
        id: `read-${h.day}-${h.lastAt}`,
        kind: "reading",
        at: h.lastAt,
        day: h.day,
        title: `Membaca hari ${h.day}`,
        detail: h.durationMs ? `Durasi ${Math.round(h.durationMs / 60000)} mnt` : "",
      });
    }
  });

  listEntries().forEach((e) => {
    const at = e.updatedAt || e.createdAt;
    const ref = [e.book, e.chapter].filter((x) => x != null && x !== "").join(" ");
    if (e.type === "prayer" || hasPrayer(e)) {
      events.push({
        id: `prayer-${e.id}`,
        kind: "prayer",
        at,
        day: e.day,
        title: e.title || `Doa${ref ? ` · ${ref}` : ""}`,
        detail: snip(e.body || e.prayer?.requests?.[0] || e.gratitude || ""),
        entryId: e.id,
      });
    }
    if (e.type === "gratitude" || (e.gratitude && e.gratitude.trim())) {
      events.push({
        id: `gratitude-${e.id}`,
        kind: "gratitude",
        at,
        day: e.day,
        title: e.title || "Ucapan syukur",
        detail: snip(e.gratitude || e.body || ""),
        entryId: e.id,
      });
    }
    events.push({
      id: `journal-${e.id}`,
      kind: "journal",
      at,
      day: e.day,
      title: e.title || `Jurnal${ref ? ` · ${ref}` : ""}`,
      detail: snip(e.body || e.actionPlan || ""),
      entryId: e.id,
      favorite: e.favorite,
    });
    if (e.actionPlan) {
      events.push({
        id: `challenge-${e.id}`,
        kind: "challenge",
        at,
        day: e.day,
        title: "Rencana tindakan",
        detail: snip(e.actionPlan),
        entryId: e.id,
      });
    }
  });

  achievementList().forEach((a) => {
    if (!a.unlocked || !a.at) return;
    events.push({
      id: `ach-${a.id}`,
      kind: "achievement",
      at: a.at,
      title: a.title,
      detail: a.desc,
      icon: a.icon,
    });
  });

  return events
    .filter((e) => e.at)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

function hasPrayer(e) {
  const p = e.prayer || {};
  return [p.requests, p.thanks, p.answered, p.waiting].some((arr) => arr && arr.length);
}

function snip(text, n = 120) {
  const t = String(text || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}
