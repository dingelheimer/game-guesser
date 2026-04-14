import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: getSiteUrl(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getSiteUrl("/rules"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: getSiteUrl("/leaderboard"),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: getSiteUrl("/play/solo"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
