import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { GitBranch, Plus, RefreshCw } from "lucide-react";

interface Repo {
  id: string;
  fullName: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  statusMessage: string | null;
  totalFiles: number;
  totalChunks: number;
  isPrivate: boolean;
  language: string | null;
}

export function RepositoriesPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reposQuery = useQuery({
    queryKey: ["repos"],
    queryFn: async () => {
      const res = await api<{ success: boolean; data: Repo[] }>("/api/repos", { token });
      return res.data;
    },
    refetchInterval: (query) =>
      query.state.data?.some((r) => !["ready", "failed"].includes(r.status)) ? 3000 : false,
  });

  const githubQuery = useQuery({
    queryKey: ["github-repos"],
    queryFn: async () => {
      const res = await api<{ success: boolean; data: Array<{
        id: number;
        full_name: string;
        description: string | null;
        private: boolean;
        language: string | null;
        default_branch: string;
        clone_url: string;
        html_url: string;
        name: string;
        owner: { login: string };
      }> }>("/api/repos/github/list", { token });
      return res.data;
    },
  });

  const importMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api<{ success: boolean; data: Repo }>("/api/repos/import", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      return res.data;
    },
    onSuccess: () => {
      setFullName("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["repos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Repositories
        </h1>
        <p className="text-[var(--muted)] mt-1">
          Import public or private GitHub repos and track indexing progress.
        </p>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-medium mb-3 flex items-center gap-2">
          <Plus size={16} /> Import by full name
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="owner/repo (e.g. vercel/next.js)"
            className="flex-1 rounded-xl border border-[var(--border)] bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={() => importMutation.mutate({ fullName })}
            disabled={!fullName.includes("/") || importMutation.isPending}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#041018] bg-[linear-gradient(135deg,#3dd6c6,#7be7dc)] disabled:opacity-50"
          >
            {importMutation.isPending ? "Importing..." : "Import & index"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-medium mb-3">From GitHub</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {(githubQuery.data || []).slice(0, 8).map((repo) => (
            <button
              key={repo.id}
              onClick={() =>
                importMutation.mutate({
                  githubId: repo.id,
                  fullName: repo.full_name,
                  name: repo.name,
                  owner: repo.owner.login,
                  description: repo.description,
                  defaultBranch: repo.default_branch,
                  isPrivate: repo.private,
                  language: repo.language,
                  cloneUrl: repo.clone_url,
                  htmlUrl: repo.html_url,
                })
              }
              className="text-left rounded-xl border border-[var(--border)] px-4 py-3 hover:bg-white/5"
            >
              <div className="font-medium">{repo.full_name}</div>
              <div className="text-xs text-[var(--muted)] mt-1 line-clamp-2">
                {repo.description || "No description"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <RefreshCw size={14} />
          Auto-refreshes while indexing
        </div>
        {(reposQuery.data || []).map((repo) => (
          <Link
            key={repo.id}
            to={`/app/repos/${repo.id}`}
            className="glass rounded-2xl p-5 block hover:border-[rgba(61,214,198,0.35)] border border-transparent"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <GitBranch size={16} className="text-[var(--accent)]" />
                  <span className="font-medium">{repo.fullName}</span>
                </div>
                <p className="text-sm text-[var(--muted)] mt-1">
                  {repo.statusMessage || repo.description || "—"}
                </p>
              </div>
              <StatusBadge status={repo.status} progress={repo.progress} />
            </div>
            {repo.status !== "ready" && repo.status !== "failed" && (
              <div className="mt-4 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-[linear-gradient(90deg,#3dd6c6,#5b8cff)] transition-all"
                  style={{ width: `${repo.progress}%` }}
                />
              </div>
            )}
            <div className="mt-3 flex gap-4 text-xs text-[var(--muted)]">
              <span>{repo.totalFiles} files</span>
              <span>{repo.totalChunks} chunks</span>
              {repo.language && <span>{repo.language}</span>}
            </div>
          </Link>
        ))}
        {!reposQuery.isLoading && (reposQuery.data || []).length === 0 && (
          <p className="text-sm text-[var(--muted)]">No repositories imported yet.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, progress }: { status: string; progress: number }) {
  const color =
    status === "ready"
      ? "text-[var(--ok)] bg-[rgba(61,214,140,0.12)]"
      : status === "failed"
        ? "text-[var(--danger)] bg-[rgba(255,107,122,0.12)]"
        : "text-[var(--warn)] bg-[rgba(245,197,66,0.12)]";
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full ${color}`}>
      {status}
      {status !== "ready" && status !== "failed" ? ` · ${progress}%` : ""}
    </span>
  );
}
