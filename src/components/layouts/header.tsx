import Link from "next/link";
import { Gamepad2, Trophy, HelpCircle, LogIn, UserPlus, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";

const navItems = [
  { href: "/play", label: "Play", icon: Gamepad2 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/rules", label: "Rules", icon: HelpCircle },
] as const;

/** Props for the site header. */
export type HeaderProps = {
  /** Authenticated user's username, or null for guests. */
  username: string | null;
};

/** Site header with logo, navigation, and auth state display. Server Component. */
export function Header({ username }: HeaderProps) {
  return (
    <header className="border-border/50 bg-surface-800/80 hidden border-b backdrop-blur-xl md:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Gamepad2 className="text-primary-400 h-7 w-7" />
          <span className="font-display text-text-primary text-xl font-bold tracking-tight">
            Game Guesser
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-text-secondary hover:bg-surface-700 hover:text-text-primary flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-border/50 ml-2 flex items-center gap-2 border-l pl-2">
            {username !== null ? (
              <>
                <Link
                  href="/profile"
                  className="text-text-secondary hover:bg-surface-700 hover:text-text-primary flex max-w-[160px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200"
                >
                  <User className="h-4 w-4 shrink-0" />
                  <span className="truncate">{username}</span>
                </Link>
                <form action={signOutAction}>
                  <Button type="submit" variant="ghost" size="sm" className="gap-2">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </form>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth/login" className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Log In
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/auth/signup" className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Sign Up
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
