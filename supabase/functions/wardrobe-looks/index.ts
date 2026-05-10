import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  name: "save_looks",
  description: "Suggest 2-3 outfit combinations using only items from the provided wardrobe.",
  input_schema: {
    type: "object",
    properties: {
      looks: {
        type: "array",
        description: "Between 2 and 3 outfit combinations using only the listed items.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short evocative name for the look, e.g. 'Sunday in the country'. No banned words." },
            item_ids: {
              type: "array",
              items: { type: "string" },
              description: "The [ID:...] values from the inventory for items used in this look. List 2-4 item IDs that make up the outfit.",
            },
            pieces: { type: "array", items: { type: "string" }, description: "Human-readable description of each piece used. Name each by category and brand if known." },
            styling_note: { type: "string", description: "One sentence on how to wear it. Max 20 words. No banned words." },
          },
          required: ["title", "item_ids", "pieces", "styling_note"],
          additionalProperties: false,
        },
      },
    },
    required: ["looks"],
    additionalProperties: false,
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    const { data: items } = await supabase
      .from("wardrobe_items")
      .select("id, category, brand, tags, reason")
      .eq("user_id", user.id)
      .eq("status", "analysed")
      .eq("verdict", "keep");

    if (!items || items.length < 3) {
      return new Response(JSON.stringify({ error: "Need at least 3 kept items." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "Missing API key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const inventory = items.map((it: any) =>
      `- [ID:${it.id}] ${it.category}${it.brand ? ` (${it.brand})` : ""} — tags: ${(it.tags || []).join(", ") || "none"}${it.reason ? ` — ${it.reason}` : ""}`
    ).join("\n");

    const systemPrompt = `You are a senior personal stylist. Suggest 2-3 outfit combinations using ONLY items from this client's wardrobe. Be specific about which pieces combine and why they work together.

CLIENT PROFILE
Style summary: ${profile?.style_summary || "—"}
Archetypes: ${(profile?.style_archetypes || []).join(", ") || "—"}
Palette: ${(profile?.colour_palette || []).join(", ") || "—"}
Proportions: ${profile?.proportions || "—"}
${profile?.style_rules ? `Hard constraints — cuts/styles that do not work for the client: ${profile.style_rules}` : ""}

RULES
- Only use items that appear in the list below. Do not invent items the client doesn't own.
- Include the [ID:...] of each item you use in the item_ids field.
- BANNED WORDS: effortless, chic, elevate, elevated, timeless, versatile, seamless, fashion-forward, curated, polished, sophisticated, must-have, statement piece, capsule.`;

    const userMsg = `Wardrobe:\n\n${inventory}\n\nSuggest 2-3 outfit combinations using only these pieces.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
        tools: [TOOL],
        tool_choice: { type: "tool", name: "save_looks" },
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("Anthropic error", resp.status, JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Claude error: " + JSON.stringify(data) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const toolUse = Array.isArray(data?.content) ? data.content.find((b: any) => b.type === "tool_use") : null;
    if (!toolUse?.input?.looks) {
      return new Response(JSON.stringify({ error: "No looks returned" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ looks: toolUse.input.looks }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("wardrobe-looks error", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
