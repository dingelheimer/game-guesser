import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="border-border/50 bg-surface-800 flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border p-8 text-center">
        <AlertTriangle className="text-destructive h-12 w-12" />
        <div className="space-y-2">
          <h1 className="font-display text-text-primary text-2xl font-bold">
            Authentication Error
          </h1>
          <p className="text-text-secondary text-sm">
            Something went wrong during sign-in. The link may have expired or already been used.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/auth/login">Try Again</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
