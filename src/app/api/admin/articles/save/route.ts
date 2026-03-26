import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase-admin";

const ADMIN_EMAIL = "gavin.ranton@gmail.com";

const VALID_CATEGORIES = [
  "security-guides",
  "vulnerability-types",
  "devsecops",
  "product-updates",
] as const;

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // Option 1: Bearer token matching N8N_WEBHOOK_SECRET
  const authHeader = req.headers.get("authorization");
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret && authHeader === `Bearer ${secret}`) {
    return true;
  }

  // Option 2: Admin session cookie check
  try {
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await authClient.auth.getUser();

    return !error && !!user && user.email === ADMIN_EMAIL;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorized = await isAuthorized(req);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      slug,
      content,
      excerpt,
      category,
      tags,
      published,
      publishedAt,
      authorName,
      seoTitle,
      seoDescription,
    } = body;

    // Validate required fields
    if (!title || !slug || !content || !excerpt || !category) {
      return NextResponse.json(
        { error: "Missing required fields: title, slug, content, excerpt, category" },
        { status: 400 }
      );
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const articleData = {
      title,
      slug,
      content,
      excerpt,
      category,
      tags: tags ?? [],
      published: published ?? false,
      published_at: publishedAt ?? null,
      author_name: authorName ?? "VibeTrace Team",
      seo_title: seoTitle ?? null,
      seo_description: seoDescription ?? null,
      updated_at: now,
    };

    // Check if slug already exists
    const { data: existing } = await adminClient
      .from("articles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    let article: { id: string; slug: string };

    if (existing) {
      // UPDATE
      const { data, error } = await adminClient
        .from("articles")
        .update(articleData)
        .eq("slug", slug)
        .select("id, slug")
        .single();

      if (error) {
        console.error("save-article: update error:", error);
        return NextResponse.json({ error: "Failed to update article" }, { status: 500 });
      }
      article = data;
    } else {
      // INSERT
      const { data, error } = await adminClient
        .from("articles")
        .insert({ ...articleData, created_at: now })
        .select("id, slug")
        .single();

      if (error) {
        console.error("save-article: insert error:", error);
        return NextResponse.json({ error: "Failed to create article" }, { status: 500 });
      }
      article = data;
    }

    return NextResponse.json({ success: true, article });
  } catch (err) {
    console.error("save-article: unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
