import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Boxes, FileCode2, Layers3, MessageSquare, Sparkles } from "lucide-react";

interface DashboardData {
  repositories: number;
  readyRepos: number;
  indexingRepos: number;
  totalFiles: number;
  totalFunctions: number;
  totalClasses: number;
  totalEmbeddings: number;
  recentChats: Array<{ id: string; title: string; repository_id: string; updated_at: string }>;
  searchHistory: Array<{ id: string; query: string; created_at: string }>;
}

export function DashboardPage() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await api<{ success: boolean; data: DashboardData }>("/api/dashboard", {
        token,
      });
      return res.data;
    },
  });

  const cards = [
    { label: "Repositories", value: data?.repositories ?? 0, icon: Boxes },
    { label: "Files indexed", value: data?.totalFiles ?? 0, icon: FileCode2 },
    { label: "Functions / classes", value: (data?.totalFunctions ?? 0) + (data?.totalClasses ?? 0), icon: Layers3 },
    { label: "Embeddings", value: data?.totalEmbeddings ?? 0, icon: Sparkles },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Dashboard
          </h1>
          <p className="text-[var(--muted)] mt-1">
            Indexing status, embeddings, and recent activity across your repos.
          </p>
        </div>
        <Link
          to="/app/repos"
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#041018] bg-[linear-gradient(135deg,#3dd6c6,#7be7dc)]"
        >
          Import repository
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--muted)]">{card.label}</span>
              <card.icon size={16} className="text-[var(--accent)]" />
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">
              {isLoading ? "—" : card.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={16} className="text-[var(--accent-2)]" />
            <h2 className="font-medium">Recent chats</h2>
          </div>
          <div className="space-y-2">
            {(data?.recentChats || []).length === 0 && (
              <p className="text-sm text-[var(--muted)]">No chats yet. Ask a question after indexing.</p>
            )}
            {data?.recentChats.map((chat) => (
              <Link
                key={chat.id}
                to={`/app/repos/${chat.repository_id}/chat`}
                className="block rounded-xl border border-[var(--border)] px-3 py-2.5 hover:bg-white/5"
              >
                <div className="text-sm truncate">{chat.title}</div>
                <div className="text-xs text-[var(--muted)]">
                  {new Date(chat.updated_at).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-medium mb-4">Search history</h2>
          <div className="space-y-2">
            {(data?.searchHistory || []).length === 0 && (
              <p className="text-sm text-[var(--muted)]">Semantic searches will appear here.</p>
            )}
            {data?.searchHistory.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[var(--border)] px-3 py-2.5"
              >
                <div className="text-sm">{item.query}</div>
                <div className="text-xs text-[var(--muted)]">
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 flex flex-wrap gap-6 text-sm">
        <div>
          <div className="text-[var(--muted)]">Ready</div>
          <div className="text-xl font-semibold text-[var(--ok)]">{data?.readyRepos ?? 0}</div>
        </div>
        <div>
          <div className="text-[var(--muted)]">Indexing</div>
          <div className="text-xl font-semibold text-[var(--warn)]">{data?.indexingRepos ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
