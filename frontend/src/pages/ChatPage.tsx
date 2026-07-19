import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { streamAsk } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ArrowLeft, Send } from "lucide-react";

interface Citation {
  filePath: string;
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  score?: number;
}

interface ChatItem {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export function ChatPage() {
  const { id = "" } = useParams();
  const { token } = useAuth();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [streaming, setStreaming] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || !token || streaming) return;

    const q = question.trim();
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setStreaming(true);

    let assistant = "";
    let citations: Citation[] = [];
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      await streamAsk(
        token,
        { repositoryId: id, conversationId, question: q },
        (event) => {
          if (event.type === "conversation") {
            const data = event.data as { conversationId: string };
            setConversationId(data.conversationId);
          }
          if (event.type === "citations") {
            citations = event.data as Citation[];
          }
          if (event.type === "token") {
            assistant += String(event.data);
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = {
                role: "assistant",
                content: assistant,
                citations,
              };
              return copy;
            });
          }
          if (event.type === "done") {
            const data = event.data as { citations?: Citation[] };
            if (data?.citations) citations = data.citations;
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = {
                role: "assistant",
                content: assistant,
                citations,
              };
              return copy;
            });
          }
        }
      );
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: err instanceof Error ? err.message : "Failed to get answer",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            to={`/app/repos/${id}`}
            className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-white"
          >
            <ArrowLeft size={14} /> Back to repository
          </Link>
          <h1 className="text-2xl font-semibold mt-1" style={{ fontFamily: "var(--font-display)" }}>
            Repository Q&A
          </h1>
        </div>
      </div>

      <div className="glass rounded-2xl flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full grid place-items-center text-center text-[var(--muted)] px-6">
            <div>
              <p className="text-lg text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
                Ask anything about this codebase
              </p>
              <p className="text-sm">
                Try “Where is authentication handled?” or “Explain the indexing pipeline.”
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-3xl ${msg.role === "user" ? "ml-auto" : ""}`}
          >
            <div
              className={`rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-[rgba(91,140,255,0.18)] border border-[rgba(91,140,255,0.25)]"
                  : "bg-black/25 border border-[var(--border)]"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose-chat text-sm">
                  <ReactMarkdown>{msg.content || (streaming ? "▌" : "")}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
            {msg.citations && msg.citations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.citations.slice(0, 6).map((c, i) => (
                  <span
                    key={`${c.filePath}-${i}`}
                    className="text-[11px] rounded-lg border border-[var(--border)] px-2 py-1 text-[var(--muted)]"
                  >
                    {c.filePath}:{c.startLine}-{c.endLine} · {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="glass rounded-2xl p-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about architecture, functions, bugs, APIs..."
          className="flex-1 bg-transparent outline-none px-2 text-sm"
          disabled={streaming}
        />
        <button
          type="submit"
          disabled={streaming || !question.trim()}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-[#041018] bg-[linear-gradient(135deg,#3dd6c6,#7be7dc)] disabled:opacity-50"
        >
          <Send size={14} /> {streaming ? "Thinking..." : "Ask"}
        </button>
      </form>
    </div>
  );
}
