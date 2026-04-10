import type { Metadata } from "next";
import { SoloGamePage } from "./SoloGamePage";

export const metadata: Metadata = {
  title: "Solo Mode",
  description: "Place games in chronological order — how far can you go?",
};

export default function PlaySoloPage() {
  return <SoloGamePage />;
}
