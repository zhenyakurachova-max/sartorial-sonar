// Atelier analyse-item edge function.
// Takes an uploaded wardrobe photo + the user's style profile and returns
// a verdict (keep/dump/gap), a one-line reason, and a few tags via Claude vision.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-5-sonnet-20240620";

const SYSTEM = `You are an experienced personal stylist looking at a single garment a client has just photographed from her wardrobe. You already know her style profile. Your job is to give a fast, honest professional read.

VOICE
- Second person: "you", "your". Never "she" / "her".
- Plain, direct, confident. No exclamation marks. No fashion-magazine fluff.
- Sound like a sharp friend with great taste, not a brochure.

VERDICT — pick exactly one
- "keep": the piece serves your style profile. It earns its hanger.
- "dump": the piece works against your style profile. Let it go.
- "gap": the piece is fine in itself, but it shows what's MISSING from your wardrobe — flag the gap it points to.

REASON
- ONE sentence. Maximum 20 words. Specific. Names a real reason — silhouette, fabric, colour, line, role in the wardrobe.
- Do NOT use these words: effortless, chic, elevate, elevated, timeless, versatile, seamless, fashion-forward, curated, polished, sophisticated, on-trend, must-have, statement piece, capsule, staple.

TAGS
- 2-4 short lowercase tags. Examples: "structured shoulder", "ink navy", "wool blend", "wide leg", "cropped", "high-shine".
- Concrete attributes only — no vague adjectives.`;

const TOOL = {
  name: "save_verdict",
  description: "Save the stylist's read of this single wardrobe item.",
  input_schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["keep", "dump", "gap"] },
      reason: { type: "string", description: "ONE sentence, max 20 words. Second person." },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "2-4 short concrete tags, lowercase.",
      },
    },
    required: ["verdict", "reason", "tags"],
    additionalProperties: false,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.log("[analyse-item] invoked", {
    method: req.method,
    hasAuth: !!req.headers.get("Authorization"),
    hasUrl: !!Deno.env.get("SUPABASE_URL"),
    hasService: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    hasAnon: !!Deno.env.get("SUPABASE_ANON_KEY"),
    hasAnthropic: !!Deno.env.get("ANTHROPIC_API_KEY"),
  });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("[analyse-item] missing Authorization header");
      return json({ error: "Not authenticated" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userRes, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userRes?.user) {
      console.warn("[analyse-item] auth.getUser failed", { err: userErr?.message });
      return json({ error: "Not authenticated" }, 401);
    }
    const userId = userRes.user.id;
    console.log("[analyse-item] authed", { userId });

    const body = await req.json();
    const itemId = String(body?.item_id ?? "");
    if (!itemId) return json({ error: "Missing item_id" }, 400);

    // Fetch the item (must belong to user)
    const { data: item, error: itemErr } = await supabase
      .from("wardrobe_items")
      .select("id, user_id, image_path, category")
      .eq("id", itemId)
      .maybeSingle();
    if (itemErr || !item || item.user_id !== userId) {
      return json({ error: "Item not found" }, 404);
    }

    // Fetch profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("style_summary, colour_palette, style_archetypes, avoid_list, body_notes, budget_ceiling")
      .eq("id", userId)
      .maybeSingle();

    // Download the image bytes
    const { data: blob, error: dlErr } = await supabase.storage.from("wardrobe").download(item.image_path);
    if (dlErr || !blob) {
      console.error("download error", dlErr);
      return json({ error: "Couldn't read photo" }, 500);
    }
    const buf = new Uint8Array(await blob.arrayBuffer());
    // Base64 encode
    let binary = "";
    for (let i = 0; i < buf.byteLength; i++) binary += String.fromCharCode(buf[i]);
    const base64 = btoa(binary);
    const mediaType = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    console.log("[analyse-item] start", {
      itemId,
      userId,
      category: item.category,
      imageBytes: buf.byteLength,
      mediaType,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? apiKey.slice(0, 10) + "…" : null,
      hasProfile: !!profile,
    });
    if (!apiKey) {
      console.error("[analyse-item] ANTHROPIC_API_KEY missing in environment");
      await supabase.from("wardrobe_items").update({ status: "failed" }).eq("id", itemId);
      return json({ error: "Stylist isn't configured yet (missing API key)." }, 500);
    }

    const profileText = profile
      ? `STYLE PROFILE
Summary: ${profile.style_summary ?? "—"}
Archetypes: ${(profile.style_archetypes ?? []).join(", ") || "—"}
Palette: ${(profile.colour_palette ?? []).join(", ") || "—"}
Avoid: ${(profile.avoid_list ?? []).join("; ") || "—"}
Body notes: ${profile.body_notes ?? "—"}
Budget ceiling (EUR/piece): ${profile.budget_ceiling ?? "—"}`
      : "No style profile yet — judge on general principles of cut, fabric, colour.";

    const userText = `${profileText}

This item's category (as the user labelled it): ${item.category}

Look at the photo. Decide: keep, dump, or gap. Give a one-sentence reason (max 20 words) and 2-4 concrete tags. Call the save_verdict tool.`;

    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: userText },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "tool", name: "save_verdict" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[analyse-item] Anthropic error", {
        status: resp.status,
        statusText: resp.statusText,
        body: text.slice(0, 2000),
      });
      await supabase.from("wardrobe_items").update({ status: "failed" }).eq("id", itemId);
      let msg = "Couldn't analyse this photo. Try again.";
      if (resp.status === 401 || resp.status === 403) msg = "Stylist credentials rejected. Check the API key.";
      else if (resp.status === 429) msg = "Lots of requests right now. Try again in a moment.";
      else if (resp.status === 400 && /credit|balance|quota/i.test(text)) msg = "Stylist is out of credit.";
      return json({ error: msg, upstream_status: resp.status }, 200);
    }
    console.log("[analyse-item] Anthropic ok");

    const data = await resp.json();
    const toolUse = Array.isArray(data?.content)
      ? data.content.find((b: any) => b.type === "tool_use")
      : null;
    if (!toolUse?.input) {
      console.error("No tool_use", JSON.stringify(data));
      await supabase.from("wardrobe_items").update({ status: "failed" }).eq("id", itemId);
      return json({ error: "Couldn't read the result" }, 500);
    }

    const { verdict, reason, tags } = toolUse.input;
    const safeVerdict = ["keep", "dump", "gap"].includes(verdict) ? verdict : "keep";
    const safeTags = Array.isArray(tags) ? tags.slice(0, 6).map((t: any) => String(t)) : [];

    const { error: upErr } = await supabase
      .from("wardrobe_items")
      .update({
        status: "analysed",
        verdict: safeVerdict,
        reason: String(reason ?? "").slice(0, 240),
        tags: safeTags,
      })
      .eq("id", itemId);
    if (upErr) {
      console.error("update item error", upErr);
      return json({ error: "Couldn't save the result" }, 500);
    }

    return json({ verdict: safeVerdict, reason, tags: safeTags });
  } catch (e: any) {
    console.error("[analyse-item] uncaught error", {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
    });
    return json({ error: "Something went wrong analysing this photo.", detail: e?.message }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
