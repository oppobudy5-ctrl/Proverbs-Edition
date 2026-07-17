// =============================================================================
// achievement.js — Pencapaian (achievements) berbasis aktivitas lokal.
//
// evaluateAchievements() menghitung status terkini, menyimpan yang terbuka,
// dan mengembalikan daftar pencapaian yang BARU terbuka untuk animasi/toast.
// =============================================================================
import { readJSON, writeJSON, emitChange } from "./safe-store.js";
import { Store } from "./store.js";
import { overallStats } from "./progress.js";
import { listBookmarks } from "./bookmark.js";
import { journalCount, prayerItemCount } from "./journal.js";
import { listHistory } from "./history.js";

const KEY = "bibleTime.achievements.v3";

export const ACHIEVEMENTS = [
  { id: "first_day", icon: "\u{1F4D6}", title: "Hari Pertama", desc: "Menyelesaikan hari pertamamu.", test: (c) => c.done >= 1 },
  { id: "streak3", icon: "\u{1F525}", title: "3 Hari Berturut", desc: "Streak membaca 3 hari.", test: (c) => c.streak >= 3 },
  { id: "streak7", icon: "\u{1F525}", title: "7 Hari Berturut", desc: "Streak membaca 7 hari.", test: (c) => c.streak >= 7 },
  { id: "streak14", icon: "\u{1F525}", title: "14 Hari Berturut", desc: "Streak membaca 14 hari.", test: (c) => c.streak >= 14 },
  { id: "streak30", icon: "\u{1F525}", title: "30 Hari Berturut", desc: "Streak membaca 30 hari.", test: (c) => c.streak >= 30 },
  { id: "half", icon: "\u{1F31F}", title: "Separuh Jalan", desc: "Menuntaskan 15 hari.", test: (c) => c.done >= 15 },
  { id: "bookmark10", icon: "\u2B50", title: "Kolektor Hikmat", desc: "Menyimpan 10 bookmark.", test: (c) => c.bookmarkCount >= 10 },
  { id: "journal7", icon: "\u270D\uFE0F", title: "Perenung Setia", desc: "Menulis 7 catatan jurnal.", test: (c) => c.journalCount >= 7 },
  { id: "journal50", icon: "\u270D\uFE0F", title: "50 Jurnal", desc: "Menulis 50 catatan jurnal.", test: (c) => c.journalCount >= 50 },
  { id: "prayer30", icon: "\u{1F64F}", title: "30 Doa", desc: "Menuliskan 30 butir doa di jurnal.", test: (c) => c.prayerCount >= 30 },
  { id: "reading100", icon: "\u{1F4DA}", title: "100 Hari Membaca", desc: "Mencatat 100 hari aktivitas baca.", test: (c) => c.readingDays >= 100 },
  { id: "quiz_perfect", icon: "\u{1F3AF}", title: "Skor Sempurna", desc: "Meraih 100 pada sebuah kuis.", test: (c) => c.quizPerfect },
  { id: "all_renungan", icon: "\u{1F48E}", title: "Membaca Semua Renungan", desc: "Menuntaskan seluruh 31 renungan.", test: (c) => c.done >= c.total },
  { id: "complete", icon: "\u{1F4DA}", title: "31 Hari Amsal Selesai", desc: "Menuntaskan 31 Hari Hidup dalam Hikmat.", test: (c) => c.done >= c.total },
];

function context() {
  const stats = overallStats();
  const s = Store.load();
  const quizPerfect = Object.values(s.quiz || {}).some((q) => q && q.total && q.score === q.total);
  return {
    done: stats.doneCount,
    total: stats.total,
    streak: stats.streak,
    quizPerfect,
    bookmarkCount: listBookmarks().length,
    journalCount: journalCount(),
    prayerCount: prayerItemCount(),
    readingDays: listHistory().length,
  };
}

export function getUnlocked() {
  return readJSON(KEY, {});
}

export function evaluateAchievements() {
  const c = context();
  const unlocked = getUnlocked();
  const newly = [];
  ACHIEVEMENTS.forEach((a) => {
    const passed = !!a.test(c);
    if (passed && !unlocked[a.id]) {
      unlocked[a.id] = { at: new Date().toISOString() };
      newly.push(a);
    }
  });
  if (newly.length) {
    writeJSON(KEY, unlocked);
    emitChange("achievements", { newly: newly.map((a) => a.id) });
  }
  return newly;
}

export function achievementList() {
  const unlocked = getUnlocked();
  return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: !!unlocked[a.id], at: unlocked[a.id]?.at || null }));
}

export function achievementProgress() {
  const unlocked = getUnlocked();
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  return { count, total: ACHIEVEMENTS.length };
}
