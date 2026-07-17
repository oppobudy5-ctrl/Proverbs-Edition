// =============================================================================
// reader.js — Popup baca paralel: TB + versi pendamping.
//
// PENTING: memilih versi pendamping di sini TIDAK mengubah versi UTAMA (hero).
// Preferensi pendamping disimpan terpisah via store.getSecondaryVersion().
// =============================================================================
import { el } from "../dom.js";
import { COMPANION_VERSIONS, TEXT_API_VERSIONS, SABDA_VER, READER_LAYOUTS } from "../versions.js";
import { getSecondaryVersion, setSecondaryVersion, getReaderLayout, setReaderLayout } from "../store.js";
import { fetchChapter, chapterFromRefs, sabdaDiglotURL } from "../bible-api.js";

function renderParallelVerses(tb, en, nums, layout, verLbl, enOk, chapter, ver2) {
  const list = el("div", { class: "reader-verses layout-" + layout });

  if (enOk === false) {
    list.append(
      el("div", { class: "reader-note" },
        el("span", {}, `Teks ${verLbl} belum tersedia untuk dibaca paralel di app. `),
        el("a", { href: sabdaDiglotURL(chapter, ver2, SABDA_VER), target: "_blank", rel: "noopener" }, `Buka TB + ${verLbl} di SABDA \u2197`)
      )
    );
    nums.forEach((n) => {
      list.append(
        el("div", { class: "rv" },
          el("div", { class: "rv-row rv-tb" },
            el("span", { class: "rv-num" }, String(n)),
            el("span", { class: "rv-tag" }, "TB"),
            el("span", { class: "rv-text" }, tb[n] || "")
          )
        )
      );
    });
    return list;
  }

  if (layout === "cols") {
    list.append(
      el("div", { class: "reader-cols-hd" },
        el("span", { class: "reader-cols-hd-num" }, ""),
        el("span", { class: "reader-cols-hd-tb" }, "TB"),
        el("span", { class: "reader-cols-hd-en" }, verLbl)
      )
    );
    nums.forEach((n) => {
      list.append(
        el("div", { class: "rv rv--cols" },
          el("span", { class: "rv-num" }, String(n)),
          el("div", { class: "rv-col rv-col-tb" }, el("p", { class: "rv-text" }, tb[n] || "")),
          el("div", { class: "rv-col rv-col-en", "data-ver": verLbl }, el("p", { class: "rv-text rv-text-en" }, en[n] || "\u2014"))
        )
      );
    });
  } else {
    nums.forEach((n) => {
      list.append(
        el("div", { class: "rv" },
          el("div", { class: "rv-row rv-tb" },
            el("span", { class: "rv-num" }, String(n)),
            el("span", { class: "rv-tag" }, "TB"),
            el("span", { class: "rv-text" }, tb[n] || "")
          ),
          el("div", { class: "rv-row rv-en" },
            el("span", { class: "rv-num" }, ""),
            el("span", { class: "rv-tag rv-tag-en" }, verLbl),
            el("span", { class: "rv-text" }, en[n] || "\u2014")
          )
        )
      );
    });
  }
  return list;
}

