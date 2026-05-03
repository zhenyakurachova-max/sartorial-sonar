// Atelier interview edge function — synthesises 10 answers into a style profile.
// Calls Anthropic Claude directly with tool-use for structured output.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5-20251001";

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
  name: "save_profile",
  description: "Save the user's style profile. Address the user as 'you', never 'she'.",
  input_schema: {
    type: "object",
    properties: {
      style_summary: {
        type: "string",
        description: "EXACTLY 2-3 sentences. A stylist's interpretation of who you are dressing as — not a recap of your answers. Must contain at least one insight you did not state outright. Second person ('you', 'your'). No banned words. Never quote the user back to herself.",
      },
      style_archetypes: {
        type: "array",
        items: { type: "string" },
        description: "2-3 specific, evocative archetype labels. Examples: 'quiet authority', 'off-duty creative', 'European minimalist', 'old money weekend'. NOT generic labels like 'professional' or 'casual'. Lowercase. No banned words.",
      },
      colour_palette: {
        type: "array",
        items: { type: "string" },
        description: "MAXIMUM 4 colours. Use precise, evocative names — 'ink navy' not 'navy', 'clean ivory' not 'white', 'soft camel' not 'beige', 'oxblood' not 'red'. Lowercase.",
      },
      avoid_list: {
        type: "array",
        items: { type: "string" },
        description: "3-5 SPECIFIC things to avoid — name the actual problem, not a vague category. 'Anything that loses the shoulder line' not 'baggy clothes'. 'High-shine synthetics' not 'cheap fabrics'. No banned words.",
      },
      body_notes: {
        type: "string",
        description: "1-2 sentences of fit and silhouette guidance, written as a stylist's read of your shape — not a recap of what you said. Second person. Empty string if truly unclear. No banned words.",
      },
      proportions: {
        type: "string",
        description: "Verbatim her stated proportions answer (e.g. 'Long legs, shorter torso'). Empty string if she said she doesn't know.",
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
      "proportions",
      "budget_ceiling",
    ],
    additionalProperties: false,
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

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const userMsg = `Here is the full intake interview:\n\n${transcript(history as Answer[])}\n\nNow write up your professional read by calling the save_profile tool.\n\nReminders before you write:\n- Do NOT repeat her words back. Interpret.\n- Name at least one through-line she did not state outright.\n- Archetypes must be specific and evocative (e.g. "quiet authority"), not generic.\n- Maximum 4 colours, with precise names ("ink navy", not "navy").\n- Avoid_list must name the actual problem ("anything that loses the shoulder line"), not a vague category.\n- No banned words. Second person throughout.`;

    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_SYNTH,
        messages: [{ role: "user", content: userMsg }],
        tools: [TOOL],
        tool_choice: { type: "tool", name: "save_profile" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Anthropic error", resp.status, text);
      let userMessage = "Something went wrong building your profile. Try again in a moment.";
      if (resp.status === 429) userMessage = "Lots of requests right now. Try again in a moment.";
      if (resp.status === 401) userMessage = "Anthropic API key is invalid.";
      return new Response(JSON.stringify({ error: userMessage }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolUse = Array.isArray(data?.content)
      ? data.content.find((b: any) => b.type === "tool_use")
      : null;
    if (!toolUse?.input) {
      console.error("No tool_use in Anthropic response", JSON.stringify(data));
      throw new Error("No tool_use in response");
    }
    const profile = toolUse.input;

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
