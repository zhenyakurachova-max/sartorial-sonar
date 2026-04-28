// Question definitions for the interview flow.
// Q1–Q3 are fixed/structured. Q4–Q10 are open-text or chip-based prompts.

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
  // Optional chip-based input. If omitted, render a free-text box.
  chips?: {
    select: "single" | "multi";
    options: string[];
    allowOther?: boolean;
    maxSelect?: number;
    helperText?: string;
  };
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
  // Q4
  { kind: "open", prompt: "What do you reach for when you want to look your best?" },
  // Q5
  { kind: "open", prompt: "Name one thing in your wardrobe you love and always reach for." },
  // Q6
  { kind: "open", prompt: "Name one thing in your wardrobe you never wear." },
  // Q7 — multi-select chips, up to 3, + Other
  {
    kind: "open",
    prompt: "How would you describe your personal style in three words?",
    chips: {
      select: "multi",
      maxSelect: 3,
      helperText: "Pick up to 3",
      options: [
        "Classic",
        "Minimal",
        "Bold",
        "Relaxed",
        "Polished",
        "Creative",
        "Understated",
        "Eclectic",
      ],
      allowOther: true,
    },
  },
  // Q8
  { kind: "open", prompt: "Which designers or brands do you love, even if you can't always afford them?" },
  // Q9 — multi-select chips
  {
    kind: "open",
    prompt: "Where do you shop most?",
    chips: {
      select: "multi",
      options: [
        "Independent boutiques",
        "Designer brands and stores",
        "Department stores",
        "High street chains",
        "Online mostly",
        "Vintage and second-hand",
        "Mix of everything",
      ],
      allowOther: false,
    },
  },
  // Q10 — multi-select chips, up to 2, + Other
  {
    kind: "open",
    prompt: "What do you want to feel like when you're dressed?",
    chips: {
      select: "multi",
      maxSelect: 2,
      helperText: "Pick up to 2",
      options: [
        "In control",
        "Confident",
        "Relaxed",
        "Polished",
        "Individual",
        "Understated",
        "Powerful",
        "Easy",
      ],
      allowOther: true,
    },
  },
];
