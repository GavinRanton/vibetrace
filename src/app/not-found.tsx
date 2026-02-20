import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center justify-center px-6">
      <img src="/branding/logo-icon-dark.svg" alt="VibeTrace" className="w-12 h-12 mb-8" />
      <p className="text-[#3B82F6] text-sm font-mono mb-4">404</p>
      <h1 className="text-3xl font-bold mb-3">Page not found</h1>
      <p className="text-white/40 text-sm mb-8 text-center max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        <Home size={16} />
        Back to home
      </Link>
    </div>
  );
}
