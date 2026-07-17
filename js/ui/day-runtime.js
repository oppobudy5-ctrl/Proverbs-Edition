// =============================================================================
// day-runtime.js — Perilaku runtime halaman "Hari":
//   • Bilah progres baca (atas layar) + simpan progres pasal
//   • Reading timer (akumulasi durasi aktif) -> history
//   • Navigasi keyboard (← → Home End) + swipe kiri/kanan (mobile)
// Semua listener dibersihkan otomatis lewat lifecycle.onLeave().
// =============================================================================
import { $ } from "../dom.js";
import { go } from "../router.js";
import { planCount } from "../plan.js";
import { onLeave } from "../lifecycle.js";
import { setChapterProgress } from "../progress.js";
import { addSession } from "../history.js";

function ensureBar() {
  let bar = $("#read-progress");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "read-progress";
    bar.className = "read-progress";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", "Progres membaca halaman");
    bar.innerHTML = '<span class="read-progress-fill"></span>';
    document.body.appendChild(bar);
  }
  return bar;
}

export function mountDayRuntime({ plan, section, resumeRatio = 0 }) {
  const bar = ensureBar();
  const fill = bar.querySelector(".read-progress-fill");
  bar.classList.add("show");

  let raf = 0;
  let lastSaved = 0;
  let maxRatio = 0;

  function computeRatio() {
    const top = section.offsetTop;
    const height = section.offsetHeight - window.innerHeight;
    if (height <= 0) return 1;
    return Math.max(0, Math.min(1, (window.scrollY - top + window.innerHeight * 0.15) / height));
  }

  function paint() {
    raf = 0;
    const ratio = computeRatio();
    maxRatio = Math.max(maxRatio, ratio);
    fill.style.transform = `scaleX(${ratio.toFixed(3)})`;
    bar.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
    const now = Date.now();
    if (now - lastSaved > 1500) { lastSaved = now; setChapterProgress(plan.day, ratio); }
  }
  function onScroll() { if (!raf) raf = requestAnimationFrame(paint); }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  paint();

  // ---- Reading timer -------------------------------------------------------
  let activeSince = document.visibilityState === "visible" ? Date.now() : 0;
  let accumulated = 0;
  function pauseTimer() {
    if (activeSince) { accumulated += Date.now() - activeSince; activeSince = 0; }
  }
  function resumeTimer() {
    if (!activeSince && document.visibilityState === "visible") activeSince = Date.now();
  }
  function onVisibility() { document.visibilityState === "visible" ? resumeTimer() : (pauseTimer(), flush()); }
  function flush() {
    pauseTimer();
    if (accumulated >= 1000) { addSession(plan.day, accumulated); accumulated = 0; }
    resumeTimer();
  }
  document.addEventListener("visibilitychange", onVisibility);

  // ---- Keyboard navigation -------------------------------------------------
  function inField(t) {
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }
  function onKey(e) {
    if (inField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowRight" && plan.day < planCount()) { e.preventDefault(); go("day", { day: plan.day + 1 }); }
    else if (e.key === "ArrowLeft" && plan.day > 1) { e.preventDefault(); go("day", { day: plan.day - 1 }); }
    else if (e.key === "Home") { e.preventDefault(); go("day", { day: 1 }); }
    else if (e.key === "End") { e.preventDefault(); go("day", { day: planCount() }); }
  }
  document.addEventListener("keydown", onKey);

  // ---- Swipe navigation (mobile) ------------------------------------------
  let sx = 0, sy = 0, tracking = false;
  function onTouchStart(e) {
    if (e.touches.length !== 1) { tracking = false; return; }
    tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }
  function onTouchEnd(e) {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && plan.day < planCount()) go("day", { day: plan.day + 1 });
    else if (dx > 0 && plan.day > 1) go("day", { day: plan.day - 1 });
  }
  section.addEventListener("touchstart", onTouchStart, { passive: true });
  section.addEventListener("touchend", onTouchEnd, { passive: true });

  // ---- Resume posisi -------------------------------------------------------
  if (resumeRatio > 0.05 && resumeRatio < 0.95) {
    requestAnimationFrame(() => {
      const target = section.offsetTop + (section.offsetHeight - window.innerHeight) * resumeRatio;
      window.scrollTo({ top: Math.max(0, target), behavior: "auto" });
    });
  }

  onLeave(() => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("keydown", onKey);
    section.removeEventListener("touchstart", onTouchStart);
    section.removeEventListener("touchend", onTouchEnd);
    if (raf) cancelAnimationFrame(raf);
    setChapterProgress(plan.day, maxRatio);
    flush();
    bar.classList.remove("show");
  });
}
