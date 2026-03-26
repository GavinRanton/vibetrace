import type { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://vibetrace.app";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const supabase = await createServerSupabaseClient();
    const { data: articles } = await supabase
      .from("articles")
      .select("slug, updated_at")
      .eq("published", true)
      .order("published_at", { ascending: false });

    const articleRoutes: MetadataRoute.Sitemap = (articles ?? []).map((article) => ({
      url: `${base}/blog/${article.slug}`,
      lastModified: article.updated_at ? new Date(article.updated_at) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

    return [...staticRoutes, ...articleRoutes];
  } catch {
    return staticRoutes;
  }
}
