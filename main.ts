// SUNSET KEYS — the hand-in program for the gta6-01 entry (Node 22, stdlib only).
// The game itself is plain static files under game/ (game/index.html plus its ES
// modules and the vendored three.js build): a desktop browser opens it offline
// with no network request. This program gathers the entry: it copies game/ and
// screenshots/ from beside this file into the output folder and writes
// output/dossier.json, the summary the judge reads, using the kit's vendored
// make.fun library. It runs twice and writes identical bytes both times.
//
// The CP2 core loop ships four screenshots (start, play, chase, end): the
// chase shot is the police pursuit, staged by game/src/shots.js from the
// same seed as the rest. A hand-in with no screenshots at all is refused
// here, so a broken screenshot step fails loudly instead of silently.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The entry is judged on its screenshots: refuse a hand-in that has none.
const shotCount = readdirSync(join(outputDir, 'screenshots'))
  .filter((name) => /\.(jpe?g|png|webp)$/i.test(name)).length;
if (shotCount === 0) {
  throw new Error('no screenshots in screenshots/ — run the shot poses first');
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the rest refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes. game/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
