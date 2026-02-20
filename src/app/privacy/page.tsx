import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8FAFC]">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center">
            <span className="text-xs font-bold text-white">VT</span>
          </div>
          <span className="font-semibold text-[#F8FAFC]">VibeTrace</span>
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-[#94A3B8] hover:text-[#F8FAFC] text-sm transition-colors mb-8 inline-block"
        >
          Back to home
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-white/50 text-sm mb-12">Effective date: 20 February 2026</p>

        <div className="space-y-10">
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">1. Introduction</h2>
            <p className="text-white/70 leading-relaxed">
              VibeTrace is committed to protecting your privacy. This Privacy Policy explains what
              data we collect, why we collect it, and how we use and protect it. By using our
              service, you agree to the practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">2. Data We Collect</h2>
            <p className="text-white/70 leading-relaxed mb-3">
              We collect only what is necessary to provide the service:
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2">
              <li>
                <span className="font-medium text-white/90">Email address</span> — collected via
                GitHub or Google OAuth, or directly on signup. Used to log in and communicate with
                you about your account and scan results.
              </li>
              <li>
                <span className="font-medium text-white/90">GitHub username and repository names</span>{" "}
                — collected when you connect your GitHub account. We do not collect or store your
                source code.
              </li>
              <li>
                <span className="font-medium text-white/90">Scan results</span> — vulnerability
                metadata including issue type, severity, file path, and line number. Never the
                underlying code.
              </li>
              <li>
                <span className="font-medium text-white/90">Payment information</span> — handled
                entirely by Stripe. We never see or store your card details.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">3. What We Do NOT Store</h2>
            <p className="text-white/70 leading-relaxed mb-3">
              We take your code privacy seriously:
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2">
              <li>
                We clone your repository temporarily for the purpose of scanning and delete it
                immediately after the scan completes.
              </li>
              <li>No source code is ever retained on our servers.</li>
              <li>We do not index, train models on, or share your code with third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">4. How We Use Your Data</h2>
            <ul className="list-disc list-inside text-white/70 space-y-2">
              <li>To provide the VibeTrace scanning service and deliver scan reports.</li>
              <li>To send you notifications about your scans and account.</li>
              <li>To process payments via Stripe.</li>
              <li>To improve our vulnerability detection rules and overall service quality.</li>
              <li>To comply with legal obligations.</li>
            </ul>
            <p className="text-white/70 leading-relaxed mt-3">
              We do not sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">5. Data Retention</h2>
            <p className="text-white/70 leading-relaxed">
              Account data and scan results are retained for as long as your account is active.
              If you request deletion of your account, your personal data will be permanently
              deleted within 30 days of the request. Aggregated, anonymised statistics may be
              retained for service improvement purposes.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">6. Third-Party Services</h2>
            <p className="text-white/70 leading-relaxed">
              We use the following third-party services to operate VibeTrace:
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-3">
              <li><span className="font-medium text-white/90">Stripe</span> — payment processing.</li>
              <li><span className="font-medium text-white/90">GitHub OAuth</span> — authentication and repository access.</li>
              <li><span className="font-medium text-white/90">Google OAuth</span> — authentication.</li>
            </ul>
            <p className="text-white/70 leading-relaxed mt-3">
              Each of these services has its own privacy policy governing how they handle your data.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">7. Your Rights (UK GDPR)</h2>
            <p className="text-white/70 leading-relaxed mb-3">
              Under UK GDPR, you have the following rights regarding your personal data:
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2">
              <li><span className="font-medium text-white/90">Right of access</span> — request a copy of the data we hold about you.</li>
              <li><span className="font-medium text-white/90">Right to rectification</span> — request correction of inaccurate data.</li>
              <li><span className="font-medium text-white/90">Right to erasure</span> — request deletion of your data.</li>
              <li><span className="font-medium text-white/90">Right to data portability</span> — request your data in a structured, machine-readable format.</li>
              <li><span className="font-medium text-white/90">Right to object</span> — object to processing of your data in certain circumstances.</li>
            </ul>
            <p className="text-white/70 leading-relaxed mt-3">
              To exercise any of these rights, email{" "}
              <a href="mailto:support@vibetrace.app" className="text-[#3B82F6] hover:underline">
                support@vibetrace.app
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">8. Changes to This Policy</h2>
            <p className="text-white/70 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by email or via a notice within the platform. Your continued use of VibeTrace
              after changes take effect constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">9. Contact</h2>
            <p className="text-white/70 leading-relaxed">
              If you have any questions about this Privacy Policy or how we handle your data, please
              contact us at{" "}
              <a href="mailto:support@vibetrace.app" className="text-[#3B82F6] hover:underline">
                support@vibetrace.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-[#94A3B8] text-sm mt-16">
        <div className="flex items-center justify-center gap-6">
          <span>2026 VibeTrace</span>
          <Link href="/terms" className="text-white/30 hover:text-white/60 text-sm transition-colors">Terms</Link>
          <Link href="/privacy" className="text-white/30 hover:text-white/60 text-sm transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
