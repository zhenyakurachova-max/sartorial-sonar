import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { APPROVED_EMAILS } from "@/lib/approved-emails";
import { supabase } from "@/integrations/supabase/client";

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

  if (
    APPROVED_EMAILS.length > 0 &&
    session.user?.email &&
    !APPROVED_EMAILS.includes(session.user.email.toLowerCase())
  ) {
    supabase.auth.signOut();
    return <Navigate to="/signup?waitlisted=1" replace />;
  }

  return <>{children}</>;
}
