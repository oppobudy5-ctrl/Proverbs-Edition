// =============================================================================
// continue-card.js — Kartu "Lanjutkan Membaca" di beranda.
// =============================================================================
import { el } from "../dom.js";
import { go } from "../router.js";
import { getPlanByDay } from "../plan.js";
import { CONTENT } from "../../data/content.js";
import { resumeTarget, overallStats, getChapterProgress } from "../progress.js";

export function continueCard() {
  const target = resumeTarget();
  const plan = getPlanByDay(target.day);
  if (!plan) return null;
  const content = (CONTENT && CONTENT[plan.day]) || {};
  const stats = overallStats();
  const chapterPct = Math.round(getChapterProgress(plan.day) * 100);
  const neverStarted = stats.doneCount === 0 && chapterPct === 0 && target.fresh;

  const eyebrow = neverStarted ? "Mulai perjalanan" : (target.fresh ? "Selanjutnya" : "Lanjutkan membaca");
  const ctaLabel = neverStarted ? "Mulai Hari 1" : (target.fresh ? "Baca sekarang" : "Lanjutkan");

  return el("div", { class: "continue-card" },
    el("div", { class: "continue-info" },
      el("div", { class: "continue-eyebrow" }, el("span", { class: "dot" }), eyebrow),
      el("div", { class: "continue-title" }, `Hari ${plan.day} \u00b7 ${content.title || plan.title}`),
      el("div", { class: "continue-meta" }, `${plan.book} ${plan.chapter}`),
      el("div", { class: "continue-bar", role: "progressbar", "aria-valuenow": String(stats.percent), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": "Progres keseluruhan" },
        el("span", { class: "continue-bar-fill", style: `width:${stats.percent}%` })
      ),
      el("div", { class: "continue-pct" }, `${stats.percent}% perjalanan \u00b7 ${stats.doneCount}/${stats.total} hari`)
    ),
    el("button", {
      class: "btn primary continue-btn",
      onclick: () => go("day", { day: plan.day, resume: !target.fresh }),
    }, ctaLabel, el("span", { class: "arrow" }, "\u2192"))
  );
}
