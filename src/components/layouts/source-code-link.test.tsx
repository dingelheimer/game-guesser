// SPDX-License-Identifier: AGPL-3.0-only
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceCodeLink } from "./source-code-link";

describe("SourceCodeLink", () => {
  it("renders a link to the GitHub repository with safe external-link attributes", () => {
    render(<SourceCodeLink>View Source</SourceCodeLink>);

    const link = screen.getByRole("link", { name: "View Source" });
    expect(link).toHaveAttribute("href", "https://github.com/dingelheimer/gamester");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("applies custom className", () => {
    render(<SourceCodeLink className="text-xs">Source</SourceCodeLink>);

    const link = screen.getByRole("link", { name: "Source" });
    expect(link).toHaveClass("text-xs");
  });
});
