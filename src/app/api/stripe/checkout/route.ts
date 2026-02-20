import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    // Get user if authenticated (optional)
    let userId: string | undefined;
    let userEmail: string | undefined;
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email;
      }
    } catch {}

    const body = await req.json() as {
      priceId?: string;
      priceKey?: keyof typeof STRIPE_PRICE_IDS;
    };

    const { priceId: directPriceId, priceKey } = body;

    // Resolve the price ID — accept either priceId directly or priceKey lookup
    let priceId: string | undefined = directPriceId;
    if (!priceId && priceKey) {
      priceId = STRIPE_PRICE_IDS[priceKey];
    }

    if (!priceId) {
      return NextResponse.json({ error: 'Missing priceId or priceKey' }, { status: 400 });
    }

    const isOneTime = priceKey === 'deep_audit' ||
      priceId === process.env.STRIPE_DEEP_AUDIT_PRICE ||
      priceId === process.env.STRIPE_PRICE_DEEP_AUDIT;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vibetrace.app';

    // Build metadata — include user info only if authenticated
    const metadata: Record<string, string> = { priceId };
    if (userId) {
      metadata.user_id = userId;
      metadata.email = userEmail ?? '';
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isOneTime ? 'payment' : 'subscription',
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url:  `${appUrl}/pricing?checkout=cancelled`,
      metadata,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
