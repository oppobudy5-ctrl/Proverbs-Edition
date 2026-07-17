// =============================================================================
// export.js — Ekspor jurnal (JSON / Markdown / TXT). PDF via print stylesheet.
// =============================================================================
import { listEntries } from "./store.js";
import { recordJournalExport } from "./analytics.js";

export function buildJournalExportPayload(entries = listEntries()) {
  return {
    format: "bibletime-journal",
    version: 4,
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };
}

export function exportJournalJSON(entries = listEntries(), { track = true } = {}) {
  if (track) recordJournalExport();
  return JSON.stringify(buildJournalExportPayload(entries), null, 2);
}

export function exportJournalMarkdown(entries = listEntries(), { track = true } = {}) {
  if (track) recordJournalExport();
  const lines = ["# Bible Time — Jurnal", "", `Diekspor: ${new Date().toISOString()}`, ""];
  entries.forEach((e) => {
    const ref = [e.book, e.chapter, e.verse].filter((x) => x != null && x !== "").join(" ");
    lines.push(`## ${e.title || ref || e.type || "Catatan"}`);
    lines.push("");
    lines.push(`- ID: \`${e.id}\``);
    lines.push(`- Tipe: ${e.type}`);
    lines.push(`- Tanggal: ${(e.updatedAt || e.createdAt || "").slice(0, 10)}`);
    if (ref) lines.push(`- Bacaan: ${ref}`);
    if (e.day != null) lines.push(`- Hari rencana: ${e.day}`);
    if (e.mood) lines.push(`- Mood: ${e.mood}`);
    if (e.tags?.length) lines.push(`- Tag: ${e.tags.join(", ")}`);
    if (e.favorite) lines.push("- Favorit: ya");
    lines.push("");
    if (e.body) {
      lines.push("### Refleksi");
      lines.push(e.body);
      lines.push("");
    }
    if (e.gratitude) {
      lines.push("### Syukur");
      lines.push(e.gratitude);
      lines.push("");
    }
    if (e.actionPlan) {
      lines.push("### Rencana tindakan");
      lines.push(e.actionPlan);
      lines.push("");
    }
    const p = e.prayer || {};
    if (p.requests?.length || p.thanks?.length || p.answered?.length || p.waiting?.length) {
      lines.push("### Doa");
      if (p.requests?.length) lines.push(`- Permohonan: ${p.requests.join("; ")}`);
      if (p.thanks?.length) lines.push(`- Syukur: ${p.thanks.join("; ")}`);
      if (p.answered?.length) lines.push(`- Dijawab: ${p.answered.join("; ")}`);
      if (p.waiting?.length) lines.push(`- Dinantikan: ${p.waiting.join("; ")}`);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  });
  return lines.join("\n");
}

export function exportJournalText(entries = listEntries(), { track = true } = {}) {
  if (track) recordJournalExport();
  return entries.map((e) => {
    const ref = [e.book, e.chapter, e.verse].filter((x) => x != null && x !== "").join(" ");
    const p = e.prayer || {};
    return [
      `=== ${e.title || ref || e.type} ===`,
      `ID: ${e.id}`,
      `Tipe: ${e.type}`,
      `Diperbarui: ${e.updatedAt}`,
      ref ? `Bacaan: ${ref}` : null,
      e.tags?.length ? `Tag: ${e.tags.join(", ")}` : null,
      e.body ? `Refleksi:\n${e.body}` : null,
      e.gratitude ? `Syukur:\n${e.gratitude}` : null,
      e.actionPlan ? `Rencana:\n${e.actionPlan}` : null,
      p.requests?.length ? `Permohonan: ${p.requests.join("; ")}` : null,
      p.thanks?.length ? `Ucapan syukur: ${p.thanks.join("; ")}` : null,
      p.answered?.length ? `Doa dijawab: ${p.answered.join("; ")}` : null,
      p.waiting?.length ? `Masih dinantikan: ${p.waiting.join("; ")}` : null,
      "",
    ].filter((line) => line != null).join("\n");
  }).join("\n");
}

export function downloadTextFile(filename, content, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function markdownToSafeHtml(markdown) {
  const escaped = escapeHtml(markdown);
  return escaped
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.trim() === "---") return "<hr>";
      if (!line.trim()) return "<br>";
      return `<p>${line}</p>`;
    })
    .join("\n");
}

export function printJournalAsPdf(entries = listEntries()) {
  recordJournalExport();
  const md = exportJournalMarkdown(entries, { track: false });
  const html = markdownToSafeHtml(md);
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><title>Jurnal Bible Time</title>
    <style>body{font-family:Georgia,serif;max-width:720px;margin:2rem auto;line-height:1.5;color:#222}
    h1,h2,h3{font-weight:600} p{margin:0 0 .35rem} hr{border:0;border-top:1px solid #ccc;margin:1rem 0}
    @media print{body{margin:0}}</style></head>
    <body>${html}<script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
  return true;
}
