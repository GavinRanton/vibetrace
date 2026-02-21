import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8FAFC]">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <img src="/branding/logo-icon-dark.svg" alt="VibeTrace" className="w-7 h-7" />
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

        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-white/50 text-sm mb-12">Effective date: 20 February 2026</p>

        <div className="space-y-10">
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">1. Service Description</h2>
            <p className="text-white/70 leading-relaxed">
              VibeTrace provides automated security scanning for software repositories and web
              applications. We use static analysis, dependency scanning, and AI-powered vulnerability
              translation to help founders identify and fix security issues. By using VibeTrace, you
              agree to these Terms of Service in full.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">2. Acceptable Use</h2>
            <p className="text-white/70 leading-relaxed mb-3">
              You may only use VibeTrace to scan repositories and applications that you own or have
              explicit permission to test. The following are strictly prohibited:
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2">
              <li>Scanning repositories or applications you do not own or have no authorisation to test.</li>
              <li>Automated abuse of the service, including scripted mass scanning or denial-of-service attempts.</li>
              <li>Reverse engineering, decompiling, or attempting to extract proprietary logic from our platform.</li>
              <li>Reselling or redistributing scan results or reports without prior written consent.</li>
            </ul>
            <p className="text-white/70 leading-relaxed mt-3">
              Violation of these terms may result in immediate suspension or termination of your account.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">3. Payment Terms</h2>
            <p className="text-white/70 leading-relaxed mb-3">
              Paid plans are billed monthly or annually via Stripe. By subscribing, you authorise us
              to charge your payment method on a recurring basis until you cancel.
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2">
              <li>No refunds are issued for completed scans or partial billing periods.</li>
              <li>
                You may cancel your subscription at any time from your account settings. Access
                continues until the end of your current billing period.
              </li>
              <li>
                Deep Audit is a one-time purchase. Once the audit has been delivered, the payment is
                non-refundable.
              </li>
              <li>
                We reserve the right to update pricing. Existing subscribers will receive at least 30
                days notice before any price changes take effect.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">4. Limitation of Liability</h2>
            <p className="text-white/70 leading-relaxed">
              VibeTrace provides security insights to help you identify potential vulnerabilities. We
              do not guarantee complete security coverage, and our scans are not a substitute for
              professional security audits. VibeTrace is not liable for any damages including data
              breaches, financial loss, or reputational harm arising from vulnerabilities that were
              not detected by our service or from reliance on the information contained in our reports.
              Our total liability to you for any claim arising out of or relating to these terms shall
              not exceed the amount you paid to us in the three months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">5. Intellectual Property</h2>
            <p className="text-white/70 leading-relaxed">
              All intellectual property rights in the VibeTrace platform, including its scanning
              engine, AI models, and user interface, remain the property of VibeTrace. You retain
              full ownership of your source code and scan results. We do not claim any rights over
              your repositories or applications.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">6. Termination</h2>
            <p className="text-white/70 leading-relaxed">
              We reserve the right to suspend or terminate your account if you violate these terms,
              engage in fraudulent activity, or if we are required to do so by law. You may delete
              your account at any time. Upon termination, your data will be deleted in accordance with
              our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">7. Governing Law</h2>
            <p className="text-white/70 leading-relaxed">
              These Terms of Service are governed by and construed in accordance with the laws of
              England and Wales. Any disputes arising from these terms shall be subject to the
              exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">8. Changes to These Terms</h2>
            <p className="text-white/70 leading-relaxed">
              We may update these terms from time to time. We will notify you of significant changes
              by email or via a notice within the platform. Your continued use of VibeTrace after
              changes take effect constitutes your acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">9. Contact</h2>
            <p className="text-white/70 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at{" "}
              <a
                href="mailto:support@vibetrace.app"
                className="text-[#3B82F6] hover:underline"
              >
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
