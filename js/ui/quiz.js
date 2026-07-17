// =============================================================================
// quiz.js — Mesin kuis harian (5 soal berkategori).
// =============================================================================
import { el, $$ } from "../dom.js";
import { Store } from "../store.js";
import { planCount } from "../plan.js";
import { refreshStreak } from "./streak.js";
import { go } from "../router.js";
import { completeDay } from "../complete.js";
import { showAchievements } from "./celebrate.js";

const QUIZ_CATS = {
  bacaan:  { label: "Pemahaman Bacaan",    icon: "\u{1F4D6}", poin: 20 },
  ingat:   { label: "Daya Ingat Firman",   icon: "\u2728",    poin: 25 },
  isi:     { label: "Pemahaman Isi Pasal", icon: "\u2696\uFE0F", poin: 15 },
  terap:   { label: "Penerapan Kehidupan", icon: "\u{1F64F}", poin: 20 },
  mengisi: { label: "Soal Mengisi",        icon: "\u{1F3AF}", poin: 20 },
};

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randomizeQuestion(question) {
  const options = question.opts.map((text, originalIndex) => ({ text, originalIndex }));
  const randomized = shuffled(options);
  return {
    ...question,
    opts: randomized.map((option) => option.text),
    answer: randomized.findIndex((option) => option.originalIndex === question.answer),
  };
}

