# Sunset Keys

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/hamka1749/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/hamka1749/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

A mini open-world crime game in the spirit of GTA 6, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01).
Explore the island city of Palmera Keys on foot, steal a car, outrun the
police, and complete the Marina getaway — all offline, in a desktop browser,
from static files.

## Play

```sh
node serve.ts
```

Then open http://localhost:8080 (Node 22 or newer). No build step, no network
requests; `game/index.html` is the entry point.

## Controls

- **W A S D** move, **Shift** run, **Mouse drag** camera
- **E** steal / leave a car, **Space** brake, **H** horn, **R** reset
- **F** shove (on foot), **X** save progress

## The game

- Steal any car and the wanted level rises (1–3 stars); police cruisers spawn,
  chase, and ram. Escape, get busted, or reach the Marina to complete the
  getaway.
- 8 pedestrians walk the sidewalks and flee from cars; traffic drives the
  streets; a live minimap tracks the Marina beacon.
- Save/load keeps your run across a page reload; restart is clean from every
  state.
- Everything is procedural and deterministic: a seeded city, fixed-step
  simulation, synthesized WebAudio sound, no external assets.

## License

MIT — see [LICENSE](LICENSE).
