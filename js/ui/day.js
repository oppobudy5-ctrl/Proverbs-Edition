// =============================================================================
// day.js — Halaman "Hari" (renderDay) + renderer per-section yang modular.
//
// Setiap section adalah fungsi kecil yang mengembalikan node ATAU null bila
// datanya tidak ada. Tidak ada lagi rantai else-if yang menyembunyikan section
// lain: Ringkasan, Renungan, Catatan Eksegesis, dan Kata Kunci kini tampil
// independen sesuai urutan.
//
// Urutan halaman hari: Hero → Ayat Emas → Teks Pasal → Renungan →
//         Catatan Eksegesis → Jurnal → Kuis → Navigasi.
// Beranda menempatkan Ayat Emas → Kuis → Hero Preview → kartu perjalanan
// di bagian akhir.
// =============================================================================
import { el, paragraphs, $ } from "../dom.js";
import { CONTENT } from "../../data/content.js";
import { getPlanByDay, firstPlan, planCount, planDateStatus, getTodayPlan } from "../plan.js";
import { Store } from "../store.js";
import { setMainVersion } from "../store.js";
import { fmtDateID } from "../date-helper.js";
import { fetchChapter, fullChapterLabel } from "../bible-api.js";
import { openParallelReader } from "./reader.js";
import { buildVersionDropdown } from "./version-dropdown.js";
import { renderQuiz } from "./quiz.js";
import { fitHeroTitle } from "./hero-title.js";
import { refreshStreak } from "./streak.js";
import { toast } from "../dom.js";
import { go } from "../router.js";
import { estimateMinutes } from "../reading-time.js";
import { getChapterProgress } from "../progress.js";
import { completeDay } from "../complete.js";
import { mountDayRuntime } from "./day-runtime.js";
import { renderJournalBox } from "./journal-box.js";
import { bookmarkButton, favoriteButton } from "./save-actions.js";
import { continueCard } from "./continue-card.js";
import { showAchievements } from "./celebrate.js";
import { mountAiLessonAssist } from "./ai-lesson-assist.js";

// Tandai hari selesai + rayakan pencapaian yang baru terbuka.
function finishDay(plan) {
  const newly = completeDay(plan.day);
  refreshStreak();
  toast("Tandai dibaca \u2713");
  if (newly.length) showAchievements(newly);
  go("day", { day: plan.day });
}

// ---------------------------------------------------------------------------
// Section: Hero
// ---------------------------------------------------------------------------
function renderHero(plan, content, status) {
  const isDone = !!Store.load().done[plan.day];

  const eyebrow = el("div", { class: "hero-eyebrow" },
    el("span", { class: "dot" }),
    `${status.isPreview ? "(preview) \u00b7 " : ""}${fmtDateID(plan.date)}`
  );

  const actions = el("div", { class: "hero-actions" },
    el("button", { class: "btn primary", onclick: () => { document.getElementById("reading-anchor").scrollIntoView({ behavior: "smooth" }); } },
      "Mulai baca", el("span", { class: "arrow" }, "\u2192")
    ),
    el("button", { class: "btn", onclick: () => openParallelReader(plan.refs) }, fullChapterLabel(plan.refs)),
    buildVersionDropdown((code) => { setMainVersion(code); go("day", { day: plan.day }); }),
    bookmarkButton({ day: plan.day, chapter: plan.chapter, type: "chapter", text: `${plan.book} ${plan.chapter} \u00b7 ${content.title || plan.title}`, label: "Bookmark" }),
    isDone
      ? el("span", { class: "chip", style: "background:rgba(88,214,141,0.18);border-color:rgba(88,214,141,0.35);color:#bff5d2" }, "\u2713 Sudah dibaca")
      : el("button", { class: "btn ghost", onclick: () => finishDay(plan) }, "Tandai sudah dibaca")
  );

  const hero = el("div", { class: "hero" },
    eyebrow,
    el("h1", {}, "31 Hari Hidup Dalam Hikmat"),
    el("p", { class: "hero-sub" }, "Menjelajahi kitab Amsal pasal demi pasal untuk membangun kehidupan yang berhikmat, takut akan Tuhan, dan mampu mengambil keputusan yang benar setiap hari."),
    el("div", { class: "hero-meta" },
      el("span", { class: "chip gold" }, `Hari ${plan.day} dari 31`),
      el("span", { class: "chip" }, `${plan.book} ${plan.chapter}`),
      el("span", { class: "chip" }, content.title || plan.title),
      el("span", { class: "chip time-chip" }, `\u23F1\uFE0F \u00b1${estimateMinutes(content)} menit`)
    ),
    actions
  );
  return hero;
}

