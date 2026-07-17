export const AI_MESSAGE_ROLES = Object.freeze(["system", "user", "assistant"]);

export function createAIMessage({ role, content, metadata = {}, timestamp = new Date().toISOString() }) {
  if (!AI_MESSAGE_ROLES.includes(role)) throw new TypeError(`Invalid AI message role: ${role}`);
  if (typeof content !== "string" || !content.trim()) throw new TypeError("AI message content must be a non-empty string");
  return Object.freeze({ role, content: content.trim(), metadata: { ...metadata }, timestamp });
}

export function isAIMessage(value) {
  return !!value && AI_MESSAGE_ROLES.includes(value.role) && typeof value.content === "string";
}
