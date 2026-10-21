# Gesture Playground

Move, resize and rotate photos and design screenshots on top of your webcam feed with hand gestures.
Built with React, TypeScript, Vite and MediaPipe Hand + Face Landmarker (`@mediapipe/tasks-vision` 1.1.1).
A second mode, **Anime Reveal**, opens a window between your hands that shows an uploaded anime portrait
aligned to your face.

**Live demo:** https://jbieyashvi.github.io/gesture-playground/ (allow the camera after clicking *Start camera*).

Everything runs in the browser. Camera frames go straight from the camera to the on-device model and are
never uploaded or stored. The models (`public/models/hand_landmarker.task`, `public/models/face_landmarker.task`) and the WASM runtime
(`public/mediapipe/wasm`) are served by the app itself, so no CDN is involved.

## Setup

```bash
npm install          # also copies MediaPipe's WASM into public/mediapipe/wasm
npm run setup        # downloads the hand + face models if public/models/ is missing them
npm run dev          # open the printed http://localhost URL in Chrome, Edge, Safari or Firefox
```

Camera access needs `localhost` or HTTPS. For production run `npm run build`, then `npm run preview`
(the `dist/` folder is a static site you can host anywhere).

Other scripts: `npm test` (gesture-engine unit tests), `npm run lint`.

## Gesture guide

| Gesture | What it does |
| --- | --- |
| **Pinch** thumb + index finger on or near an image | Grabs it and brings it to the front |
| Keep pinching and **move your hand** | Drags the image |
| **Open your fingers** | Drops the image where it is |
| **Pinch the same image with both hands**, then spread or twist | Resizes and rotates it; proportions stay locked |
| Let go with one hand while resizing | The other hand keeps dragging, with no jump |

Tips:
- Keep your hand 40–80 cm from the camera with your palm roughly facing it, in even light.
- A pinch that starts on empty space grabs nothing, even if you then move over an image.
- If your hand leaves the frame, the image holds still for 0.3 s, then drops where it is.
  When your hand comes back, open it and pinch again to pick the image up.
- The ring cursor shows your pinch point: hollow while open, filled while pinching, blue while holding.

## Anime Reveal

Switch with the **Playground / Anime Reveal** toggle in the toolbar (or press **M**).

This is an **uploaded portrait overlay**, not a live anime transformation: it warps a still image so its
eyes and mouth sit on yours. Nothing is generated and nothing leaves the browser.

| Do this | What happens |
| --- | --- |
| Hold up **both hands** | Each thumb–index pinch point becomes one corner of the reveal window |
| Move or spread your hands | Moves and resizes the window |
| Move, lean or tilt your head | The portrait follows your face, independently of the window |
| Bring your hands together, or drop them | The window closes |
| Leave the frame | The portrait hides until your face is found again |

Calibrating your own portrait:
1. **Upload portrait** (a front-facing JPG/PNG/WebP). **Auto-align** tries to find its eyes and mouth; the
   face model is trained on photos, so on anime art it often can't — then drag the three markers yourself.
2. Tick **Calibrate: show full overlay** to see the whole portrait with green dots on your real eyes and mouth.
   Adjust **Offset X/Y**, **Scale** and **Opacity** until they line up, then untick it.
3. **Soft portrait edges** fades the image border into the webcam; **Tracking labels** shows the small
   REVEAL / FACE readouts. For a clean recording turn labels off and press **P**.

## Mouse and keyboard

- **Drag** an image to move it.
- **Scroll** over an image to resize it. Use **Shift + scroll** or the **corner handle** to rotate it
  (hold Shift on the handle to resize without rotating).
- Drop image files onto the page to add them. **Delete** removes the selected image.
- **P** turns presentation mode on and off (fullscreen, no UI, cursor hides when idle). **Esc** exits it.
- **M** switches between Playground and Anime Reveal.
- **H** hides or shows the controls. **L** hides or shows the hand landmarks.

## How it works

- `src/lib/handTracker.ts` loads the model (GPU first, CPU as a fallback), starts the camera, and maps
  landmarks into screen space. It mirrors x and accounts for the `object-fit: cover` crop.
- `src/lib/faceTracker.ts` loads the Face Landmarker (478 points, one face) sharing the hand model's WASM runtime.
- `src/lib/reveal.ts` is the Anime Reveal logic, unit-tested like the gesture engine: the window's edges are the
  min/max of the two pinch points (so hand order doesn't matter), eyes and mouth are One-Euro-smoothed separately,
  and `faceMatrix` maps the portrait's eye line exactly onto yours (rotation + scale), using the mouth for height.
  `src/lib/drawReveal.ts` clips the portrait to the window.
- `src/lib/gestureEngine.ts` is the gesture logic. It has no UI code, so it is unit-tested.
  - **Pinch amount**: thumb–index distance divided by palm size, so it works at any distance from the camera.
  - **Grab and release**: a pinch starts below 0.30 and ends above 0.50, and each change must hold for
    2–3 frames. This prevents jitter and accidental drops.
  - **Smoothing**: a One Euro filter on the pinch point steadies slow, precise moves without lag on fast ones.
  - **Hand identity**: hands are matched between frames by position, so a flipped left/right label
    doesn't drop what you hold.
  - **Tracking loss**: a lost hand freezes for 300 ms, then releases safely. A hand that comes back
    already pinched can't grab until it opens.
- `src/lib/gestureEngine.test.ts` has 14 tests that cover these behaviours.
