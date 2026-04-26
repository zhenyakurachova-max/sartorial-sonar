/**
 * Tone of voice helpers.
 * Direct, warm, like a friend with good taste. No exclamation marks.
 * Keep all user-facing strings here so we don't drift into cheery copy.
 */

export const copy = {
  brand: "Atelier",

  signup: {
    heading: "Let's see what's in your wardrobe.",
    sub: "Sign in to start. We'll send a link to your inbox.",
    emailPlaceholder: "you@example.com",
    sendLink: "Send link",
    sending: "Sending…",
    google: "Continue with Google",
    or: "or",
    sentHeading: "Check your inbox.",
    sentBody: "The link expires in an hour. You can close this tab.",
    errorGeneric: "That didn't go through. Try again in a moment.",
  },

  interview: {
    intro: "Ten questions. Three minutes. Then we get to the wardrobe.",
    progress: (i: number, total: number) => `${i} of ${total}`,
    placeholder: "Take your time.",
    next: "Next",
    back: "Back",
    finish: "Finish",
    thinking: "Thinking…",
    saving: "Saving your profile…",
    errorThinking: "Couldn't generate the next question. Try again in a moment.",
    errorSaving: "Couldn't save that. Try once more.",
  },

  complete: {
    heading: "Your profile's ready.",
    sub: "Here's what we picked up. You can refine it later.",
    cta: "Start your wardrobe",
  },

  empty: {
    wardrobe: "Nothing here yet. Start by photographing something you love — or something you're not sure about.",
  },
};
