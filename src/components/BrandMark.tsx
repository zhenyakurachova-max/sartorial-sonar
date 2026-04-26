import { copy } from "@/lib/copy";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif text-xl tracking-tight text-primary ${className}`}>
      {copy.brand}
    </span>
  );
}
