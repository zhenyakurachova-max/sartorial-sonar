import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { item_id } = await req.json();
    console.log("Analysing item:", item_id, "for user:", user.id);

    const { data: item, error: itemError } = await supabase.from("wardrobe_items").select("*").eq("id", item_id).eq("user_id", user.id).single();
    if (itemError || !item) { console.error("Item error:", itemError); return new Response(JSON.stringify({ error: "Item not found" }), { status: 404, headers: corsHeaders }); }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    console.log("Profile found:", !!profile);

    const { data: imageData, error: downloadError } = await supabase.storage.from("wardrobe").download(item.image_path);
    if (downloadError) { console.error("Download error:", downloadError); return new Response(JSON.stringify({ error: "Could not download image: " + downloadError.message }), { status: 500, headers: corsHeaders }); }

    const arrayBuffer = await imageData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    console.log("Image encoded, size:", base64.length);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) { console.error("No ANTHROPIC_API_KEY"); return new Response(JSON.stringify({ error: "Missing API key" }), { status: 500, headers: corsHeaders }); }

    const systemPrompt = `You are a personal stylist with strong opinions. Style profile: ${profile?.style_summary || "classic and polished"}. Palette: ${(profile?.colour_palette || []).join(", ")}. Archetypes: ${(profile?.style_archetypes || []).join(", ")}. Avoid: ${(profile?.avoid_list || []).join(", ")}.

Assess the clothing item in the photo. Return ONLY valid JSON, no markdown, no explanation:
{ "verdict": "keep", "reason": "one sentence max 20 words", "tags": ["tag1", "tag2"] }

verdict must be exactly one of: keep, dump, gap
- keep: fits her profile and is good quality
- dump: wrong for her style or poor quality  
- gap: good item but she needs more like this`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } }, { type: "text", text: `Category: ${item.category}. Give verdict.` }] }]
      })
    });

    const anthropicData = await response.json();
    console.log("Anthropic status:", response.status, "response:", JSON.stringify(anthropicData));

    if (!response.ok) return new Response(JSON.stringify({ error: "Claude error: " + JSON.stringify(anthropicData) }), { status: 500, headers: corsHeaders });

    const text = anthropicData.content?.[0]?.text;
    if (!text) return new Response(JSON.stringify({ error: "No text in response" }), { status: 500, headers: corsHeaders });

    const result = JSON.parse(text);
    console.log("Result:", result);

    await supabase.from("wardrobe_items").update({ verdict: result.verdict, reason: result.reason, tags: result.tags, analysed_at: new Date().toISOString(), status: "analysed" }).eq("id", item_id);

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Function error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
