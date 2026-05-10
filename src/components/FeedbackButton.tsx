import { useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function FeedbackButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setRating(0);
    setMessage("");
    setDone(false);
  };

  const submit = async () => {
    if (!user || !rating || submitting) return;
    setSubmitting(true);
    await (supabase.from as any)("feedback").insert({
      user_id: user.id,
      rating,
      message: message.trim() || null,
    });
    setSubmitting(false);
    setDone(true);
    setTimeout(() => {
      setOpen(false);
      reset();
    }, 1500);
  };

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        aria-label="Give feedback"
        className="fixed bottom-20 right-4 z-40 h-10 w-10 rounded-full bg-background border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquare className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-normal">Your thoughts</DialogTitle>
          </DialogHeader>

          {done ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Thanks for the feedback.</p>
          ) : (
            <div className="space-y-5 pt-1">
              <div className="flex gap-1 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1.5 transition-transform active:scale-90"
                    aria-label={`${star} star`}
                  >
                    <Star
                      className="h-7 w-7 transition-colors"
                      fill={star <= rating ? "hsl(348,42%,30%)" : "none"}
                      stroke={star <= rating ? "hsl(348,42%,30%)" : "hsl(0,0%,70%)"}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think"
                rows={3}
                className="rounded-sm border-foreground/20 bg-transparent text-sm focus-visible:ring-primary resize-none"
              />
              <Button
                onClick={submit}
                disabled={!rating || submitting}
                className="w-full h-11 rounded-sm"
              >
                {submitting ? "Sending…" : "Submit"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
