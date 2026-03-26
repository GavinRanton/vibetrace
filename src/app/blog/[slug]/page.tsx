import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

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
  content: string;
  cover_image: string | null;
  category: string;
  tags: string[];
  published_at: string | null;
  author_name: string;
  seo_title: string | null;
  seo_description: string | null;
};

async function getArticle(slug: string): Promise<Article | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();
  return data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return { title: "Article not found | VibeTrace" };
  }

  const title = article.seo_title ?? article.title;
  const description = article.seo_description ?? article.excerpt;

  return {
    title: `${title} | VibeTrace`,
    description,
    openGraph: {
      title: `${title} | VibeTrace`,
      description,
      url: `https://vibetrace.app/blog/${slug}`,
      siteName: "VibeTrace",
      type: "article",
      publishedTime: article.published_at ?? undefined,
      authors: [article.author_name],
      ...(article.cover_image ? { images: [{ url: article.cover_image }] } : {}),
    },
    alternates: {
      canonical: `https://vibetrace.app/blog/${slug}`,
    },
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    author: { "@type": "Organization", name: article.author_name },
    datePublished: article.published_at,
    url: `https://vibetrace.app/blog/${article.slug}`,
    ...(article.cover_image ? { image: article.cover_image } : {}),
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

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

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-10"
        >
          ← Back to blog
        </Link>

        {/* Article header */}
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Badge className={`text-xs border ${CATEGORY_COLORS[article.category] ?? "bg-white/5 text-white/50 border-white/10"}`}>
              {CATEGORY_LABELS[article.category] ?? article.category}
            </Badge>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">{article.title}</h1>
          <p className="text-white/50 text-lg leading-relaxed mb-6">{article.excerpt}</p>
          <div className="flex items-center gap-3 text-sm text-white/30">
            <span>{article.author_name}</span>
            {article.published_at && (
              <>
                <span>·</span>
                <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
              </>
            )}
          </div>
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {article.tags.map((tag) => (
                <Badge key={tag} className="text-xs bg-white/5 text-white/40 border-white/10 border">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {article.cover_image && (
          <div className="aspect-video overflow-hidden rounded-xl mb-10 border border-white/5">
            <img
              src={article.cover_image}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <Separator className="bg-white/5 mb-10" />

        {/* Article content */}
        <div className="prose prose-invert prose-headings:text-white prose-headings:font-bold prose-p:text-white/70 prose-a:text-[#3B82F6] prose-a:no-underline hover:prose-a:underline prose-code:text-[#3B82F6] prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/[0.03] prose-pre:border prose-pre:border-white/5 prose-blockquote:border-l-[#3B82F6] prose-blockquote:text-white/50 prose-strong:text-white prose-li:text-white/70 max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 border border-white/5 bg-white/[0.02] rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Ready to scan your code?</h2>
          <p className="text-white/40 text-sm mb-6">
            Detect vulnerabilities before they reach production — for free.
          </p>
          <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
            <Link href="/scan">Start scanning</Link>
          </Button>
        </div>
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
