// =============================================================================
// settings-panel.js — Drawer preferensi membaca: reading mode, tema, tipografi, AI.
// =============================================================================
import { el } from "../dom.js";
import { trapFocus, announce } from "../a11y.js";
import {
  getSettings, updateSettings, toggleReadingMode,
  FONT_SIZES, LINE_HEIGHTS, COMFORT_WIDTHS, FONT_FAMILIES,
} from "../settings.js";
import { THEMES, getTheme, setTheme } from "../theme.js";
import { AISettings } from "../../src/ai/ai-settings.js";
import { AI_PROVIDER_IDS } from "../../config/ai.config.js";
import { ModelRegistry } from "../../src/ai/providers/model-registry.js";

let openEl = null;

function segmented({ options, activeId, getId = (o) => o.id, getLabel = (o) => o.label, onPick, ariaLabel }) {
  const group = el("div", { class: "seg", role: "group", "aria-label": ariaLabel });
  const btns = [];
  options.forEach((opt) => {
    const id = getId(opt);
    const btn = el("button", {
      type: "button",
      class: "seg-btn" + (id === activeId ? " is-active" : ""),
      "aria-pressed": id === activeId ? "true" : "false",
      onclick: () => {
        btns.forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-pressed", "false"); });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        onPick(id);
      },
    }, getLabel(opt));
    btns.push(btn);
    group.append(btn);
  });
  return group;
}

function field(label, control) {
  return el("div", { class: "sp-field" }, el("div", { class: "sp-label" }, label), control);
}

function aiToggle(label, checked, onChange, ariaLabel) {
  const btn = el("button", {
    class: "sp-toggle" + (checked ? " is-on" : ""),
    type: "button",
    role: "switch",
    "aria-checked": checked ? "true" : "false",
    "aria-label": ariaLabel || label,
    onclick: () => {
      const next = !btn.classList.contains("is-on");
      btn.classList.toggle("is-on", next);
      btn.setAttribute("aria-checked", next ? "true" : "false");
      onChange(next);
    },
  }, el("span", { class: "sp-toggle-track", "aria-hidden": "true" }, el("span", { class: "sp-toggle-thumb" })));
  return el("div", { class: "sp-row" },
    el("div", {}, el("div", { class: "sp-label" }, label)),
    btn,
  );
}

