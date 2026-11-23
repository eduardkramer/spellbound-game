# Spellbound project structure

Spellbound is a browser game built with HTML, CSS and vanilla JavaScript. The
project keeps page markup in the root entrypoints and game systems in `src`.

## Source ownership

- `src/game` contains gameplay systems, entities and scene rendering.
- `src/game/quests` contains quest definitions and persistence.
- `src/audio` contains reusable music data and playback code.
- `src/boot` contains page-specific startup and layout wiring.
- `assets/sprites` contains gameplay sprites and sprite metadata.
- `assets/ui` contains CSS assets used by the game interface.
- `assets/music`, `assets/images` and `assets/fonts` contain media grouped by type.

`index.html`, `game.html` and `tiles.html` remain stable browser entrypoints.
When adding a feature, keep simulation and persistence in `src/game`, keep
presentation in the relevant page or renderer, and place new media in the
matching `assets` category.
