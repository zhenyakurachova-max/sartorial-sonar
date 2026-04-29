import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export default function GapsStub() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8 flex items-center justify-between">
        <BrandMark />
        <Link
          to="/app/wardrobe"
          className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Wardrobe
        </Link>
      </header>
      <section className="flex-1 px-6 pt-10 pb-16 max-w-2xl mx-auto w-full">
        <h1 className="font-serif text-3xl">Your gaps</h1>
        <p className="mt-6 text-muted-foreground">
          Coming next — the wardrobe gaps view.
        </p>
      </section>
    </main>
  );
}
