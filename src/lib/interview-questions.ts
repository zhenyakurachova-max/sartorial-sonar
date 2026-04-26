// Question definitions for the interview flow.
// Q1–Q3 are fixed/structured. Q4–Q10 are fixed open-text prompts.

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
    prompt: "What does your typical week look like?",
    options: [
      "I work in an office",
      "I work from home",
      "I'm mostly out and about — meetings, clients, errands",
      "I wear a uniform at work",
      "My week is a real mix",
      "Mostly social and personal life",
    ],
    allowOther: false,
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
        id: "love_dressing",
        prompt: "Which part of your body do you love dressing?",
        options: [
          "My shoulders and neckline",
          "My waist",
          "My legs",
          "My arms",
          "All of it honestly",
        ],
      },
      {
        id: "fit_feel",
        prompt: "How do you like your clothes to feel on your body?",
        options: [
          "Structured and tailored",
          "Relaxed and easy",
          "Fitted but comfortable",
          "Depends on the occasion",
        ],
      },
    ],
  },
];

export const FIXED_OPEN_QUESTIONS: OpenQuestion[] = [
  { kind: "open", prompt: "What's your go-to work outfit on a good day?" },
  { kind: "open", prompt: "Name one thing in your wardrobe you love and always reach for." },
  { kind: "open", prompt: "Name one thing in your wardrobe you never wear." },
  { kind: "open", prompt: "How would you describe your personal style in three words?" },
  { kind: "open", prompt: "Which designers or brands do you love, even if you can't always afford them?" },
  { kind: "open", prompt: "Where do you shop most?" },
  { kind: "open", prompt: "What do you want to feel like when you're dressed?" },
];
