import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Github } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("demo-dev");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function demoLogin() {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{
        success: boolean;
        data: { token: string; user: { id: string; username: string; role: string } };
      }>("/api/auth/demo", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      setSession(res.data.token, res.data.user);
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <Link to="/" className="text-sm text-[var(--muted)] hover:text-white">
          ← Back
        </Link>
        <h1
          className="mt-4 text-3xl font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Sign in to CodeAtlas
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Use GitHub OAuth for private repos, or continue with demo mode.
        </p>

        <a
          href="/api/auth/github"
          className="mt-6 flex items-center justify-center gap-2 w-full rounded-xl border border-[var(--border)] bg-white/5 py-3 text-sm font-medium hover:bg-white/10"
        >
          <Github size={16} /> Continue with GitHub
        </a>

        <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]">
          <div className="h-px flex-1 bg-[var(--border)]" />
          or demo
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <label className="block text-sm text-[var(--muted)] mb-2">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-black/30 px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />

        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}

        <button
          onClick={demoLogin}
          disabled={loading}
          className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-[#041018] bg-[linear-gradient(135deg,#3dd6c6,#7be7dc)] disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Continue in demo mode"}
        </button>
      </div>
    </div>
  );
}
