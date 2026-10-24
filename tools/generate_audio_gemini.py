#!/usr/bin/env python3
"""Regenerate the Draw & Learn voice clips with Gemini TTS.

The game ships with pre-generated voices; this script regenerates the
identical clip set (same files, same texts from tools/voice_clips.json)
using the Gemini API, for a different voice character or fresher takes.

Usage:
  python3 tools/generate_audio_gemini.py --key YOUR_GEMINI_API_KEY
  python3 tools/generate_audio_gemini.py --key ... --voice Puck --style "warm and bubbly"
  python3 tools/generate_audio_gemini.py --key ... --only items/circle items/a

Requires: pip install requests  (ffmpeg optional, for MP3 output)
Note: the Gemini API is region-restricted; run this from a supported location.
"""
import argparse
import base64
import json
import os
import struct
import sys
import time

try:
    import urllib.request
except ImportError:  # pragma: no cover
    sys.exit("This script needs Python 3 standard library only")

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(HERE, "voice_clips.json")
OUT_DIR = os.path.join(HERE, "..", "assets", "audio")

API_ROOT = "https://generativelanguage.googleapis.com/v1beta"
NEW_MODEL = "gemini-3.8-flash-tts"        # Interactions API
LEGACY_MODEL = "gemini-2.5-flash-preview-tts"  # generateContent API (fallback)


def post(url, payload, key, timeout=90):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("x-goog-api-key", key)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def pcm_to_wav(pcm: bytes, sample_rate=24000, channels=1, bits=16) -> bytes:
    data_len = len(pcm)
    hdr = b"RIFF" + struct.pack("<I", 36 + data_len) + b"WAVE"
    hdr += b"fmt " + struct.pack("<IHHIIHH", 16, 1, channels, sample_rate,
                                 sample_rate * channels * bits // 8, channels * bits // 8, bits)
    hdr += b"data" + struct.pack("<I", data_len)
    return hdr + pcm


def gen_new_api(text, voice, style, key):
    """Interactions API — returns WAV bytes."""
    payload = {
        "model": NEW_MODEL,
        "input": [{
            "type": "user_input",
            "content": [{
                "type": "text",
                "text": text,
                "annotations": [{"type": "speech_metadata", "style": style}],
            }],
        }],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": [{"voice": voice}]},
    }
    resp = post(f"{API_ROOT}/interactions", payload, key)
    for step in resp.get("steps", []):
        for c in step.get("content", []):
            if c.get("type") == "audio" and c.get("data"):
                return base64.b64decode(c["data"])
    raise RuntimeError(f"no audio in response: {json.dumps(resp)[:300]}")


def gen_legacy_api(text, voice, style, key):
    """Legacy generateContent TTS — returns WAV bytes (PCM wrapped)."""
    payload = {
        "contents": [{"parts": [{"text": f"Say {style}: {text}"}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    resp = post(f"{API_ROOT}/models/{LEGACY_MODEL}:generateContent", payload, key)
    cand = resp.get("candidates", [{}])[0]
    parts = cand.get("content", {}).get("parts", [])
    for p in parts:
        d = p.get("inlineData", {}).get("data")
        if d:
            return pcm_to_wav(base64.b64decode(d))
    raise RuntimeError(f"no audio in response: {json.dumps(resp)[:300]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=os.environ.get("GEMINI_API_KEY"), help="Gemini API key")
    ap.add_argument("--voice", default="Leda", help="prebuilt voice name (Leda, Puck, Kore, ...)")
    ap.add_argument("--style", default="warm, cheerful and playful kindergarten teacher talking to toddlers")
    ap.add_argument("--only", nargs="*", help="clip ids to regenerate (default: all)")
    ap.add_argument("--delay", type=float, default=5.0, help="seconds between API calls (free tier is slow)")
    ap.add_argument("--out", default=OUT_DIR)
    args = ap.parse_args()

    if not args.key:
        sys.exit("Pass --key YOUR_API_KEY or set GEMINI_API_KEY")

    clips = json.load(open(MANIFEST, encoding="utf-8"))
    if args.only:
        clips = [c for c in clips if c["id"] in args.only or c["file"] in args.only]
    print(f"Generating {len(clips)} clips with Gemini TTS ({args.voice}) -> {args.out}")

    have_ffmpeg = os.system("ffmpeg -version > /dev/null 2>&1") == 0
    gen = gen_new_api
    mode = "interactions API"
    ok = fail = 0
    for i, clip in enumerate(clips):
        dest_base = os.path.join(args.out, clip["file"])
        os.makedirs(os.path.dirname(dest_base), exist_ok=True)
        try:
            for attempt in range(4):
                try:
                    wav = gen(clip["text"], args.voice, args.style, args.key)
                    break
                except RuntimeError as e:
                    msg = str(e)
                    if "not found" in msg or "404" in msg:
                        raise
                    if attempt == 3:
                        raise
                    wait = 15 * (attempt + 1)
                    print(f"  retry {clip['file']} in {wait}s ({msg[:120]})")
                    time.sleep(wait)
            if have_ffmpeg:
                dest = dest_base + ".mp3"
                import subprocess
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "-", "-codec:a",
                                "libmp3lame", "-b:a", "64k", dest], input=wav, check=True)
            else:
                dest = dest_base + ".wav"
                open(dest, "wb").write(wav)
            print(f"  ok  {os.path.basename(dest)}  ({os.path.getsize(dest)//1024} KB)")
            ok += 1
        except Exception as e:  # noqa: BLE001
            if "404" in str(e) and gen is gen_new_api:
                print("  (new API unavailable, falling back to legacy generateContent)")
                gen = gen_legacy_api
                mode = "legacy API"
                continue  # retry this clip with legacy
            print(f"  FAIL {clip['file']}: {e}")
            fail += 1
        if i < len(clips) - 1:
            time.sleep(args.delay)
    print(f"Done ({mode}): {ok} ok, {fail} failed")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
