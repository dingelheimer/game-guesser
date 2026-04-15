// SPDX-License-Identifier: AGPL-3.0-only
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
      <Skeleton className="bg-surface-700 h-10 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="bg-surface-700 h-48 rounded-xl" />
        ))}
      </div>
    </main>
  );
}
