// =============================================================================
// journal-editor.js — Editor jurnal kaya (refleksi, doa, syukur, tag, mood).
// =============================================================================
import { el, toast } from "../dom.js";
import { announce } from "../a11y.js";
import {
  GUIDED_PROMPTS,
  JOURNAL_TYPES,
  emptyPrayer,
} from "../journal/schema.js";
import {
  getPrimaryDayEntry,
  getEntry,
  saveEntry,
} from "../journal/store.js";
import { suggestTags, mergeTags, allSuggestedTags } from "../journal/tags.js";
import { evaluateAchievements } from "../achievement.js";
import { showAchievements } from "./celebrate.js";
import { mountAiReflectionPanel } from "./ai-reflection-panel.js";

export function renderJournalEditor(options = {}) {
  const plan = options.plan || {};
  const day = options.day ?? plan.day;
  const existing = options.entryId
    ? getEntry(options.entryId)
    : (day != null ? getPrimaryDayEntry(day) : null);

  const state = {
    id: existing?.id,
    type: existing?.type || "reflection",
    title: existing?.title || "",
    body: existing?.body || "",
    gratitude: existing?.gratitude || "",
    actionPlan: existing?.actionPlan || "",
    mood: existing?.mood || "",
    favorite: !!existing?.favorite,
    tags: [...(existing?.tags || [])],
    prayer: existing?.prayer ? { ...existing.prayer } : emptyPrayer(),
    guidedAnswers: { ...(existing?.guidedAnswers || {}) },
    day: existing?.day ?? day ?? null,
    book: existing?.book || "Amsal",
    chapter: existing?.chapter ?? day ?? null,
    verse: existing?.verse || null,
    createdAt: existing?.createdAt,
  };

  // Ensure prayer arrays
  ["requests", "thanks", "answered", "waiting"].forEach((k) => {
    if (!Array.isArray(state.prayer[k])) state.prayer[k] = [];
    if (!state.prayer[k].length) state.prayer[k] = [""];
  });

  let saveTimer = 0;
  const status = el("span", { class: "journal-status", "aria-live": "polite" }, existing?.updatedAt ? "Tersimpan" : "");

  const titleInput = el("input", { class: "journal-input journal-title-input", type: "text", placeholder: "Judul singkat (opsional)", "aria-label": "Judul jurnal", value: state.title });
  const bodyInput = el("textarea", { class: "journal-input", rows: "4", placeholder: "Tuliskan refleksi, pelajaran, atau pergumulanmu…", "aria-label": "Refleksi" });
  bodyInput.value = state.body;
  const gratitudeInput = el("textarea", { class: "journal-input", rows: "2", placeholder: "Satu atau beberapa hal yang disyukuri hari ini…", "aria-label": "Ucapan syukur" });
  gratitudeInput.value = state.gratitude;
  const actionInput = el("textarea", { class: "journal-input", rows: "2", placeholder: "Satu langkah nyata minggu ini…", "aria-label": "Rencana tindakan" });
  actionInput.value = state.actionPlan;
  const moodInput = el("input", { class: "journal-input", type: "text", placeholder: "Mis. tenang, bersyukur, berat…", "aria-label": "Mood (opsional)", value: state.mood });
  const typeSelect = el("select", { class: "journal-select", "aria-label": "Jenis catatan" },
    ...JOURNAL_TYPES.map((t) => el("option", { value: t }, typeLabel(t))),
  );
  typeSelect.value = state.type;
  const favBtn = el("button", {
    type: "button",
    class: "btn ghost journal-fav-btn" + (state.favorite ? " is-on" : ""),
    "aria-pressed": state.favorite ? "true" : "false",
    title: "Tandai favorit",
  }, state.favorite ? "★ Favorit" : "☆ Favorit");

  const tagsWrap = el("div", { class: "journal-tags", "aria-label": "Tag" });
  const tagInput = el("input", { class: "journal-input journal-tag-input", type: "text", placeholder: "Tambah tag…", "aria-label": "Tambah tag" });

  function renderTags() {
    tagsWrap.replaceChildren();
    state.tags.forEach((tag) => {
      const chip = el("button", {
        type: "button",
        class: "journal-tag-chip",
        title: `Hapus tag ${tag}`,
        onclick: () => {
          state.tags = state.tags.filter((t) => t !== tag);
          renderTags();
          queueSave();
        },
      }, tag, " ×");
      tagsWrap.append(chip);
    });
  }
  renderTags();

  const prayerFields = {};
  const prayerSection = el("div", { class: "journal-prayer-grid" });
  [
    ["requests", "Permohonan"],
    ["thanks", "Ucapan syukur"],
    ["answered", "Doa yang dijawab"],
    ["waiting", "Doa yang masih dinantikan"],
  ].forEach(([key, label]) => {
    const ta = el("textarea", {
      class: "journal-input",
      rows: "2",
      "aria-label": label,
      placeholder: label + "…",
    });
    ta.value = (state.prayer[key] || []).filter(Boolean).join("\n");
    prayerFields[key] = ta;
    prayerSection.append(el("label", { class: "journal-field" }, el("span", { class: "journal-label" }, label), ta));
  });

  const guidedWrap = el("div", { class: "journal-guided" });
  const guidedInputs = {};
  GUIDED_PROMPTS.forEach((g) => {
    const ta = el("textarea", { class: "journal-input", rows: "2", "aria-label": g.label, placeholder: "Jawaban singkat…" });
    ta.value = state.guidedAnswers[g.id] || "";
    guidedInputs[g.id] = ta;
    guidedWrap.append(el("label", { class: "journal-field" }, el("span", { class: "journal-label" }, g.label), ta));
  });

  function collect() {
    state.title = titleInput.value;
    state.body = bodyInput.value;
    state.gratitude = gratitudeInput.value;
    state.actionPlan = actionInput.value;
    state.mood = moodInput.value;
    state.type = typeSelect.value;
    Object.keys(prayerFields).forEach((key) => {
      state.prayer[key] = prayerFields[key].value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    });
    Object.keys(guidedInputs).forEach((id) => {
      const v = guidedInputs[id].value.trim();
      if (v) state.guidedAnswers[id] = v;
      else delete state.guidedAnswers[id];
    });
    const suggested = suggestTags({ ...state, tags: state.tags });
    state.tags = mergeTags(state.tags, []);
    return {
      id: state.id,
      type: state.type,
      title: state.title,
      body: state.body,
      gratitude: state.gratitude,
      actionPlan: state.actionPlan,
      mood: state.mood,
      favorite: state.favorite,
      tags: state.tags,
      prayer: state.prayer,
      guidedAnswers: state.guidedAnswers,
      day: state.day,
      book: state.book,
      chapter: state.chapter,
      verse: state.verse,
      createdAt: state.createdAt,
      _suggested: suggested,
    };
  }

  function persist(manual) {
    const data = collect();
    const saved = saveEntry(data);
    state.id = saved?.id || state.id;
    status.textContent = saved ? "Tersimpan ✓" : "Kosong — belum disimpan";
    if (manual) {
      toast(saved ? "Catatan jurnal disimpan" : "Isi jurnal masih kosong");
      announce(saved ? "Catatan jurnal disimpan" : "Isi jurnal masih kosong");
      if (saved) {
        const newly = evaluateAchievements();
        if (newly.length) showAchievements(newly);
      }
    }
    return saved;
  }

  function queueSave() {
    status.textContent = "Menyimpan…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(false), 700);
  }

  [titleInput, bodyInput, gratitudeInput, actionInput, moodInput, typeSelect, ...Object.values(prayerFields), ...Object.values(guidedInputs)]
    .forEach((node) => node.addEventListener("input", queueSave));

  favBtn.addEventListener("click", () => {
    state.favorite = !state.favorite;
    favBtn.classList.toggle("is-on", state.favorite);
    favBtn.setAttribute("aria-pressed", state.favorite ? "true" : "false");
    favBtn.textContent = state.favorite ? "★ Favorit" : "☆ Favorit";
    queueSave();
  });

  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const tag = tagInput.value.trim();
      if (tag) {
        state.tags = mergeTags(state.tags, [tag]);
        tagInput.value = "";
        renderTags();
        queueSave();
      }
    }
  });

  const suggestRow = el("div", { class: "journal-tag-suggest" });
  allSuggestedTags().slice(0, 8).forEach((tag) => {
    suggestRow.append(el("button", {
      type: "button",
      class: "journal-tag-suggest-btn",
      onclick: () => {
        state.tags = mergeTags(state.tags, [tag]);
        renderTags();
        queueSave();
      },
    }, tag));
  });

  const aiHost = el("div", { class: "journal-ai-host" });
  const root = el("div", { class: "reading journal-box journal-box-rich" },
    el("div", { class: "eyebrow" }, "Jurnal Pribadi"),
    el("h2", {}, options.heading || "Catatan refleksi"),
    el("p", { class: "journal-note" }, "Privat di perangkatmu. AI hanya membaca jurnal setelah kamu memberi izin."),
    el("div", { class: "journal-toolbar" }, typeSelect, favBtn),
    el("label", { class: "journal-field" }, el("span", { class: "journal-label" }, "Judul"), titleInput),
    el("label", { class: "journal-field" }, el("span", { class: "journal-label" }, "Refleksi"), bodyInput),
    el("label", { class: "journal-field" }, el("span", { class: "journal-label" }, "Ucapan syukur"), gratitudeInput),
    el("label", { class: "journal-field" }, el("span", { class: "journal-label" }, "Rencana tindakan"), actionInput),
    el("label", { class: "journal-field" }, el("span", { class: "journal-label" }, "Mood (opsional)"), moodInput),
    el("div", { class: "journal-field" },
      el("span", { class: "journal-label" }, "Tag"),
      tagsWrap,
      tagInput,
      suggestRow,
    ),
    el("h3", { class: "journal-subhead" }, "Jurnal doa"),
    prayerSection,
    el("h3", { class: "journal-subhead" }, "Refleksi terpandu"),
    guidedWrap,
    el("div", { class: "journal-actions" },
      el("button", { class: "btn primary", type: "button", onclick: () => persist(true) }, "Simpan catatan"),
      status,
    ),
    aiHost,
  );

  mountAiReflectionPanel(aiHost, {
    getEntry: () => {
      const data = collect();
      return { ...data, id: state.id };
    },
    onApplyDraft: (draft) => {
      if (draft?.body) {
        bodyInput.value = draft.body;
        queueSave();
      }
      if (draft?.questions?.length) {
        toast("Pertanyaan refleksi siap — lihat panel AI");
      }
    },
  });

  return root;
}

function typeLabel(type) {
  return ({
    reflection: "Refleksi",
    prayer: "Doa",
    gratitude: "Syukur",
    milestone_note: "Tonggak",
  })[type] || type;
}
