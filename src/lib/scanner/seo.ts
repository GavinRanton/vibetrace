/**
 * VibeTrace SEO Scanner
 * Analyses a deployed URL for SEO issues, returns findings
 * in the same format as SAST/DAST findings.
 */

export interface SeoFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "seo";
  rule_id: string;
  file_path: string;
  plain_english: string;
  business_impact: string;
  fix_prompt: string;
  verification_step: string;
}

interface PageData {
  url: string;
  html: string;
  statusCode: number;
  responseTimeMs: number;
  contentLength: number;
}

async function fetchPage(url: string): Promise<PageData> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "VibeTrace-SEO-Scanner/1.0 (+https://vibetrace.app)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });
    const html = await res.text();
    clearTimeout(timer);
    return {
      url,
      html,
      statusCode: res.status,
      responseTimeMs: Date.now() - start,
      contentLength: html.length,
    };
  } finally {
    clearTimeout(timer);
  }
}

function extract(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern);
  return m ? (m[1] || m[0]).trim() : null;
}

function extractAll(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(new RegExp(pattern.source, pattern.flags + (pattern.flags.includes("g") ? "" : "g")))].map(m => (m[1] || m[0]).trim());
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function checkRobotsTxt(baseUrl: string): Promise<{ exists: boolean; blocksAll: boolean }> {
  try {
    const res = await fetch(new URL("/robots.txt", baseUrl).href, { redirect: "follow" });
    if (!res.ok) return { exists: false, blocksAll: false };
    const text = await res.text();
    const blocksAll = /User-agent:\s*\*[\s\S]*?Disallow:\s*\//i.test(text);
    return { exists: true, blocksAll };
  } catch {
    return { exists: false, blocksAll: false };
  }
}

async function checkSitemap(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(new URL("/sitemap.xml", baseUrl).href, { redirect: "follow" });
    return res.ok && res.status === 200;
  } catch {
    return false;
  }
}

