// =============================================================================
// streak.js — Tampilan angka streak di header + logika milestone.
// Perhitungan streak sendiri (berbasis tanggal LOKAL) ada di store.js.
// =============================================================================
import { $ } from "../dom.js";
import { Store } from "../store.js";

export const STREAK_MILESTONES = [
  { days: 3, label: "\u{1F525} 3 Hari" },
  { days: 7, label: "\u{1F525} 7 Hari" },
  { days: 14, label: "\u{1F525} 14 Hari" },
  { days: 30, label: "\u{1F525} 30 Hari" },
  { days: 100, label: "\u{1F525} 100 Hari" },
];

// Milestone tertinggi yang sudah dicapai (atau null).
export function streakMilestone(streak) {
  let reached = null;
  for (const m of STREAK_MILESTONES) if (streak >= m.days) reached = m;
  return reached;
}

// Milestone berikutnya yang belum dicapai (untuk motivasi).
export function nextMilestone(streak) {
  return STREAK_MILESTONES.find((m) => streak < m.days) || null;
}

export function refreshStreak() {
  const s = Store.load();
  const node = $("#streak-count");
  if (node) node.textContent = String(s.streak || 0);
  const pill = $("#streak-pill");
  if (pill) {
    const m = streakMilestone(s.streak || 0);
    const days = s.streak || 0;
    pill.classList.toggle("has-milestone", !!m);
    const label = m ? `Streak ${days} hari · ${m.label}` : `Streak harian ${days} hari`;
    pill.title = label;
    pill.setAttribute("aria-label", label);
  }
}
