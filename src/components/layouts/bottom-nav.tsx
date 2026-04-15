// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import Link from "next/link";
import { Gamepad2, Trophy, HelpCircle, User, LogIn } from "lucide-react";

/** Props for the mobile bottom navigation bar. */
export type BottomNavProps = {
  /** Authenticated user's username, or null for guests. */
  username: string | null;
};

/** Mobile-only bottom navigation bar with auth-aware profile link. */
export function BottomNav({ username }: BottomNavProps) {
  const navItems = [
    { href: "/play", label: "Play", icon: Gamepad2 },
    { href: "/leaderboard", label: "Board", icon: Trophy },
    { href: "/rules", label: "Rules", icon: HelpCircle },
    username !== null
      ? { href: "/profile", label: "Profile", icon: User }
      : { href: "/auth/login", label: "Log In", icon: LogIn },
  ] as const;

  return (
    <nav className="border-border/50 bg-surface-800/90 fixed right-0 bottom-0 left-0 z-40 border-t backdrop-blur-xl md:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-text-secondary hover:text-text-primary flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 transition-all duration-200 active:scale-95"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
