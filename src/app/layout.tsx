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
  title: {
    default: "VibeTrace — Security Scanning for Modern Apps",
    template: "%s | VibeTrace",
  },
  description:
    "Enterprise-grade vulnerability scanning powered by AI. Find and fix security issues before they reach production.",
  keywords: ["security", "vulnerability", "scanning", "SAST", "SCA", "DevSecOps"],
  authors: [{ name: "VibeTrace" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://vibetrace.dev",
    siteName: "VibeTrace",
    title: "VibeTrace — Security Scanning for Modern Apps",
    description:
      "Enterprise-grade vulnerability scanning powered by AI.",
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeTrace — Security Scanning for Modern Apps",
    description: "Enterprise-grade vulnerability scanning powered by AI.",
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
