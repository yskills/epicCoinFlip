# ⚔️ EPIC FINAL BATTLE

A cinematic anime-style coin-flip battle simulator. Two fighters clash with **special attacks**, **critical hits**, **beam animations**, **screen shakes**, and dramatic **final hit sequences** — all in a single HTML file with zero dependencies.

## Play

Open `dist/index.html` in any modern browser — no build step required.

## Deploy on Render.com

1. Push to GitHub.
2. On Render → **New → Static Site**.
3. Set **Publish Directory** to `dist`.
4. Deploy. Done.

The included `render.yaml` blueprint handles this automatically if you use **Blueprints**.

## Local dev

```bash
npx serve dist
```

## Features

- Custom fighter names (defaults: Kopf / Zahl)
- Animated canvas background with nebulae and energy waves
- Critical hits (15% chance, 2× damage)
- Special attacks (10% chance): Kamehameha / Dark Laser with full cutscenes
- Beam animations, screen shake, flash overlays, particle bursts
- Final Phase / Ultra Instinct when HP drops low
- Cinematic final-hit zoom sequence
- Winner celebration screen
