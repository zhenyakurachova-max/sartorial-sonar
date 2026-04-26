// Question definitions for the interview flow.
// Q1–Q3 are fixed and structured. Q4–Q10 are adaptive (Claude) with a fallback bank.

export type ChoiceQuestion = {
  kind: "choice";
  prompt: string;
  options: string[];
  allowOther?: boolean;
};

export type MultiPartQuestion = {
  kind: "multi";
  parts: { id: string; prompt: string; options: string[]; allowOther?: boolean }[];
};

export type OpenQuestion = {
  kind: "open";
  prompt: string;
};

export type Question = ChoiceQuestion | MultiPartQuestion | OpenQuestion;

export const FIXED_QUESTIONS: Question[] = [
  {
    kind: "choice",
    prompt: "Where do you spend most of your week — and what do you wear there?",
    options: [
      "Office / Hybrid work",
      "Mostly at home",
      "Client-facing / hospitality",
      "Mixed lifestyle",
    ],
    allowOther: true,
  },
  {
    kind: "choice",
    prompt: "What's your budget ceiling per piece?",
    options: ["Under €100", "€100–300", "€300–500", "Over €500"],
    allowOther: false,
  },
  {
    kind: "multi",
    parts: [
      {
        id: "frame",
        prompt: "How would you describe your frame?",
        options: ["Petite", "Tall", "Athletic", "Curvy", "Straight", "Plus"],
      },
      {
        id: "fit_challenges",
        prompt: "Any fit challenges you want me to work around?",
        options: [
          "Short torso",
          "Long torso",
          "Narrow shoulders",
          "Broad shoulders",
          "None",
        ],
        allowOther: true,
      },
      {
        id: "waist",
        prompt: "Do you prefer clothes that define your waist or sit relaxed?",
        options: ["Define my waist", "Relaxed fit", "Depends on the piece"],
      },
    ],
  },
];

// Pre-written fallback questions used if the AI call fails.
// Indexed by question_index (4..10 i.e. positions 3..9 zero-indexed).
export const FALLBACK_QUESTIONS: string[] = [
  "Which colours do you actually reach for — and which ones never make it out of the wardrobe?",
  "Name a person whose style you'd quietly steal from. What is it about how they dress?",
  "What's an absolute no for you — a silhouette, fabric, or trend you'll never wear?",
  "When you dress up, what's the occasion — and what do you reach for?",
  "Which materials make you feel like yourself? Which ones do you avoid?",
  "What's the most frustrating thing about your wardrobe right now?",
  "If you could only wear one outfit for a week, what would it be?",
];
