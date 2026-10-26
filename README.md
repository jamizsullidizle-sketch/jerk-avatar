# DigiDoppler: Jimmy's jerk twin (v1)

**Live:** https://jamizsullidizle-sketch.github.io/jerk-avatar/  ·  Backend: Supabase project `kwwpjzwhuxpcqlidqnwl` (functions `roast` and `speak`)

A web page where you talk to a cocky, trash-talking welder from Warwick, RI, and he roasts you out loud.
It uses the dark, industrial DigiDoppler look (near-black panels with cyan, emerald, and amber accents), in plain HTML, CSS, and JS with no build step.
You type, or hold the mic button and talk. Jimmy fires back a short comeback and says it out loud.

- **Brain:** an AI writes the roast through a Supabase function called `roast`. **Google Gemini is the default, and it has a free tier.**
  OpenAI or xAI (Grok) still work as backups if you'd rather pay for one of those.
- **Voice:** Jimmy's cloned voice from ElevenLabs, through a Supabase function called `speak`.
  Until that's set up, the page uses the free voice built into the browser.
- **No keys yet?** The page runs in **Offline demo mode**: a purple badge, a banner, and a `DEMO` tag on every
  reply. It picks from about a dozen pre-written lines. It is not AI, and the page says so.

Rules baked into the AI: rude and funny, but no slurs, no hate toward any group, no real threats, no sexual stuff,
and no digging into anyone's private info. Replies stay at 1 to 3 sentences so they sound good spoken.

## Files

| File | What it does |
|---|---|
| `index.html`, `style.css`, `app.js` | The web page (avatar, chat log, mic, send) |
| `config.js` | Where you paste your Supabase URL and public anon key. Empty means demo mode |
| `supabase/functions/roast/handler.ts` | AI brain: Jimmy persona prompt, Gemini / OpenAI / xAI calls |
| `supabase/functions/roast/index.ts` | Starts the `roast` function |
| `supabase/functions/tests/roast_test.ts` | Deno tests against a fake Gemini/OpenAI server |
| `supabase/functions/speak/index.ts` | ElevenLabs text-to-speech, returns MP3 |
| `supabase/functions/_shared/cors.ts` | Lets the web page call the functions |
| `supabase/.env.example` | List of secret keys (never commit the real ones) |
| `tests/smoke.mjs` | Headless browser test (Playwright) |

## Run it on your computer

You only need some way to serve a folder. The mic doesn't work if you just double-click the file.

```bash
cd jerk-avatar
python3 -m http.server 8765
# open http://localhost:8765
```

That's demo mode. Add `?demo=1` to the URL to force demo mode even after you've set up the backend.

The mic button works in Chrome, Edge, and Safari. In Firefox it hides itself and you type instead.

### Try the real AI locally (optional)

Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker, then:

```bash
cp supabase/.env.example supabase/.env     # fill in your keys
supabase start
supabase functions serve --env-file supabase/.env
```

Then in `config.js`, set `supabaseUrl: "http://127.0.0.1:54321"` and paste the `anon key` that `supabase start` printed.

## Secret keys (environment variables)

These go on the **server** as Supabase secrets. Never put them in `config.js`.

**Brain: the first key that's set wins, in this order: Gemini, then OpenAI, then xAI.**

| Name | Needed? | What |
|---|---|---|
| `GEMINI_API_KEY` | **recommended (free)** | Google Gemini key from AI Studio |
| `GEMINI_MODEL` | optional | Default `gemini-flash-latest` (current stable Flash, on the free tier). For a cheaper, faster model, try `gemini-3.5-flash-lite` |
| `GEMINI_THINKING_LEVEL` | optional | `low` (default, quickest replies), `medium`, or `high` |
| `GEMINI_BASE_URL` | optional | Default `https://generativelanguage.googleapis.com/v1beta` |
| `OPENAI_API_KEY` | backup | OpenAI key (default model `gpt-4o-mini`). Only used if there's no Gemini key |
| `XAI_API_KEY` | backup | xAI key (default model `grok-3-mini`). Only used if there's no Gemini or OpenAI key |
| `LLM_BASE_URL` / `LLM_MODEL` | optional | Overrides for the OpenAI/xAI path (any OpenAI-compatible API) |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SEC` | optional | Abuse guard on `roast`: max roasts per IP per window (default 20 per 600 s). It's kept in memory, so it's a speed bump, not a vault door |
| `ELEVENLABS_API_KEY` | for Jimmy's voice | ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | for Jimmy's voice | The ID of Jimmy's cloned voice in ElevenLabs |
| `ELEVENLABS_MODEL_ID` | optional | Defaults to `eleven_turbo_v2_5` (fast and cheap) |

If no AI key is set, the page drops into demo mode. If the ElevenLabs keys are missing, the page uses the browser voice.

`config.js` only gets the Supabase project URL and **anon** key. Those are public by design.

### Get a free Gemini key (about 2 minutes)

1. Go to **https://aistudio.google.com** and sign in with any Google account.
2. Click **Get API key** (or go straight to https://aistudio.google.com/apikey), then **Create API key**.
   Let it make a new Google Cloud project if it asks. You don't need a credit card for the free tier.
3. Copy the key (it starts with `AIza`). Treat it like a password.
4. Set it as a secret: `supabase secrets set GEMINI_API_KEY=AIza...` (or paste it into `supabase/.env` for local testing).

Free-tier fine print: there are per-minute and per-day request limits (you can see yours in AI Studio). Also, Google may use
free-tier prompts to improve its products. That's fine for a public roast bot, but if you ever need privacy or more volume,
turn on billing in AI Studio.

## Go live later (Supabase + GitHub Pages)

1. **Supabase** (free tier is fine): create a project at supabase.com, then:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set GEMINI_API_KEY=AIza...           # free; or OPENAI_API_KEY / XAI_API_KEY
   supabase secrets set ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=...
   supabase functions deploy roast
   supabase functions deploy speak
   ```
2. **Voice clone:** in ElevenLabs (the Starter plan or higher allows Instant Voice Cloning), upload a few minutes of clean
   recordings of Jimmy talking. Then copy the Voice ID.
3. **config.js:** paste `https://YOUR_PROJECT_REF.supabase.co` and the project's anon key
   (Supabase dashboard → Project Settings → API).
4. **GitHub Pages:** push this folder to a GitHub repo. Then go to Settings → Pages → Deploy from branch → `main` / root.
   The page will be at `https://YOUR_USER.github.io/REPO/`. The mic needs HTTPS, and Pages gives you that.
5. **Watch costs:** on Gemini's free tier the AI part costs $0, but it's rate-limited. ElevenLabs bills by character, so set
   limits there (and in OpenAI/xAI if you use those). Before you share the link widely, add rate limiting (for example, a per-IP counter
   in the function).

## Test

```bash
python3 -m http.server 8765 &              # from this folder
npm i playwright-core                      # uses an installed Chrome
node tests/smoke.mjs                       # edit executablePath inside if Chrome lives elsewhere
cd supabase/functions && deno check roast/index.ts speak/index.ts && deno lint
deno test --allow-net --allow-env tests/  # roast vs. a fake Gemini/OpenAI server
```

## Make money with it

Sell custom "roast bots" to bars, gyms, streamers, and roast-party hosts: their voice, their inside jokes, $50–$200 setup plus a monthly fee to cover voice costs.
