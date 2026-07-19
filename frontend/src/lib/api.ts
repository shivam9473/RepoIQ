const API_BASE = import.meta.env.VITE_API_URL || "";

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || res.statusText || "Request failed");
  }
  return json as T;
}

export async function streamAsk(
  token: string,
  body: { repositoryId: string; conversationId?: string; question: string },
  onEvent: (event: { type: string; data: unknown }) => void
) {
  const res = await fetch(`${API_BASE}/api/chat/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Streaming failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.replace(/^data:\s*/, "");
      if (payload === "[DONE]") return;
      try {
        onEvent(JSON.parse(payload));
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
