// =============================================================================
// progress.js — Progres membaca: posisi terakhir, progres per pasal, dan
// agregat keseluruhan 31 hari. Dibangun di atas Store (done/quiz/streak).
// =============================================================================
import { readJSON, writeJSON, emitChange } from "./safe-store.js";
import { Store } from "./store.js";
import { planCount, firstPlan } from "./plan.js";

const PROGRESS_KEY = "bibleTime.progress.v3";

function load() {
  return readJSON(PROGRESS_KEY, { position: null, chapters: {} });
}
function save(state) {
  writeJSON(PROGRESS_KEY, state);
}

// Simpan progres scroll sebuah pasal (0..1) + tandai posisi terakhir dibuka.
export function setChapterProgress(day, ratio) {
  const r = Math.max(0, Math.min(1, ratio || 0));
  const state = load();
  const prev = state.chapters[day]?.ratio || 0;
  state.chapters[day] = { ratio: Math.max(prev, r), at: new Date().toISOString() };
  state.position = { day, ratio: r, at: new Date().toISOString() };
  save(state);
  emitChange("progress", { day, ratio: r });
}

export function getChapterProgress(day) {
  return load().chapters[day]?.ratio || 0;
}

export function getLastPosition() {
  const pos = load().position;
  if (pos && pos.day >= 1 && pos.day <= planCount()) return pos;
  return null;
}

// Statistik agregat untuk dashboard & kartu lanjut membaca.
export function overallStats() {
  const s = Store.load();
  const total = planCount();
  const doneDays = Object.keys(s.done || {})
    .map(Number)
    .filter((d) => d >= 1 && d <= total);
  const doneCount = doneDays.length;
  const quizDays = Object.keys(s.quiz || {}).map(Number).filter((d) => d >= 1 && d <= total);
  return {
    total,
    doneCount,
    doneDays,
    quizCount: quizDays.length,
    percent: total ? Math.round((doneCount / total) * 100) : 0,
    streak: s.streak || 0,
  };
}

// Tentukan hari untuk kartu "Lanjutkan Membaca".
export function resumeTarget() {
  const pos = getLastPosition();
  if (pos) {
    const finished = (getChapterProgress(pos.day) >= 0.95) || !!Store.load().done[pos.day];
    if (finished && pos.day < planCount()) return { day: pos.day + 1, fresh: true };
    return { day: pos.day, ratio: pos.ratio, fresh: false };
  }
  return { day: firstPlan().day, fresh: true };
}
