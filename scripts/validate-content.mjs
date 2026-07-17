import { CONTENT } from "../data/content.js";
import { READING_PLAN } from "../data/schedule.js";

const errors = [];
const countWords = (text) => String(text || "").trim().split(/\s+/).filter(Boolean).length;
const requiredStrings = ["book", "title", "theme", "summary", "lead", "renungan", "exegesis", "prayer", "challenge"];

if (READING_PLAN.length !== 31) errors.push(`Schedule berisi ${READING_PLAN.length} hari, seharusnya 31.`);
if (Object.keys(CONTENT).length !== 31) errors.push(`Content berisi ${Object.keys(CONTENT).length} hari, seharusnya 31.`);

for (let day = 1; day <= 31; day++) {
  const item = CONTENT[day];
  const plan = READING_PLAN[day - 1];
  const label = `Hari ${day}`;
  if (!item) {
    errors.push(`${label}: konten tidak ada.`);
    continue;
  }
  if (!plan || plan.day !== day || plan.chapter !== day) errors.push(`${label}: schedule tidak sinkron.`);
  if (item.day !== day || item.chapter !== day || item.book !== "Amsal") errors.push(`${label}: identitas buku/pasal tidak valid.`);

  for (const field of requiredStrings) {
    if (typeof item[field] !== "string" || !item[field].trim()) errors.push(`${label}: ${field} kosong.`);
  }

  if (!item.goldenVerse?.ref || !item.goldenVerse?.text) errors.push(`${label}: goldenVerse kosong.`);
  if (!item.pullQuote?.text || !item.pullQuote?.author) errors.push(`${label}: pullQuote kosong.`);
  if (!Array.isArray(item.keywords) || item.keywords.length < 6 || item.keywords.some((x) => !String(x).trim())) {
    errors.push(`${label}: keywords harus minimal 6 dan tidak boleh kosong.`);
  }
  if (!Array.isArray(item.reflection) || item.reflection.length !== 3 || item.reflection.some((x) => !String(x).trim())) {
    errors.push(`${label}: reflection harus tepat 3 pertanyaan.`);
  }
  if (!Array.isArray(item.quiz) || item.quiz.length !== 5) {
    errors.push(`${label}: quiz harus tepat 5 soal.`);
  } else {
    item.quiz.forEach((q, index) => {
      if (!q.q || !q.explain || q.type !== "pg" || !Array.isArray(q.opts) || q.opts.length !== 4 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) {
        errors.push(`${label}: quiz ${index + 1} tidak valid.`);
      }
    });
  }

  const summaryWords = countWords(item.summary);
  const devotionalWords = countWords(item.renungan);
  const exegesisWords = countWords(item.exegesis);
  const prayerWords = countWords(item.prayer);
  if (summaryWords < 150 || summaryWords > 250) errors.push(`${label}: ringkasan ${summaryWords} kata (target 150–250).`);
  if (devotionalWords < 400 || devotionalWords > 700) errors.push(`${label}: renungan ${devotionalWords} kata (target 400–700).`);
  if (exegesisWords < 200 || exegesisWords > 400) errors.push(`${label}: eksegesis ${exegesisWords} kata (target 200–400).`);
  if (prayerWords < 100 || prayerWords > 180) errors.push(`${label}: doa ${prayerWords} kata (target 100–180).`);
}

if (/\bMazmur\b|\bMzm\.?\b|\bPsalm\b/i.test(JSON.stringify(CONTENT))) {
  errors.push("Konten masih mengandung referensi edisi lama.");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("VALID: 31 hari Amsal lengkap dan seluruh schema/lokasi kata memenuhi syarat.");
