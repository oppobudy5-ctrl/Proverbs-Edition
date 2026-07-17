// =============================================================================
// about.js — Halaman "Tentang" + tautan sosial pengembang + ikon footer.
// =============================================================================
import { el, $ } from "../dom.js";
import { clearAllData } from "../store.js";
import { refreshStreak } from "./streak.js";
import { toast } from "../dom.js";
import { go } from "../router.js";

const DEV_LINKS = [
  { key: "ig",  label: "Instagram", aria: "Instagram @parestemy", href: "https://instagram.com/parestemy",
    svg: "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"5\"/><path d=\"M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z\"/><line x1=\"17.5\" y1=\"6.5\" x2=\"17.51\" y2=\"6.5\"/></svg>" },
  { key: "wa",  label: "WhatsApp",  aria: "WhatsApp Budi",       href: "https://wa.me/62895358013512",
    svg: "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"currentColor\"><path d=\"M17.6 14.2c-.3-.1-1.7-.8-2-.9-.3-.1-.4-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.9-2.1-.2-.5-.5-.5-.6-.5h-.5c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.3 0 1.3 1 2.7 1.1 2.8.1.2 1.9 2.9 4.5 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.3c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.3c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.2.8.8-3.1-.2-.3C4 14.9 3.6 13.5 3.6 12 3.6 7.4 7.4 3.6 12 3.6S20.4 7.4 20.4 12 16.6 20.3 12 20.3z\"/></svg>" },
  { key: "tt",  label: "TikTok",    aria: "TikTok @parestemy",   href: "https://www.tiktok.com/@parestemy",
    svg: "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"currentColor\"><path d=\"M19.6 6.7c-1.4-.2-2.6-1-3.4-2.1-.4-.6-.7-1.3-.8-2H12v12.4c0 1.3-1 2.3-2.3 2.3s-2.3-1-2.3-2.3 1-2.3 2.3-2.3c.3 0 .5 0 .8.1v-3.4c-.3 0-.5-.1-.8-.1-3.2 0-5.7 2.6-5.7 5.7s2.6 5.7 5.7 5.7 5.7-2.6 5.7-5.7V9.6c1.2.8 2.6 1.3 4.2 1.4V7.6c0-.3-.1-.6-.3-.9z\"/></svg>" },
  { key: "x",   label: "Twitter/X", aria: "Twitter/X @parestemy", href: "https://x.com/parestemy",
    svg: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"currentColor\"><path d=\"M18.2 2H21l-6.5 7.4L22 22h-6.2l-4.9-6.4L5.3 22H2.5l7-8L2 2h6.4l4.4 5.8L18.2 2zm-2.2 18h1.6L7.2 4H5.5l10.5 16z\"/></svg>" },
  { key: "in",  label: "LinkedIn",  aria: "LinkedIn parestemy",  href: "https://www.linkedin.com/in/parestemy",
    svg: "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"currentColor\"><path d=\"M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5V8h3v11zM6.5 6.7a1.7 1.7 0 1 1 0-3.5 1.7 1.7 0 0 1 0 3.5zM19 19h-3v-5.4c0-1.3-.5-2.1-1.6-2.1-.9 0-1.4.6-1.6 1.2-.1.2-.1.5-.1.8V19h-3V8h3v1.3a3 3 0 0 1 2.7-1.5c2 0 3.6 1.3 3.6 4V19z\"/></svg>" },
  { key: "em",  label: "Email",     aria: "Email budycreated119@outlook.com", href: "mailto:budycreated119@outlook.com",
    svg: "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z\"/><polyline points=\"22,6 12,13 2,6\"/></svg>" },
];

function devLinksRow() {
  const wrap = el("div", { class: "dev-links" });
  DEV_LINKS.forEach((link) => {
    const a = el("a", { class: "dev-link " + link.key, href: link.href, target: "_blank", rel: "noopener", "aria-label": link.aria });
    a.innerHTML = link.svg + "<span>" + link.label + "</span>";
    wrap.appendChild(a);
  });
  return wrap;
}

function devIconsRow() {
  const wrap = el("div", { class: "foot-icons" });
  DEV_LINKS.forEach((link) => {
    const a = el("a", { class: "foot-icon " + link.key, href: link.href, target: "_blank", rel: "noopener", "aria-label": link.aria, title: link.label });
    a.innerHTML = link.svg;
    wrap.appendChild(a);
  });
  return wrap;
}

// Inject ikon footer saat boot (menggantikan ikon statis di HTML).
export function injectFooterIcons() {
  const right = document.querySelector(".footer .foot-right");
  if (!right) return;
  right.querySelectorAll(".foot-icon").forEach((n) => n.remove());
  right.appendChild(devIconsRow());
}

