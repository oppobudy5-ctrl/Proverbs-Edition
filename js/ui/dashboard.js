// =============================================================================
// dashboard.js — Ringkasan statistik membaca (dipakai di halaman Koleksi).
// =============================================================================
import { el } from "../dom.js";
import { overallStats } from "../progress.js";
import { totalReadingMs } from "../history.js";
import { listBookmarks } from "../bookmark.js";
import { favoriteCount } from "../favorites.js";
import { journalCount, prayerItemCount, gratitudeCount } from "../journal.js";
import { achievementProgress } from "../achievement.js";
import { streakMilestone } from "./streak.js";
import { formatDuration } from "../reading-time.js";

function statCard(icon, value, label, accent) {
  return el("div", { class: "stat-card" + (accent ? " is-accent" : "") },
    el("span", { class: "stat-icon" }, icon),
    el("span", { class: "stat-value" }, String(value)),
    el("span", { class: "stat-label" }, label)
  );
}

function progressRing(percent) {
  const size = 132, stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - percent / 100);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("class", "ring");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Progres ${percent} persen`);
  const mk = (cls, extra) => {
    const ci = document.createElementNS(ns, "circle");
    ci.setAttribute("cx", size / 2); ci.setAttribute("cy", size / 2); ci.setAttribute("r", r);
    ci.setAttribute("fill", "none"); ci.setAttribute("stroke-width", stroke);
    ci.setAttribute("class", cls);
    if (extra) Object.entries(extra).forEach(([k, v]) => ci.setAttribute(k, v));
    return ci;
  };
  svg.append(mk("ring-track"));
  svg.append(mk("ring-fill", { "stroke-dasharray": c.toFixed(1), "stroke-dashoffset": off.toFixed(1), transform: `rotate(-90 ${size / 2} ${size / 2})` }));
  const label = el("div", { class: "ring-label" },
    el("span", { class: "ring-pct" }, `${percent}%`),
    el("span", { class: "ring-sub" }, "selesai")
  );
  return el("div", { class: "ring-wrap" }, svg, label);
}

export function dashboardView() {
  const stats = overallStats();
  const milestone = streakMilestone(stats.streak);
  const ach = achievementProgress();

  const hero = el("div", { class: "dash-hero" },
    progressRing(stats.percent),
    el("div", { class: "dash-hero-info" },
      el("div", { class: "dash-hero-title" }, `${stats.doneCount} dari ${stats.total} hari`),
      el("div", { class: "dash-hero-sub" }, "Perjalanan 31 Hari Hidup dalam Hikmat"),
      el("div", { class: "dash-streak" },
        el("span", { class: "dash-streak-flame" }, "\u{1F525}"),
        el("span", {}, `${stats.streak} hari berturut`),
        milestone ? el("span", { class: "dash-streak-badge" }, milestone.label) : null
      )
    )
  );

  const grid = el("div", { class: "stat-grid" },
    statCard("\u2705", stats.doneCount, "Hari selesai"),
    statCard("\u{1F4CA}", stats.percent + "%", "Progres"),
    statCard("\u23F1\uFE0F", formatDuration(totalReadingMs()), "Waktu membaca"),
    statCard("\u{1F4D6}", listBookmarks().length, "Bookmark"),
    statCard("\u2764\uFE0F", favoriteCount(), "Favorit"),
    statCard("\u270D\uFE0F", journalCount(), "Jurnal"),
    statCard("\u{1F64F}", prayerItemCount(), "Butir doa"),
    statCard("\u{1F49B}", gratitudeCount(), "Syukur"),
    statCard("\u{1F525}", stats.streak, "Streak"),
    statCard("\u{1F3C6}", `${ach.count}/${ach.total}`, "Pencapaian", true)
  );

  return el("div", { class: "dash" }, hero, grid);
}
