import { $, el } from "../dom.js";
import { AIService } from "../../src/ai/ai-service.js";
import { Store } from "../store.js";
import { aiError, aiLoading } from "./ai-dialog.js";
import { announce } from "../a11y.js";

const GOAL_OPTIONS = Object.freeze([
  "Belajar hikmat",
  "Studi karakter",
  "Studi kitab",
  "Bacaan harian",
  "Studi topikal",
  "Pertumbuhan rohani",
  "Menghafal Firman",
  "Doa",
  "Kepemimpinan",
  "Pemuridan",
  "Belajar Alkitab",
]);

export function renderPlanning() {
  const section = el("section", {
    class: "section day-section",
    "aria-labelledby": "planning-title",
  });
  const output = el("div", {
    "aria-live": "polite",
    "aria-busy": "true",
  }, aiLoading("Menyusun rencana belajar…"));

  const goalSelect = el("select", {
    class: "reader-vselect",
    id: "planning-goal",
    "aria-label": "Pilih tujuan belajar",
  }, ...GOAL_OPTIONS.map((goal) => el("option", { value: goal }, goal)));
  const customGoal = el("input", {
    class: "reader-vselect",
    id: "planning-custom-goal",
    type: "text",
    maxlength: "160",
    placeholder: "Topik khusus, mis. doa atau kepemimpinan",
    "aria-label": "Tujuan atau topik khusus",
  });
  const durationSelect = el("select", {
    class: "reader-vselect",
    id: "planning-duration",
    "aria-label": "Durasi rencana",
  },
    ...[7, 14, 21, 31].map((days) =>
      el("option", { value: String(days) }, `${days} lesson`),
    ),
  );
  const difficultySelect = el("select", {
    class: "reader-vselect",
    id: "planning-difficulty",
    "aria-label": "Tingkat kesulitan",
  },
    el("option", { value: "pemula" }, "Pemula"),
    el("option", { value: "menengah" }, "Menengah"),
    el("option", { value: "lanjutan" }, "Lanjutan"),
  );
  const generateButton = el("button", {
    type: "button",
    class: "btn primary",
    onclick: () => void loadPlan(),
  }, "Susun rencana");

  section.append(
    el("div", { class: "hero" },
      el("div", { class: "hero-eyebrow" },
        el("span", { class: "dot" }),
        "Canonical Learning Journey",
      ),
      el("h1", { id: "planning-title" }, "Planning & Discipleship"),
      el("p", { class: "hero-sub" },
        "Susun jalur belajar dari materi kanonik yang tersedia, lengkap dengan refleksi, doa, penerapan, review, dan milestone.",
      ),
    ),
    el("div", { class: "reading companion-controls" },
      el("div", { class: "reading-head" },
        el("div", {},
          el("div", { class: "eyebrow" }, "Goal Analyzer"),
          el("h2", {}, "Tujuan belajar"),
        ),
      ),
      el("div", { class: "journal-actions", role: "group", "aria-label": "Pengaturan rencana belajar" },
        field("Tujuan", goalSelect),
        field("Topik khusus", customGoal),
        field("Durasi", durationSelect),
        field("Kesulitan", difficultySelect),
        generateButton,
      ),
    ),
    output,
  );
  $("#app")?.append(section);
  void loadPlan();

  async function loadPlan() {
    generateButton.disabled = true;
    output.setAttribute("aria-busy", "true");
    output.replaceChildren(aiLoading("Menyusun rencana dari Knowledge Base lokal…"));
    const stored = Store.load();
    const response = await AIService.plan({
      goal: customGoal.value.trim() || goalSelect.value,
      duration: Number(durationSelect.value),
      difficulty: difficultySelect.value,
      currentLesson: currentChapter(stored),
      completedLessons: stored.done || {},
      cache: true,
      llmEnabled: false,
    });
    generateButton.disabled = false;
    output.removeAttribute("aria-busy");

    if (!response.success || !response.plan) {
      output.replaceChildren(aiError(response.error?.message || "Rencana belajar tidak dapat disusun."));
      return;
    }
    output.replaceChildren(...renderPlanCards(response.plan));
    announce(`Rencana ${response.plan.title} siap`);
  }
}

