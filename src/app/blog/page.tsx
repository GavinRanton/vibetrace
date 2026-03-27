import type { Metadata } from "next";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | VibeTrace",
  description: "Security guides, vulnerability deep-dives, and DevSecOps best practices from the VibeTrace team.",
  openGraph: {
    title: "Blog | VibeTrace",
    description: "Security guides, vulnerability deep-dives, and DevSecOps best practices from the VibeTrace team.",
    url: "https://vibetrace.app/blog",
    siteName: "VibeTrace",
    type: "website",
  },
  alternates: {
    canonical: "https://vibetrace.app/blog",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  "security-guides": "Security Guides",
  "vulnerability-types": "Vulnerability Types",
  "devsecops": "DevSecOps",
  "product-updates": "Product Updates",
};

const CATEGORY_COLORS: Record<string, string> = {
  "security-guides": "bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20",
  "vulnerability-types": "bg-red-500/10 text-red-400 border-red-500/20",
  "devsecops": "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20",
  "product-updates": "bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20",
};

type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image: string | null;
  category: string;
  tags: string[];
  published_at: string | null;
  author_name: string;
};

async function getArticles(category?: string): Promise<Article[]> {
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("articles")
    .select("id, slug, title, excerpt, cover_image, category, tags, published_at, author_name")
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data } = await query;
  return data ?? [];
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const articles = await getArticles(category);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <img src="/branding/logo-icon-dark.svg" alt="VibeTrace" className="w-7 h-7" />
          <span className="font-semibold">VibeTrace</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-white/50" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button size="sm" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
            <Link href="/scan">Start scanning</Link>
          </Button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20">
            Blog
          </Badge>
          <h1 className="text-5xl font-bold mb-4">Security insights</h1>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            Guides, vulnerability deep-dives, and DevSecOps best practices from the VibeTrace team.
          </p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 justify-center mb-12">
          <Link href="/blog">
            <Badge
              className={`cursor-pointer px-3 py-1 text-sm border transition-colors ${
                !category
                  ? "bg-[#3B82F6] text-white border-[#3B82F6]"
                  : "bg-white/5 text-white/50 border-white/10 hover:border-white/20 hover:text-white/70"
              }`}
            >
              All
            </Badge>
          </Link>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <Link key={key} href={`/blog?category=${key}`}>
              <Badge
                className={`cursor-pointer px-3 py-1 text-sm border transition-colors ${
                  category === key
                    ? "bg-[#3B82F6] text-white border-[#3B82F6]"
                    : "bg-white/5 text-white/50 border-white/10 hover:border-white/20 hover:text-white/70"
                }`}
              >
                {label}
              </Badge>
            </Link>
          ))}
        </div>

        {/* Article grid */}
        {articles.length === 0 ? (
          <div className="text-center py-24 text-white/30">
            <p className="text-lg">No articles yet — check back soon.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link key={article.id} href={`/blog/${article.slug}`} className="group">
                <Card className="h-full flex flex-col border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-colors">
                  {article.cover_image && (
                    <div className="aspect-video overflow-hidden rounded-t-lg">
                      <img
                        src={article.cover_image}
                        alt={article.title}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`text-xs border ${CATEGORY_COLORS[article.category] ?? "bg-white/5 text-white/50 border-white/10"}`}>
                        {CATEGORY_LABELS[article.category] ?? article.category}
                      </Badge>
                    </div>
                    <CardTitle className="text-white text-base leading-snug group-hover:text-[#3B82F6] transition-colors">
                      {article.title}
                    </CardTitle>
                    <CardDescription className="text-white/40 text-sm line-clamp-3">
                      {article.excerpt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto pt-0">
                    <div className="flex items-center justify-between text-xs text-white/30">
                      <span>{article.author_name}</span>
                      {article.published_at && <span>{formatDate(article.published_at)}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-[#94A3B8] text-sm">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <span>© 2026 VibeTrace</span>
          <Link href="/terms" className="text-white/30 hover:text-white/60 text-sm transition-colors">Terms</Link>
          <Link href="/privacy" className="text-white/30 hover:text-white/60 text-sm transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
