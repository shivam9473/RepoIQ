import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ArrowLeft } from "lucide-react";

type Tab = "architecture" | "dependencies" | "readme" | "api" | "review" | "duplicates";

export function InsightsPage() {
  const { id = "" } = useParams();
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("architecture");

  const architecture = useQuery({
    queryKey: ["architecture", id],
    enabled: tab === "architecture",
    queryFn: async () => {
      const res = await api<{ success: boolean; data: {
        summary: string;
        layers: Array<{ name: string; description: string; files: string[] }>;
        entryPoints: string[];
        keyModules: Array<{ name: string; purpose: string }>;
      } }>(`/api/insights/${id}/architecture`, { token });
      return res.data;
    },
  });

  const deps = useQuery({
    queryKey: ["deps", id],
    enabled: tab === "dependencies",
    queryFn: async () => {
      const res = await api<{ success: boolean; data: {
        nodes: Array<{ id: string; label: string; type: string }>;
        edges: Array<{ id: string; source: string; target: string; label?: string }>;
      } }>(`/api/insights/${id}/dependencies`, { token });
      return res.data;
    },
  });

  const markdownQuery = useQuery({
    queryKey: ["md", tab, id],
    enabled: ["readme", "api", "review"].includes(tab),
    queryFn: async () => {
      const path =
        tab === "readme"
          ? "readme"
          : tab === "api"
            ? "api-docs"
            : "review";
      const res = await api<{ success: boolean; data: { markdown: string } }>(
        `/api/insights/${id}/${path}`,
        { token }
      );
      return res.data.markdown;
    },
  });

  const duplicates = useQuery({
    queryKey: ["duplicates", id],
    enabled: tab === "duplicates",
    queryFn: async () => {
      const res = await api<{ success: boolean; data: Array<{
        a: { filePath: string; name: string };
        b: { filePath: string; name: string };
        similarity: number;
      }> }>(`/api/insights/${id}/duplicates`, { token });
      return res.data;
    },
  });

  const initialNodes: Node[] = useMemo(
    () =>
      (deps.data?.nodes || []).map((n, i) => ({
        id: n.id,
        data: { label: n.label },
        position: {
          x: (i % 5) * 180,
          y: Math.floor(i / 5) * 110,
        },
        style: {
          background: "#121a2b",
          color: "#e8eef9",
          border: "1px solid rgba(148,163,184,0.25)",
          borderRadius: 10,
          fontSize: 12,
          width: 140,
        },
      })),
    [deps.data]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      (deps.data?.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: true,
        style: { stroke: "#3dd6c6" },
      })),
    [deps.data]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (tab === "dependencies" && deps.data) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [tab, deps.data, initialNodes, initialEdges, setNodes, setEdges]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "architecture", label: "Architecture" },
    { id: "dependencies", label: "Dependencies" },
    { id: "readme", label: "AI README" },
    { id: "api", label: "API Docs" },
    { id: "review", label: "Code Review" },
    { id: "duplicates", label: "Duplicates" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/app/repos/${id}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-white"
        >
          <ArrowLeft size={14} /> Back
        </Link>
        <h1 className="text-3xl font-semibold mt-1" style={{ fontFamily: "var(--font-display)" }}>
          Insights
        </h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-3 py-2 text-sm border ${
              tab === t.id
                ? "border-[rgba(61,214,198,0.45)] bg-[rgba(61,214,198,0.12)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass rounded-2xl p-5 min-h-[420px]">
        {tab === "architecture" && (
          <div className="space-y-4">
            {architecture.isLoading && <p className="text-[var(--muted)]">Analyzing architecture...</p>}
            {architecture.data && (
              <>
                <p className="text-sm leading-relaxed">{architecture.data.summary}</p>
                <div className="grid md:grid-cols-2 gap-3">
                  {architecture.data.layers.map((layer) => (
                    <div key={layer.name} className="rounded-xl border border-[var(--border)] p-3">
                      <div className="font-medium">{layer.name}</div>
                      <div className="text-sm text-[var(--muted)] mt-1">{layer.description}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="font-medium mb-2">Entry points</h3>
                  <div className="flex flex-wrap gap-2">
                    {architecture.data.entryPoints.map((ep) => (
                      <span key={ep} className="text-xs font-mono rounded-lg bg-black/30 px-2 py-1">
                        {ep}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "dependencies" && (
          <div className="h-[480px]">
            {deps.isLoading ? (
              <p className="text-[var(--muted)]">Building dependency graph...</p>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
              >
                <Background color="#334155" gap={18} />
                <MiniMap
                  nodeColor="#3dd6c6"
                  maskColor="rgba(8,16,28,0.8)"
                  style={{ background: "#0b1220" }}
                />
                <Controls />
              </ReactFlow>
            )}
          </div>
        )}

        {["readme", "api", "review"].includes(tab) && (
          <div className="prose-chat text-sm">
            {markdownQuery.isLoading && <p className="text-[var(--muted)]">Generating...</p>}
            {markdownQuery.data && <ReactMarkdown>{markdownQuery.data}</ReactMarkdown>}
          </div>
        )}

        {tab === "duplicates" && (
          <div className="space-y-3">
            {duplicates.isLoading && <p className="text-[var(--muted)]">Scanning for similar code...</p>}
            {(duplicates.data || []).length === 0 && !duplicates.isLoading && (
              <p className="text-sm text-[var(--muted)]">No strong duplicates detected.</p>
            )}
            {duplicates.data?.map((pair, i) => (
              <div key={i} className="rounded-xl border border-[var(--border)] p-3 text-sm">
                <div>
                  <span className="font-mono text-[var(--accent)]">{pair.a.name}</span>
                  <span className="text-[var(--muted)]"> in {pair.a.filePath}</span>
                </div>
                <div className="my-1 text-[var(--muted)]">≈ similar to</div>
                <div>
                  <span className="font-mono text-[var(--accent-2)]">{pair.b.name}</span>
                  <span className="text-[var(--muted)]"> in {pair.b.filePath}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