function renderPlanCards(plan) {
  const next = plan.recommendation?.next_lesson;
  const readingCard = el("article", { class: "reading ai-assist-card companion-card" },
    el("div", { class: "eyebrow" }, "Reading Plan Card"),
    el("h2", {}, plan.title),
    el("div", { class: "chips" },
      el("span", { class: "chip gold" }, `${plan.duration} lesson`),
      el("span", { class: "chip" }, plan.difficulty),
      el("span", { class: "chip" }, `±${plan.estimated_time} menit total`),
      el("span", { class: "chip" }, `${plan.completion.percent}% selesai`),
    ),
    el("p", {}, `Goal: ${plan.goal_analysis.original || plan.goal}`),
    plan.book_plan?.purpose ? el("p", {}, `Tujuan kitab: ${plan.book_plan.purpose}`) : null,
  );

  const studyCard = el("article", { class: "reading ai-assist-card companion-card" },
    el("div", { class: "eyebrow" }, "Study Plan Card"),
    el("h2", {}, "Jalur studi"),
    el("div", { class: "chips", "aria-label": "Urutan tema studi" },
      ...plan.study_path.slice(0, 12).map((theme, index) =>
        el("span", { class: `chip${index === 0 ? " gold" : ""}` }, `${index + 1}. ${theme}`),
      ),
    ),
  );

  const dailyCard = el("article", { class: "reading ai-assist-card companion-card" },
    el("div", { class: "eyebrow" }, "Daily Plan"),
    el("h2", {}, "Lesson harian"),
    el("ol", { class: "ai-crossref-list" },
      ...plan.lessons.map((lesson) =>
        el("li", { class: "ai-crossref-item" },
          el("strong", {}, `Hari ${lesson.day} · ${lesson.book} ${lesson.chapter}`),
          el("p", {}, lesson.objective),
          el("div", { class: "chips" },
            el("span", { class: "chip" }, `±${lesson.estimated_time} menit`),
            lesson.memory_verse?.ref
              ? el("span", { class: "chip gold" }, lesson.memory_verse.ref)
              : null,
          ),
          el("button", {
            type: "button",
            class: "btn ghost",
            "data-route": "day",
            "data-day": String(lesson.chapter),
          }, "Buka lesson"),
        ),
      ),
    ),
  );

  const recommendationCard = el("article", { class: "reading ai-assist-card companion-card" },
    el("div", { class: "eyebrow" }, "Recommendation Card"),
    el("h2", {}, next ? `${next.book} ${next.chapter}` : "Plan selesai"),
    el("p", {}, plan.recommendation.reason),
    next ? el("p", {}, `Tema: ${next.theme}`) : null,
    next
      ? el("button", {
          type: "button",
          class: "btn primary",
          "data-route": "day",
          "data-day": String(next.chapter),
        }, "Lanjutkan")
      : null,
  );

  const milestoneCard = el("article", { class: "reading ai-assist-card companion-card" },
    el("div", { class: "eyebrow" }, "Milestone Card"),
    el("h2", {}, "Pencapaian"),
    el("ul", { class: "ai-crossref-list" },
      ...plan.milestones.map((milestone) =>
        el("li", { class: "ai-crossref-item" },
          el("strong", {}, milestone.title),
          el("p", {}, `${milestone.progress}/${milestone.target} · ${milestone.percent}% · ${milestone.status}`),
        ),
      ),
    ),
  );

  return [readingCard, studyCard, dailyCard, recommendationCard, milestoneCard];
}

function field(label, control) {
  return el("label", { class: "journal-field" },
    el("span", { class: "journal-label" }, label),
    control,
  );
}

function currentChapter(stored) {
  const completed = Object.entries(stored?.done || {})
    .filter(([, done]) => Boolean(done))
    .map(([chapter]) => Number(chapter))
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
  return completed.length ? completed[completed.length - 1] + 1 : 1;
}
