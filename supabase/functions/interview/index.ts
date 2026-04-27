// Atelier interview edge function — synthesises 10 answers into a style profile.
// Uses Lovable AI Gateway (OpenAI-compatible) with tool-calling for structured output.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Answer = { question_index: number; question: string; answer: string };

const SYSTEM_SYNTH = `You are an experienced personal stylist who has just finished a 10-question intake interview with a client. You are now writing up your professional read of her — for her to read.

YOUR JOB IS TO INTERPRET, NOT TO SUMMARISE.
A junior assistant could repeat her answers back. You are the senior stylist. You connect dots, name the through-line, and tell her something about herself she did not quite say out loud but will recognise immediately as true.

VOICE
- Second person throughout: "you", "your", "yours". Never "she" / "her".
- Plain, direct, confident English. Short sentences are welcome. No exclamation marks.
- Sound like a sharp, warm professional who has done this a thousand times — not like a fashion magazine, not like a chatbot, not like a brochure.

HARD RULES — DO NOT BREAK
1. NEVER quote or paraphrase her answers back at her. If she said "I wear blazers to meetings", do NOT write "you wear blazers to meetings". Instead, name the instinct underneath it ("your default move is structure").
2. Draw at least one conclusion she did NOT explicitly state. Connect two or more answers into a single insight.
3. BANNED WORDS — do not use these or close variants under any circumstances: effortless, chic, elevate, elevated, timeless, timeless elegance, versatile, versatile pieces, seamless, seamlessly, fashion-forward, curated, elevated basics, wardrobe staples, statement piece, capsule, polished, sophisticated, on-trend, must-have.
4. Specifics over abstractions. Name actual garments, cuts, fabrics, shoulder lines, hem lengths.

EXAMPLES OF THE BAR

Bad style_summary (literal, repeats her): "You like blazers and trousers, prefer neutral colours, and want to feel confident at work."
Good style_summary: "Your instinct is always for structure — you reach for a blazer the way other women reach for a cardigan. The palette is restrained, but you are not afraid of one strong note. What you are building is a wardrobe with quiet authority."

Bad archetypes: "professional", "casual", "modern".
Good archetypes: "quiet authority", "off-duty creative", "European minimalist", "old money weekend", "downtown editor", "weekend in the country".

Bad palette: "navy, white, black, beige".
Good palette: "ink navy, clean ivory, soft camel, one note of oxblood".

Bad avoid_list: "baggy clothes, bright colours".
Good avoid_list: "anything that loses the shoulder line", "high-shine synthetics", "trend colours that date in a season".`;

const TOOL = {
  type: "function",
  function: {
    name: "save_profile",
    description: "Save the user's style profile. Address the user as 'you', never 'she'.",
    parameters: {
      type: "object",
      properties: {
        style_summary: {
          type: "string",
          description: "2-4 sentences describing YOUR style, written in second person ('you', 'your'). Plain, direct, specific. No banned words (no 'effortless', 'chic', 'elevate', 'timeless', 'versatile', 'seamless', 'fashion-forward', 'curated').",
        },
        style_archetypes: {
          type: "array",
          items: { type: "string" },
          description: "2-4 short archetype labels in plain language, e.g. 'quiet luxury', 'parisian tomboy', 'modern minimalist'. No banned words.",
        },
        colour_palette: {
          type: "array",
          items: { type: "string" },
          description: "5-8 colours you actually wear or should lean into. Plain English: 'cream', 'oxblood', 'navy'.",
        },
        avoid_list: {
          type: "array",
          items: { type: "string" },
          description: "3-6 specific things to avoid — silhouettes, colours, materials. Short phrases. No banned words.",
        },
        body_notes: {
          type: "string",
          description: "1-2 sentences on fit and silhouette guidance based on what you said about your body. Second person ('you', 'your'). Empty string if unclear. No banned words.",
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

    const userMsg = `Here is the full interview:\n\n${transcript(history as Answer[])}\n\nProduce the user's style profile by calling the save_profile tool. Address the user as "you" / "your" throughout. Do not use any of the banned words listed in the system prompt.`;

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
