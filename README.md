# Handsign

> **Play light and sound with your hands** — a browser-based interactive media-art piece driven by real-time hand-gesture recognition.

Raise a hand to your webcam and an invisible magnetic field wakes up on screen: a cool teal particle cloud that condenses, glows, and sings as you move. No mouse, no keyboard — just gestures.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)
![Three.js](https://img.shields.io/badge/Three.js-r183-000000?logo=three.js)
![Tone.js](https://img.shields.io/badge/Tone.js-15-f472b6)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks%20Vision-00a3a3)

---

<!-- TODO(owner): add a short screen-recorded GIF of the field reacting to a hand here — by far the highest-impact addition for a visual/interactive piece.
     e.g.  <p align="center"><img src="docs/demo.gif" width="80%" /></p>  -->

## 🔒 Privacy first

Camera frames are processed **entirely in your browser** and are **never uploaded to any server**. Hand tracking runs locally in a Web Worker via WebAssembly.

## The idea

Your hand is treated as something that stirs an invisible magnetic field. The resting state is a restrained teal field; as your gesture grows stronger, golden energy seeps in and the density condenses. It should feel less like a control panel and more like **an instrument that responds to your body**.

## Gestures

| Gesture | Scene | Visual | Sound |
|---------|-------|--------|-------|
| ✋ **Open Palm** | broad, breathing field | wide, gentle diffusion — teal dominant | drone volume rises |
| 🤏 **Pinch** | focus / condense | particles gather to the center, rotation intensifies | filter cutoff & brightness climb (a sense of *tuning*) |
| ✌️ **Victory** | flare | halo and afterglow bloom, warmest color | reverb & presence swell — the space opens |

Pinch is a *continuous* value derived from the thumb–index fingertip distance, so it modulates density and audio filtering smoothly rather than as an on/off switch.

## Tech stack

- **UI**: React 19 + TypeScript, built with Vite 7
- **Visuals**: [Three.js](https://threejs.org/) — a particle field with bloom/afterglow (`features/visual`)
- **Audio**: [Tone.js](https://tonejs.github.io/) — ambient drone with filter sweeps and reverb (`features/audio`)
- **Hand tracking**: [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe) `GestureRecognizer`, loaded from CDN and run **off the main thread in a Web Worker** (`workers/inference.worker.ts`)
- **Camera**: `getUserMedia` (`features/camera`), with an explicit permission notice before capture

## Getting started

### Prerequisites

- Node.js 20+
- A webcam
- A recent Chromium-based desktop browser (primary target)

### Run locally

```bash
git clone https://github.com/hanmariyang/proj_handsign.git
cd proj_handsign

npm install
npm run dev        # http://localhost:5173
```

Open the page, grant camera permission, and raise a hand into frame.

### Build

```bash
npm run build      # type-check (tsc -b) + vite build → dist/
npm run preview    # serve the production build locally
```

## How it works

```
webcam ──getUserMedia──▶ camera-service
                              │  video frames
                              ▼
                    inference.worker (Web Worker)
                    MediaPipe GestureRecognizer (WASM)
                              │  landmarks + gesture label
                              ▼
                       gesture-mapper ──▶ session-machine (scene state)
                              │                     │
                   ┌──────────┴──────────┐          │
                   ▼                     ▼          ▼
             visual-engine         audio-engine   StatusHud (fps, state, pinch)
             (Three.js field)      (Tone.js drone)
```

State priority resolves to `Victory → Open Palm → Pinch → Tracking → Idle`, so a clear gesture always wins over ambient hand movement.

## Project structure

```
proj_handsign/
├── index.html
├── src/
│   ├── app/                    # App shell + global styles
│   ├── components/             # StartScreen, PermissionNotice, StatusHud, ControlPanel
│   ├── features/
│   │   ├── camera/             # getUserMedia session + permission state
│   │   ├── inference/          # worker bridge, landmark utils
│   │   ├── gestures/           # gesture mapping + thresholds
│   │   ├── audio/              # Tone.js audio engine
│   │   ├── visual/             # Three.js visual engine
│   │   └── session/            # scene state machine + runtime settings
│   ├── workers/                # inference.worker.ts (MediaPipe, off-thread)
│   └── shared/                 # constants, events, math
└── docs (design notes):
    ├── project-plan.md         # concept, scenarios, scope
    ├── art-direction.md        # color / texture / motion / sound principles
    ├── interaction-spec.md     # gesture spec + numeric thresholds
    └── implementation-plan.md
```

## Browser support

- **Primary**: latest Chromium-based desktop (Chrome, Edge, Arc)
- **Secondary**: iOS Safari — usable but a later stabilization target

Requires webcam access and WebAssembly. Performance scales with device GPU/CPU; the HUD shows live render and inference FPS.

## Roadmap ideas

- `Thumb_Up` → reset / freeze the scene
- `Pointing_Up` → pointer-based drawing mode
- Two-hand mode with left/right role separation

## License

MIT License — see [LICENSE](LICENSE).
