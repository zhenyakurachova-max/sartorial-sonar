import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function currencySymbol(c: string | null): string {
  if (!c) return "€";
  if (c.includes("GBP")) return "£";
  if (c.includes("USD")) return "$";
  if (c.includes("AED")) return "AED ";
  return "€";
}

// Maps the client's stated proportions to a feature-based styling note.
function proportionsNote(p: string): string {
  if (!p) return "";
  const low = p.toLowerCase();
  if (low.includes("legs are notably longer"))
    return "Legs are a standout proportional feature — celebrate leg length with higher hemlines, wide-leg cuts, and high-rise waistbands.";
  if (low.includes("torso is notably longer"))
    return "Torso is notably longer — use high-rise bottoms, cropped lengths, and waist-defining cuts to create balance.";
  if (low.includes("balanced"))
    return "Proportions are balanced — most silhouettes work well.";
  if (low.includes("broad shoulder"))
    return "Shoulders are a strong proportional feature — balance with wider-cut bottoms and avoid cap or puffed sleeves.";
  if (low.includes("narrower shoulder"))
    return "Shoulders are narrower than hips — structured shoulder seams, boat necks, and clean-cut tops add visual width.";
  if (low.includes("don't know") || low.includes("honest"))
    return "";
  return `Proportions: ${p}`;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    console.log("analyse-item health check reached");
    return new Response(JSON.stringify({ ok: true, function: "analyse-item" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    console.log("analyse-item request reached", req.method);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { item_id } = await req.json();
    console.log("Analysing item:", item_id, "for user:", user.id);

    const { data: item, error: itemError } = await supabase.from("wardrobe_items").select("*").eq("id", item_id).eq("user_id", user.id).single();
    if (itemError || !item) { console.error("Item error:", itemError); return new Response(JSON.stringify({ error: "Item not found" }), { status: 404, headers: corsHeaders }); }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    console.log("Profile found:", !!profile);

    const { data: imageData, error: downloadError } = await supabase.storage.from("wardrobe").download(item.image_path);
    if (downloadError) { console.error("Download error:", downloadError); return new Response(JSON.stringify({ error: "Could not download image: " + downloadError.message }), { status: 500, headers: corsHeaders }); }

    const arrayBuffer = await imageData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(binary);
    const mediaType = (imageData.type && imageData.type.startsWith("image/")) ? imageData.type : "image/jpeg";
    console.log("Image encoded, size:", base64.length, "type:", mediaType);

    // Claude checks the base64 string length directly (limit: 5,242,880 bytes = 5 MB base64,
    // which is ~3.75 MB of raw image data). Check base64.length, not the decoded size.
    if (base64.length > 5242880) {
      return new Response(JSON.stringify({ error: "IMAGE_TOO_LARGE" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) { console.error("No ANTHROPIC_API_KEY"); return new Response(JSON.stringify({ error: "Missing API key" }), { status: 500, headers: corsHeaders }); }

    const propNote = proportionsNote(profile?.proportions || "");
    const styleRulesNote = profile?.style_rules ? ` Hard constraints (cuts/styles that do not work): ${profile.style_rules}.` : "";
    const systemPrompt = `You are a personal stylist with strong opinions. Style profile: ${profile?.style_summary || "classic and polished"}. Palette: ${(profile?.colour_palette || []).join(", ")}. Archetypes: ${(profile?.style_archetypes || []).join(", ")}. Avoid: ${(profile?.avoid_list || []).join(", ")}. Body notes: ${profile?.body_notes || "none"}.${propNote ? ` ${propNote}` : ""}${styleRulesNote}

Assess the clothing item in the photo. Return ONLY valid JSON, no markdown, no explanation:
{ "verdict": "keep", "reason": "one sentence max 20 words", "tags": ["tag1", "tag2"] }

verdict must be exactly one of: keep, dump, gap
- keep: fits the client's profile and is good quality
- dump: wrong for the client's style or poor quality
- gap: good item but the client needs more like this`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }, { type: "text", text: `Category: ${item.category}.${item.brand ? ` Brand: ${item.brand}.` : ""} Give verdict.` }] }]
      })
    });

    const anthropicData = await response.json();
    console.log("Anthropic status:", response.status, "response:", JSON.stringify(anthropicData).slice(0, 500));

    if (!response.ok) return new Response(JSON.stringify({ error: "Claude error: " + JSON.stringify(anthropicData) }), { status: 500, headers: corsHeaders });

    const text = anthropicData.content?.[0]?.text;
    if (!text) return new Response(JSON.stringify({ error: "No text in response" }), { status: 500, headers: corsHeaders });

    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const result = JSON.parse(cleaned);
    console.log("Result:", result);

    const verdict = String(result.verdict ?? "").toLowerCase();
    if (!["keep", "dump", "gap"].includes(verdict)) {
      return new Response(JSON.stringify({ error: "Invalid verdict returned: " + JSON.stringify(result) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from("wardrobe_items")
      .update({ verdict, reason: result.reason ?? null, tags: Array.isArray(result.tags) ? result.tags : [], status: "analysed" })
      .eq("id", item_id)
      .eq("user_id", user.id)
      .select("id, image_path, category, status, verdict, reason, tags, created_at")
      .single();
    if (updateError || !updatedItem) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: "Could not save analysis: " + (updateError?.message ?? "No updated item returned") }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Updated wardrobe item:", updatedItem.id, updatedItem.status, updatedItem.verdict);
    return new Response(JSON.stringify({ ...updatedItem, verdict: updatedItem.verdict, reason: updatedItem.reason, tags: updatedItem.tags ?? [], item: updatedItem }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Function error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
