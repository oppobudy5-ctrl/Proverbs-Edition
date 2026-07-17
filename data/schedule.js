// =============================================================================
// schedule.js — DATA jadwal 31 Hari Hidup dalam Hikmat.
//
// Edisi aktif: Amsal 1–31, satu pasal per hari.
// Struktur generik ini dipakai oleh plan.js dan seluruh renderer.
// =============================================================================

export const READING_PLAN = [
  { day: 1,  date: "2026-08-01", book: "Amsal", chapter: 1,  refs: ["Amsal 1"],  title: "Hikmat Dimulai dengan Takut akan TUHAN", theme: "takut akan TUHAN" },
  { day: 2,  date: "2026-08-02", book: "Amsal", chapter: 2,  refs: ["Amsal 2"],  title: "Mencari Hikmat seperti Harta", theme: "mencari hikmat" },
  { day: 3,  date: "2026-08-03", book: "Amsal", chapter: 3,  refs: ["Amsal 3"],  title: "Percaya kepada TUHAN dengan Segenap Hati", theme: "percaya kepada TUHAN" },
  { day: 4,  date: "2026-08-04", book: "Amsal", chapter: 4,  refs: ["Amsal 4"],  title: "Jagalah Hati dengan Segala Kewaspadaan", theme: "menjaga hati" },
  { day: 5,  date: "2026-08-05", book: "Amsal", chapter: 5,  refs: ["Amsal 5"],  title: "Setia dalam Kasih Perjanjian", theme: "kesetiaan" },
  { day: 6,  date: "2026-08-06", book: "Amsal", chapter: 6,  refs: ["Amsal 6"],  title: "Belajar Rajin dan Menjauhi Jerat", theme: "kerajinan" },
  { day: 7,  date: "2026-08-07", book: "Amsal", chapter: 7,  refs: ["Amsal 7"],  title: "Waspada terhadap Jalan yang Menyesatkan", theme: "kewaspadaan" },
  { day: 8,  date: "2026-08-08", book: "Amsal", chapter: 8,  refs: ["Amsal 8"],  title: "Hikmat Memanggil Semua Orang", theme: "panggilan hikmat" },
  { day: 9,  date: "2026-08-09", book: "Amsal", chapter: 9,  refs: ["Amsal 9"],  title: "Undangan Hikmat dan Permulaan Pengetahuan", theme: "takut akan TUHAN" },
  { day: 10, date: "2026-08-10", book: "Amsal", chapter: 10, refs: ["Amsal 10"], title: "Perkataan dan Jalan Orang Benar", theme: "orang benar" },
  { day: 11, date: "2026-08-11", book: "Amsal", chapter: 11, refs: ["Amsal 11"], title: "Integritas yang Membawa Kehidupan", theme: "integritas" },
  { day: 12, date: "2026-08-12", book: "Amsal", chapter: 12, refs: ["Amsal 12"], title: "Mencintai Didikan dan Menghidupi Kebenaran", theme: "didikan" },
  { day: 13, date: "2026-08-13", book: "Amsal", chapter: 13, refs: ["Amsal 13"], title: "Disiplin, Pengharapan, dan Persahabatan Bijak", theme: "disiplin" },
  { day: 14, date: "2026-08-14", book: "Amsal", chapter: 14, refs: ["Amsal 14"], title: "Membangun Rumah dengan Hikmat", theme: "membangun kehidupan" },
  { day: 15, date: "2026-08-15", book: "Amsal", chapter: 15, refs: ["Amsal 15"], title: "Jawaban Lemah Lembut Meredakan Kegeraman", theme: "perkataan" },
  { day: 16, date: "2026-08-16", book: "Amsal", chapter: 16, refs: ["Amsal 16"], title: "Menyerahkan Rencana kepada TUHAN", theme: "penyerahan" },
  { day: 17, date: "2026-08-17", book: "Amsal", chapter: 17, refs: ["Amsal 17"], title: "Damai Lebih Berharga daripada Kelimpahan", theme: "damai" },
  { day: 18, date: "2026-08-18", book: "Amsal", chapter: 18, refs: ["Amsal 18"], title: "Kuasa Perkataan dan Persahabatan", theme: "perkataan dan relasi" },
  { day: 19, date: "2026-08-19", book: "Amsal", chapter: 19, refs: ["Amsal 19"], title: "Rancangan TUHAN Tetap Terlaksana", theme: "kedaulatan TUHAN" },
  { day: 20, date: "2026-08-20", book: "Amsal", chapter: 20, refs: ["Amsal 20"], title: "Hidup Jujur dan Menguasai Diri", theme: "kejujuran" },
  { day: 21, date: "2026-08-21", book: "Amsal", chapter: 21, refs: ["Amsal 21"], title: "Keadilan Lebih Berkenan daripada Korban", theme: "keadilan" },
  { day: 22, date: "2026-08-22", book: "Amsal", chapter: 22, refs: ["Amsal 22"], title: "Mendidik Generasi dalam Jalan Hikmat", theme: "pendidikan iman" },
  { day: 23, date: "2026-08-23", book: "Amsal", chapter: 23, refs: ["Amsal 23"], title: "Menjaga Hati di Tengah Godaan", theme: "penguasaan diri" },
  { day: 24, date: "2026-08-24", book: "Amsal", chapter: 24, refs: ["Amsal 24"], title: "Jangan Iri kepada Orang Jahat", theme: "ketekunan dalam kebaikan" },
  { day: 25, date: "2026-08-25", book: "Amsal", chapter: 25, refs: ["Amsal 25"], title: "Kemuliaan dalam Kerendahan Hati", theme: "kerendahan hati" },
  { day: 26, date: "2026-08-26", book: "Amsal", chapter: 26, refs: ["Amsal 26"], title: "Menjawab Kebodohan dengan Bijaksana", theme: "kebijaksanaan" },
  { day: 27, date: "2026-08-27", book: "Amsal", chapter: 27, refs: ["Amsal 27"], title: "Persahabatan yang Menajamkan", theme: "persahabatan" },
  { day: 28, date: "2026-08-28", book: "Amsal", chapter: 28, refs: ["Amsal 28"], title: "Berani karena Hidup Benar", theme: "keberanian moral" },
  { day: 29, date: "2026-08-29", book: "Amsal", chapter: 29, refs: ["Amsal 29"], title: "Takut kepada Manusia Mendatangkan Jerat", theme: "takut akan manusia" },
  { day: 30, date: "2026-08-30", book: "Amsal", chapter: 30, refs: ["Amsal 30"], title: "Kerendahan Hati di Hadapan Firman", theme: "kerendahan hati" },
  { day: 31, date: "2026-08-31", book: "Amsal", chapter: 31, refs: ["Amsal 31"], title: "Hidup yang Cakap dan Takut akan TUHAN", theme: "takut akan TUHAN" },
];
