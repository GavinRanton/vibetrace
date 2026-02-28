import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free & Pro Security Scanning",
  description:
    "Start free with 1 full scan. Upgrade to Pro for unlimited scans, shareable reports, and priority support. No credit card required to start.",
  alternates: { canonical: "https://vibetrace.app/pricing" },
  openGraph: {
    title: "VibeTrace Pricing — Free & Pro Plans",
    description: "1 free scan to get started. Pro for unlimited security and SEO scanning.",
    url: "https://vibetrace.app/pricing",
    type: "website",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
