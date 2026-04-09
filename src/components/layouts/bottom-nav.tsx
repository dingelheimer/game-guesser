"use client";

import Link from "next/link";
import { Gamepad2, Trophy, HelpCircle, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "Play", icon: Gamepad2 },
  { href: "/leaderboard", label: "Board", icon: Trophy },
  { href: "/rules", label: "Rules", icon: HelpCircle },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-surface-800/90 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-text-secondary transition-all duration-200 hover:text-text-primary active:scale-95"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
