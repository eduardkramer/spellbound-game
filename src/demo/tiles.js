(function () {
'use strict';
const T = TILESET;

/* ---- overzicht ---- */
const anim = [];
for (const d of T.tiles) {
  const fig = document.createElement('figure');
  const cv = document.createElement('canvas'); cv.width = T.CW; cv.height = T.CH;
  const cap = document.createElement('figcaption');
  const tags = d.group === 'tapijt'
    ? 'masker ' + d.mask
    : (d.walkable ? '<span class="ok">loopbaar</span>' : '<span class="no">blokkeert</span>') + (d.height ? ' · ' + d.height + 'px' : '') + (d.frames > 1 ? ' · ' + d.frames + ' frames' : '');
  cap.innerHTML = (d.group === 'tapijt' ? '' : d.label) + '<small>' + (d.group === 'tapijt' ? '' : d.id + '<br>') + tags + '</small>';
  fig.append(cv); fig.append(cap);
  document.getElementById(d.group).append(fig);
  const g = cv.getContext('2d');
  g.drawImage(d.cache[0], 0, 0);
  if (d.frames > 1) anim.push({ d, g });
}

/* ---- tovenaar-overzicht ---- */
const wanim = [];
for (const st of ['idle', 'walk']) for (const dir of WIZARD.DIRS) {
  const fig = document.createElement('figure');
  const cv = document.createElement('canvas'); cv.width = WIZARD.CW; cv.height = WIZARD.CH;
  const cap = document.createElement('figcaption');
  cap.innerHTML = dir + '<small>' + (st === 'idle' ? 'rust · 2 frames' : 'lopen · 4 frames') + '</small>';
  fig.append(cv); fig.append(cap); document.getElementById('tovenaar').append(fig);
  wanim.push({ dir, st, g: cv.getContext('2d') });
}

/* ---- testkamer ---- */
const MAP = [
  '#BBBDBBB_',
  '#f..x..f_',
  '#.ccccc._',
  'E.cccccd_',
  '#=ccoccC_',
  '#=ccccc._',
  '#,.i..~~_',
  '#,.k.p~O_',
  '_________'
];
const N = MAP.length;
const ch = (x, y) => (MAP[y] && MAP[y][x]) || '#';
const isCarpet = c => c === 'c' || c === 'o';
function tileAt(x, y) {
  const c = ch(x, y);
  switch (c) {
    case '.': return [((x + y) & 1) ? 'stone_b' : 'stone_a'];
    case ',': return ['stone_moss'];
    case 'x': return ['stone_cracked'];
    case '=': return ['wood'];
    case 'o': return ['rune'];
    case '~': return ['water'];
    case 'O': return ['pit'];
    case 'p': return ['plate'];
    case '#': return ['wall'];
    case '_': return ['wall_low'];
    case 'B': return ['bookshelf'];
    case 'D': return ['door_l'];
    case 'E': return ['door_r'];
    case 'C': return ['stone_a', 'chest'];
    case 'i': return ['stone_b', 'pillar'];
    case 'f': return ['stone_a', 'brazier'];
    case 'd': return ['stone_b', 'table'];
    case 'k': return ['stone_a', 'cauldron'];
    case 'c': {
      let m = 0;
      if (!isCarpet(ch(x - 1, y))) m |= 1;
      if (!isCarpet(ch(x, y - 1))) m |= 2;
      if (!isCarpet(ch(x + 1, y))) m |= 4;
      if (!isCarpet(ch(x, y + 1))) m |= 8;
      return [m ? 'carpet_' + m : 'carpet'];
    }
  }
  return ['stone_a'];
}
const rc = document.getElementById('room'), rg = rc.getContext('2d');
const OX = T.TW / 2 * (N - 1) + T.TW / 2, OY = 32;
rc.width = T.TW * N; rc.height = OY + T.TH / 2 * (2 * N - 2) + T.TH;
function fit() {
  const s = Math.max(1, Math.min(3, Math.floor((innerWidth - 36) / rc.width)));
  rc.style.width = rc.width * s + 'px'; rc.style.height = rc.height * s + 'px';
}
addEventListener('resize', fit); fit();

const STEP = .4;                                   // seconden per tile = 4 walk-frames op 10 fps
const Wz = { x: 3, y: 2, to: null, p: 0, dir: 'se', wt: 0 };
const KD = { ArrowUp: [0, -1, 'ne'], ArrowRight: [1, 0, 'se'], ArrowDown: [0, 1, 'sw'], ArrowLeft: [-1, 0, 'nw'], w: [0, -1, 'ne'], d: [1, 0, 'se'], s: [0, 1, 'sw'], a: [-1, 0, 'nw'] };
const keys = [];
addEventListener('keydown', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (!KD[k]) return; e.preventDefault(); const i = keys.indexOf(k); if (i >= 0) keys.splice(i, 1); keys.push(k); });
addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; const i = keys.indexOf(k); if (i >= 0) keys.splice(i, 1); });
const walkable = (x, y) => x >= 0 && y >= 0 && x < N && y < N && tileAt(x, y).every(id => T.info(id).walkable);
let last = 0;

function frame(ms) {
  const t = ms / 1000, dt = Math.min(.1, last ? t - last : .016), f = Math.floor(t * T.FPS); last = t;
  if (!Wz.to && keys.length) {
    const [dx, dy, dir] = KD[keys[keys.length - 1]]; Wz.dir = dir;
    if (walkable(Wz.x + dx, Wz.y + dy)) { Wz.to = [Wz.x + dx, Wz.y + dy]; Wz.p = 0; }
  }
  if (Wz.to) { Wz.p += dt / STEP; Wz.wt += dt; if (Wz.p >= 1) { Wz.x = Wz.to[0]; Wz.y = Wz.to[1]; Wz.to = null; Wz.p = 0; } }
  else if (!keys.length) Wz.wt = 0;
  const px = Wz.x + (Wz.to ? (Wz.to[0] - Wz.x) * Wz.p : 0), py = Wz.y + (Wz.to ? (Wz.to[1] - Wz.y) * Wz.p : 0);
  const sw = Math.ceil(px + py - 1e-6), moving = !!Wz.to;
  for (const a of wanim) { a.g.clearRect(0, 0, WIZARD.CW, WIZARD.CH); a.g.drawImage(WIZARD.canvas(a.dir, a.st, t), 0, 0); }
  for (const a of anim) { a.g.clearRect(0, 0, T.CW, T.CH); a.g.drawImage(a.d.cache[f % a.d.frames], 0, 0); }
  rg.clearRect(0, 0, rc.width, rc.height);
  for (let s = 0; s <= 2 * (N - 1); s++) {
    for (let x = 0; x < N; x++) { const y = s - x; if (y < 0 || y >= N) continue; for (const id of tileAt(x, y)) T.draw(rg, id, x, y, OX, OY, t); }
    if (s === sw) { const [wx, wy] = T.center(px, py, OX, OY); WIZARD.draw(rg, Wz.dir, moving ? 'walk' : 'idle', moving ? Wz.wt : t, wx, wy); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
