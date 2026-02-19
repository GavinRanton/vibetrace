/**
 * Stripe client placeholder
 * Install stripe and configure env vars to activate.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 *   STRIPE_WEBHOOK_SECRET
 */

// TODO: Uncomment after installing stripe
// import Stripe from 'stripe'
//
// export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2024-12-18.acacia',
//   typescript: true,
// })

export const stripe = null; // placeholder — not yet configured

export const STRIPE_PRICE_IDS = {
  pro_monthly: "price_PLACEHOLDER_PRO_MONTHLY",
  pro_yearly: "price_PLACEHOLDER_PRO_YEARLY",
  enterprise: "price_PLACEHOLDER_ENTERPRISE",
} as const;
