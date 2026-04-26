import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        …
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/signup" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
