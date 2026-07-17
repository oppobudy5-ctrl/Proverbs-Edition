const DEFAULT_THRESHOLDS = Object.freeze([7, 14, 21, 31]);

export function buildMilestones({
  lessonCount,
  completedCount = 0,
  thresholds = DEFAULT_THRESHOLDS,
  book = "proverbs",
  topic = null,
  includeBookComplete = Number(lessonCount) >= 31,
} = {}) {
  const total = Math.max(0, Number(lessonCount) || 0);
  const completed = Math.max(0, Math.min(total, Number(completedCount) || 0));
  const numeric = [...new Set(
    (Array.isArray(thresholds) ? thresholds : DEFAULT_THRESHOLDS)
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0 && value <= total),
  )].sort((a, b) => a - b);

  const milestones = numeric.map((value) => createMilestone(
    `lessons-${value}`,
    `${value} Lesson`,
    value,
    completed,
  ));

  if (total > 0) {
    if (includeBookComplete) {
      milestones.push(createMilestone(
        `book-${book}-complete`,
        "Book Complete",
        total,
        completed,
      ));
    }
    if (topic) {
      milestones.push(createMilestone(
        `theme-${slug(topic)}-complete`,
        "Theme Complete",
        total,
        completed,
      ));
    }
    milestones.push(createMilestone(
      "plan-complete",
      "Plan Complete",
      total,
      completed,
    ));
  }

  return Object.freeze(milestones);
}

export function getNextMilestone(milestones = []) {
  return milestones.find((item) => item.status !== "completed") || null;
}

function createMilestone(id, title, target, completed) {
  const progress = Math.min(target, completed);
  return Object.freeze({
    id,
    title,
    target,
    progress,
    percent: target ? Math.round((progress / target) * 100) : 0,
    status: completed >= target ? "completed" : "pending",
  });
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "topic";
}
