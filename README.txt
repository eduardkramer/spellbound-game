Spellbound

Starten: pak de zip uit en open index.html en kies Spelen. Geen server of installatie nodig.

SPELEN
  Beweeg de tovenaar met de pijltjestoetsen of WASD. Houd een toets
  ingedrukt om door te lopen. Je kunt om meubels heen lopen.
  Klik op een vrije tegel. De tovenaar loopt erheen om obstakels heen.
  Een looptoets neemt de besturing over.
  Loop naast de kist om het deksel te openen en goudlicht te zien.
  Beweeg de muis over een vloertegel om de rand te laten oplichten.
  Gebruik − en + boven het speelveld om te zoomen. Klik op het percentage
  om terug te gaan naar 100%. Scroll als het speelveld niet volledig past.
  De pijltjes volgen de diagonale tegelrichtingen van de isometrische kamer.

MUZIEK TOEVOEGEN
  1. Zet je .mp3 bestanden in de map  assets/music/
  2. Open src/audio/tracks.js en voeg per nummer een regel toe:
       { title: 'Rainy Tower', artist: 'Naam', src: 'assets/music/rainy-tower.mp3' },
  3. Pagina verversen.
  Spatiebalk = afspelen/pauzeren. Je volume wordt onthouden.

TILES (voor de tile-game)
  Open tiles.html: alle tiles + een testkamer.
  src/game/tiles.js    de tiles, procedureel getekend in dezelfde stijl. 1 tile = ruit van 32x16 px, afbeelding 32x48 px.
  assets/sprites/tiles.png   spritesheet (8 cellen per rij), assets/sprites/tiles.json zegt waar elke tile staat, of hij loopbaar is en hoe hoog.
  In code: TILESET.draw(ctx, 'stone_a', gx, gy, ox, oy, t)  en  TILESET.info('wall').walkable

TOVENAAR (sprite)
  src/game/wizard.js   de tovenaar, 4 richtingen (se, sw, ne, nw), 'idle' (2 frames) en 'walk' (4 frames). Cel 32x48 px, voeten op (16,44).
  assets/sprites/wizard.png  spritesheet: per richting een rij (2x idle, 4x walk), assets/sprites/wizard.json beschrijft de indeling.
  In code: WIZARD.draw(ctx, 'se', 'walk', t, x, y)  met [x,y] = TILESET.center(gx, gy, ox, oy)
  tiles.html: loop met pijltjestoetsen of WASD door de testkamer.

Bestanden
  index.html      landingspagina
  game.html       speelbare torenkamer
  tiles.html      tegeloverzicht en testkamer
  src/game/       spelcode, dialoogindeling en quests
  src/demo/       besturing en weergave van de testkamer
  src/styles/     stylesheets voor de pagina’s, portretten en scrolls
  src/audio/      muziekspeler en afspeellijst
  assets/         lettertypen, afbeeldingen, muziek en spritesheets
