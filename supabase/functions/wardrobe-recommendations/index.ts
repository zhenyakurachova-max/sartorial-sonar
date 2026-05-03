import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  name: "save_recommendations",
  description: "Return three specific buyable wardrobe recommendations for one wardrobe gap.",
  input_schema: {
    type: "object",
    properties: {
      recommendations: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            designer: { type: "string" },
            piece_name: { type: "string" },
            reason: { type: "string" },
            price_eur: { type: "string" },
            search_query: { type: "string" },
          },
          required: ["designer", "piece_name", "reason", "price_eur", "search_query"],
          additionalProperties: false,
        },
      },
    },
    required: ["recommendations"],
    additionalProperties: false,
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { gap } = await req.json();
    if (!gap?.description && !gap?.title) {
      return new Response(JSON.stringify({ error: "Missing gap description" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "Missing API key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const systemPrompt = `You are a senior personal shopper. Recommend exactly three specific pieces for this wardrobe gap.

CLIENT PROFILE
Style summary: ${profile?.style_summary || "—"}
Archetypes: ${(profile?.style_archetypes || []).join(", ") || "—"}
Palette: ${(profile?.colour_palette || []).join(", ") || "—"}
Avoid: ${(profile?.avoid_list || []).join(", ") || "—"}
Body notes: ${profile?.body_notes || "—"}
Proportions: ${profile?.proportions || "—"}
Budget per piece: €${profile?.budget_ceiling || "—"}

Use real designers or brands, concrete piece names, approximate EUR pricing, and searchable wording. Keep reasons under 18 words.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: `Gap title: ${gap.title || "Wardrobe gap"}\nGap description: ${gap.description || gap.title}` }],
        tools: [TOOL],
        tool_choice: { type: "tool", name: "save_recommendations" },
      }),
    });

    const data = await resp.json();
    if (!resp.ok) return new Response(JSON.stringify({ error: "Claude error: " + JSON.stringify(data) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const toolUse = Array.isArray(data?.content) ? data.content.find((b: any) => b.type === "tool_use") : null;
    const recommendations = toolUse?.input?.recommendations;
    if (!Array.isArray(recommendations)) return new Response(JSON.stringify({ error: "No recommendations returned" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ recommendations }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("wardrobe-recommendations error", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});