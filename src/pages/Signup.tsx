import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { APPROVED_EMAILS } from "@/lib/approved-emails";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import { copy } from "@/lib/copy";

const REDIRECT_TO = "https://atylier.style/auth/callback";

function isApproved(email: string): boolean {
  if (APPROVED_EMAILS.length === 0) return true;
  return APPROVED_EMAILS.includes(email.trim().toLowerCase());
}

export default function Signup() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [waitlisted, setWaitlisted] = useState(
    new URLSearchParams(location.search).get("waitlisted") === "1",
  );
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) return <Navigate to="/app/interview" replace />;

  const sendMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isApproved(email)) {
      setWaitlisted(true);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: REDIRECT_TO },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  const signInWithGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: REDIRECT_TO },
    });
    if (error) setError(copy.signup.errorGeneric);
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>

      <section className="flex-1 flex items-start justify-center px-6 pt-16 pb-12">
        <div className="w-full max-w-sm">
          {waitlisted ? (
            <>
              <h1 className="font-serif text-3xl text-balance">You're on the list.</h1>
              <p className="mt-4 text-muted-foreground">
                Atylier is currently invite-only. We'll be in touch when a spot opens up.
              </p>
              <button
                type="button"
                onClick={() => { setWaitlisted(false); setEmail(""); }}
                className="mt-8 text-sm underline underline-offset-4 text-primary"
              >
                Try a different email
              </button>
            </>
          ) : sent ? (
            <>
              <h1 className="font-serif text-3xl text-balance">{copy.signup.sentHeading}</h1>
              <p className="mt-4 text-muted-foreground">{copy.signup.sentBody}</p>
              <button
                type="button"
                onClick={() => { setSent(false); setEmail(""); }}
                className="mt-8 text-sm underline underline-offset-4 text-primary"
              >
                Use a different email
              </button>
            </>
          ) : (
            <>
              <h1 className="font-serif text-3xl text-balance">{copy.signup.heading}</h1>
              <p className="mt-3 text-muted-foreground">{copy.signup.sub}</p>

              <form onSubmit={sendMagicLink} className="mt-10 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={copy.signup.emailPlaceholder}
                    className="h-12 rounded-sm border-foreground/20 bg-transparent focus-visible:ring-primary"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy || !email}
                  className="w-full h-12 rounded-sm"
                >
                  {busy ? copy.signup.sending : copy.signup.sendLink}
                </Button>
              </form>

              <div className="my-8 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                {copy.signup.or}
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={signInWithGoogle}
                className="w-full h-12 rounded-sm border-foreground/20"
              >
                {copy.signup.google}
              </Button>

              {error && (
                <p className="mt-6 text-sm text-destructive">{error}</p>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
