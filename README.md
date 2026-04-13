# FIFA Soccer Game

Browser-based **11v11** soccer built with **Three.js** and **Vite**: procedural stadium, pitch markings, ball physics, teammate AI, match flow (halftime, full time, penalty shootout), and lightweight **Web Audio** SFX (no audio files).

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (port set in `vite.config.js`; Vite may open the browser automatically).

## Scripts

| Command | Description |
| --------| ------------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |

## Features

- **Modes**: Quick match or **Custom match** (home/away kit presets, formation, **difficulty**).
- **Difficulty** (Easy / Medium / Hard): AI reaction time, sprint aggression, pressing range, and shot accuracy.
- **Stadium**: Night sky and fog, extended ground plane, concrete stands with striped “crowd” texture (home colors), corner floodlight poles with shadow-casting spotlights.
- **Match**: Possession, passes, through balls, tackles, charged shots, goals with short replay, optional goal-scorer celebration and nearby runners.
- **Set pieces**: Free kicks and penalty shootout when the match is drawn.
- **Cameras**: Broadcast, player-follow, and tactical orthographic (**C** to cycle).

## Controls

### Keyboard

| Input | Action |
| ----- | ------ |
| **W A S D** | Move (camera-relative) |
| **Shift** | Sprint |
| **Space** | Pass (with ball) / Switch player (without) |
| **E** (hold) | Charged shot (with ball) |
| **E** (tap) | Tackle (without ball) |
| **Q** | Through ball |
| **C** | Cycle camera mode |
| **Esc** | Pause / Resume |

### Touch

On touch devices, a **virtual joystick** plus **Pass**, **Shoot**, and **Sprint** buttons are shown (through ball remains **Q** on keyboard).

## Tech stack

- [Three.js](https://threejs.org/) — WebGL scene, stadium, pitch, players, ball, lighting
- [Vite](https://vitejs.dev/) — Dev server and bundler
- Vanilla JS — gameplay in `src/main.js`
- Web Audio API — kick, whistle, crowd murmur (synthesized)

## Project layout

```
fifa-soccer-game/
├── index.html       # UI overlays, HUD / menu CSS
├── src/main.js      # Scene, gameplay, AI, audio
├── public/
├── package.json
└── vite.config.js
```

## License

MIT (or your choice — update this line if needed.)
