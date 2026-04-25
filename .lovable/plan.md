
# Ticket 1 — Foundation, Auth, Interview

Scope: design system, signup screen, and a working interview screen that produces a saved style profile. Wardrobe, photo analysis, payment, and email come in later tickets.

## Stack notes (deviations from your brief)

The brief asks for Next.js 15, raw Supabase, and Vercel. Lovable runs **React 18 + Vite + TypeScript + Tailwind + shadcn/ui** with **Lovable Cloud** (managed Supabase: same auth, Postgres, storage, edge functions) — published from Lovable, optionally to a custom domain. Everything else stays as you asked: **Anthropic Claude (claude-sonnet-4-6)** for the AI via an edge function, **Stripe** in a later ticket via the built-in integration, **Resend** in a later ticket via secret + edge function.

You'll need to add an **`ANTHROPIC_API_KEY`** secret before the interview can talk to Claude. I'll prompt for it at the right moment.

## Design system

Set up once, reused everywhere. All tokens in `index.css` + `tailwind.config.ts`, all colours HSL.

- **Background** ivory `#FAF8F3`, **foreground** near-black `#1A1A1A`
- **Accent** dusky burgundy `#6B2C39` with a paler tint for hover/focus rings and a deep variant for pressed states
- **Verdict tokens** (used in ticket 2): `keep` deep green, `dump` muted terracotta, `gap` warm amber — each always paired with a text label
- **Type**: Playfair Display (headings, weights 400/600), Inter (body, 400/500), loaded from Google Fonts in `index.html`
- **Spacing**: generous — base padding `px-6`, sections `py-12+`, max content width `max-w-md` on mobile
- **Components**: shadcn `Button`, `Input`, `Label`, `Textarea`, `Card`, `Progress`, `Toaster`, restyled away from default slate
- **Tone helpers**: a small `lib/copy.ts` holding standard error/empty-state strings so we don't drift into hedging language. No exclamation marks anywhere.

## Screen 1 — `/signup`

Single centred card on ivory.

- Serif headline: "Let's see what's in your wardrobe."
- One-line subhead: "Sign in to start. We'll send a link to your inbox."
- Email input + "Send link" → `supabase.auth.signInWithOtp` with `emailRedirectTo: window.location.origin + '/app/interview'`
- Divider "or"
- "Continue with Google" → `signInWithOAuth({ provider: 'google' })`
- Success state: "Check your inbox. The link expires in an hour."
- Error: "That didn't go through. Try again in a moment."

Auth wiring: a `useAuth` hook with `onAuthStateChange` registered **before** `getSession()`, session in context. A `<RequireAuth>` wrapper redirects unauthenticated users from `/app/*` to `/signup`.

Google OAuth needs to be enabled in Cloud → Users → Auth Settings (I'll point you to it once the screen is built).

## Screen 2 — `/app/interview`

Conversational, one question at a time, feels like a chat.

**Layout**
- Slim top bar: brand wordmark left, progress text right ("3 of 10")
- Thin `Progress` bar under it
- Question rendered as a serif statement, large, generous breathing room
- Single `Textarea` (auto-grows), "Next" right-aligned, "Back" ghost left
- Subtle fade/slide between questions

**Question flow (hybrid: 3 fixed + 7 adaptive)**

Three fixed openers cover the basics. Claude generates the next seven adaptively from prior answers.

1. "Where do you spend most of your week — and what do you wear there?"
2. "What's your budget ceiling for a single piece you'd actually buy?"
3. "Anything about your body or how clothes fit that I should know?"

Then 7 AI-generated follow-ups covering colour preferences, references / archetypes, hard nos, occasions she dresses up for, materials and comfort, current frustrations, and one wildcard.

**Edge function `interview` (Claude)**
- Reads `ANTHROPIC_API_KEY` from secrets, calls `claude-sonnet-4-6` via `https://api.anthropic.com/v1/messages`
- Validates input with Zod, full CORS, surfaces Anthropic 429 / 529 / 401 errors as friendly messages
- Mode A — `next_question`: input is the transcript; returns the next question text
- Mode B — `synthesise`: input is all 10 Q&A; returns structured profile via Claude tool-use — `style_summary` (paragraph), `colour_palette` (array), `style_archetypes` (array), `avoid_list` (array), `body_notes` (string), `budget_ceiling` (number)

**On completion**
- Profile written to `profiles` for the current user
- Success screen: "Your profile's ready." + 4-line preview (archetypes, palette swatches, budget, top avoid) + button "Start your wardrobe →" linking to `/app/wardrobe` (stub for now)

## Database (ticket 1 subset)

Only what this ticket needs. Other tables (`wardrobe_items`, `audit_sessions`, `gap_summaries`, `recommendations`, `purchases`) come with their respective tickets so RLS stays focused.

- `profiles` — `id uuid PK references auth.users on delete cascade`, `style_summary text`, `colour_palette text[]`, `style_archetypes text[]`, `avoid_list text[]`, `body_notes text`, `budget_ceiling int`, `created_at`, `updated_at`
- `interview_answers` — `id`, `user_id`, `question_index int`, `question text`, `answer text`, `created_at`. Lets us resume mid-interview and gives Claude full context each turn.
- Trigger: auto-create empty `profiles` row on `auth.users` insert
- RLS: users can `select` / `insert` / `update` only their own rows on both tables

## File layout

```text
src/
  index.css                     design tokens
  lib/copy.ts                   tone-of-voice strings
  lib/supabase.ts               client (auto-generated)
  hooks/useAuth.tsx             session + onAuthStateChange
  components/RequireAuth.tsx
  components/BrandMark.tsx
  pages/Signup.tsx
  pages/Interview.tsx
  pages/InterviewComplete.tsx
  pages/WardrobeStub.tsx        placeholder for ticket 2
supabase/functions/interview/index.ts
```

Routes in `App.tsx`: `/`, `/signup`, `/app/interview`, `/app/wardrobe` (stub), catch-all `NotFound`.

## What's explicitly **not** in this ticket

- Photo upload, vision analysis, verdict badges, gap summary, recommendations
- Stripe €29 unlock
- Resend transactional emails
- Account / settings screen

## Acceptance — done when

1. New visitor lands on `/signup`, signs in via magic link or Google, arrives on `/app/interview` authenticated
2. Can answer 10 questions; each AI-generated question references prior answers
3. On submit, a populated `profiles` row exists and the completion screen shows it back
4. Refreshing mid-interview resumes at the right question
5. Visiting `/app/interview` while logged out redirects to `/signup`
6. Design matches the editorial direction: ivory bg, dusky burgundy accent, Playfair headings, no exclamation marks in UI copy
