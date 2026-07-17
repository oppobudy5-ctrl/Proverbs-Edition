// =============================================================================
// calendar.js — Halaman kalender 31 Hari Hidup dalam Hikmat.
// =============================================================================
import { el, $ } from "../dom.js";
import { Store } from "../store.js";
import { READING_PLAN } from "../../data/schedule.js";
import { planCount } from "../plan.js";
import { todayISO, dayName, fmtDateShort } from "../date-helper.js";
import { searchContent, highlight } from "../search.js";
import { mountSemanticSearch } from "./semantic-search-ui.js";

export function renderCalendar() {
  const state = Store.load();
  const today = todayISO();

  const head = el("div", { class: "cal-head" },
    el("h1", {}, "31 Hari ", el("em", { style: "font-style:italic;color:var(--gold-1)" }, "Hidup dalam Hikmat")),
    el("span", { class: "sub" }, "Bible Time Proverbs Edition · Daily Wisdom Journey")
  );

  const grid = el("div", { class: "cal-grid" });
  READING_PLAN.forEach((p) => {
    const isToday = p.date === today;
    const isFuture = p.date > today;
    const isDone = !!state.done[p.day];
    const cls = ["cal-cell"];
    if (isToday) cls.push("is-today");
    if (isDone) cls.push("is-done");
    if (isFuture && !isToday) cls.push("is-future");

    const titleEl = el("span", { class: "t" }, p.title);
    const cell = el(isFuture && !isToday ? "div" : "button",
      Object.assign({ class: cls.join(" "), "data-day": p.day }, (isFuture && !isToday) ? {} : { "data-route": "day" }),
      el("span", { class: "d" }, `${dayName(p.date)} · ${fmtDateShort(p.date)}`),
      el("span", { class: "n" }, `Hari ${p.day}`),
      el("span", { class: "r" }, `${p.book} ${p.chapter}`),
      titleEl
    );
    cell._title = titleEl;
    cell._plainTitle = p.title;
    grid.appendChild(cell);
  });

  const totalDays = planCount();
  const doneCount = Object.keys(state.done).filter((day) => Number(day) >= 1 && Number(day) <= totalDays).length;
  const allDone = doneCount >= totalDays;

  const summary = el("div", { style: "color:var(--ink-2);font-size:14px;margin:18px 0 8px" },
    el("div", {}, `Dibaca: ${doneCount} dari ${totalDays} hari · streak ${state.streak || 0} 🔥`),
    el("progress", { value: doneCount, max: totalDays, "aria-label": `Progress ${doneCount} dari ${totalDays} hari`, style: "width:100%;margin-top:10px;accent-color:var(--gold-1)" })
  );

  const finaleBanner = allDone
    ? el("div", { class: "finale-banner" },
        el("strong", {}, "Perjalanan selesai!"),
        " Kamu sudah menyelesaikan 31 Hari Hidup dalam Hikmat. Teruslah berjalan dalam takut akan TUHAN!"
      )
    : null;

  const searchHost = el("div", { class: "cal-search-host" });
  mountSemanticSearch(searchHost, {
    placeholder: "Cari makna, situasi hidup, topik, atau ayat…",
    ariaLabel: "Pencarian semantik perjalanan hikmat",
    onClear() {
      grid.querySelectorAll(".cal-cell").forEach((cell) => {
        cell.hidden = false;
        if (cell._title) cell._title.textContent = cell._plainTitle;
      });
    },
    onResults(response) {
      const query = response.query || "";
      const chapters = new Set(
        response.results
          .map((r) => r.chapter)
          .filter((n) => Number.isFinite(n)),
      );
      // Fallback lexical day filter if semantic returns no chapter hits.
      if (!chapters.size && query) {
        searchContent(query).forEach((item) => chapters.add(item.day));
      }
      grid.querySelectorAll(".cal-cell").forEach((cell) => {
        const day = Number(cell.dataset.day);
        const match = !query || chapters.has(day);
        cell.hidden = !match;
        if (cell._title) {
          if (query && match) cell._title.innerHTML = highlight(cell._plainTitle, query);
          else cell._title.textContent = cell._plainTitle;
        }
      });
    },
    onError() {
      // Keep calendar usable via lexical filter only when BKB fails to load.
    },
  });

  const section = el("section", { class: "section" }, head, summary, searchHost);
  if (finaleBanner) section.appendChild(finaleBanner);
  section.appendChild(grid);
  $("#app").appendChild(section);
}
