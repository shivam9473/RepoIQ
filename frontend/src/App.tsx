import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { AppShell } from "./components/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RepositoriesPage } from "./pages/RepositoriesPage";
import { RepositoryDetailPage } from "./pages/RepositoryDetailPage";
import { ChatPage } from "./pages/ChatPage";
import { InsightsPage } from "./pages/InsightsPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/app"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="repos" element={<RepositoriesPage />} />
        <Route path="repos/:id" element={<RepositoryDetailPage />} />
        <Route path="repos/:id/chat" element={<ChatPage />} />
        <Route path="repos/:id/insights" element={<InsightsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
