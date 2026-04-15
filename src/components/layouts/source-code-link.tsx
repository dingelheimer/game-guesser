// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";

type SourceCodeLinkProps = {
  /** Extra classes for layout-specific sizing. */
  className?: string;
  /** Link content (icon + label). */
  children: ReactNode;
};

/** AGPL-3.0 Section 13 compliance link to the project's GitHub repository. */
export function SourceCodeLink({ className, children }: SourceCodeLinkProps) {
  return (
    <a
      href={siteConfig.repoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "text-text-disabled hover:text-primary-400 flex items-center gap-1 underline-offset-2 transition-colors hover:underline",
        className,
      )}
    >
      {children}
    </a>
  );
}
