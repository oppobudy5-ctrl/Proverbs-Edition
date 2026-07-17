import { normalizeText } from "../ai-utils.js";

const THEME_RELATIONS = Object.freeze({
  "takut akan tuhan": Object.freeze(["hikmat", "ketaatan", "kekudusan"]),
  hikmat: Object.freeze(["ketaatan", "integritas", "keadilan", "disiplin"]),
  ketaatan: Object.freeze(["berkat", "kesetiaan", "pengharapan"]),
  kekudusan: Object.freeze(["iman", "ketaatan"]),
  iman: Object.freeze(["kesetiaan", "pengharapan", "doa"]),
  keadilan: Object.freeze(["belas kasih", "integritas"]),
  kasih: Object.freeze(["belas kasih", "keadilan"]),
  doa: Object.freeze(["iman", "hikmat", "pengharapan"]),
  integritas: Object.freeze(["keadilan", "kesetiaan"]),
  kerendahan: Object.freeze(["hikmat", "ketaatan"]),
  kesetiaan: Object.freeze(["kasih", "iman"]),
  disiplin: Object.freeze(["hikmat", "ketaatan"]),
  "belas kasih": Object.freeze(["kasih", "keadilan"]),
  pengharapan: Object.freeze(["iman", "kesetiaan"]),
});

/**
 * Produce an explainable theme path from themes that are present in canonical
 * evidence. Related labels are included only when the context already contains
 * them, so this never manufactures a new theological claim.
 */
export function buildThemePath(themes = []) {
  const labels = [...new Set(themes.map((theme) => String(theme || "").trim()).filter(Boolean))];
  const byNormalized = new Map(labels.map((label) => [normalizeText(label), label]));
  const links = [];

  for (const [normalized, label] of byNormalized) {
    for (const related of THEME_RELATIONS[normalized] || []) {
      const target = byNormalized.get(normalizeText(related));
      if (target) {
        links.push(Object.freeze({
          from: label,
          to: target,
          relationship: "canonical-theme-connection",
        }));
      }
    }
  }

  return Object.freeze({
    themes: Object.freeze(labels),
    links: Object.freeze(dedupeLinks(links)),
    path: Object.freeze(buildOrderedPath(labels, links)),
  });
}

function dedupeLinks(links) {
  const seen = new Set();
  return links.filter((link) => {
    const key = [link.from, link.to].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildOrderedPath(labels, links) {
  if (!labels.length) return [];
  if (!links.length) return labels.slice(0, 5);
  const ordered = [];
  for (const link of links) {
    if (!ordered.includes(link.from)) ordered.push(link.from);
    if (!ordered.includes(link.to)) ordered.push(link.to);
  }
  for (const label of labels) if (!ordered.includes(label)) ordered.push(label);
  return ordered.slice(0, 6);
}
