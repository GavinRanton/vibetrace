import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vibetrace.app"),
  title: {
    default: "VibeTrace — Free Website Security & SEO Scanner",
    template: "%s | VibeTrace",
  },
  description:
    "Scan your website for security vulnerabilities and SEO issues in minutes. Get plain-English fixes you can paste straight into Lovable or Cursor. Free to start.",
  keywords: ["website security scanner", "free security scan", "SEO audit", "vulnerability scanner", "OWASP scan", "Lovable security", "Cursor security", "website security check"],
  authors: [{ name: "VibeTrace" }],
  alternates: {
    canonical: "https://vibetrace.app",
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://vibetrace.app",
    siteName: "VibeTrace",
    title: "VibeTrace — Free Website Security & SEO Scanner",
    description:
      "Scan your website for security vulnerabilities and SEO issues. Get plain-English fixes for Lovable, Cursor, and more. Free to start.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "VibeTrace Security Scanner" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeTrace — Free Website Security & SEO Scanner",
    description: "Security + SEO scan in one click. Plain-English fixes for Lovable and Cursor builders.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased min-h-screen bg-[#0A0A0F]">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
