import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

export const STRIPE_PRICE_IDS = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
  starter_annual:  process.env.STRIPE_PRICE_STARTER_ANNUAL!,
  pro_monthly:     process.env.STRIPE_PRICE_PRO_MONTHLY!,
  pro_annual:      process.env.STRIPE_PRICE_PRO_ANNUAL!,
  deep_audit:      process.env.STRIPE_PRICE_DEEP_AUDIT!,
} as const;

export type PlanSlug = 'free' | 'starter' | 'pro' | 'deep_audit';

/** Map a Stripe price ID back to a plan slug */
export function planFromPriceId(priceId: string): PlanSlug {
  if (priceId === process.env.STRIPE_PRICE_STARTER_MONTHLY || priceId === process.env.STRIPE_PRICE_STARTER_ANNUAL) {
    return 'starter';
  }
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) {
    return 'pro';
  }
  if (priceId === process.env.STRIPE_PRICE_DEEP_AUDIT) {
    return 'deep_audit';
  }
  return 'free';
}
