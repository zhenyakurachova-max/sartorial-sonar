import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const token_hash = params.get("token_hash");
      const type = params.get("type") as "magiclink" | "email" | null;

      if (token_hash && type) {
        // PKCE flow: verify the token hash from query params
        const { error } = await supabase.auth.verifyOtp({ token_hash, type });
        if (error) {
          navigate("/?auth_error=1", { replace: true });
          return;
        }
      } else {
        // Implicit flow: SDK auto-processes #access_token from the hash on init;
        // getSession() returns it if that already happened.
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/?auth_error=1", { replace: true });
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/", { replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("interview_complete")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.interview_complete) {
        navigate("/app/wardrobe", { replace: true });
      } else {
        navigate("/app/interview", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </main>
  );
}
