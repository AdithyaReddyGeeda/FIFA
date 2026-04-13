# FIFA Soccer Game

Browser-based **11v11** soccer match built with **Three.js** and **Vite** — pitch, ball physics, AI opponents (Barcelona vs Real Madrid, 4-3-3), match flow, and lightweight **Web Audio** SFX.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (port set in `vite.config.js`).

## Scripts

| Command       | Description              |
| ------------- | ------------------------ |
| `npm run dev` | Dev server with HMR      |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |

## Controls

| Input | Action |
| ----- | ------ |
| **W A S D** | Move |
| **Shift** | Sprint |
| **Space** | Pass (with ball) / Switch player (without) |
| **E** (hold) | Charged shot (with ball) |
| **E** (tap) | Tackle (without ball) |
| **Q** | Through ball |
| **Esc** | Pause / Resume |

## Tech stack

- [Three.js](https://threejs.org/) — WebGL scene, pitch, players, ball
- [Vite](https://vitejs.dev/) — Dev server and bundler
- Vanilla JS — all gameplay in `src/main.js`
- Web Audio API — kick, whistle, crowd (no audio assets)

## Project layout

```
fifa-soccer-game/
├── index.html      # UI overlays, embedded HUD CSS
├── src/main.js     # Game logic, AI, audio
├── public/
├── package.json
└── vite.config.js
```

## License

MIT (or your choice — update this line if needed.)
