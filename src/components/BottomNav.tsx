import { Grid3X3, ShoppingBag, Target, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/app/wardrobe", label: "Wardrobe", Icon: Grid3X3 },
  { to: "/app/gaps", label: "Gaps", Icon: Target },
  { to: "/app/recommendations", label: "Recommendations", Icon: ShoppingBag },
  { to: "/app/profile", label: "Profile", Icon: UserRound },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto grid h-16 max-w-2xl grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors",
                isActive && "text-primary",
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}