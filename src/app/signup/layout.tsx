import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up — Start Your Free Security Scan",
  description:
    "Create a free VibeTrace account and scan your website for security vulnerabilities and SEO issues. No credit card required.",
  alternates: { canonical: "https://vibetrace.io/signup" },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
