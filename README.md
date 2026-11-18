# Solmar Heat

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/jefriidan15/solmar-heat-r2/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/jefriidan15/solmar-heat-r2/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Heat** is an original top-down open-world crime game for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01), built from scratch
in plain Canvas 2D with zero dependencies and zero network requests.

Dana is new in Solmar City and already broke. Rosa at the garage has five
jobs that pay — if the Solmar PD doesn't catch her first.

## The game

- **Solmar City** — a procedural 2400×2400 island: a road grid, downtown,
  Old Town, Harbor, Northside, a beach and a pier, all generated from a seed.
- **On foot and by car** — WASD to move, Shift to run, E to steal any parked
  car, Space for the handbrake, mouse to aim, click to shoot.
- **Traffic and pedestrians** — cars drive the grid, pedestrians walk the
  sidewalks and flee from gunfire and speeding cars.
- **Wanted level 0–5** — stealing and shooting draw heat; police interceptors
  chase and ram, officers on foot run you down. Get caught and you're Busted;
  get shot down and you're Wasted.
- **Five missions from Rosa** — First Wheels, Sunset Courier (90s), Pier
  Showdown (4 Vipers at the docks), Heat Run (draw 3 stars, shake them off),
  Night Run — plus courier side work that pays on the side.
- **HUD with a live minimap** — cash, health, stars, ammo, speed, objective,
  and a minimap tracking the player, police, and the job marker.
- **Sound, save, menus** — synthesized WebAudio (engine, sirens, gunshots,
  jingles), M to mute, P to pause, progress saved to localStorage with
  Continue on the start menu.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Screenshots

`1-cover.jpg` — downtown chase at 3 stars · `2-street.jpg` — on foot at the
plaza · `3-pier.jpg` — the Vipers at the docks · `4-dusk.jpg` — sunset beach
drive. All four are real renders of the game (`?shot=cover|street|pier|dusk&seed=1`).

## Build

`game/` is plain static files: `index.html` plus ES modules in `game/src/`
(`game.js` core, `city.js` world, `vehicles.js` traffic/police/driving,
`people.js` peds/cops/Vipers, `missions.js` jobs, `render.js` world/HUD/minimap,
`audio.js` synthesized sound, `input.js`, `rng.js`, `save.js`, `shots.js`).
`main.ts` copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json` with the vendored `vendor/makefun-game.ts`.
