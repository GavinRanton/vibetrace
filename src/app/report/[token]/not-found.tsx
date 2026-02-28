import Link from "next/link";

export default function ReportNotFound() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[#3B82F6] text-xs uppercase tracking-[0.15em] font-semibold">Report Unavailable</p>
        <h1 className="text-3xl font-semibold mt-3">This report is no longer available</h1>
        <p className="text-white/50 text-sm mt-3">
          The share link may be invalid, expired, or has been revoked by the report owner.
        </p>
        <Link
          href="/"
          className="inline-flex mt-8 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm"
        >
          Back to VibeTrace
        </Link>
      </div>
    </main>
  );
}
