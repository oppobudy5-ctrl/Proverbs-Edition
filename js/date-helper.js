// =============================================================================
// date-helper.js — Tanggal berbasis waktu LOKAL browser (bukan UTC).
//
// Semua perhitungan "hari ini", streak, kalender, dan progress memakai helper
// ini agar tidak ada pergeseran hari akibat perbedaan zona waktu (mis. WIB
// UTC+7 vs UTC pada dini hari).
// =============================================================================

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const BULAN_SINGKAT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const pad = (n) => String(n).padStart(2, "0");

// Tanggal lokal dalam format YYYY-MM-DD (memakai getFullYear/Month/Date lokal).
export function localISO(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Alias eksplisit untuk "hari ini" (waktu lokal).
export function todayISO() {
  return localISO(new Date());
}

// Geser sebuah tanggal ISO sebanyak `days` hari (bisa negatif), hasil ISO lokal.
export function shiftISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localISO(d);
}

// "Sabtu, 1 Agustus 2026"
export function fmtDateID(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

// "5 Jun"
export function fmtDateShort(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${BULAN_SINGKAT[d.getMonth()]}`;
}

// "Jumat"
export function dayName(iso) {
  return HARI[new Date(iso + "T00:00:00").getDay()];
}
