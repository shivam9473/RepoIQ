import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Code2, Network, Search } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-8 py-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[linear-gradient(135deg,#3dd6c6,#5b8cff)]" />
          <span
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            CodeAtlas AI
          </span>
        </div>
        <Link
          to="/login"
          className="text-sm px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-white/5"
        >
          Sign in
        </Link>
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-8 pt-16 pb-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl md:text-6xl leading-[1.05] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Understand any
            <br />
            codebase instantly
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
            className="mt-5 text-lg text-[var(--muted)] max-w-xl"
          >
            Import GitHub repositories, index them with AST-aware chunking and
            vector search, then ask natural language questions with cited answers.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-[#041018] bg-[linear-gradient(135deg,#3dd6c6,#7be7dc)]"
            >
              Launch platform <ArrowRight size={16} />
            </Link>
            <a
              href="https://github.com/shivam9473/RepoIQ"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm border border-[var(--border)] hover:bg-white/5"
            >
              View repository
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.55 }}
          className="glass rounded-2xl p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
        >
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)] mb-4">
            Core pipeline
          </div>
          <div className="space-y-3">
            {[
              { icon: Code2, title: "AST parsing", desc: "Tree-structure chunks for functions & classes" },
              { icon: Search, title: "Semantic search", desc: "Embeddings + Pinecone vector retrieval" },
              { icon: Network, title: "RAG answers", desc: "Streamed responses with code citations" },
            ].map((item) => (
              <div
                key={item.title}
                className="flex gap-3 rounded-xl border border-[var(--border)] bg-black/20 p-3"
              >
                <div className="h-10 w-10 rounded-lg bg-[rgba(91,140,255,0.15)] grid place-items-center text-[var(--accent-2)]">
                  <item.icon size={18} />
                </div>
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-[var(--muted)]">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
