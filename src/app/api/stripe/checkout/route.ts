import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { priceKey, userId, email } = await req.json() as {
      priceKey: keyof typeof STRIPE_PRICE_IDS;
      userId: string;
      email: string;
    };

    if (!priceKey || !userId || !email) {
      return NextResponse.json({ error: 'Missing priceKey, userId, or email' }, { status: 400 });
    }

    const priceId = STRIPE_PRICE_IDS[priceKey];
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid priceKey' }, { status: 400 });
    }

    // Look up or create Stripe customer
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    let customerId: string | undefined = userData?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    const isOneTime = priceKey === 'deep_audit';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isOneTime ? 'payment' : 'subscription',
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url:  `${appUrl}/pricing?checkout=cancelled`,
      metadata: { userId, priceKey },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
