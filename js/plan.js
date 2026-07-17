// =============================================================================
// plan.js — Logika jadwal (di atas data/schedule.js).
// =============================================================================
import { READING_PLAN } from "../data/schedule.js";
import { todayISO } from "./date-helper.js";

export const planCount = () => READING_PLAN.length;
export const firstPlan = () => READING_PLAN[0];
export const lastPlan = () => READING_PLAN[READING_PLAN.length - 1];

// Rencana untuk "hari ini" (waktu lokal). Menyertakan flag isPreview / isAfter.
export function getTodayPlan() {
  const today = todayISO();
  const plans = READING_PLAN;

  if (today < plans[0].date) {
    return { ...plans[0], isPreview: true };
  }
  const exact = plans.find((p) => p.date === today);
  if (exact) return exact;

  const last = plans[plans.length - 1];
  if (today > last.date) return { ...last, isAfter: true };

  return plans.find((p) => p.date > today) || last;
}

export function getPlanByDay(dayNum) {
  return READING_PLAN.find((p) => p.day === dayNum);
}

export function getPlanByChapter(chapterNum) {
  return READING_PLAN.find((p) => p.chapter === chapterNum);
}

// Status tanggal sebuah rencana relatif terhadap hari ini (waktu lokal).
// Dipakai renderer untuk menampilkan badge "(preview)" tanpa bergantung pada
// flag yang mungkin hilang saat plan dimuat ulang lewat getPlanByDay().
export function planDateStatus(plan) {
  const today = todayISO();
  return {
    isPreview: plan.date > today,
    isToday: plan.date === today,
    isAfter: plan.date < today,
  };
}