export function renderQuiz(plan, content) {
  const wrap = el("div", { class: "quiz" });
  if (!content.quiz || !content.quiz.length) {
    wrap.append(el("div", { class: "quiz-head" }, el("span", { class: "quiz-eyebrow" }, "Kuis")));
    wrap.append(el("p", { style: "color:var(--ink-2)" }, "Kuis untuk hari ini akan segera hadir."));
    return wrap;
  }

  const questions = shuffled(content.quiz).map(randomizeQuestion);
  const state = { i: 0, score: 0, poin: 0, total: questions.length, answers: [] };
  const head = el("div", { class: "quiz-head" },
    el("span", { class: "quiz-eyebrow" }, "\u{1F3AF} Kuis"),
    el("span", { class: "quiz-progress" }, `Soal 1 / ${state.total} \u00b7 0 poin`)
  );
  const body = el("div", { class: "quiz-body" });
  wrap.append(head, body);

  const catPoin = (q) => q.poin || (QUIZ_CATS[q.cat] && QUIZ_CATS[q.cat].poin) || 20;

  function next() {
    if (state.i >= state.total) return finish();
    head.lastChild.textContent = `Soal ${state.i + 1} / ${state.total} \u00b7 ${state.poin} poin`;
    body.replaceChildren();
    const q = questions[state.i];
    const cat = QUIZ_CATS[q.cat] || null;
    const poin = catPoin(q);
    const isTF = q.type === "tf";
    const optList = isTF ? ["Salah", "Benar"] : q.opts;

    const catBar = el("div", { class: "q-catbar" },
      el("span", { class: "q-cat" }, cat ? `${cat.icon} ${cat.label}` : "\u{1F4D6} Kuis"),
      el("span", { class: "q-poin" }, `${poin} POIN`)
    );
    const titleEl = q.type === "fill" ? renderFill(q) : el("h3", {}, q.q);
    const opts = el("div", { class: "opts" + (isTF ? " opts--tf" : "") });
    const feedback = el("div", { class: "feedback" });
    const footer = el("div", { class: "quiz-foot" });

    optList.forEach((text, idx) => {
      const badgeTxt = isTF ? (idx === 1 ? "\u2713" : "\u2717") : String.fromCharCode(65 + idx);
      const btn = el("button", { class: "opt", onclick: () => choose(idx) },
        el("span", { class: "badge" }, badgeTxt),
        el("span", {}, text)
      );
      opts.append(btn);
    });

    function choose(idx) {
      const correct = idx === q.answer;
      if (correct) { state.score++; state.poin += poin; }
      state.answers.push({ q: state.i, cat: q.cat, picked: idx, correct });
      head.lastChild.textContent = `Soal ${state.i + 1} / ${state.total} \u00b7 ${state.poin} poin`;
      $$(".opt", opts).forEach((b, i) => {
        b.classList.add("locked");
        if (i === q.answer) b.classList.add("correct");
        if (i === idx && !correct) b.classList.add("wrong");
      });
      if (q.type === "fill") {
        const blank = body.querySelector(".verse-fill .blank");
        if (blank) { blank.textContent = q.opts[q.answer]; blank.classList.add("filled"); }
      }
      feedback.className = "feedback show " + (correct ? "ok" : "no");
      const ans = isTF ? optList[q.answer] : q.opts[q.answer];
      feedback.replaceChildren(
        document.createTextNode(correct ? "\u2713 " : "\u2717 "),
        el("strong", {}, correct ? "Benar!" : "Belum tepat."),
        document.createTextNode(" "),
        el("span", { class: "ans" }, "Jawaban: ", el("strong", {}, String(ans ?? "")), "."),
        document.createTextNode(" " + (q.explain || "")),
      );
      footer.replaceChildren();
      footer.append(
        el("button", { class: "btn primary", onclick: () => { state.i++; next(); } },
          state.i + 1 < state.total ? "Soal berikutnya \u2192" : "Selesai \u2713")
      );
    }

    body.append(catBar, titleEl, opts, feedback, footer);
  }

  function finish() {
    Store.markQuiz(plan.day, state.score, state.total);
    const pct = Math.round((state.score / state.total) * 100);
    const isFinale = plan.day === planCount();
    body.replaceChildren();
    head.replaceChildren();
    head.appendChild(el("span", { class: "quiz-eyebrow quiz-eyebrow--finale" }, "Kuis"));

    const starFor = (ratio) => Math.max(1, Math.min(5, Math.round((ratio || 0) * 5)));
    const overall = state.total ? state.score / state.total : 0;
    const tally = {};
    state.answers.forEach((a) => {
      const key = a.cat === "mengisi" ? "ingat" : (a.cat || null);
      if (!key) return;
      (tally[key] = tally[key] || { c: 0, t: 0 });
      tally[key].t++;
      if (a.correct) tally[key].c++;
    });
    const SKILL_LABELS = [
      { key: "bacaan", label: "Pemahaman Bacaan" },
      { key: "ingat",  label: "Daya Ingat Firman" },
      { key: "isi",    label: "Pemahaman Isi Pasal" },
      { key: "terap",  label: "Penerapan Kehidupan" },
    ];
    const skills = SKILL_LABELS.map(({ key, label }) => ({
      label,
      stars: tally[key] && tally[key].t ? starFor(tally[key].c / tally[key].t) : starFor(overall),
    }));

    const msg = pct === 100
      ? "\u2728 Sempurna! Firman Tuhan hidup dalam hatimu. Terus rajin merenungkannya."
      : pct >= 70
        ? "\u2728 Luar biasa! Firman Tuhan telah kamu pahami dengan baik. Teruslah merenungkan dan melakukan Firman-Nya."
        : "\u{1F4D6} Tidak apa-apa \u2014 baca perlahan, biarlah firman memperbarui pikiranmu.";
    const finaleNote = isFinale
      ? "Kamu menyelesaikan 31 Hari Hidup dalam Hikmat. Teruslah takut akan TUHAN dan hidupi hikmat-Nya setiap hari!"
      : msg;

    body.append(
      el("div", { class: "quiz-finale" + (isFinale ? " is-finale" : "") },
        el("div", { class: "finale-medal" }, isFinale ? "\u{1F451}" : "\u{1F4D6}"),
        el("h3", { class: "finale-title" }, isFinale ? "Perjalanan Selesai" : "Pasal Selesai"),
        el("div", { class: "finale-score" }, `Skor: ${pct} / 100`),
        el("div", { class: "skill-list" },
          ...skills.map((s) =>
            el("div", { class: "skill-row" },
              el("span", { class: "skill-label" }, s.label),
              el("span", { class: "skill-stars" },
                ...Array.from({ length: s.stars }, () => el("span", { class: "star" }, "\u2605"))
              )
            )
          )
        ),
        el("p", { class: "finale-foot" }, finaleNote),
        el("div", { class: "action-row" },
          el("button", { class: "btn", onclick: () => { const n = completeDay(plan.day); refreshStreak(); if (n.length) showAchievements(n); go("day", { day: plan.day }); } }, "\u2713 Tandai dibaca & simpan"),
          plan.day < planCount()
            ? el("button", { class: "btn primary", "data-route": "day", "data-day": plan.day + 1 }, "Lanjut Hari " + (plan.day + 1) + " \u2192")
            : el("button", { class: "btn primary", "data-route": "calendar" }, "Lihat seluruh perjalanan")
        )
      )
    );
  }

  function renderFill(q) {
    const parts = (q.prompt || "").split(/___+/);
    const wrap2 = el("div", { class: "verse-fill" });
    parts.forEach((p, i) => {
      wrap2.appendChild(document.createTextNode(p));
      if (i < parts.length - 1) wrap2.appendChild(el("span", { class: "blank" }, "\u00a0"));
    });
    const refLine = q.ref
      ? el("div", { style: "margin-top:10px;font-style:normal;color:var(--gold-1);font-size:13px;letter-spacing:.04em" }, `\u2014 ${q.ref} (TB)`)
      : null;
    return el("div", {}, wrap2, refLine, el("h3", { style: "margin-top:16px;font-size:18px" }, q.q || "Pilih kata yang tepat untuk melengkapi ayat:"));
  }

  next();
  return wrap;
}
