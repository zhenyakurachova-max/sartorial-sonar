// Atelier interview edge function — synthesises 10 answers into a style profile.
// Uses Lovable AI Gateway (OpenAI-compatible) with tool-calling for structured output.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Answer = { question_index: number; question: string; answer: string };

const SYSTEM_SYNTH = `You are Atelier, distilling a 10-question style interview into a usable style profile.

VOICE RULES — read carefully:
- Write in plain, direct English. Sound like a real person, not a fashion magazine.
- Address the user in the SECOND PERSON: "you", "your", "yours". Never "she", "her", "hers".
- No exclamation marks.
- BANNED WORDS — do not use any of these or close variants: "effortless", "chic", "elevate", "elevated", "timeless elegance", "timeless", "versatile pieces", "versatile", "seamlessly", "seamless", "fashion-forward", "curated", "elevated basics", "wardrobe staples".
- Replace fancy phrases with plain ones. Examples: instead of "effortless chic" say "easy and unfussy". Instead of "timeless elegance" say "classic and well-made". Instead of "versatile pieces" say "things you can wear lots of ways".
- Specific over abstract. Name actual garments, colours, shapes.`;

const TOOL = {
  type: "function",
  function: {
    name: "save_profile",
    description: "Save the woman's style profile.",
    parameters: {
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
          description: "5-8 colours she actually wears or should lean into. Plain English: 'cream', 'oxblood', 'navy'.",
        },
        avoid_list: {
          type: "array",
          items: { type: "string" },
          description: "3-6 specific things she should avoid — silhouettes, colours, materials. Short phrases.",
        },
        body_notes: {
          type: "string",
          description: "1-2 sentences on fit and silhouette guidance based on what she said about her body. Empty string if unclear.",
        },
        budget_ceiling: {
          type: "integer",
          description: "Per-piece budget ceiling in EUR as a whole number. 0 if unclear.",
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
      additionalProperties: false,
    },
  },
};

function transcript(history: Answer[]) {
  return history
    .sort((a, b) => a.question_index - b.question_index)
    .map((h) => `Q${h.question_index + 1}: ${h.question}\nA: ${h.answer}`)
    .join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { history } = await req.json();
    if (!Array.isArray(history) || history.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const userMsg = `Here is the full interview:\n\n${transcript(history as Answer[])}\n\nProduce her style profile by calling the save_profile tool.`;

    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_SYNTH },
          { role: "user", content: userMsg },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "save_profile" } },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Gateway error", resp.status, text);
      let userMessage = "Something went wrong building your profile. Try again in a moment.";
      if (resp.status === 429) userMessage = "Lots of requests right now. Try again in a moment.";
      if (resp.status === 402) userMessage = "AI credits are exhausted. Top up Lovable AI to continue.";
      return new Response(JSON.stringify({ error: userMessage }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in gateway response", JSON.stringify(data));
      throw new Error("No tool_call in response");
    }
    const profile = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ profile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("interview function error:", e);
    return new Response(
      JSON.stringify({ error: "Something went wrong building your profile. Try again in a moment." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
