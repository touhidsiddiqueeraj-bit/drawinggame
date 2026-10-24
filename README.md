# Draw & Learn! 🎨⭐

A joyful, colorful tracing game for toddlers (ages 1–5). Big friendly guides appear
as dotted lines and little artists trace over them with a fat rainbow crayon —
learning **shapes, letters and numbers** while sparkles fly, confetti bursts and a
cheerful voice celebrates every finished drawing.

**50 traceable things**: 14 shapes (circle, star, heart, moon, sun...), 26 letters
(A is for Apple...) and 10 numbers — each with its own voice-over, colors and a
star reward.

## ✨ Features

- **Trace & complete** — guide paths appear as pastel roads with animated candy dots and
  pulsing start markers. Drawing over ~72% of the guide triggers a celebration.
- **Made for tiny hands** — giant touch targets, palm-friendly multi-touch, no fail states,
  no menus to get lost in, auto-advance to the next drawing.
- **Colors!** — 11 crayons (plus a hue-cycling rainbow brush). Tapping a color says its name.
- **Sounds** — punchy pop/whoosh/fanfare sound effects synthesized live with WebAudio,
  a gentle pentatonic background loop (mute button included for parents 😉), and 75
  spoken lines (instructions, praise, color names).
- **Rewarding** — confetti cannons, star bursts, bouncing praise cards and a ⭐ badge
  on every finished item (saved on the device).
- **Offline-first PWA** — installable from the browser, works fully offline via a
  service worker. No accounts, no ads, no tracking, no permissions.

## 🌐 Play it

- **On the web (GitHub Pages)**: https://touhidsiddiqueeraj-bit.github.io/drawinggame/
- **On Android**: install the APK from [Releases](../../releases) (`DrawAndLearn-vX.Y.Z.apk`),
  or build it yourself (below).
- **Locally**: just open `index.html`, or serve the folder
  (`npx serve .` / `python3 -m http.server`) — everything is static.

For the best phone experience use the **Add to Home Screen** option in the browser menu.

## 📱 Building the Android APK

The web app is wrapped with [Capacitor](https://capacitorjs.com). Prerequisites:
Node 18+, JDK 17+, Android SDK (platform 35, build-tools 35.0.0).

```bash
npm install                # installs Capacitor
npm run android:release    # assembles www/ + builds the signed release APK
# APK lands in android/app/build/outputs/apk/release/app-release.apk
```

Other useful commands:

```bash
npm run android:run        # build + install on a connected device (debug)
npm run android:open       # open the project in Android Studio
npm run android:sync       # re-copy web assets after editing the game
```

The APK is signed with `android/app/drawinggame.keystore`
(password `DrawLearn2026`, alias `drawinggame`) — replace it with your own for
anything serious. A ready-to-use GitHub Actions workflow is included at
`tools/github-workflow-build-apk.yml` — it builds the APK on every push and
attaches it to Releases for version tags (`git tag v1.0.1 && git push --tags`).

> **Enable CI in 2 clicks:** open
> `tools/github-workflow-build-apk.yml` on GitHub → copy its contents → create
> the file `.github/workflows/build-apk.yml` via the web UI (Add file →
> Create new file). Doing it through the web UI needs no extra token
> permissions.

## 🗣️ Voice-overs

All 75 voice lines are pre-generated MP3s in `assets/audio/` (currently the
"Ana" child voice via edge-tts) so the game works offline with zero API calls.

To regenerate the identical set with **Gemini TTS** (as originally intended), run
from a Gemini-supported region:

```bash
python3 tools/generate_audio_gemini.py --key YOUR_GEMINI_API_KEY
# options: --voice Leda|Puck|Kore|...  --style "..."  --only items/circle
```

Clip texts live in one place: `js/data.js` → export with `npm run clips:export`
→ `tools/voice_clips.json` is what both generators read.

## 🛠️ Tech

- Pure static web app — HTML5 Canvas + vanilla JS, no frameworks, no build step.
  (Great for toddlers: instant load, works offline, trivially wrappable into an APK.)
- Tracing detection: guides are resampled every ~5 px; a guide point counts as
  covered when the finger passes within a generous radius; 72% coverage = done.
- Sound effects are synthesized at runtime (WebAudio) — no audio files to download.
- Fredoka font (SIL OFL) bundled in `assets/fonts/`.

## 📁 Layout

```
index.html            the whole game (3 screens)
css/style.css         candy-bright styling + animations
js/data.js            50 glyphs as stroke paths + voice clip manifest
js/audio.js           WebAudio SFX synth + music loop + voice manager
js/fx.js              sparkles / confetti particle layer
js/game.js            tracing engine (guides, brush, coverage, hints)
js/app.js             screens, palette, progress, celebration
assets/audio/         75 spoken lines (mp3)
tools/                www assembly, clip manifest, Gemini TTS regenerator
android/              Capacitor Android project (signed release config)
```

## ⚠️ Notes

- When you change game files, bump `CACHE_VERSION` in `sw.js` so installed
  copies pick up the update.
- The Gemini API is region-restricted; the included fallback script keeps
  working voice-overs regardless (edge-tts), and the app itself falls back to
  the browser's speech synthesis if an audio file is ever missing.

Made with ❤️ for little artists.

## 📝 Changelog

**v1.0.1 — Shape accuracy fix**
- Guides are now drawn with **corner-preserving smoothing**: strokes that
  turn sharper than 50° keep crisp straight corners (Rectangle, Hexagon,
  Pentagon, Square, Triangle, Diamond, Star, Arrow, and letters like
  A E F H K L M N V W X Y Z), while curvy glyphs (S, O, B, 3, hearts…)
  keep their soft rounded look. Previously every corner was being rounded
  off, which made polygons and zig-zag letters look wrong.
- All 50 glyphs visually verified (grid review + on-device draw screen).
- Bumped versionCode 2 / versionName 1.0.1, service-worker cache v1.0.2.
