import { AI_CONFIG } from "../../../config/ai.config.js";
import { ProviderBase } from "./provider-base.js";
import { AIError, AI_ERROR_CODES, sleep } from "../ai-utils.js";

export class MockProvider extends ProviderBase {
  constructor(options = {}) {
    super({ id: "mock", model: options.model || AI_CONFIG.models.mock, endpoint: "" });
    this.latencyMs = Number.isFinite(options.latencyMs) ? options.latencyMs : 80;
  }

  async sendPrompt(request, options = {}) {
    if (options.signal?.aborted) throw new AIError(AI_ERROR_CODES.CANCELLED);
    await sleep(this.latencyMs, options.signal);
    return {
      content: buildMockAnswer(request),
      model: this.model,
      usage: { promptTokens: estimateTokens(JSON.stringify(request.messages)), completionTokens: 120 },
      metadata: { mock: true, deterministic: true },
    };
  }

  async *stream(request, options = {}) {
    const answer = buildMockAnswer(request);
    const chunks = answer.match(/\S+\s*/g) || [];
    for (const chunk of chunks) {
      if (options.signal?.aborted) throw new AIError(AI_ERROR_CODES.CANCELLED);
      await sleep(8, options.signal);
      yield chunk;
    }
  }

  async embeddings(input) {
    const values = Array.isArray(input) ? input : [input];
    return values.map((value) => deterministicVector(String(value), 16));
  }

  async healthCheck() {
    return { ok: true, provider: this.id, model: this.model, mode: "mock", latencyMs: this.latencyMs };
  }

  get capabilities() {
    return Object.freeze({ prompt: true, streaming: true, embeddings: true, mock: true });
  }
}

function buildMockAnswer(request = {}) {
  const meta = request.metadata || {};
  const context = meta.context || {};
  const title = context.title || "bacaan hari ini";
  const chapter = context.book && context.chapter ? `${context.book} ${context.chapter}` : "pasal ini";
  const verse = context.goldenVerse?.text ? ` Ayat emasnya mengingatkan: “${context.goldenVerse.text}”` : "";
  const question = meta.question || extractLastUserMessage(request.messages) || "";

  switch (meta.intent) {
    case "summary":
      return `Ringkasan contoh untuk ${chapter}, “${title}”: hikmat Tuhan membentuk hati, perkataan, dan keputusan nyata. Bacalah konteks pasal secara utuh, perhatikan tema utamanya, lalu pilih satu tindakan taat yang dapat dilakukan hari ini.${verse}`;
    case "reflection":
      return `Refleksi contoh untuk “${title}”: bagian mana yang paling menegur atau menguatkanmu? Bawalah responsmu dalam doa, lalu tuliskan satu keputusan sederhana yang dapat kamu jalani dengan pertolongan Tuhan.${verse}`;
    case "journal-reflection":
      return [
        "Ringkasan (contoh): tulisanmu menyoroti pergumulan dan respons iman yang sedang kamu proses.",
        "Tema: hikmat praktis, doa, dan langkah taat yang konkret.",
        chapter ? `Kaitan bacaan: ${chapter}${title ? ` (“${title}”)` : ""} dapat menjadi cermin untuk keputusanmu.` : "",
        "Pertanyaan lanjutan: Apa satu kebenaran yang paling ingin kamu pegang minggu ini? Siapa yang dapat menolongmu bertumbuh? Langkah kecil apa yang realistis untuk hari ini?",
      ].filter(Boolean).join(" ");
    case "search":
      return `Hasil contoh AI disusun dari indeks lokal Bible Time. Topik “${question || title}” paling baik dipahami dengan membuka konteks pasal yang ditemukan, membandingkan tema dan ayat emasnya, lalu membaca teks Alkitab lengkap.`;
    case "explain":
      return `Penjelasan contoh untuk ${chapter}: tema “${title}” menekankan hikmat yang bukan sekadar pengetahuan, tetapi kecakapan hidup di hadapan Tuhan. Perhatikan konteks sastra, tujuan nasihat, dan penerapannya tanpa melepaskan ayat dari pasal.${verse}`;
    case "wisdom":
      return `Respons hikmat contoh: pertimbangkan pilihanmu dalam terang takut akan Tuhan, kebenaran, kasih, dan dampaknya bagi sesama. Jangan terburu-buru; mintalah nasihat yang dewasa dan ambil langkah yang jujur serta dapat dipertanggungjawabkan.`;
    default:
      return `Jawaban contoh untuk pertanyaan “${question || "tentang bacaan ini"}”: ${chapter} mengarahkan kita kepada tema “${title}”. Mulailah dari konteks pasal, renungkan ayat emas, lalu hubungkan kebenaran itu dengan satu respons iman yang konkret.${verse}`;
  }
}

function extractLastUserMessage(messages = []) {
  return [...messages].reverse().find((message) => message.role === "user")?.content || "";
}

function estimateTokens(value) {
  return Math.max(1, Math.ceil(String(value).length / 4));
}

function deterministicVector(value, dimensions) {
  const vector = new Array(dimensions).fill(0);
  for (let index = 0; index < value.length; index++) {
    vector[index % dimensions] += ((value.charCodeAt(index) % 31) - 15) / 15;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0)) || 1;
  return vector.map((item) => item / magnitude);
}
