// =============================================================================
// complete.js — Aksi "tandai selesai" terpusat: progress + riwayat + pencapaian.
// =============================================================================
import { Store } from "./store.js";
import { markFinished } from "./history.js";
import { evaluateAchievements } from "./achievement.js";

// Tandai satu hari selesai dan kembalikan daftar pencapaian yang baru terbuka.
export function completeDay(day) {
  Store.markRead(day);
  markFinished(day);
  return evaluateAchievements();
}
