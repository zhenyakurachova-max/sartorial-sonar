// Question definitions for the interview flow.
// Q1–Q4 are fixed/structured. Q5–Q11 are open-text or chip-based prompts.

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
  // Q1 — Fix 2: mutually exclusive lifestyle options
  {
    kind: "choice",
    prompt: "What does your typical week look like?",
    options: [
      "Most of my week is office or workplace",
      "I mostly work from home",
      "I'm out and about — meetings, clients, on the move",
      "I wear a uniform for work",
      "My week is mostly social and personal",
      "It genuinely varies week to week",
    ],
    allowOther: false,
  },
  // Q2
  {
    kind: "choice",
    prompt: "What's your budget ceiling per piece?",
    options: ["Under €100", "€100–300", "€300–500", "Over €500"],
    allowOther: false,
  },
  // Q3
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
  // Q4 — Fix 3: feature-based proportions framing
  {
    kind: "choice",
    prompt: "How would you describe your leg-to-torso ratio?",
    options: [
      "My legs are notably longer than my torso",
      "My torso is notably longer than my legs",
      "Pretty balanced overall",
      "Broad shoulders relative to my hips",
      "Narrower shoulders relative to my hips",
      "I honestly don't know",
    ],
    allowOther: false,
  },
];

export const FIXED_OPEN_QUESTIONS: OpenQuestion[] = [
  // Q5
  { kind: "open", prompt: "What do you reach for when you want to look your best?" },
  // Q6
  { kind: "open", prompt: "Name one thing in your wardrobe you love and always reach for." },
  // Q7
  { kind: "open", prompt: "Name one thing in your wardrobe you never wear." },
  // Q8 — Fix 4: style archetypes, up to 2, no Other
  {
    kind: "open",
    prompt: "Which of these best describes your style?",
    chips: {
      select: "multi",
      maxSelect: 2,
      helperText: "Pick up to 2",
      options: ["Classic", "Minimal", "Elegant", "Romantic", "Edgy", "Relaxed", "Creative", "Not sure"],
      allowOther: false,
    },
  },
  // Q9
  { kind: "open", prompt: "Which designers or brands do you love, even if you can't always afford them?" },
  // Q10 — Fix 5: shopping, up to 2
  {
    kind: "open",
    prompt: "Where do you shop most?",
    chips: {
      select: "multi",
      maxSelect: 2,
      helperText: "Pick up to 2",
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
  // Q11 — up to 2
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
