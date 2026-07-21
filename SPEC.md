# RAPP Video — Product Spec (v1)

**One line:** A self-contained, single-file AI video studio — the Higgsfield workflow
(preset-driven cinematic video from an image or prompt) rebuilt as something we own,
run anywhere, and customize freely. No accounts, no credits, no lock-in.

## Why (the destiny clause)

Higgsfield is a rented workflow: their presets, their queue, their credits, their models.
RAPP Video keeps the workflow and removes the rent:

1. **Local Motion Engine (default)** — generates real videos entirely in the browser.
   Zero API keys, zero network, works offline, free forever.
2. **Provider adapters (optional)** — the same UI can drive any external video model
   (fal.ai, Replicate, OpenAI video, or a local RAPP brainstem agent via `POST /chat`).
   Keys live in localStorage only. Swap providers without changing the workflow.
3. **User-defined presets** — every camera move and effect is a JSON recipe, editable
   in-app. Higgsfield ships you 40 presets; RAPP Video ships you a preset *format*.

## Architecture

Single file: `index.html`. No build step, no dependencies, no CDN. Served from
GitHub Pages or a `file://` double-click.

```
┌────────────────────────────────────────────────────────┐
│ UI  (preset gallery · input panel · settings · player) │
├────────────────────────────────────────────────────────┤
│ Recipe  { input, camera keyframes, fx stack, settings }│
├───────────────────────────┬────────────────────────────┤
│ Local Motion Engine       │  Provider Adapters         │
│ canvas 2.5D camera rig    │  fal.ai / Replicate /      │
│ + FX compositor           │  OpenAI / brainstem /chat  │
│ → captureStream           │  → poll → video URL        │
│ → MediaRecorder → .webm   │                            │
└───────────────────────────┴────────────────────────────┘
```

### Local Motion Engine

- Input: uploaded/dragged image (image-to-video) or a procedural scene synthesized
  from the text prompt (text-to-video: gradient/starfield/city-lights scene classes
  chosen by keyword).
- Camera rig: per-frame transform (scale, x/y translate, rotate, perspective skew,
  shake) interpolated over keyframes with easing curves (linear, easeIn, easeOut,
  easeInOut, elastic, bounce). Parallax fake-3D: background layer moves at a
  different rate than a soft-extracted foreground scale layer.
- FX compositor (stackable, ordered): film grain, letterbox bars, vignette,
  chromatic aberration, flash strobe (paparazzi), night-vision green + scanlines,
  CCTV timestamp overlay, VHS jitter, neon glow bloom, rain streaks, snow, embers/
  particles, explosion flash + shockwave ripple, speed lines, fade in/out.
- Encoder: `canvas.captureStream(fps)` + `MediaRecorder` (`video/webm;codecs=vp9`
  fallback `vp8`) at settings-driven bitrate → Blob → preview `<video>` + download.
  Deterministic frame loop driven by `requestAnimationFrame` against a fixed
  duration timeline (not wall-clock-drift-sensitive).

### Camera presets (v1 ships ≥16; all are JSON recipes)

Push-In · Crash Zoom · Slow Zoom Out · Dolly Left · Dolly Right · Orbit (parallax) ·
Whip Pan · Handheld · Crane Up · Crane Down · Freeze Orbit (bullet-time-style spin) ·
Dutch Roll · Ken Burns Classic · Punch & Shake · Vertigo (dolly-zoom counter move) ·
FPV Dive. Generic cinematography vocabulary only — no Higgsfield coined names.

### FX presets (v1 ships ≥12, themed, our own names)

Paparazzi 2000s (flash strobes) · Night Vision · Security Cam · VHS Memory ·
Neon District · Storm Cell (rain + flash) · Ember Storm · First Snow · Detonation
(explosion flash + shockwave) · Anime Speed Lines · Noir (b/w + grain + vignette) ·
Golden Hour (warm grade + haze).

### Recipe / preset JSON (user-extensible, import/export)

```json
{
  "name": "Crash Zoom",
  "kind": "camera",
  "keyframes": [
    {"t": 0.0, "scale": 1.0, "x": 0, "y": 0, "rot": 0, "ease": "easeIn"},
    {"t": 1.0, "scale": 2.6, "x": 0, "y": -40, "rot": 0}
  ],
  "shake": {"amp": 6, "freq": 18, "from": 0.7},
  "fx": ["grain"]
}
```

In-app preset editor: duplicate any preset → edit JSON → live preview → save to
localStorage → export/import as `.json` (shareable).

### Provider adapter interface

```js
adapter = {
  id, label, needsKey,
  generate: async ({mode, prompt, imageDataUrl, preset, duration, aspect, onProgress}) => ({videoUrl})
}
```
Ships with: `local` (the engine), `brainstem` (POST localhost:7071/chat, response
field `response`), `fal`, `replicate`, `custom` (user-defined URL template).
External adapters are best-effort scaffolds behind the same UI; `local` is the
guaranteed path.

