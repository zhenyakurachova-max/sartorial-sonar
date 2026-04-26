import { BrandMark } from "@/components/BrandMark";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function WardrobeStub() {
  const { signOut } = useAuth();
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8 flex items-center justify-between">
        <BrandMark />
        <button onClick={signOut} className="text-xs uppercase tracking-wider text-muted-foreground">
          Sign out
        </button>
      </header>
      <section className="flex-1 px-6 pt-16 pb-12 max-w-md mx-auto w-full">
        <h1 className="font-serif text-3xl">Your wardrobe</h1>
        <p className="mt-6 text-muted-foreground text-pretty">{copy.empty.wardrobe}</p>
        <Button className="mt-10 rounded-sm" disabled>
          Coming next
        </Button>
      </section>
    </main>
  );
}
