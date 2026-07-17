// =============================================================================
// crypto.js — Stub enkripsi jurnal (AES-GCM siap di fase berikutnya).
// AI-07: no-op passthrough; arsitektur sync/encryption-ready saja.
// =============================================================================

export const JournalCrypto = Object.freeze({
  isEnabled() {
    return false;
  },

  async encrypt(plaintext) {
    return plaintext;
  },

  async decrypt(ciphertext) {
    return ciphertext;
  },

  async wrapEntries(entries) {
    return entries;
  },

  async unwrapEntries(entries) {
    return entries;
  },
});
