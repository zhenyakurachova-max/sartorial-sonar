import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import { copy } from "@/lib/copy";

const REDIRECT_TO = `${window.location.origin}/app/interview`;

export default function Signup() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) return <Navigate to="/app/interview" replace />;

  const sendMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: REDIRECT_TO },
    });
    setBusy(false);
    if (error) setError(copy.signup.errorGeneric);
    else setSent(true);
  };

  const signInWithGoogle = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: REDIRECT_TO,
    });
    if ("error" in result && result.error) setError(copy.signup.errorGeneric);
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>

      <section className="flex-1 flex items-start justify-center px-6 pt-16 pb-12">
        <div className="w-full max-w-sm">
          {sent ? (
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
