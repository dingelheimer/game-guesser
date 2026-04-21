// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { DailyGamePage } from "./DailyGamePage";

export const metadata: Metadata = {
  title: "Daily Challenge",
  description:
    "Play today's daily challenge — the same 11 games for everyone. How does your score compare?",
};

export default function DailyPage() {
  return <DailyGamePage />;
}