export function openParallelReader(refs) {
  const chapter = chapterFromRefs(refs);
  let ver2 = getSecondaryVersion();
  let layout = getReaderLayout();
  let cached = null;
  let loadToken = 0;

  const overlay = el("div", { class: "reader-overlay" });
  const body = el("div", { class: "reader-body" });
  const verLabel = () => (COMPANION_VERSIONS.find((x) => x.code === ver2) || { label: "NKJV" }).label;

  const select = el("select", {
    class: "reader-vselect",
    title: "Versi pendamping",
    "aria-label": "Versi pendamping",
    // Hanya mengubah versi PENDAMPING, tidak menyentuh versi utama.
    onchange: (e) => { ver2 = e.target.value; setSecondaryVersion(ver2); load(); },
  }, ...COMPANION_VERSIONS.map((v) =>
    el("option", v.code === ver2 ? { value: v.code, selected: "selected" } : { value: v.code }, v.label)
  ));

  const layoutToggle = el("div", { class: "reader-layout", role: "group", "aria-label": "Tata letak bacaan" });
  const layoutBtns = [];
  READER_LAYOUTS.forEach((opt) => {
    const btn = el("button", {
      type: "button",
      class: "reader-layout-btn" + (layout === opt.id ? " active" : ""),
      title: opt.label,
      onclick: () => {
        if (layout === opt.id) return;
        layout = opt.id;
        setReaderLayout(layout);
        syncLayoutUI();
        paintVerses();
      },
    }, opt.label);
    layoutBtns.push({ id: opt.id, btn });
    layoutToggle.append(btn);
  });

  function syncLayoutUI() {
    layoutBtns.forEach(({ id, btn }) => btn.classList.toggle("active", id === layout));
    modal.classList.toggle("reader-modal--wide", layout === "cols");
  }

  const closeBtn = el("button", { class: "reader-close", title: "Tutup", "aria-label": "Tutup", onclick: close }, "\u2715");

  const head = el("div", { class: "reader-head" },
    el("div", { class: "reader-titles" },
      el("h2", {}, `Amsal ${chapter}`),
      el("div", { class: "reader-sub" },
        el("span", {}, "TB"),
        el("span", { class: "reader-plus" }, "+"),
        select,
        layoutToggle
      )
    ),
    closeBtn
  );

  const foot = el("div", { class: "reader-foot" },
    el("a", { class: "btn ghost", href: sabdaDiglotURL(chapter, ver2, SABDA_VER), target: "_blank", rel: "noopener" }, "Buka diglot di SABDA \u2197")
  );

  const modal = el("div", {
    class: "reader-modal" + (layout === "cols" ? " reader-modal--wide" : ""),
    role: "dialog",
    "aria-modal": "true",
  }, head, body, foot);
  overlay.append(modal);

  function close() {
    loadToken++; // batalkan efek load yang tertunda
    document.removeEventListener("keydown", onKey);
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 180);
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", onKey);

  function paintVerses() {
    if (!cached) return;
    const scroll = body.scrollTop;
    const existing = body.querySelector(".reader-verses, .reader-error");
    if (existing) existing.remove();
    body.append(renderParallelVerses(cached.tb, cached.en, cached.nums, layout, verLabel(), cached.enOk, chapter, ver2));
    body.scrollTop = scroll;
  }

  async function load() {
    const token = ++loadToken;
    foot.firstChild.href = sabdaDiglotURL(chapter, ver2, SABDA_VER);
    cached = null;
    body.innerHTML = "";
    body.append(el("div", { class: "reader-loading" }, el("span", { class: "reader-spin" }), "Memuat teks\u2026"));
    try {
      const enWanted = TEXT_API_VERSIONS.has(ver2);
      const [tb, enRes] = await Promise.all([
        fetchChapter("tb", chapter),
        enWanted
          ? fetchChapter(ver2, chapter).then((en) => ({ en, ok: true })).catch(() => ({ en: {}, ok: false }))
          : Promise.resolve({ en: {}, ok: false }),
      ]);
      if (token !== loadToken) return; // versi/pasal sudah berganti atau ditutup
      const en = enRes.en, enOk = enWanted ? enRes.ok : false;
      const nums = Object.keys(tb).map(Number).sort((a, b) => a - b);
      cached = { tb, en, nums, enOk };
      body.innerHTML = "";
      body.append(renderParallelVerses(tb, en, nums, layout, verLabel(), enOk, chapter, ver2));
      body.scrollTop = 0;
    } catch {
      if (token !== loadToken) return;
      body.innerHTML = "";
      body.append(
        el("div", { class: "reader-error" },
          el("p", {}, "Tidak bisa memuat teks daring. Pastikan ada koneksi internet (fitur ini aktif di versi web/Vercel)."),
          el("a", { class: "btn", href: sabdaDiglotURL(chapter, ver2, SABDA_VER), target: "_blank", rel: "noopener" }, "Baca di SABDA \u2197")
        )
      );
    }
  }

  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));
  load();
}
