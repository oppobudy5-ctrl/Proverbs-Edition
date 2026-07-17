import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = new EventTarget();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  analyzeLearningGoal,
  PLANNING_GOALS,
  buildDiscipleshipPlan,
  buildMilestones,
  buildRecommendation,
  clearPlanningCache,
} = await import("../src/ai/planning/index.js");
const { AIService } = await import("../src/ai/ai-service.js");

const goals = [
  ["Saya ingin belajar hikmat", PLANNING_GOALS.LEARN_WISDOM],
  ["Studi karakter tokoh", PLANNING_GOALS.CHARACTER_STUDY],
  ["Studi kitab pasal demi pasal", PLANNING_GOALS.BOOK_STUDY],
  ["Bacaan harian setiap hari", PLANNING_GOALS.DAILY_READING],
  ["Studi topikal tentang doa", PLANNING_GOALS.TOPICAL_STUDY],
  ["Saya ingin pertumbuhan rohani", PLANNING_GOALS.SPIRITUAL_GROWTH],
  ["Menghafal memory verse", PLANNING_GOALS.MEMORIZATION],
  ["Bertumbuh dalam doa", PLANNING_GOALS.PRAYER],
  ["Belajar kepemimpinan", PLANNING_GOALS.LEADERSHIP],
  ["Jalur pemuridan", PLANNING_GOALS.DISCIPLESHIP],
  ["Saya ingin belajar", PLANNING_GOALS.GENERAL_LEARNING],
];
for (const [input, expected] of goals) {
  assert.equal(analyzeLearningGoal(input).goal, expected, input);
}
assert.equal(analyzeLearningGoal("Studi topikal tentang doa").topic, "prayer");
console.log("PASS: 11 learning goal categories");

const reading = await buildDiscipleshipPlan({
  goal: "Bacaan harian",
  duration: 7,
  completedLessons: [],
  llmEnabled: false,
});
assertPlan(reading, 7);
assert.equal(reading.type, "reading");
assert.equal(reading.lessons[0].chapter, 1);
assert.equal(reading.offline_compatible, true);
assert.ok(reading.canonical_context.reasoning_metadata?.intent);
console.log("PASS: offline reading plan with canonical reasoning");

const study = await buildDiscipleshipPlan({
  goal: "Studi karakter dan integritas",
  duration: 7,
  llmEnabled: false,
});
assertPlan(study, 7);
assert.equal(study.type, "study");
assert.ok(study.study_path.length > 0);
console.log("PASS: study path from existing chapter themes");

const book = await buildDiscipleshipPlan({
  goal: "Studi kitab pasal demi pasal",
  duration: 31,
  llmEnabled: false,
});
assertPlan(book, 31);
assert.equal(book.type, "book");
assert.deepEqual(book.book_plan.reading_order, Array.from({ length: 31 }, (_, index) => index + 1));
assert.ok(book.book_plan.purpose);
assert.ok(book.book_plan.overview);
assert.deepEqual(book.book_plan.review_checkpoints, [7, 14, 21, 28, 31]);
console.log("PASS: 31-chapter book study plan");

const topical = await buildDiscipleshipPlan({
  goal: "Studi topikal tentang doa",
  duration: 7,
  llmEnabled: false,
});
assertPlan(topical, 7);
assert.equal(topical.type, "topical");
assert.equal(topical.goal_analysis.topic, "prayer");
assert.equal(topical.topical_plan.length, 7);
console.log("PASS: topical learning plan");

const firstChapter = topical.lessons[0].chapter;
const progressed = await buildDiscipleshipPlan({
  goal: "Studi topikal tentang doa",
  duration: 7,
  completedLessons: [firstChapter],
  currentLesson: firstChapter,
  llmEnabled: false,
});
assert.equal(progressed.completion.completed, 1);
assert.notEqual(progressed.recommendation.next_lesson?.chapter, firstChapter);
assert.ok(progressed.recommendation.reason);
console.log("PASS: progress-aware recommendation engine");

