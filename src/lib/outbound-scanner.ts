// Outbound email scanner — guards against sending to invalid/test addresses

const BLOCKED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "test.com",
  "localhost",
  "mailinator.com",
]);

export function isValidOutboundEmail(email: string): boolean {
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return false;

  const domain = email.slice(atIdx + 1).toLowerCase();

  // Block .local TLD
  if (domain.endsWith(".local")) {
    console.log(`[outbound] Blocked .local address: ${email}`);
    return false;
  }

  // Block addresses with no TLD (no dot after @)
  if (!domain.includes(".")) {
    console.log(`[outbound] Blocked no-TLD address: ${email}`);
    return false;
  }

  // Block known test/placeholder domains
  if (BLOCKED_DOMAINS.has(domain)) {
    console.log(`[outbound] Blocked test domain address: ${email}`);
    return false;
  }

  return true;
}

export function shouldSendOutbound(score: number): boolean {
  return score < 80;
}
