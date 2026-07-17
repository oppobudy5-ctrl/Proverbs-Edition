// =============================================================================
// journal-box.js — Kotak jurnal harian (delegasi ke editor kaya AI-07).
// =============================================================================
import { renderJournalEditor } from "./journal-editor.js";

export function renderJournalBox(plan) {
  return renderJournalEditor({
    plan,
    day: plan?.day,
    heading: "Catatan refleksi hari ini",
  });
}
