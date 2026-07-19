import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const { setSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      setSession(token);
      navigate("/app", { replace: true });
    } else {
      navigate("/login?error=oauth", { replace: true });
    }
  }, [params, setSession, navigate]);

  return (
    <div className="min-h-screen grid place-items-center text-[var(--muted)]">
      Completing GitHub sign-in...
    </div>
  );
}
