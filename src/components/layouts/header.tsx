"use client";

import Link from "next/link";
import { Gamepad2, Trophy, HelpCircle, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "Play", icon: Gamepad2 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/rules", label: "Rules", icon: HelpCircle },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Header() {
  return (
    <header className="hidden border-b border-border/50 bg-surface-800/80 backdrop-blur-xl md:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Gamepad2 className="h-7 w-7 text-primary-400" />
          <span className="font-display text-xl font-bold tracking-tight text-text-primary">
            Game Guesser
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-all duration-200 hover:bg-surface-700 hover:text-text-primary"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
