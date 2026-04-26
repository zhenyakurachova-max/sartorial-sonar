// Atelier interview edge function — calls Anthropic Claude.
// One mode:
//   - "synthesise": given all 10 fixed answers, return a structured style profile
// Uses Claude tool-use for reliable structured output.

import { corsHeaders } from "@supabase/supabase-js/cors";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

type Answer = { question_index: number; question: string; answer: string };

const SYSTEM_SYNTH = `You are Atelier, distilling a 10-question style interview into a usable style profile. Write with editorial confidence — like a stylist's notes, not a personality quiz. No exclamation marks.`;

async function callClaude(body: Record<string, unknown>) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Anthropic error", resp.status, text);
    const err = new Error(`Anthropic ${resp.status}`);
    // @ts-expect-error attach for handler
    err.status = resp.status;
    throw err;
  }
  return await resp.json();
}

function transcript(history: Answer[]) {
  return history
    .sort((a, b) => a.question_index - b.question_index)
    .map((h) => `Q${h.question_index + 1}: ${h.question}\nA: ${h.answer}`)
    .join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { mode, history } = await req.json();
    if (!mode || !Array.isArray(history)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "synthesise") {
      const userMsg = `Here is the full interview:\n\n${transcript(history as Answer[])}\n\nProduce her style profile by calling the save_profile tool.`;

      const data = await callClaude({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_SYNTH,
        tools: [
          {
            name: "save_profile",
            description: "Save the woman's style profile.",
            input_schema: {
              type: "object",
              properties: {
                style_summary: {
                  type: "string",
                  description: "2-4 sentences capturing her style in editorial voice. Confident, specific.",
                },
                style_archetypes: {
                  type: "array",
                  items: { type: "string" },
                  description: "2-4 short archetype labels, e.g. 'quiet luxury', 'parisian tomboy', 'modern minimalist'.",
                },
                colour_palette: {
                  type: "array",
                  items: { type: "string" },
                  description: "5-8 colours she actually wears or should lean into. Plain English names: 'cream', 'oxblood', 'navy'.",
                },
                avoid_list: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-6 specific things she should avoid — silhouettes, colours, materials. Short phrases.",
                },
                body_notes: {
                  type: "string",
                  description: "1-2 sentences on fit and silhouette guidance based on what she said about her body. Empty string if she didn't share.",
                },
                budget_ceiling: {
                  type: "integer",
                  description: "Per-piece budget ceiling in her stated currency, as a whole number. 0 if unclear.",
                },
              },
              required: [
                "style_summary",
                "style_archetypes",
                "colour_palette",
                "avoid_list",
                "body_notes",
                "budget_ceiling",
              ],
            },
          },
        ],
        tool_choice: { type: "tool", name: "save_profile" },
        messages: [{ role: "user", content: userMsg }],
      });

      const toolUse = data?.content?.find((c: { type: string }) => c.type === "tool_use");
      if (!toolUse?.input) throw new Error("No tool_use in response");

      return new Response(JSON.stringify({ profile: toolUse.input }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const status = (e as { status?: number })?.status;
    let userMessage = "Something went wrong. Try again in a moment.";
    if (status === 429) userMessage = "Too many requests. Try again in a moment.";
    if (status === 401) userMessage = "AI key isn't valid. Check the project secrets.";
    if (status === 529) userMessage = "AI is overloaded right now. Try again shortly.";
    console.error("interview function error:", e);
    return new Response(JSON.stringify({ error: userMessage }), {
      status: status && status >= 400 && status < 600 ? status : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