export async function runSeoScan(url: string, scanId: string): Promise<SeoFinding[]> {
  const findings: SeoFinding[] = [];

  let page: PageData;
  try {
    page = await fetchPage(url);
  } catch (err: any) {
    return [{
      severity: "critical",
      category: "seo",
      rule_id: "seo-fetch-failed",
      file_path: url,
      plain_english: "We could not load your site to analyse it for SEO issues.",
      business_impact: "If VibeTrace can't load your site, search engines may have the same problem — meaning your pages won't get indexed.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Check that your site at ${url} returns a 200 status code and is publicly accessible. Ensure there are no authentication walls on the homepage."`,
      verification_step: `Visit ${url} in a private browser window while not logged in. If you see a login page, your homepage is gated.`,
    }];
  }

  const { html, responseTimeMs, contentLength } = page;
  const baseUrl = new URL(url).origin;

  // ─── Title ───────────────────────────────────────────
  const title = extract(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleClean = title ? stripTags(title) : null;

  if (!titleClean) {
    findings.push({
      severity: "critical",
      category: "seo",
      rule_id: "seo-missing-title",
      file_path: url,
      plain_english: "Your page has no title tag. This is the blue link text that shows in Google results.",
      business_impact: "Google won't rank a page that has no title. This is the single most important on-page SEO element.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Add a descriptive <title> tag to the <head> section of the homepage. It should be 50–60 characters, include the main keyword, and clearly describe what the page is about."`,
      verification_step: "View source on your homepage and search for <title>. You should see a meaningful phrase, not empty tags.",
    });
  } else if (titleClean.length < 10) {
    findings.push({
      severity: "high",
      category: "seo",
      rule_id: "seo-title-too-short",
      file_path: url,
      plain_english: `Your page title is only ${titleClean.length} characters: "${titleClean}". That's too short to rank for anything meaningful.`,
      business_impact: "Short titles miss keyword opportunities and look unprofessional in search results.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Expand the <title> tag on the homepage to 50–60 characters. Include your product name, the main keyword people would search for, and a short value proposition. Example: 'ProductName – Free Website Security Scanner | VibeTrace'"`,
      verification_step: "Check the title tag length using a free tool like https://moz.com/learn/seo/title-tag",
    });
  } else if (titleClean.length > 65) {
    findings.push({
      severity: "medium",
      category: "seo",
      rule_id: "seo-title-too-long",
      file_path: url,
      plain_english: `Your page title is ${titleClean.length} characters. Google cuts off titles longer than ~60 characters in search results.`,
      business_impact: "Truncated titles look messy in Google and may hide your key message from potential visitors.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Shorten the <title> tag to under 60 characters while keeping the most important keyword and brand name. Current title: '${titleClean}'"`,
      verification_step: "Paste your title into https://www.google.com/search to preview how it will appear.",
    });
  }

  // ─── Meta Description ─────────────────────────────────
  const metaDesc = extract(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    ?? extract(html, /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);

  if (!metaDesc) {
    findings.push({
      severity: "high",
      category: "seo",
      rule_id: "seo-missing-meta-description",
      file_path: url,
      plain_english: "Your page has no meta description — the short summary text that appears under your title in Google search results.",
      business_impact: "Without a meta description, Google writes its own (often poor quality). A good description improves click-through rates from search results.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Add a <meta name='description' content='...'> tag to the <head> section. Write 140–160 characters that describe what the page does and why someone should click. Include your main keyword naturally."`,
      verification_step: "View page source and search for 'meta name=\"description\"'. Confirm it exists and has meaningful content.",
    });
  } else if (metaDesc.length > 160) {
    findings.push({
      severity: "low",
      category: "seo",
      rule_id: "seo-meta-description-too-long",
      file_path: url,
      plain_english: `Your meta description is ${metaDesc.length} characters. Google truncates it at ~160 characters.`,
      business_impact: "The cut-off text may hide your call to action from users in search results.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Trim the meta description to under 155 characters. Keep the most important phrase and call-to-action near the start. Current: '${metaDesc.substring(0, 80)}...'"`,
      verification_step: "Check with https://moz.com/learn/seo/meta-description that the description fits within the character limit.",
    });
  }

  // ─── Canonical ────────────────────────────────────────
  const canonical = extract(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    ?? extract(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);

  if (!canonical) {
    findings.push({
      severity: "high",
      category: "seo",
      rule_id: "seo-missing-canonical",
      file_path: url,
      plain_english: "Your page is missing a canonical tag. This tells Google which version of a URL is the 'official' one.",
      business_impact: "Without canonicals, if your page is accessible via multiple URLs (with/without www, with/without trailing slash), Google may split your ranking power across duplicates.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Add <link rel='canonical' href='${url}' /> to the <head> of this page. For dynamic pages, ensure the canonical always points to the clean, preferred URL of the page."`,
      verification_step: "View page source and search for 'rel=\"canonical\"'. Confirm the href matches the page's preferred URL.",
    });
  }

  // ─── H1 ──────────────────────────────────────────────
  const h1s = extractAll(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Count = h1s.length;

  if (h1Count === 0) {
    findings.push({
      severity: "high",
      category: "seo",
      rule_id: "seo-missing-h1",
      file_path: url,
      plain_english: "Your page has no H1 heading. The H1 is the main headline — it tells Google what your page is about.",
      business_impact: "Google uses H1 to understand page topic. Missing H1 weakens your ability to rank for target keywords.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Add a single <h1> tag to the main page content. It should include your primary keyword and clearly state what the page offers. Every page should have exactly one H1."`,
      verification_step: "View page source and search for <h1>. There should be exactly one, containing your main keyword.",
    });
  } else if (h1Count > 1) {
    findings.push({
      severity: "medium",
      category: "seo",
      rule_id: "seo-multiple-h1",
      file_path: url,
      plain_english: `Your page has ${h1Count} H1 headings. There should only be one — it's meant to be the single main headline.`,
      business_impact: "Multiple H1s dilute the SEO signal and confuse search engines about what your page is really about.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Review all H1 tags on the page. Keep only the most important one as H1. Change the others to H2 or H3. There should be exactly one <h1> per page."`,
      verification_step: "Search the page source for '<h1' — count the results. There should be exactly one.",
    });
  }

  // ─── Open Graph ───────────────────────────────────────
  const ogTitle = extract(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogDesc = extract(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const ogImage = extract(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);

  if (!ogTitle || !ogDesc || !ogImage) {
    const missing = [!ogTitle && "og:title", !ogDesc && "og:description", !ogImage && "og:image"].filter(Boolean).join(", ");
    findings.push({
      severity: "medium",
      category: "seo",
      rule_id: "seo-missing-og-tags",
      file_path: url,
      plain_english: `Your page is missing Open Graph tags (${missing}). These control how your site looks when shared on LinkedIn, Twitter, Slack, etc.`,
      business_impact: "Without OG tags, link shares look generic — no image, no description. This reduces click-through when people share your link.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Add these Open Graph meta tags to the <head>:\n<meta property='og:title' content='Your Page Title' />\n<meta property='og:description' content='Your 140-char description' />\n<meta property='og:image' content='https://yourdomain.com/og-image.png' />\n<meta property='og:type' content='website' />\n<meta property='og:url' content='${url}' />"`,
      verification_step: "Paste your URL into https://www.opengraph.xyz/ to preview how it looks when shared.",
    });
  }

  // ─── Schema.org ───────────────────────────────────────
  const hasSchema = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  if (!hasSchema) {
    findings.push({
      severity: "medium",
      category: "seo",
      rule_id: "seo-missing-schema",
      file_path: url,
      plain_english: "Your page has no structured data (Schema.org). This is machine-readable markup that helps Google understand your content.",
      business_impact: "Structured data can unlock rich results in Google (star ratings, FAQs, breadcrumbs) — these get significantly more clicks than plain results.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Add a JSON-LD script block to the <head> of this page with basic Organization or WebSite schema:\n<script type='application/ld+json'>\n{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"WebSite\",\n  \"name\": \"Your Site Name\",\n  \"url\": \"${baseUrl}\"\n}\n</script>"`,
      verification_step: "Test at https://search.google.com/test/rich-results — paste your URL and check for structured data.",
    });
  }

  // ─── Robots.txt ───────────────────────────────────────
  const robots = await checkRobotsTxt(baseUrl);
  if (!robots.exists) {
    findings.push({
      severity: "medium",
      category: "seo",
      rule_id: "seo-missing-robots-txt",
      file_path: `${baseUrl}/robots.txt`,
      plain_english: "Your site has no robots.txt file. This file gives instructions to search engine crawlers.",
      business_impact: "Without robots.txt, search engines crawl everything including admin pages, APIs, and duplicate content — wasting crawl budget on pages you don't want indexed.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Create a public/robots.txt file with this content:\nUser-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nSitemap: ${baseUrl}/sitemap.xml"`,
      verification_step: `Visit ${baseUrl}/robots.txt in your browser. You should see plain text instructions, not a 404.`,
    });
  } else if (robots.blocksAll) {
    findings.push({
      severity: "critical",
      category: "seo",
      rule_id: "seo-robots-blocking-all",
      file_path: `${baseUrl}/robots.txt`,
      plain_english: "Your robots.txt is blocking all search engines from crawling your site. You are completely invisible to Google.",
      business_impact: "This is a total indexing block. No pages will appear in Google search results while this is in place.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Fix the robots.txt file. Remove or change the 'Disallow: /' line under 'User-agent: *'. Replace with:\nUser-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/"`,
      verification_step: `Visit ${baseUrl}/robots.txt and confirm 'Disallow: /' is NOT present under 'User-agent: *'.`,
    });
  }

  // ─── Sitemap ──────────────────────────────────────────
  const hasSitemap = await checkSitemap(baseUrl);
  if (!hasSitemap) {
    findings.push({
      severity: "high",
      category: "seo",
      rule_id: "seo-missing-sitemap",
      file_path: `${baseUrl}/sitemap.xml`,
      plain_english: "Your site has no sitemap.xml. A sitemap is a list of all your pages that you hand directly to Google.",
      business_impact: "Without a sitemap, Google has to discover your pages by crawling links. This is slower and may miss pages entirely — especially new ones.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Generate a sitemap.xml for this site. For Next.js, create src/app/sitemap.ts that exports a function returning all your page URLs. For other frameworks, use a sitemap generator library. Submit it at https://search.google.com/search-console once created."`,
      verification_step: `Visit ${baseUrl}/sitemap.xml. You should see an XML file listing all your pages, not a 404.`,
    });
  }

  // ─── Page speed / size ────────────────────────────────
  if (responseTimeMs > 3000) {
    findings.push({
      severity: "medium",
      category: "seo",
      rule_id: "seo-slow-response",
      file_path: url,
      plain_english: `Your page took ${(responseTimeMs / 1000).toFixed(1)} seconds to load. Google uses page speed as a ranking factor.`,
      business_impact: "Pages taking over 3 seconds see up to 40% abandonment. Google also ranks faster pages higher.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Audit and improve page performance. Enable response compression (gzip/brotli), add a CDN, optimise images (use WebP format), and ensure server-side caching is active. For Next.js, enable the Image component and check that static assets are served from /_next/static/."`,
      verification_step: "Run a free speed test at https://pagespeed.web.dev/ — aim for a score above 80.",
    });
  }

  if (contentLength > 500000) {
    findings.push({
      severity: "low",
      category: "seo",
      rule_id: "seo-large-page-size",
      file_path: url,
      plain_english: `Your page HTML is ${(contentLength / 1024).toFixed(0)}KB — that's large. Google prefers lean, fast pages.`,
      business_impact: "Large HTML means slower rendering, which negatively affects Core Web Vitals and search rankings.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Reduce the HTML page size. Check for large inline SVGs or inline JSON data blobs that should be loaded lazily or moved to separate files. Consider server-side pagination for content-heavy pages."`,
      verification_step: "View page source (Ctrl+U) and check the file size. Target under 100KB for the HTML document itself.",
    });
  }

  // ─── llms.txt ─────────────────────────────────────────
  try {
    const llmsRes = await fetch(new URL("/llms.txt", baseUrl).href, { redirect: "follow" });
    if (!llmsRes.ok) {
      findings.push({
        severity: "info",
        category: "seo",
        rule_id: "seo-missing-llms-txt",
        file_path: `${baseUrl}/llms.txt`,
        plain_english: "Your site doesn't have an llms.txt file. This is an emerging standard that tells AI tools (ChatGPT, Perplexity, Claude) about your site.",
        business_impact: "As more users search via AI assistants, llms.txt helps ensure your site gets cited and recommended in AI-generated answers.",
        fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Create a public/llms.txt file describing your site for AI crawlers:\n# Your Site Name\nhttps://yourdomain.com\n\n## What we are\n[2-3 sentences describing what your product does and who it serves]\n\n## Key pages\n- /features — main features\n- /pricing — pricing information"`,
        verification_step: `Visit ${baseUrl}/llms.txt — it should return a plain text file, not a 404.`,
      });
    }
  } catch {}

  // ─── Twitter card ─────────────────────────────────────
  const twitterCard = extract(html, /<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']+)["']/i);
  if (!twitterCard) {
    findings.push({
      severity: "low",
      category: "seo",
      rule_id: "seo-missing-twitter-card",
      file_path: url,
      plain_english: "Your page has no Twitter/X card meta tags. These control how links look when shared on X (Twitter).",
      business_impact: "Without Twitter cards, X link previews show no image and minimal text — significantly reducing click-through from shares.",
      fix_prompt: `In Lovable (or Cursor), paste this exactly:\n"Add Twitter card meta tags to the <head>:\n<meta name='twitter:card' content='summary_large_image' />\n<meta name='twitter:title' content='Your Page Title' />\n<meta name='twitter:description' content='Your description' />\n<meta name='twitter:image' content='https://yourdomain.com/og-image.png' />"`,
      verification_step: "Test at https://cards-dev.twitter.com/validator by entering your URL.",
    });
  }

  console.log(`[SEO] Completed scan for ${url}: ${findings.length} findings`);
  return findings;
}
