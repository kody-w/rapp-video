# RAPP Video

**A cinematic video studio in a single HTML file.** Pick a camera move, drop in an
image (or just a prompt), and get a real, downloadable video — rendered entirely in
your browser. No account. No credits. No queue. No lock-in.

**Live studio:** https://kody-w.github.io/rapp-video/

## What it does

RAPP Video reproduces the preset-driven video workflow popularized by platforms like
Higgsfield — preset gallery → input → generate → download — but as software you own:

- **16+ camera presets** — Push-In, Crash Zoom, Orbit, Whip Pan, Vertigo, Freeze
  Orbit, FPV Dive, Handheld, Crane, Dutch Roll and more, each a live-animated
  preview card.
- **12+ effect stacks** — Paparazzi 2000s, Night Vision, Security Cam, VHS Memory,
  Neon District, Storm Cell, Detonation, Noir, Golden Hour…
- **Image-to-video and text-to-video** — upload any image, or type a prompt and the
  procedural scene engine builds one.
- **Real video files** — the in-browser engine renders your timeline and encodes a
  downloadable `.webm` (720p/1080p, 16:9 / 9:16 / 1:1, 2–10 s).
- **Every render carries its recipe** — one click copies the full JSON that made it;
  one click remixes it.

## What makes it different

1. **The default engine is local.** The Motion Engine runs on a `<canvas>` with a
   2.5D camera rig and an FX compositor — it works offline, from `file://`, forever
   free. External AI models are an *option*, not a dependency.
2. **Presets are data, not product.** Every camera move and effect is a JSON recipe
   you can duplicate, edit live, save, and share. The platform ships a preset
   *format*, not just a preset list.
3. **Bring any backend.** A thin adapter seam lets the same UI drive fal.ai,
   Replicate, an OpenAI-compatible video endpoint, or a local
   [RAPP brainstem](https://github.com/kody-w/rapp-installer) agent over
   `POST /chat`. Keys live in your browser's localStorage only.

## Run it

Open the live URL above — or download `index.html` and double-click it. That's the
whole install.

## Customize it

Open **Presets → Duplicate** on any card, edit the JSON (keyframes, easing, shake,
FX stack), watch the live preview, save. Export your preset file and share it.

See [SPEC.md](SPEC.md) for the architecture and the recipe format.

---

<sub>RAPP Video is part of the RAPP family — experimental software, provided as-is;
see [DISCLAIMER.md](DISCLAIMER.md). RAPP and the RAPP family of names are trademarks
of the RAPP project. Code is MIT-licensed.</sub>
