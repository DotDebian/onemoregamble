export default defineEventHandler(() => {
  // Auth is resolved per request: the chat tries the Claude subscription
  // (`claude -p` / Agent SDK) first, then falls back to ANTHROPIC_API_KEY.
  // Either path works, so we don't pre-warn about a missing key — a genuine
  // "no auth at all" case surfaces as a clear message inside the chat itself.
  return { configured: true }
})
