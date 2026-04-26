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

      <section className="flex-1 px-6 pt-16 pb-12 max-w-md mx-auto w-full">
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
    </main>
  );
};

export default Index;
