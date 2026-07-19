import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { MessageSquare, Network, RefreshCw, Sparkles } from "lucide-react";

interface Repo {
  id: string;
  fullName: string;
  status: string;
  progress: number;
  statusMessage: string | null;
  errorMessage: string | null;
  totalFiles: number;
  totalChunks: number;
  totalEmbeddings: number;
  totalFunctions: number;
  totalClasses: number;
  htmlUrl: string;
}

interface ChunkRow {
  id: string;
  file_path: string;
  language: string;
  kind: string;
  name: string;
  start_line: number;
  end_line: number;
  content_preview: string;
}

export function RepositoryDetailPage() {
  const { id = "" } = useParams();
  const { token } = useAuth();
  const qc = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const repoQuery = useQuery({
    queryKey: ["repo", id],
    queryFn: async () => {
      const res = await api<{ success: boolean; data: Repo }>(`/api/repos/${id}`, { token });
      return res.data;
    },
    refetchInterval: (q) =>
      q.state.data && !["ready", "failed"].includes(q.state.data.status) ? 2500 : false,
  });

  const chunksQuery = useQuery({
    queryKey: ["chunks", id],
    enabled: !!repoQuery.data && repoQuery.data.status === "ready",
    queryFn: async () => {
      const res = await api<{ success: boolean; data: ChunkRow[] }>(
        `/api/repos/${id}/chunks?limit=100`,
        { token }
      );
      return res.data;
    },
  });

  const files = useMemo(() => {
    const set = new Set((chunksQuery.data || []).map((c) => c.file_path));
    return [...set].sort();
  }, [chunksQuery.data]);

  const fileChunks = (chunksQuery.data || []).filter((c) => c.file_path === selectedFile);
  const editorValue = fileChunks.map((c) => c.content_preview).join("\n\n// --- next symbol ---\n\n");

  const reindex = useMutation({
    mutationFn: async () => {
      await api(`/api/repos/${id}/reindex`, { method: "POST", token });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repo", id] });
      qc.invalidateQueries({ queryKey: ["repos"] });
    },
  });

  const repo = repoQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            {repo?.fullName || "Repository"}
          </h1>
          <p className="text-[var(--muted)] mt-1">
            {repo?.statusMessage || "Loading repository details..."}
          </p>
          {repo?.errorMessage && (
            <p className="text-sm text-[var(--danger)] mt-2">{repo.errorMessage}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => reindex.mutate()}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            <RefreshCw size={14} /> Reindex
          </button>
          <Link
            to={`/app/repos/${id}/chat`}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#041018] bg-[linear-gradient(135deg,#3dd6c6,#7be7dc)]"
          >
            <MessageSquare size={14} /> Ask AI
          </Link>
          <Link
            to={`/app/repos/${id}/insights`}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            <Network size={14} /> Insights
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["Status", repo?.status || "—"],
          ["Files", repo?.totalFiles ?? "—"],
          ["Chunks", repo?.totalChunks ?? "—"],
          ["Functions", repo?.totalFunctions ?? "—"],
          ["Embeddings", repo?.totalEmbeddings ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="glass rounded-xl p-4">
            <div className="text-xs text-[var(--muted)]">{label}</div>
            <div className="mt-1 text-lg font-semibold capitalize">{value}</div>
          </div>
        ))}
      </div>

      {repo && !["ready", "failed"].includes(repo.status) && (
        <div className="glass rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Indexing progress</span>
            <span>{repo.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-[linear-gradient(90deg,#3dd6c6,#5b8cff)]"
              style={{ width: `${repo.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-4 min-h-[480px]">
        <div className="glass rounded-2xl p-3 overflow-auto">
          <div className="text-xs uppercase tracking-wider text-[var(--muted)] px-2 py-2">
            Indexed files
          </div>
          {files.length === 0 && (
            <p className="text-sm text-[var(--muted)] px-2 py-3">
              {repo?.status === "ready" ? "No chunks yet." : "Waiting for index..."}
            </p>
          )}
          {files.map((file) => (
            <button
              key={file}
              onClick={() => setSelectedFile(file)}
              className={`w-full text-left text-xs font-mono px-2 py-2 rounded-lg truncate ${
                selectedFile === file ? "bg-[rgba(61,214,198,0.12)] text-[var(--accent)]" : "hover:bg-white/5"
              }`}
            >
              {file}
            </button>
          ))}
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 text-sm">
            <Sparkles size={14} className="text-[var(--accent)]" />
            {selectedFile || "Select a file to preview symbols"}
          </div>
          <Editor
            height="420px"
            theme="vs-dark"
            language={fileChunks[0]?.language || "typescript"}
            value={editorValue || "// Import and index a repository to browse AST chunks"}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 13,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      </div>
    </div>
  );
}