export function renderAbout() {
  const s = el("section", { class: "section about" },
    el("h1", {}, "Bible Time Proverbs Edition"),
    el("p", {
      class: "lead",
      html:
        "<strong>31 Hari Hidup dalam Hikmat</strong> adalah Daily Wisdom Journey yang mengajak kita " +
        "menjelajahi kitab Amsal pasal demi pasal. Setiap hari kita belajar takut akan TUHAN, " +
        "membentuk karakter, dan mengambil keputusan yang benar dalam kehidupan nyata.",
    }),
    el("p", {},
      "Perjalanan ini dirancang untuk remaja, mahasiswa, orang dewasa, kelompok pemuridan, kelompok PA, dan gereja. " +
      "Tujuannya bukan hanya menambah pengetahuan, melainkan menolong firman membentuk cara kita berpikir, berbicara, bekerja, dan membangun relasi."
    ),
    el("h2", {}, "Yang kamu dapat tiap hari"),
    el("ul", {},
      el("li", {}, "Satu pasal Amsal dengan ayat emas yang mewakili pesan utamanya."),
      el("li", {}, "Ringkasan, renungan pastoral, dan catatan eksegesis yang saling melengkapi."),
      el("li", {}, "Tiga pertanyaan refleksi, doa, dan tantangan nyata untuk dijalani."),
      el("li", {}, "Lima soal pilihan ganda untuk menolong isi pasal tetap diingat."),
      el("li", {}, "Tombol \u201CBaca pasal lengkap\u201D ke SABDA / alkitab.app untuk teks penuh & resmi."),
      el("li", {}, "Streak harian + kalender progress (disimpan di browser-mu).")
    ),
    el("h2", {}, "Sumber & pendekatan"),
    el("ul", {},
      el("li", {}, "Teks Ibrani Perjanjian Lama, Terjemahan Baru LAI, dan terjemahan pembanding."),
      el("li", {}, "Pembacaan sastra hikmat yang memperhatikan konteks, bentuk amsal, dan istilah Ibrani penting."),
      el("li", {}, "Penerapan pastoral yang berpusat pada takut akan TUHAN dan pembentukan karakter Kristiani.")
    ),
    el("h2", {}, "Hak cipta & fair use"),
    el("p", {}, "Teks lengkap TB \u00a9 Lembaga Alkitab Indonesia. App ini hanya mengutip satu ayat emas singkat per hari untuk pengajaran/devosional. Untuk membaca pasal penuh, pakai tombol \u201CBaca pasal lengkap\u201D di tiap hari."),
    el("h2", {}, "Privasi jurnal & data"),
    el("p", {}, "Jurnal bersifat privat di perangkatmu. AI hanya membaca jurnal setelah izin eksplisit."),
    el("div", { class: "about-privacy-actions" },
      el("button", {
        type: "button",
        class: "btn ghost",
        onclick: async () => {
          const { exportJournalJSON, downloadTextFile } = await import("../journal/export.js");
          downloadTextFile(`bibletime-journal-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJournalJSON(), "application/json");
          toast("Backup jurnal diunduh");
        },
      }, "Ekspor jurnal (backup)"),
      el("button", {
        type: "button",
        class: "btn ghost",
        onclick: async () => {
          const { revokeJournalAiConsent } = await import("../journal/consent.js");
          revokeJournalAiConsent();
          toast("Izin AI jurnal dicabut");
        },
      }, "Cabut izin AI jurnal"),
      el("button", {
        type: "button",
        class: "btn ghost",
        onclick: async () => {
          if (!confirm("Hapus cache & percakapan AI lokal?")) return;
          try {
            const { conversationStore } = await import("../../src/ai/conversation-store.js");
            const { aiCache } = await import("../../src/ai/ai-cache.js");
            await conversationStore.clear?.();
            await aiCache.clear?.();
            toast("Cache AI dihapus");
          } catch {
            toast("Gagal menghapus cache AI");
          }
        },
      }, "Hapus cache AI"),
    ),
    el("h2", {}, "Reset progress"),
    el("p", {},
      "Kalau mau mulai dari awal (disarankan ekspor jurnal dulu): ",
      el("a", {
        href: "#",
        onclick: async (e) => {
          e.preventDefault();
          if (confirm("Ekspor jurnal ke JSON sebelum reset?")) {
            try {
              const { exportJournalJSON, downloadTextFile } = await import("../journal/export.js");
              downloadTextFile(`bibletime-journal-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJournalJSON(), "application/json");
            } catch { /* noop */ }
          }
          if (confirm("Hapus seluruh progress, bookmark, favorit, jurnal, riwayat, dan cache AI?")) {
            await clearAllData({ clearAi: true });
            refreshStreak();
            toast("Semua data di-reset");
            go("about");
          }
        },
      }, "klik di sini untuk reset"),
    ),
    el("h2", {}, "Pengembang"),
    el("div", { class: "dev-card" },
      el("div", { class: "dev-row" },
        el("span", { class: "dev-label" }, "Developer "),
        el("strong", { class: "dev-handle" }, "@parestemy"),
        el("span", { class: "dev-amp" }, " & "),
        el("strong", { class: "dev-handle" }, "@budi_siera")
      ),
      devLinksRow()
    ),
    el("p", { class: "dev-copyright" }, "2026 @parestemy")
  );
  $("#app").appendChild(s);
}
