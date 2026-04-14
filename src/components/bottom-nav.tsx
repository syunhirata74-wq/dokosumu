"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, Sparkles, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "発見", Icon: Compass },
  { href: "/matches", label: "候補", Icon: Heart },
  { href: "/diagnosis", label: "診断", Icon: Sparkles },
  { href: "/profile", label: "プロフィール", Icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full text-xs transition-colors ${
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <item.Icon
                className="mb-0.5"
                size={22}
                strokeWidth={isActive ? 2.5 : 1.5}
                fill={isActive && item.Icon === Heart ? "currentColor" : "none"}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
