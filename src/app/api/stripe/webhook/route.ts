import { NextRequest, NextResponse } from 'next/server';
import { stripe, planFromPriceId } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertSubscription(sub: any) {
  const priceId: string = sub.items?.data?.[0]?.price?.id ?? '';
  const plan = planFromPriceId(priceId);
  const customerId: string = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? '';

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!userData) {
    console.warn('[webhook] No user found for customer', customerId);
    return;
  }

  const userId = userData.id;

  await supabaseAdmin
    .from('users')
    .update({ plan })
    .eq('id', userId);

  const periodStart = sub.current_period_start
    ? new Date(sub.current_period_start * 1000).toISOString()
    : sub.items?.data?.[0]?.current_period_start
    ? new Date(sub.items.data[0].current_period_start * 1000).toISOString()
    : null;

  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : sub.items?.data?.[0]?.current_period_end
    ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
    : null;

  await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      stripe_price_id: priceId,
      plan,
      status: sub.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_subscription_id' });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature') ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === 'payment') {
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? '';
          const { data: userData } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (userData) {
            await supabaseAdmin
              .from('users')
              .update({ plan: 'deep_audit' })
              .eq('id', userData.id);

            const paymentIntent = typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? '';

            await supabaseAdmin
              .from('subscriptions')
              .upsert({
                user_id: userData.id,
                stripe_customer_id: customerId,
                stripe_payment_intent_id: paymentIntent,
                plan: 'deep_audit',
                status: 'active',
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await upsertSubscription(event.data.object);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : '';

        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (userData) {
          await supabaseAdmin
            .from('users')
            .update({ plan: 'free' })
            .eq('id', userData.id);

          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', sub.id);
        }
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('[webhook] handler error', err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
