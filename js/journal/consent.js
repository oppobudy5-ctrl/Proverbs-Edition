// =============================================================================
// consent.js — Izin eksplisit sebelum isi jurnal dikirim ke LLM.
// =============================================================================
import { readJSON, writeJSON, emitChange } from "../safe-store.js";

const KEY = "bibleTime.journal.aiConsent.v1";

export const JOURNAL_AI_CONSENT_COPY =
  "AI akan menggunakan jurnal ini untuk membantu membuat ringkasan dan refleksi. Anda dapat menolak atau mencabut izin kapan saja.";

export function getJournalConsent() {
  const data = readJSON(KEY, { granted: false, grantedAt: null, revokedAt: null });
  return {
    granted: !!data.granted,
    grantedAt: data.grantedAt || null,
    revokedAt: data.revokedAt || null,
  };
}

export function isJournalAiConsentGranted() {
  return getJournalConsent().granted === true;
}

export function grantJournalAiConsent() {
  const record = {
    granted: true,
    grantedAt: new Date().toISOString(),
    revokedAt: null,
  };
  writeJSON(KEY, record);
  emitChange("journal-consent", record);
  return record;
}

export function revokeJournalAiConsent() {
  const prev = getJournalConsent();
  const record = {
    granted: false,
    grantedAt: prev.grantedAt,
    revokedAt: new Date().toISOString(),
  };
  writeJSON(KEY, record);
  emitChange("journal-consent", record);
  // Best-effort: hapus artefak AI yang mungkin diturunkan dari jurnal.
  purgeJournalAiArtifacts().catch(() => {});
  return record;
}

export function clearJournalAiConsent() {
  writeJSON(KEY, { granted: false, grantedAt: null, revokedAt: null });
  emitChange("journal-consent", { cleared: true });
  purgeJournalAiArtifacts().catch(() => {});
}

/** Hapus cache/percakapan AI lokal (ringkasan jurnal bisa tersimpan di sana). */
export async function purgeJournalAiArtifacts() {
  try {
    const { conversationStore } = await import("../../src/ai/conversation-store.js");
    const { aiCache } = await import("../../src/ai/ai-cache.js");
    await conversationStore.clear?.();
    await aiCache.clear?.();
  } catch {
    /* AI store opsional / offline */
  }
}