// ---------------------------------------------------------------------------
// Section: Ayat Emas
// ---------------------------------------------------------------------------
function renderGoldenVerse(plan, content) {
  if (!content.goldenVerse) return null;
  return el("div", { class: "golden-verse" },
    el("div", { class: "golden-eyebrow" }, "\u2728 Ayat Emas Hari Ini"),
    el("p", { class: "golden-text" }, `\u201C${content.goldenVerse.text}\u201D`),
    el("div", { class: "golden-ref" }, `\u2014 ${content.goldenVerse.ref} (TB)`),
    el("div", { class: "save-row" },
      favoriteButton({ day: plan.day, chapter: plan.chapter, type: "verse", text: content.goldenVerse.text }),
      bookmarkButton({ day: plan.day, chapter: plan.chapter, type: "verse", text: `${content.goldenVerse.ref} \u2014 ${content.goldenVerse.text}`, label: "Simpan ayat" })
    )
  );
}

// ---------------------------------------------------------------------------
// Section: Judul pasal (Amsal N) + prev/next otomatis antar pasal
// ---------------------------------------------------------------------------
function renderChapterHeading(plan) {
  const label = `${plan.book} ${plan.chapter}`;
  const total = planCount();
  const prevDay = plan.day > 1 ? plan.day - 1 : null;
  const nextDay = plan.day < total ? plan.day + 1 : null;

  const navBtn = (dir, targetDay) => {
    const isPrev = dir === "prev";
    const enabled = targetDay != null;
    return el("button", {
      type: "button",
      class: `chapter-nav chapter-nav--${dir}${enabled ? "" : " is-disabled"}`,
      "aria-label": enabled
        ? (isPrev ? `Pasal sebelumnya · Hari ${targetDay}` : `Pasal berikutnya · Hari ${targetDay}`)
        : (isPrev ? "Tidak ada pasal sebelumnya" : "Tidak ada pasal berikutnya"),
      disabled: enabled ? undefined : "disabled",
      onclick: enabled ? () => go("day", { day: targetDay }) : undefined,
    },
      el("span", { class: "chapter-nav-icon", "aria-hidden": "true" }, isPrev ? "‹" : "›")
    );
  };

  return el("div", {
    class: "chapter-heading",
    "aria-label": label,
  },
    navBtn("prev", prevDay),
    el("div", { class: "chapter-heading-core" },
      el("h2", { class: "chapter-title" }, label),
      el("span", { class: "chapter-rule", "aria-hidden": "true" })
    ),
    navBtn("next", nextDay)
  );
}

// ---------------------------------------------------------------------------
// Section: Teks lengkap pasal TB (ringkasan tetap menjadi fallback offline)
// ---------------------------------------------------------------------------
function renderChapterText(plan, content) {
  const title = content.title || plan.title || `${plan.book} ${plan.chapter}`;
  return el("div", {
    class: "reading chapter-reading",
    "data-chapter-text": String(plan.chapter),
    "aria-busy": "true",
  },
    el("h3", { class: "chapter-pericope" }, title),
    el("div", { class: "chapter-text-body" },
      el("p", { class: "chapter-text-status", role: "status" },
        `Memuat ${fullChapterLabel(plan.refs)} (TB)…`
      )
    )
  );
}

