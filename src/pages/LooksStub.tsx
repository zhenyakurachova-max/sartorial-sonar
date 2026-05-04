import { Sparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export default function LooksStub() {
  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>
      <section className="mx-auto w-full max-w-2xl px-6 pt-10">
        <h1 className="font-serif text-3xl">Looks.</h1>
        <div className="mt-24 flex flex-col items-center text-center gap-5">
          <Sparkles className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-muted-foreground max-w-xs text-pretty">
            Your looks are being put together.
          </p>
        </div>
      </section>
    </main>
  );
}
