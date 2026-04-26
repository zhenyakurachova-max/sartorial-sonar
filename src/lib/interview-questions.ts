// Question definitions for the interview flow.
// Q1–Q3 are fixed and structured. Q4–Q10 are fixed open-text prompts.

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

export const FIXED_OPEN_QUESTIONS: OpenQuestion[] = [
  { kind: "open", prompt: "What's your go-to work outfit on a good day?" },
  { kind: "open", prompt: "Name one thing in your wardrobe you love and always reach for." },
  { kind: "open", prompt: "Name one thing hanging there you never wear — and why." },
  { kind: "open", prompt: "How would you describe your personal style in three words?" },
  { kind: "open", prompt: "Which designers or brands do you love, even if you can't always afford them?" },
  { kind: "open", prompt: "Where do you shop most — and where do you wish you shopped?" },
  { kind: "open", prompt: "What do you want to feel like when you're dressed?" },
];
