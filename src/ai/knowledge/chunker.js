// =============================================================================
// chunker.js — Pemecah teks menjadi chunk 200–400 token.
//
// Aturan:
//  - Chunk TIDAK memotong paragraf. Batas paragraf = baris kosong.
//  - Jika satu paragraf melebihi batas maksimum, dipecah pada batas kalimat.
//  - Setiap chunk mempertahankan konteks (judul/opsi prefix) untuk retrieval.
// =============================================================================

import { estimateTokens } from "./schema.js";

const TARGET_MIN = 200;
const TARGET_MAX = 400;

/**
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.min=200]
 * @param {number} [options.max=400]
 * @param {string} [options.prefix] Konteks yang diikutkan di awal setiap chunk (mis. judul).
 * @returns {{ text: string, order: number, estimatedTokens: number }[]}
 */
export function chunkText(text, options = {}) {
  const min = options.min ?? TARGET_MIN;
  const max = options.max ?? TARGET_MAX;
  const prefix = options.prefix ? `${String(options.prefix).trim()}\n\n` : "";

  const paragraphs = splitParagraphs(text);
  const chunks = [];
  let current = [];
  let currentTokens = 0;

  const flush = () => {
    if (!current.length) return;
    const body = current.join("\n\n").trim();
    chunks.push(body);
    current = [];
    currentTokens = 0;
  };

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    // Paragraf tunggal terlalu besar → pecah per kalimat.
    if (paragraphTokens > max) {
      flush();
      for (const piece of splitLargeParagraph(paragraph, max)) {
        chunks.push(piece.trim());
      }
      continue;
    }

    // Menambah paragraf akan melewati batas maksimum → tutup chunk dulu.
    if (currentTokens + paragraphTokens > max && currentTokens >= min) {
      flush();
    }

    current.push(paragraph);
    currentTokens += paragraphTokens;

    // Sudah cukup besar → tutup.
    if (currentTokens >= max) flush();
  }
  flush();

  return chunks
    .filter(Boolean)
    .map((body, index) => {
      const withPrefix = `${prefix}${body}`;
      return {
        text: withPrefix,
        order: index,
        estimatedTokens: estimateTokens(withPrefix),
      };
    });
}

function splitParagraphs(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitLargeParagraph(paragraph, max) {
  const sentences = paragraph.match(/[^.!?]+[.!?]*\s*/g) || [paragraph];
  const pieces = [];
  let buffer = "";
  let bufferTokens = 0;
  for (const sentence of sentences) {
    const tokens = estimateTokens(sentence);
    if (bufferTokens + tokens > max && buffer) {
      pieces.push(buffer.trim());
      buffer = "";
      bufferTokens = 0;
    }
    buffer += sentence;
    bufferTokens += tokens;
  }
  if (buffer.trim()) pieces.push(buffer.trim());
  return pieces;
}
