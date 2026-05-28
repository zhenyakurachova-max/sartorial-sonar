import Stripe from "npm:stripe@14";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "placeholder_key";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "placeholder_secret";
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (e) {
    console.error("Webhook signature verification failed:", e);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.user_id;
  if (!userId) {
    console.error("No user_id in session metadata");
    return new Response(JSON.stringify({ error: "Missing user_id" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const amountEur = Math.round((session.amount_total ?? 2900) / 100);

  const { error: insertErr } = await supabase.from("purchases").insert({
    user_id: userId,
    stripe_session_id: session.id,
    amount_eur: amountEur,
    status: "completed",
  });
  if (insertErr) console.error("purchases insert error:", insertErr);

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ paid: true })
    .eq("id", userId);
  if (updateErr) console.error("profiles paid update error:", updateErr);

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