async function loadChapterText(section, plan, content) {
  const card = section.querySelector(`[data-chapter-text="${plan.chapter}"]`);
  const body = card?.querySelector(".chapter-text-body");
  if (!card || !body) return;

  try {
    const verses = await fetchChapter("tb", String(plan.chapter));
    if (!card.isConnected) return;
    const numbers = Object.keys(verses).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!numbers.length) throw new Error("Ayat kosong");

    body.replaceChildren(
      el("div", { class: "chapter-verses" },
        ...numbers.map((number) =>
          el("p", { class: "chapter-verse" },
            el("sup", { class: "chapter-verse-num", "aria-label": `Ayat ${number}` }, String(number)),
            verses[number]
          )
        )
      )
    );
    card.removeAttribute("aria-busy");
  } catch {
    if (!card.isConnected) return;
    body.replaceChildren(
      el("p", { class: "chapter-offline-note", role: "status" },
        "Teks lengkap TB tidak dapat dimuat. Ringkasan ditampilkan sebagai fallback offline."
      ),
      ...paragraphs(content.summary)
    );
    card.removeAttribute("aria-busy");
  }
}

// ---------------------------------------------------------------------------
// Section: Renungan
// ---------------------------------------------------------------------------
function renderReflection(plan, content) {
  if (!content.lead && !content.renungan && !content.pullQuote) return null;
  return el("div", { class: "reading" },
    el("div", { class: "reading-head" },
      el("div", { class: "eyebrow" }, "Renungan"),
      el("div", { class: "save-row" },
        favoriteButton({ day: plan.day, chapter: plan.chapter, type: "renungan", text: content.lead || content.title }),
        bookmarkButton({ day: plan.day, chapter: plan.chapter, type: "renungan", text: `Renungan \u00b7 ${content.title || plan.title}`, label: "Simpan" })
      )
    ),
    el("h2", {}, "Apa yang Tuhan mau bilang hari ini?"),
    content.lead ? el("p", { class: "lead" }, content.lead) : null,
    ...paragraphs(content.renungan),
    content.pullQuote
      ? el("blockquote", { class: "pull" },
          `\u201C${content.pullQuote.text}\u201D`,
          el("footer", {}, ` \u2014 ${content.pullQuote.author}`)
        )
      : null
  );
}

// ---------------------------------------------------------------------------
// Section: Catatan Eksegesis
// Mendukung `exegesis` (string) maupun `eksegesis` (objek body/inti/ayatKunci).
// ---------------------------------------------------------------------------
function renderExegesis(content) {
  if (!content.exegesis) return null;
  return el("div", { class: "reading" },
    el("div", { class: "eyebrow" }, "Catatan Eksegesis"),
    ...paragraphs(content.exegesis)
  );
}

// ---------------------------------------------------------------------------
// Section: aksi antara bacaan & kuis
// ---------------------------------------------------------------------------
function renderMidAction() {
  return el("div", { class: "action-row" },
    el("button", { class: "btn ghost", onclick: () => { document.getElementById("quiz-anchor").scrollIntoView({ behavior: "smooth" }); } }, "Lanjut ke kuis \u2193")
  );
}

// ---------------------------------------------------------------------------
// Section: navigasi bawah (prev / kalender / next)
// ---------------------------------------------------------------------------
function renderFooter(plan) {
  return el("div", { class: "action-row", style: "margin-top:30px" },
    plan.day > 1
      ? el("button", { class: "btn ghost", "data-route": "day", "data-day": plan.day - 1 }, "\u2190 Hari " + (plan.day - 1))
      : null,
    el("button", { class: "btn ghost", "data-route": "calendar" }, "\u{1F5D3} Lihat kalender"),
    plan.day < planCount()
      ? el("button", { class: "btn", "data-route": "day", "data-day": plan.day + 1 }, "Hari " + (plan.day + 1) + " \u2192")
      : null
  );
}