## Walkthrough Studio (the real end goal)

**Job:** given a screen recording + documentation steps, produce a finished,
sendable walkthrough video — cuts, zooms, captions, title cards — with no manual
editing. All rendering stays on-device (screen recordings of internal tools must
never transit a third-party cloud).

- **Inputs:** a video file (`#wt-video-input`), and doc steps pasted as text/markdown
  (`#wt-doc-input`) — one step per line/bullet.
- **Timeline model** (extends the recipe format): ordered segments, each
  `{srcIn, srcOut, camera: {zoom, cx, cy} | keyframes, caption, title?, speed?}`.
  `title` segments render a full-frame title card (no source video). `speed` allows
  dead-time compression (e.g. 4× through waiting periods).
- **Auto-draft:** pasting N doc steps over an M-second video drafts N evenly-split
  segments, each captioned with its step — then the user (or an agent) refines
  in/out points and zoom targets in the segment editor (JSON + live preview,
  same pattern as presets).
- **Zoom-to-region:** camera for a segment can target a rectangle of the source
  frame (click-drag on the preview to set); rendered as smooth ease-in/out zoom.
- **Overlays:** step captions (lower-third bar), step counter chip, intro/outro
  title cards, progress ticks; all drawn by the same FX compositor.
- **Audio:** original clip audio passes through (toggle); title cards are silent.
- **Render:** same engine — canvas draws the (seeked, playing) video element per
  frame with camera transform + overlays; MediaRecorder muxes canvas track +
  source audio track → `.webm` download.
- **Debug API additions:** `RAPP_VIDEO.renderWalkthrough(timeline) => Blob`,
  `RAPP_VIDEO.draftTimeline(steps, videoDuration) => timeline`.

The full production loop this enables: documentation + raw recording → an agent
drafts the timeline JSON → RAPP Video renders it headlessly (Playwright) → finished
walkthrough. Higgsfield is not in the loop; nothing leaves the machine.

## UX flow (mirrors the Higgsfield loop)

1. **Preset gallery** — grid of cards, each with a LIVE animated mini-preview
   (tiny canvas looping the actual camera math over a sample scene). Filter chips:
   Camera / FX / Mine.
2. **Input** — drag-drop/upload image, or type a prompt (procedural scene).
   Layered prompt fields: Subject · Camera (auto-filled by preset) · Style.
3. **Settings** — duration 2–10 s, aspect 16:9 / 9:16 / 1:1, resolution 720p/1080p,
   fps 24/30, motion intensity 0–200 %, selected FX stack (toggleable chips).
4. **Generate** — progress bar with frame counter; cancellable.
5. **Result** — inline player, Download .webm, Copy Recipe (full JSON), Save to
   Projects (localStorage history with thumbnails), Remix (reload recipe into UI).

## Quality bars (test gates)

- Generated file is a real playable WebM: ffprobe shows expected duration ±10 %,
  expected resolution, vp8/vp9 stream.
- Motion is real: sampled frames across the timeline differ substantially
  (mean abs pixel diff above threshold), and match the preset's direction.
- Page works from GitHub Pages AND file:// with zero network requests.
- No console errors through a full generate cycle (Playwright-verified).

## Testing contract (MUST be implemented exactly — the e2e harness targets these)

Stable DOM ids: `#preset-grid` (cards carry `data-preset-id` + class `preset-card`),
`#file-input` (the real `<input type=file>`), `#prompt-input`, `#subject-input`,
`#style-input`, `#duration-input`, `#aspect-select`, `#resolution-select`,
`#intensity-input`, `#generate-btn`, `#progress-bar`, `#result-video` (the `<video>`
that receives the blob URL), `#download-btn` (an `<a download>` with the blob URL),
`#copy-recipe-btn`, `#provider-select`.

Walkthrough Studio ids: `#wt-video-input` (file input), `#wt-doc-input` (textarea),
`#wt-draft-btn`, `#wt-timeline` (textarea holding the timeline JSON), `#wt-render-btn`,
`#wt-progress-bar`, `#wt-result-video`, `#wt-download-btn`.

Debug API on `window.RAPP_VIDEO`:
```js
{
  version: "1.0.0",
  state: "idle" | "rendering" | "done" | "error",
  presets: [...],                       // full resolved preset list
  lastRecipe: {...} | null,             // recipe of the last render
  lastBlob: {size, type, seconds} | null,
  generate: async (recipeOverrides) => Blob   // programmatic path, same engine
}
```
The engine must set `state` transitions synchronously with the UI, and resolve
`generate()` with the same Blob the UI offers for download.

## Boundaries

- Original code and preset names throughout; no Higgsfield assets, copy, or branding.
- No secrets in repo. Keys are user-entered, localStorage only.
- MIT LICENSE + DISCLAIMER.md per rapp-* estate convention; one fine-print ™ line.
