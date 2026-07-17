/**
 * Cloudflare Pages Function — /api/ai/*
 * Keeps API keys in Cloudflare environment bindings / secrets.
 */
import { handleAiProxyRequest, publicAiConfig } from "../../scripts/ai-proxy.mjs";

export async function onRequest(context) {
  const { request, params, env } = context;
  // Mirror Pages secrets into process.env for the shared proxy module.
  for (const [key, value] of Object.entries(env || {})) {
    if (typeof value === "string" && process.env[key] == null) {
      process.env[key] = value;
    }
  }

  const url = new URL(request.url);
  const parts = String(params?.path || "")
    .split("/")
    .filter(Boolean);
  const head = parts[0] || url.pathname.replace(/^\/api\/ai\/?/, "").split("/").filter(Boolean)[0] || "";

  if (head === "config" && request.method === "GET") {
    return Response.json(publicAiConfig(), { headers: { "Cache-Control": "no-store" } });
  }
  if (head === "health" && request.method === "GET") {
    const config = publicAiConfig();
    return Response.json({
      ok: true,
      providers: config.providers,
      defaultProvider: config.defaultProvider,
      healthTimestamp: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  }

  let body = {};
  if (request.method === "POST") {
    try { body = await request.json(); } catch { body = {}; }
  }

  const result = await handleAiProxyRequest({
    provider: head || "openai",
    method: request.method,
    body,
    signal: request.signal,
  });

  return new Response(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