// ---------------------------------------------------------------------------
// Fallback content untuk hari tanpa isi penuh
// ---------------------------------------------------------------------------
function stubRenungan(plan) {
  return (
`Hari ini bacaan kita: ${plan.refs.join(", ")} \u2014 dengan tema "${plan.title}".

Pakai tombol "Baca pasal lengkap" di atas untuk membuka teks resmi. Bacalah pelan, garis-bawahi 1 ayat yang menyentuh hatimu, lalu ajukan 3 pertanyaan ini ke dalam dirimu:

1. Apa yang Tuhan tunjukkan tentang diri-Nya di pasal ini?
2. Apa yang Dia tunjukkan tentang diriku?
3. Satu langkah kecil apa yang bisa aku lakukan hari ini sebagai respons?

Renungan lengkap untuk hari ini akan segera tersedia. Sementara itu, jadikan ruang ini ruang doamu sendiri.`
  );
}

function stubContent(plan) {
  return {
    day: plan.day,
    book: plan.book,
    chapter: plan.chapter,
    title: plan.title,
    theme: plan.theme,
    goldenVerse: { ref: `${plan.book} ${plan.chapter}:1`, text: "Bacalah pasal ini dengan hati yang siap menerima hikmat." },
    summary: "Hari ini kita membaca " + plan.refs.join(" & ") + ".",
    lead: "Mintalah hikmat Tuhan untuk memahami bacaan hari ini.",
    renungan: stubRenungan(plan),
    pullQuote: { text: "Hikmat dimulai ketika kita bersedia diajar.", author: "Bible Time" },
    keywords: ["hikmat", "didikan", "takut akan TUHAN", "ketaatan", "karakter", "keputusan"],
    exegesis: "Konten catatan eksegesis sedang dipersiapkan.",
    reflection: ["Apa yang Tuhan ajarkan melalui pasal ini?", "Kebiasaan apa yang perlu saya ubah?", "Langkah taat apa yang akan saya ambil?"],
    prayer: "Tuhan, berikanlah aku hati yang mau diajar dan keberanian untuk melakukan firman-Mu. Amin.",
    challenge: "Catat satu pelajaran dan lakukan satu langkah nyata hari ini.",
    quiz: [],
  };
}

// ---------------------------------------------------------------------------
// Komposisi halaman
// ---------------------------------------------------------------------------
export function renderDay({ day, resume, homeLayout = false } = {}) {
  const plan = getPlanByDay(day) || firstPlan();
  const content = (CONTENT && CONTENT[plan.day]) || stubContent(plan);
  const status = planDateStatus(plan);

  const section = el("section", { class: "section day-section" });
  const readingAnchor = el("div", { id: "reading-anchor", style: "scroll-margin-top:80px" });
  const quizAnchor = el("div", { id: "quiz-anchor", style: "scroll-margin-top:80px" });
  const hero = renderHero(plan, content, status);
  const goldenVerse = renderGoldenVerse(plan, content);
  const quiz = renderQuiz(plan, content);

  const aiAssistHost = el("div", { id: "ai-assist-host", class: "ai-assist-host" });

  const readingParts = [
    readingAnchor,
    renderChapterHeading(plan),
    renderChapterText(plan, content),
    aiAssistHost,
    renderReflection(plan, content),
    renderExegesis(content),
    renderJournalBox(plan),
    renderMidAction(),
  ];
  const parts = homeLayout
    ? [...readingParts, goldenVerse, quizAnchor, quiz, hero, renderFooter(plan)]
    : [hero, goldenVerse, ...readingParts, quizAnchor, quiz, renderFooter(plan)];
  parts.forEach((node) => { if (node) section.append(node); });

  $("#app").appendChild(section);
  fitHeroTitle(section.querySelector(".hero h1"));

  const resumeRatio = resume ? getChapterProgress(plan.day) : 0;
  mountDayRuntime({ plan, section, resumeRatio });
  loadChapterText(section, plan, content);
  mountAiLessonAssist(aiAssistHost, { plan, content });
}

// Beranda = renungan, ayat emas, kuis, hero preview, lalu kartu perjalanan.
export function renderHome() {
  const card = continueCard();
  renderDay({ day: getTodayPlan().day, homeLayout: true });
  if (card) $("#app").appendChild(el("section", { class: "section home-lead" }, card));
}
