# Solmar Heat

[![make.fun](https://make.fun/badge/competition/gta6-01)](https://make.fun/competitions/gta6-01)
[![make.fun](https://make.fun/badge/entry/jefriidan15/solmar-heat-r2)](https://make.fun/entries/jefriidan15/solmar-heat-r2)
[![make.fun](https://make.fun/badge/build/jefriidan15/solmar-heat-r2)](https://make.fun/entries/jefriidan15/solmar-heat-r2)

An original open-world crime game set in **Solmar**, a fictional sun-soaked
coastal city. You are **Dana**, a newcomer driver proving herself to **Rosa**,
a garage owner, while the **Vipers** crew and the Solmar police make every job
harder than the last. Nothing here comes from any commercial game: the city,
characters, story, art and music are all invented for this entry.

## How to play

Serve the `game/` folder with any static server and open `game/index.html`:

```sh
node serve.ts
# then open http://localhost:8080
```

Click **New Game** (or **Continue** if a save exists). Follow the objective
line at the top of the screen and the yellow marker on the map and minimap.

## The story — five jobs

1. **First Wheels** — steal any car and deliver it to Rosa's Garage. Get paid.
2. **Sunset Courier** — a package across town in 90 seconds, before sunset.
3. **Pier Showdown** — clear the Vipers off Solmar Pier. Pistol loaded.
4. **Heat Run** — you start at 3 stars. Lose the cops, then slip to the safehouse.
5. **Night Run** — one last hot car to the East Docks, after dark.

Between jobs, green **$** courier pickups appear around the city for +$150 each.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk (on foot) / drive (in a car) |
| Shift | Run |
| E | Steal / enter a parked car, exit a car |
| Mouse | Aim |
| Click | Shoot the pistol |
| Space | Handbrake |
| P | Pause |
| M | Mute |
| Enter | Continue after Busted / Wasted |

## Systems

- **City** — downtown street grid, beach and pier on the south edge, suburbs,
  a highway ring, traffic cars on the roads and pedestrians on the sidewalks.
- **Wanted level 0–5** — stealing, shooting and hitting people or police raise
  it. Police cruisers and officers chase; the heat fades when you stay clean
  and out of sight. Caught on foot at high wanted and you are **Busted**;
  at 0 health you are **Wasted**.
- **Combat** — pistol with 24 rounds, mouse aim, Vipers and cops shoot back.
- **HUD** — cash, health, wanted stars, ammo, speed while driving, live
  minimap with streets, player arrow, mission marker and police, objective line.
- **Save / Continue** — progress autosaves to localStorage; the start screen
  offers Continue when a save exists.
- **Sound** — fully synthesized WebAudio: engine hum, sirens, gunshots and a
  bass groove. No audio files.
- **Tech** — plain Canvas 2D, zero dependencies, zero network requests. Static
  files under `game/` only.

## Files

- `game/index.html` — page shell, menu and pause overlays
- `game/src/game.js` — core loop, player, wanted level, police, save flow
- `game/src/world.js` — city layout, buildings, collision
- `game/src/vehicles.js` — parked cars, traffic, police cruisers, driving
- `game/src/people.js` — pedestrians, cops, Vipers, shooting
- `game/src/missions.js` — the five jobs and courier side work
- `game/src/render.js` — Canvas 2D world, HUD and minimap
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/input.js` — keyboard + mouse
- `game/src/rng.js` — seeded random numbers
- `game/src/save.js` — localStorage save / load

Deterministic screenshot scenes: `?shot=cover|street|pier|dusk&seed=1`.
