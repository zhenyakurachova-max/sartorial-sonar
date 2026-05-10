import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function proportionsNote(p: string): string {
  if (!p) return "";
  const low = p.toLowerCase();
  if (low.includes("legs are notably longer"))
    return "Legs are a standout proportional feature — celebrate leg length with higher hemlines, wide-leg cuts, and high-rise waistbands.";
  if (low.includes("torso is notably longer"))
    return "Torso is notably longer — use high-rise bottoms, cropped lengths, and waist-defining cuts to balance.";
  if (low.includes("balanced"))
    return "Proportions are balanced — most silhouettes work well.";
  if (low.includes("broad shoulder"))
    return "Shoulders are a strong proportional feature — balance with wider-cut bottoms and avoid cap sleeves.";
  if (low.includes("narrower shoulder"))
    return "Shoulders are narrower than hips — structured shoulder seams, boat necks, and clean-cut tops add visual balance.";
  if (low.includes("don't know") || low.includes("honest"))
    return "";
  return `Proportions: ${p}`;
}

const TOOL = {
  name: "save_gaps",
  description: "Identify the 3-5 most important gaps in this wardrobe.",
  input_schema: {
    type: "object",
    properties: {
      gaps: {
        type: "array",
        description: "Between 3 and 5 gaps.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short concrete name for the gap, e.g. 'A proper navy blazer'." },
            description: { type: "string", description: "One sentence, max 25 words. Tell the client why they need it given their wardrobe and style." },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["title", "description", "priority"],
          additionalProperties: false,
        },
      },
    },
    required: ["gaps"],
    additionalProperties: false,
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    const { data: items } = await supabase
      .from("wardrobe_items")
      .select("category, verdict, reason, tags")
      .eq("user_id", user.id)
      .eq("status", "analysed");

    if (!items || items.length < 3) {
      return new Response(JSON.stringify({ error: "Need at least 3 analysed items." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "Missing API key" }), { status: 500, headers: corsHeaders });

    const inventory = items.map((it: any) =>
      `- ${it.category} (${it.verdict}) — tags: ${(it.tags || []).join(", ") || "none"}${it.reason ? ` — ${it.reason}` : ""}`
    ).join("\n");

    const propNote = proportionsNote(profile?.proportions || "");

    const systemPrompt = `You are a senior personal stylist. Identify the 3-5 most important gaps in this client's wardrobe. Be specific, not generic — name actual garments.

CLIENT PROFILE
Style summary: ${profile?.style_summary || "—"}
Archetypes: ${(profile?.style_archetypes || []).join(", ") || "—"}
Palette: ${(profile?.colour_palette || []).join(", ") || "—"}
Avoid: ${(profile?.avoid_list || []).join(", ") || "—"}
Body notes: ${profile?.body_notes || "—"}
${propNote ? `Proportions insight: ${propNote}` : ""}
Budget per piece: €${profile?.budget_ceiling || "—"}

Banned words: effortless, chic, elevate, elevated, timeless, versatile, seamless, fashion-forward, curated, polished, sophisticated, must-have, statement piece, capsule.`;

    const userMsg = `Client's current wardrobe (analysed):\n\n${inventory}\n\nReturn the top gaps via the save_gaps tool. Priority high = client needs it now, medium = next season, low = nice to have.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
        tools: [TOOL],
        tool_choice: { type: "tool", name: "save_gaps" },
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("Anthropic error", resp.status, JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Claude error: " + JSON.stringify(data) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const toolUse = Array.isArray(data?.content) ? data.content.find((b: any) => b.type === "tool_use") : null;
    if (!toolUse?.input?.gaps) {
      console.error("No tool_use in response", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "No gaps returned" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const gaps = toolUse.input.gaps;

    const { error: upsertErr } = await supabase
      .from("gap_summaries")
      .upsert({ user_id: user.id, gaps, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (upsertErr) console.error("gap_summaries upsert error", upsertErr.message);

    return new Response(JSON.stringify({ gaps }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("wardrobe-gaps error", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
