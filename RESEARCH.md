# Research Notes — Designing "Draw & Learn"

Before building, I surveyed the current toddler tracing/drawing app landscape and
the relevant web tech. This file records what was found and how it shaped the game.

## 1. What existing toddler tracing apps do

Sources: app store listings and reviews for **Colors & Shapes (Bimi Boo)**,
**ABC Preschool Kids Tracing (Kidzooly)**, **Ultimate Tracing for Kids**,
**Keke Kids ABC Tracing**, **Baby Games: Shapes and Colors**, Wirecutter's
learning-apps guide (Aug 2026), plus OT (occupational therapy) app roundups.

Common patterns across the successful apps:

| Pattern | Detail | Adopted? |
|---|---|---|
| Step-by-step guides | Shape shown as a path with a start marker; child traces over it | ✅ dotted "candy road" + pulsing start star |
| Generous tolerance | Toddler strokes are sloppy; success thresholds are forgiving | ✅ wide coverage radius, 72% completion |
| Audio instructions | Spoken prompts, not text (pre-readers) | ✅ 75 spoken lines |
| Positive-only feedback | No fail states, ever; praise variety matters | ✅ 8 different praise lines, no negative sounds |
| Rewards | Stickers/stars per completed item | ✅ ⭐ badges saved in localStorage, counters on home |
| Offline, no ads, no data | Parents choose ad-free COPPA-friendly apps; top apps work offline | ✅ offline PWA, zero network calls, no analytics |
| Short cycles | One shape ≈ 10–30 seconds of play, then celebration | ✅ auto-advance after ~4.5 s celebration |
| "X is for Apple" | Letter apps pair letters with words/pictures | ✅ every letter has a word + emoji |
| Color naming | Color pickers that speak color names reinforce learning | ✅ tapping a crayon says its name |

Kidzooly/Keke-style apps also lock orientation to portrait and use huge
full-width buttons — mirrored here.

## 2. Tracing-detection technique

Tracing apps (and academic work on handwriting-stroke recognition) generally use
*coverage of resampled guide points*: the ideal path is sampled every few pixels;
a sample is "hit" when the input stroke passes near it; completion = fraction hit.
This is robust to wobble, direction and multi-stroke chaos — exactly what a
2-year-old produces. We sample every ~5 px and use a hit radius ~2× the guide
width. Alternatives (stroke-order enforcement, direction checking) are used by
handwriting apps for older kids and were deliberately **not** adopted — the goal
here is engagement + shape familiarity, not penmanship.

## 3. Web platform choices

- **Canvas + Pointer Events** (MDN documents this exact multi-touch drawing use
  case) with a touch/mouse fallback for old WebViews.
- **WebAudio for SFX**: synthesized pops/whooshes/fanfares = zero download,
  punchy, and unlimited variation. Music is a generated pentatonic loop — light
  and non-annoying.
- **No framework**: the whole game is ~1,500 lines of vanilla JS. Instant load,
  offline-friendly, and it can be served from GitHub Pages or wrapped by
  Capacitor unchanged.
- **Capacitor** for the APK: wraps the static app in a WebView-backed native
  project; works fully offline via a built-in local server (per Capacitor docs
  and community reports). Chosen over Cordova (maintenance mode) and PWABuilder
  (less control over signing/orientation).
- **PWA manifest + service worker**: installable on Android/iOS home screens,
  cache-first offline shell.

## 4. Voice-overs

- **Gemini TTS** (`gemini-3.8-flash-tts`, Interactions API; older
  `gemini-2.5-flash-preview-tts` still available) supports prebuilt voices
  (Leda/Puck/Kore...) with natural-language style control. Pre-generating clips
  at build time beats runtime synthesis: offline, instant, no key in the client.
  The `generativelanguage.googleapis.com` endpoint is region-restricted, so this
  repo ships clips generated with **edge-tts** (en-US-AnaNeural, a cartoon-child
  voice) and includes `tools/generate_audio_gemini.py` to regenerate the exact
  same set with Gemini from any supported region.
- Fallback chain in-app: MP3 → WAV → browser `speechSynthesis`.

## 5. Attention-keeping details (from kids-app design practice)

- Immediate feedback for every touch (pop + sparkle trail under the finger)
- Animated everything: marching dots, bouncing title, wobbling buttons, blinking mascot
- Big celebrations (confetti + fanfare + praise voice + emoji)
- Auto-advance so play never stalls on UI
- Rainbow brush (hue cycles along the line) — discovered crowd-pleaser in kids'
  drawing apps