export function openSettingsPanel() {
  if (openEl) return;
  const s = getSettings();
  let ai = AISettings.get();

  const readingToggle = el("button", {
    class: "sp-toggle" + (s.readingMode ? " is-on" : ""),
    type: "button",
    role: "switch",
    "aria-checked": s.readingMode ? "true" : "false",
    "aria-label": "Mode Baca",
    onclick: () => {
      const on = toggleReadingMode();
      readingToggle.classList.toggle("is-on", on);
      readingToggle.setAttribute("aria-checked", on ? "true" : "false");
      announce(on ? "Mode baca aktif" : "Mode baca nonaktif");
    },
  }, el("span", { class: "sp-toggle-track", "aria-hidden": "true" }, el("span", { class: "sp-toggle-thumb" })));

  const themeGrid = el("div", { class: "theme-grid", role: "group", "aria-label": "Pilih tema" });
  const themeBtns = [];
  THEMES.forEach((t) => {
    const btn = el("button", {
      type: "button",
      class: "theme-chip" + (t.id === getTheme() ? " is-active" : ""),
      "aria-pressed": t.id === getTheme() ? "true" : "false",
      title: t.hint,
      onclick: () => {
        themeBtns.forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-pressed", "false"); });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        setTheme(t.id);
        announce("Tema " + t.label);
      },
    },
      el("span", { class: "theme-swatch", style: `background:${t.swatch}`, "aria-hidden": "true" }),
      el("span", { class: "theme-name" }, t.label)
    );
    themeBtns.push(btn);
    themeGrid.append(btn);
  });

  const modelHost = el("div", { class: "sp-field" });
  function renderModelPicker(providerId, activeModel) {
    const models = ModelRegistry.forProvider(providerId);
    modelHost.replaceChildren(
      el("div", { class: "sp-label" }, "Model AI"),
      segmented({
        options: models,
        activeId: activeModel || models[0]?.id,
        ariaLabel: "Model AI",
        onPick: (id) => {
          ai = AISettings.update({ model: id });
          announce(`Model ${id}`);
        },
      }),
    );
  }
  renderModelPicker(ai.provider, ai.model);

  const providerOptions = AI_PROVIDER_IDS.map((id) => ({ id, label: id }));
  const aiSection = el("div", { class: "sp-section", "aria-label": "Pengaturan AI" },
    el("h3", { class: "sp-label" }, "AI Provider"),
    el("p", { class: "sp-hint" }, "Kunci API hanya disimpan di server. UI hanya memilih provider dan model."),
    field("Provider", segmented({
      options: providerOptions,
      activeId: ai.provider,
      ariaLabel: "AI Provider",
      onPick: (id) => {
        const nextModel = ModelRegistry.defaultModel(id);
        ai = AISettings.update({ provider: id, model: nextModel });
        renderModelPicker(id, nextModel);
        announce(`Provider ${id}`);
      },
    })),
    modelHost,
    aiToggle("Streaming", ai.streaming, (on) => {
      ai = AISettings.update({ streaming: on });
      announce(on ? "Streaming aktif" : "Streaming nonaktif");
    }, "Streaming AI"),
    aiToggle("Mode Offline", ai.offlineMode, (on) => {
      ai = AISettings.update({ offlineMode: on });
      announce(on ? "Mode offline AI aktif" : "Mode offline AI nonaktif");
    }, "Mode Offline AI"),
    aiToggle("Debug AI", ai.debugMode, (on) => {
      ai = AISettings.update({ debugMode: on });
      announce(on ? "Debug AI aktif" : "Debug AI nonaktif");
    }, "Debug Mode AI"),
    field("Temperature", segmented({
      options: [
        { id: "0.2", label: "Fokus" },
        { id: "0.35", label: "Seimbang" },
        { id: "0.7", label: "Kreatif" },
      ],
      activeId: String(ai.temperature),
      ariaLabel: "Temperature AI",
      onPick: (id) => {
        ai = AISettings.update({ temperature: Number(id) });
      },
    })),
  );

  const body = el("div", { class: "sp-body" },
    el("div", { class: "sp-row" },
      el("div", {},
        el("div", { class: "sp-label" }, "Mode Baca"),
        el("div", { class: "sp-hint" }, "Sembunyikan distraksi, fokus penuh pada teks.")
      ),
      readingToggle
    ),
    field("Tema", themeGrid),
    field("Ukuran huruf", segmented({
      options: FONT_SIZES, activeId: s.fontSize, ariaLabel: "Ukuran huruf",
      onPick: (id) => updateSettings({ fontSize: id }),
    })),
    field("Tinggi baris", segmented({
      options: LINE_HEIGHTS, activeId: s.lineHeight, ariaLabel: "Tinggi baris",
      onPick: (id) => updateSettings({ lineHeight: id }),
    })),
    field("Lebar teks", segmented({
      options: COMFORT_WIDTHS, activeId: s.comfortWidth, ariaLabel: "Lebar area teks",
      onPick: (id) => updateSettings({ comfortWidth: id }),
    })),
    field("Jenis huruf", segmented({
      options: FONT_FAMILIES, activeId: s.fontFamily, ariaLabel: "Jenis huruf",
      onPick: (id) => updateSettings({ fontFamily: id }),
    })),
    aiSection,
  );

  const closeBtn = el("button", { class: "sp-close", type: "button", "aria-label": "Tutup pengaturan", onclick: close }, "\u2715");
  const panel = el("div", { class: "sp-panel", role: "dialog", "aria-modal": "true", "aria-label": "Pengaturan membaca" },
    el("div", { class: "sp-head" }, el("h2", {}, "Pengaturan Membaca"), closeBtn),
    body
  );
  const overlay = el("div", { class: "sp-overlay" }, panel);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  let release = () => {};
  function close() {
    if (!openEl) return;
    release();
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
    openEl = null;
  }

  document.body.append(overlay);
  openEl = overlay;
  requestAnimationFrame(() => overlay.classList.add("show"));
  release = trapFocus(panel, { onEscape: close });
}
