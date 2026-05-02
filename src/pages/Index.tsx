import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { session } = useAuth();

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>

      <section className="px-6 pt-16 pb-12 max-w-md mx-auto w-full">
        <h1 className="font-serif text-4xl leading-tight text-balance">
          An honest look at what's in your wardrobe.
        </h1>
        <p className="mt-6 text-base text-muted-foreground text-pretty">
          Photograph every piece. Get a verdict on each one — keep, dump, or gap. Then a shopping
          list of what's actually missing.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <Button asChild size="lg" className="rounded-sm">
            <Link to={session ? "/app/interview" : "/signup"}>
              {session ? "Continue" : "Begin"}
            </Link>
          </Button>
          {!session && (
            <p className="text-xs text-muted-foreground text-center">
              Free to start. No card needed.
            </p>
          )}
        </div>
      </section>
      <section className="border-t border-border px-6 py-12">
        <div className="mx-auto grid w-full max-w-3xl gap-6 md:grid-cols-3">
          {[
            ["1", "Tell us your style", "a 10-minute interview that actually listens."],
            ["2", "Photograph your wardrobe", "every piece gets an honest verdict."],
            ["3", "Shop with intention", "specific pieces, named designers, no guessing."],
          ].map(([num, title, body]) => (
            <article key={num} className="border-l border-primary pl-4">
              <p className="text-xs uppercase tracking-wider text-primary">{num}</p>
              <h2 className="mt-3 font-serif text-2xl leading-tight">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Index;
