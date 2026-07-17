// =============================================================================
// history.js — Riwayat membaca: kapan hari diselesaikan + durasi membaca.
// Durasi diakumulasi dari Reading Timer (sesi baca).
// =============================================================================
import { readJSON, writeJSON, emitChange } from "./safe-store.js";

const KEY = "bibleTime.history.v3";

function load() { return readJSON(KEY, {}); }
function save(v) { writeJSON(KEY, v); }

// Tambahkan durasi sesi baca (ms) untuk sebuah hari.
export function addSession(day, ms) {
  if (!ms || ms < 1000) return; // abaikan sesi < 1 detik
  const all = load();
  const rec = all[day] || { day, durationMs: 0, sessions: 0, finishedAt: null, lastAt: null };
  rec.durationMs += ms;
  rec.sessions += 1;
  rec.lastAt = new Date().toISOString();
  all[day] = rec;
  save(all);
  emitChange("history", { day });
}

export function markFinished(day) {
  const all = load();
  const rec = all[day] || { day, durationMs: 0, sessions: 0, finishedAt: null, lastAt: null };
  rec.finishedAt = new Date().toISOString();
  rec.lastAt = rec.finishedAt;
  all[day] = rec;
  save(all);
  emitChange("history", { day });
}

export function getHistory(day) { return load()[day] || null; }

export function listHistory() {
  return Object.values(load()).sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));
}

export function totalReadingMs() {
  return Object.values(load()).reduce((sum, r) => sum + (r.durationMs || 0), 0);
}
