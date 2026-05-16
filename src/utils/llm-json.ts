/**
 * Parse JSON from LLM text (handles markdown fences and leading/trailing prose).
 */
export function parseJsonFromLlm<T = unknown>(text: string): T {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("AI returned an empty response");
  }

  const attempts = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/g, "").trim(),
  ];

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* try next */
    }
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]) as T;
    } catch {
      /* fall through */
    }
  }

  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as T;
    } catch {
      /* fall through */
    }
  }

  throw new Error("AI returned invalid JSON");
}
