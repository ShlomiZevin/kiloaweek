# KiloAWeek - קילו בשבוע

Shlomi's weight-loss method as an app: https://kiloaweek-app.web.app (Hebrew only, RTL, phone first, a PWA with
"add to home screen" and push). Built 2026-11-12. Reply to Shlomi in English; the app's UI is Hebrew.

**The base of everything is the weighing**: morning + evening every day → night burn (evening yesterday − morning
today), day gain (morning → evening), vs yesterday / vs same weekday last week, and the 7-day-average weekly trend
(goal 700 g–1 kg down). Plus before/after any activity (same clothes, no wet hair; net = before − after + what they
drank meanwhile, added while it runs), food counted mainly in protein / carbs / sugars (photo, typing or a voice message;
the AI never asks back - it assumes an average portion), a meal library (every logged meal, again in one tap), the AI
coach (offers log cards - meal / weight / water - that the user adds with one tap) and the multi-day analyst. The method
itself is `functions/bible.js` (his text, word for word) - it feeds the AI only; there is no method page in the app.

**His rules (2026-11-12 review):** the header always at the top and the tab bar always at the bottom (`.shell`: only
`.main` scrolls); home = ONE screen, no scrolling, on a 360x640 phone too; never the words פיפי / קקי (the toilet
activities come last, pictures only - `ACTS` in `calc.ts`); no Excel import / export anywhere; no suggested questions in
the chat, ever (and the coach never ends with a question); it must be obvious what is the user and what is the AI coach;
the profile picture opens an account menu whose entries open their own pages - no fake entries; design with GPT Image
first, then build to it - don't invent the look.

## Where things run

| Part | Where |
|---|---|
| The app (hosting), Google sign-in, Firestore | Firebase project `kiloaweek-app` (free plan) |
| The server: `kawApi` (meal / chat / analysis / transcribe / push test) + `kawReminders` (every 15 min) | **Shlomiverse project `boostmind-b052c`**, me-west1, functions codebase `kiloaweek` - his call 2026-11-12 (the Boostart billing account is at its project limit, so `kiloaweek-app` has no billing) |

The functions use `initializeApp({ projectId: 'kiloaweek-app' })`: they verify kiloaweek-app's ID tokens and read/write
its Firestore (boostmind's compute SA `463727469066-compute@` has `roles/datastore.user` on kiloaweek-app). The app calls
`https://me-west1-boostmind-b052c.cloudfunctions.net/kawApi/<path>` directly (CORS allows only kiloaweek-app's hosts +
localhost). Codebase `kiloaweek` means a techietech-api deploy never touches these two functions and vice versa.

**Keys** (secrets in boostmind-b052c): `VERSE_SITE_OPENAI_KEY` (his rule: a new live feature takes the site key - until he
makes a dedicated key; then create secret `KAW_OPENAI_KEY` and change `defineSecret` in `functions/index.js`),
`KAW_VAPID_PRIVATE` (web push; the public half is in `src/lib/config.ts` and `functions/index.js`).
OpenAI models: `gpt-5.6-terra` (Responses API) for meal / coach / analyst, `gpt-4o-transcribe` for voice. No other LLM.

## Data (Firestore `users/{uid}`, rules = owner only)
`days/{YYYY-MM-DD}` {morning, evening, morningAt, eveningAt, sleep, tags{strength, aerobic, cheat}, water, sweets, note} ·
`measures/{id}` {type, beforeKg, afterKg, drinkMl, startedAt, endedAt, minutes} · `meals/{id}` {date, at, he, items,
calories, protein, verdict ok|warn|no, why, thumb} · `chat/{id}` · `push/{hash}` (web push subscriptions) ·
`foods/{name}` (the meal library: one per meal name, `n` = times eaten) · `usage/{date}` (AI quota, 120/day) · profile
fields on the user doc (goals, reminders, `analysis` = last analyst answer). A chat message may carry `logs` (the coach's
log cards, with `added` once the user added them).
Every number on screen is computed in `src/lib/calc.ts` / `src/lib/analysis.ts` from the raw weighings - nothing stored twice.

## Design
Concept A (GPT Image 2.6 **Flare**, his pick 2026-11-12) - `design/concept-A-flare.jpg`; all rounds in `design/concepts/`
(prompts in `design/prompts/`, `design/gen.mjs`). Round 3 (after his review): `design/r3/` - home, chat, account menu,
food, before/after - made with `design/gen-ref.mjs`, which passes concept A as the reference so new screens keep its look.
Styles: `src/theme-r3.css` (the shell, header, tab bar and the round-3 screens) on top of `styles.css` + `theme-a.css`. His rules: brief the model WHAT we build, never the look; "cool, up to
date, very simple, not like Wholos". Styles: `src/styles.css` (base) + `src/theme-a.css` (concept A). Painted icons
(activities, morning/evening, logo, coach) in `public/img/` - no emoji as icons.

## Develop / test
```bash
npm install && (cd functions && npm install)
firebase emulators:start --only functions --project kiloaweek-app     # local server, keys from functions/.secret.local
VITE_MOCK=1 npx vite --port 5190                                       # every screen on 60 seeded days, no Google account
node tests/e2e.mjs [--no-ai] [--shots <dir>]                          # every screen at 360x640 + 390x844, and every flow
```
`tests/e2e.mjs` checks the header/tab bar stay put after scrolling, home fits one screen, nothing goes sideways, no banned
words, no console errors, then the flows (account menu, before/after with drinks surviving a reload, a saved meal in one tap,
food from a sentence, the coach's meal + weight cards). Run it before every deploy; look at the shots too.

Mock mode (`src/lib/mock.tsx`, dev only, `?fresh` reseeds, `?empty` = new user) sends `Bearer dev:<uid>`, which the
server accepts ONLY inside the emulator. `functions/.secret.local` (git-ignored) holds the local keys - for local tests use
the design key (sessions). No Java on this PC, so no Firestore/Auth emulators. Check every screen at 360 and 390 px.

## Deploy
```bash
bash deploy.sh            # build + hosting + Firestore rules -> kiloaweek-app
bash deploy.sh server     # functions -> boostmind-b052c (codebase kiloaweek only)
```
Never `firebase deploy` bare here: the default project is kiloaweek-app, which can't run functions.