const milestones = buildMilestones({
  lessonCount: 31,
  completedCount: 14,
  thresholds: [7, 14, 21, 31],
  book: "proverbs",
  topic: "wisdom",
});
assert.equal(milestones.find((item) => item.id === "lessons-7")?.status, "completed");
assert.equal(milestones.find((item) => item.id === "lessons-14")?.status, "completed");
assert.equal(milestones.find((item) => item.id === "lessons-21")?.status, "pending");
assert.ok(milestones.some((item) => item.title === "Book Complete"));
assert.ok(milestones.some((item) => item.title === "Theme Complete"));
assert.ok(milestones.some((item) => item.title === "Plan Complete"));
console.log("PASS: configurable milestone engine");

const recommendation = buildRecommendation({
  plan: reading,
  completedLessons: [1, 2, 3, 4, 5, 6, 7],
  currentLesson: 7,
});
assert.equal(recommendation.next_lesson, null);
assert.equal(recommendation.review_due, true);
console.log("PASS: completed-plan recommendation");

clearPlanningCache();
const cachedA = await buildDiscipleshipPlan({ goal: "Belajar hikmat", duration: 7, llmEnabled: false });
const cachedB = await buildDiscipleshipPlan({ goal: "Belajar hikmat", duration: 7, llmEnabled: false });
assert.equal(cachedA.plan_id, cachedB.plan_id);
assert.ok(globalThis.localStorage.getItem("bibletime:planning:v1"));
assert.ok(Object.isFrozen(cachedB));
console.log("PASS: deterministic local plan cache");

const service = await AIService.plan({
  goal: "Belajar hikmat",
  duration: 7,
  llmEnabled: false,
});
assert.equal(service.success, true);
assert.equal(service.source, "planning-discipleship-engine");
assert.ok(service.plan?.plan_id);
assert.equal(service.metadata.offline_compatible, true);
const serviceRecommendation = await AIService.recommend({
  goal: "Belajar hikmat",
  duration: 7,
  completedLessons: [service.plan.lessons[0].chapter],
  llmEnabled: false,
});
assert.equal(serviceRecommendation.success, true);
assert.ok(serviceRecommendation.recommendation);
console.log("PASS: AIService planning and recommendation envelopes");

const ui = await readFile(path.join(ROOT, "js/ui/planning.js"), "utf8");
const router = await readFile(path.join(ROOT, "js/router.js"), "utf8");
const html = await readFile(path.join(ROOT, "index.html"), "utf8");
assert.match(ui, /AIService\.plan/);
assert.doesNotMatch(ui, /planning-engine|ai-controller|providers\//);
for (const card of [
  "Reading Plan Card",
  "Study Plan Card",
  "Daily Plan",
  "Recommendation Card",
  "Milestone Card",
]) {
  assert.match(ui, new RegExp(card));
}
assert.match(ui, /aria-label.*Pengaturan rencana belajar/);
assert.match(router, /planning: renderPlanning/);
assert.deepEqual((await import("../js/router.js")).parsePath("/plans"), {
  route: "planning",
  params: {},
});
assert.equal((await import("../js/router.js")).buildPath("planning"), "/plans");
assert.match(html, /data-route="planning"/);
console.log("PASS: accessible responsive UI route and AIService boundary");

console.log("VALID: Phase 007 planning, study, topical, book, recommendation, milestones, cache, offline, and UI.");

function assertPlan(plan, duration) {
  for (const field of [
    "plan_id", "title", "goal", "duration", "difficulty", "lessons",
    "reflection", "prayer", "application", "memory_verse", "review",
    "milestones", "completion",
  ]) {
    assert.ok(field in plan, `plan harus punya ${field}`);
  }
  assert.equal(plan.duration, duration);
  assert.equal(plan.lessons.length, duration);
  for (const lesson of plan.lessons) {
    for (const field of [
      "book", "chapter", "estimated_time", "objective", "reflection",
      "prayer", "application", "memory_verse", "review", "milestone",
    ]) {
      assert.ok(field in lesson, `lesson harus punya ${field}`);
    }
  }
}
