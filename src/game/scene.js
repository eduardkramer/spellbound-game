/* Spellbound — proof of concept
 * Isometrische pixel-kamer, volledig procedureel getekend op een canvas.
 * Coördinaten: (a, b, z)  a = naar rechtsonder, b = naar linksonder, z = omhoog.
 * Achterhoek van de kamer = (0,0,0). Zie P() voor de projectie.
 */
(function () {
'use strict';

const TILE_SIZE = 8;
const TOWER_TILES = 11, TOWER_SIZE = TOWER_TILES * TILE_SIZE;
const TOWER_LIBRARY_DOOR_COLUMN = Math.floor(TOWER_TILES / 2);
const LIBRARY_TOWER_DOOR_COLUMN = 4;
const CHEST_TILE = [9, 0];
const [towerChestA, towerChestB] = CHEST_TILE.map(tile => (tile + .5) * TILE_SIZE);
const TABLE_A = 64, TABLE_B = 60;
const TOWER_DIAMOND_B = 68, TOWER_OWL_A = 72;
const POTION_COLUMNS = 11;
const POTION_ROWS = 13;
const POTION_DOOR_ROW = 3;
const LIBRARY_COLUMNS = 14, LIBRARY_ROWS = 12;
const LIBRARY_WIDTH = LIBRARY_COLUMNS * TILE_SIZE, LIBRARY_DEPTH = LIBRARY_ROWS * TILE_SIZE;
const LIBRARY_OUTER_SHELF_TILE = 8;
const LIBRARY_POTION_DOOR_ROW = 4;
const LIBRARY_HALL_DOOR_COLUMN = 7;
const HALL_COLUMNS = 4, HALL_ROWS = 14;
const HALL_WIDTH = HALL_COLUMNS * TILE_SIZE, HALL_DEPTH = HALL_ROWS * TILE_SIZE;
const HALL_ENTRANCE_COLUMN = 1;
const HALL_CLASSROOM_DOOR_ROW = 7, CLASSROOM_DOOR_ROW = 3;
const CLASSROOM_COLUMNS = 12, CLASSROOM_ROWS = 11;
const CLASSROOM_WIDTH = CLASSROOM_COLUMNS * TILE_SIZE, CLASSROOM_DEPTH = CLASSROOM_ROWS * TILE_SIZE;
const TEACHER_CHAIR_A = 45, TEACHER_CHAIR_B = 5;
const hallEdge = (row, arrivalRow, target, direction) =>
  Array.from({ length: HALL_COLUMNS }, (_, column) => ({
    tile: [column, row], target, arrival: [column, arrivalRow], direction
  }));
const STOCK_COLUMNS = 12, STOCK_ROWS = 10;
const STOCK_WIDTH = STOCK_COLUMNS * TILE_SIZE, STOCK_DEPTH = STOCK_ROWS * TILE_SIZE;
const POTION_STOCK_DOOR_COLUMN = POTION_COLUMNS - 1, STOCK_DOOR_ROW = 4;
const T = 20;     // muurdikte
const WH = 104;   // muurhoogte
const F = 56;     // dikte onderbouw
const W = 4 * (Math.max(STOCK_WIDTH, LIBRARY_WIDTH, LIBRARY_DEPTH, TOWER_SIZE) + T) + 10, CX = W / 2, CY = 162;
const H = CY + Math.max(STOCK_WIDTH + STOCK_DEPTH, LIBRARY_WIDTH + LIBRARY_DEPTH, 2 * TOWER_SIZE) + F + 12;

const cv = document.getElementById('scene');
const preview = cv.dataset?.preview !== undefined;
if (preview && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const statC = mk(), secondC = mk(), potionC = mk(), stockC = mk(), hallC = mk(), hallEndC = mk(), classroomC = mk();
const rooms = {
  tower: { title: 'Main Room', canvas: statC, exits: [
    { tile: [TOWER_LIBRARY_DOOR_COLUMN, TOWER_TILES - 1], target: 'library',
      arrival: [LIBRARY_TOWER_DOOR_COLUMN, 1], direction: 'sw' }
  ] },
  library: { title: 'Grand Library', canvas: secondC, exits: [
    { tile: [LIBRARY_TOWER_DOOR_COLUMN, 0], target: 'tower',
      arrival: [TOWER_LIBRARY_DOOR_COLUMN, TOWER_TILES - 2], direction: 'ne' },
    { tile: [LIBRARY_COLUMNS - 1, LIBRARY_POTION_DOOR_ROW], wallA: LIBRARY_WIDTH, target: 'potion', arrival: [1, POTION_DOOR_ROW], direction: 'se' },
    { tile: [LIBRARY_HALL_DOOR_COLUMN, LIBRARY_ROWS - 1], wallB: LIBRARY_DEPTH, archHalfWidth: 19,
      target: 'hall', arrival: [HALL_ENTRANCE_COLUMN, 1], direction: 'sw' }
  ] },
  hall: { title: 'Castle Hall', canvas: hallC, corridor: true, exits: [
    { tile: [HALL_ENTRANCE_COLUMN, 0], wallB: 0, target: 'library',
      arrival: [LIBRARY_HALL_DOOR_COLUMN, LIBRARY_ROWS - 2], direction: 'ne' },
    ...hallEdge(HALL_ROWS - 1, 1, 'hallEnd', 'sw')
  ] },
  hallEnd: { title: 'Castle Hall', canvas: hallEndC, corridor: true, exits: [
    ...hallEdge(0, HALL_ROWS - 2, 'hall', 'ne'),
    { tile: [HALL_COLUMNS - 1, HALL_CLASSROOM_DOOR_ROW], wallA: HALL_WIDTH,
      target: 'classroom', arrival: [1, CLASSROOM_DOOR_ROW], direction: 'se' }
  ] },
  classroom: { title: 'Runes Classroom', canvas: classroomC, exits: [
    { tile: [0, CLASSROOM_DOOR_ROW], wallA: 0, target: 'hallEnd',
      arrival: [HALL_COLUMNS - 2, HALL_CLASSROOM_DOOR_ROW], direction: 'nw' }
  ] },
  potion: { title: 'Potion Room', canvas: potionC, exits: [
    { tile: [0, POTION_DOOR_ROW], wallA: 0, target: 'library', arrival: [LIBRARY_COLUMNS - 2, LIBRARY_POTION_DOOR_ROW], direction: 'nw' },
    { tile: [POTION_STOCK_DOOR_COLUMN, 0], wallB: 0,
      target: 'stockroom', arrival: [1, STOCK_DOOR_ROW], direction: 'se' }
  ] },
  stockroom: { title: 'Potion Stockroom', canvas: stockC, exits: [
    { tile: [0, STOCK_DOOR_ROW], wallA: 0, target: 'potion',
      arrival: [POTION_STOCK_DOOR_COLUMN, 1], direction: 'nw' }
  ] }
};

const P = (a, b, z) => [CX + 2 * (a - b), CY + a + b - z];

/* ---------- helpers ---------- */
function hash(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const _sh = new Map();
function sh(color, factor) {
  const key = color + '|' + factor;
  if (_sh.has(key)) return _sh.get(key);
  const channels = color.startsWith('#')
    ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16))
    : color.slice(4, -1).split(',').map(Number);
  const result = 'rgb(' + channels.map(channel => Math.min(255, Math.floor(channel * factor))).join(',') + ')';
  _sh.set(key, result);
  return result;
}
function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
function dot(g, x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
function line(g, x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    dot(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function ell(g, cx, cy, rx, ry, c) {
  cx = Math.round(cx); cy = Math.round(cy);
  g.fillStyle = c;
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) g.fillRect(cx + x, cy + y, 1, 1);
}

/* muur-painters: u = pixelkolom langs de muur (2 px per eenheid) */
function wallL(g, a, u0, u1, z0, z1, fn) {      // vlak a = const (linker muur), u = 2*b
  for (let u = u0; u < u1; u++) {
    const x = CX + 2 * a - 1 - u, yb = CY + a + (u >> 1) - 1;
    for (let z = z0; z < z1; z++) {
      const c = fn(u, z);
      if (c) { g.fillStyle = c; g.fillRect(x, yb - z, 1, 1); }
    }
  }
}
function wallR(g, b, u0, u1, z0, z1, fn) {      // vlak b = const (rechter muur), u = 2*a
  for (let u = u0; u < u1; u++) {
    const x = CX - 2 * b + u, yb = CY + b + (u >> 1) - 1;
    for (let z = z0; z < z1; z++) {
      const c = fn(u, z);
      if (c) { g.fillStyle = c; g.fillRect(x, yb - z, 1, 1); }
    }
  }
}
const pxL = (g, u, z, c) => dot(g, CX - 1 - u, CY + (u >> 1) - 1 - z, c);
const pxR = (g, u, z, c) => dot(g, CX + u, CY + (u >> 1) - 1 - z, c);

function topFace(g, z, a0, a1, b0, b1, fn) {
  const xmin = Math.floor(CX + 2 * (a0 - b1)) - 1, xmax = Math.ceil(CX + 2 * (a1 - b0)) + 1;
  const ymin = Math.floor(CY + a0 + b0 - z) - 1, ymax = Math.ceil(CY + a1 + b1 - z) + 1;
  for (let y = ymin; y <= ymax; y++) for (let x = xmin; x <= xmax; x++) {
    const X = (x + .5 - CX) / 2, Y = y + .5 - CY + z;
    const a = (Y + X) / 2, b = (Y - X) / 2;
    if (a >= a0 && a < a1 && b >= b0 && b < b1) {
      const c = fn(a, b);
      if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
    }
  }
}
function box(g, a0, b0, z0, da, db, dz, c) {
  const a1 = a0 + da, b1 = b0 + db, z1 = z0 + dz;
  const xmin = Math.floor(CX + 2 * (a0 - b1)) - 1, xmax = Math.ceil(CX + 2 * (a1 - b0)) + 1;
  const ymin = Math.floor(CY + a0 + b0 - z1) - 1, ymax = Math.ceil(CY + a1 + b1 - z0) + 1;
  const get = (f, u, v) => (typeof f === 'function' ? f(u, v) : f);
  for (let y = ymin; y <= ymax; y++) for (let x = xmin; x <= xmax; x++) {
    const X = (x + .5 - CX) / 2, yy = y + .5;
    let col = null;
    const Y = yy - CY + z1;
    let a = (Y + X) / 2, b = (Y - X) / 2;
    if (a >= a0 && a < a1 && b >= b0 && b < b1) col = get(c.top, a, b);
    else {
      a = X + b1; let z = CY + a + b1 - yy;
      if (a >= a0 && a < a1 && z >= z0 && z < z1) col = get(c.left, Math.floor(a * 2), Math.floor(z));
      else {
        b = a1 - X; z = CY + a1 + b - yy;
        if (b >= b0 && b < b1 && z >= z0 && z < z1) col = get(c.right, Math.floor(b * 2), Math.floor(z));
      }
    }
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
}
function woodC(base) {
  return {
    top: (a, b) => (hash(Math.floor(a * 2), Math.floor(b * 3)) > .82 ? sh(base, 1.28) : sh(base, 1.15)),
    left: (u, z) => (hash(u, z >> 2) > .85 ? sh(base, 1.0) : sh(base, .88)),
    right: (u, z) => (hash(u >> 1, z) > .85 ? sh(base, .72) : sh(base, .62))
  };
}
const flat = (t, l, r) => ({ top: t, left: l, right: r });

/* ---------- stenen ---------- */
function scalePal(p, f) {
  return { mortar: sh(p.mortar, f), c: p.c.map(x => sh(x, f)), hi: sh(p.hi, f), lo: sh(p.lo, f) };
}
function brickFn(p, bw = 14, bh = 6) {
  return (u, z) => {
    const row = Math.floor(z / bh), zz = z - row * bh;
    const uu = u + ((row & 1) ? bw / 2 : 0), col = Math.floor(uu / bw), ux = uu - col * bw;
    if (zz === 0 || ux === 0) return p.mortar;
    const r = hash(col, row);
    const c = p.c[r < .34 ? 0 : r < .67 ? 1 : 2];
    if (zz === bh - 1) return p.hi;
    if (zz === 1) return p.lo;
    const r2 = hash(u * 7, z * 13);
    if (r2 > .95) return p.hi;
    if (r2 < .04) return p.lo;
    return c;
  };
}
const palInL = { mortar: '#242d36', c: ['#3d4855', '#485460', '#515f6a'], hi: '#667480', lo: '#323e4a' };
const palInR = { mortar: '#2a2e35', c: ['#4b5059', '#555d66', '#5e666e'], hi: '#727e86', lo: '#3a424d' };
const palChim = { mortar: '#3e3636', c: ['#686266', '#797377', '#827c7e'], hi: '#a09897', lo: '#545055' };
const palOut = { mortar: '#2e4472', c: ['#456296', '#4f70a4', '#5a7cb0'], hi: '#7da0cd', lo: '#3a5586' };
const brL = brickFn(palInL, 22, 10), brR = brickFn(palInR, 22, 10), brC = brickFn(palChim, 12, 7);
const brOutL = brickFn(scalePal(palOut, .88)), brOutR = brickFn(scalePal(palOut, 1.08));
const brOut = brickFn(palOut);

const copingFn = (a, b) => {
  const ea = ((a % TILE_SIZE) + TILE_SIZE) % TILE_SIZE, eb = ((b % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
  if (ea < .5 || eb < .5) return '#5f80ac';
  return hash(Math.floor(a / 8), Math.floor(b / 8)) > .5 ? '#86a8cf' : '#7c9ec6';
};

/* ---------- vloer ---------- */
// Middelpunt en beide stralen in vloercoördinaten.
const towerShadows = [
  [21.5, 4.5, 11.5, 3.4], [29, 45.5, 4.8, 4.8], [29, 53, 12.5, 4.7],
  [55, 4, 8, 4], [4, 27, 4, 11], [78, 23, 8, 5], [76, 44, 5, 4], [84, 68, 4, 4], [6, 61, 4, 4],
  [TABLE_A + 1, TABLE_B + 1.5, 5, 5], [towerChestA + 1, towerChestB + 1.5, 4.8, 3.7],
  [5, TOWER_DIAMOND_B + 1.5, 4.1, 4.1], [5, 5.5, 3.4, 3.4],
  [59, 37.5, 3.4, 3.4]
];

function contactShade(a, b, centerA, centerB, radiusA, radiusB) {
  const distance = ((a - centerA) / radiusA) ** 2 + ((b - centerB) / radiusB) ** 2;
  return distance < .55 ? .62 : distance < 1 ? .8 : 1;
}

function shadedTowerFloor(a, b) {
  let shade = 1;
  for (const shadow of towerShadows) shade = Math.min(shade, contactShade(a, b, ...shadow));
  const color = floorFn(a, b);
  // Hetzelfde kruis als in het glas, geprojecteerd vanaf de linkerwand.
  const u = 44 + 2 * (b - 24 + a * .33);
  const z = 60 + (a - 4) * .85;
  const sunset = towerWindowGlass(u, z) ? .24 * (1 - a / 44) : 0;
  return tintFloor(color, 1 - (1 - shade) * .72, sunset);
}

function floorFn(a, b) {
  if (a >= 10 && a < 42 && b >= 7 && b < 71) {
    const edge = Math.min(a - 10, 42 - a, b - 7, 71 - b);
    if (b < 8.2 || b >= 69.8) return Math.floor(a * 2) % 2 ? '#baa47c' : '#8b795d';
    if (edge < 1.4) return '#3c4441';
    if (edge < 2.15) return '#ad9160';
    if (edge < 3.25) return (Math.floor(a * 2) + Math.floor(b * 2)) % 5 === 0 ? '#a0845d' : '#596455';
    const diamond = Math.abs(a - 26) + Math.abs((b - 9) % 12 - 6);
    if (Math.abs(diamond - 4.25) < .45) return '#ae9468';
    if (diamond < 2) return '#758171';
    return hash(Math.floor(a * 2), Math.floor(b * 2)) > .81 ? '#53685f' : '#4b625a';
  }
  if (b >= TOWER_SIZE - .8 || a >= TOWER_SIZE - .8) return '#747e87';
  const width = 4, length = 4;
  const column = Math.floor(a / width), row = Math.floor(b / width);
  const phase = (column + row) % (length * 2);
  const acrossA = phase < length;
  const offset = phase % length;
  const cross = (acrossA ? b : a) % width;
  const along = offset * width + (acrossA ? a : b) % width;
  if (cross < .38 || along < .38) return '#59402f';

  // Elke plank is vier vakjes lang. De twee richtingen grijpen trapsgewijs in elkaar.
  const startA = column - (acrossA ? offset : 0);
  const startB = row - (acrossA ? 0 : offset);
  const tone = .95 + hash(startA, startB) * .1;
  const edge = cross > width - .4 ? 1.035 : 1;
  const grain = hash(Math.floor(along / 3) + startA, Math.floor(cross * 2) + startB);
  return sh('#6c4d3a', tone * edge * (grain > .87 ? 1.09 : grain < .12 ? .94 : 1));
};

/* ---------- onderbouw met bogen ---------- */
function arch(adu, z) {
  const w = 26, zs = -40, c = 6.7, R = w + c;
  if (adu > w) return 0;
  const inside = z <= zs ? true : ((adu + c) * (adu + c) + (z - zs) * (z - zs) <= R * R);
  if (!inside) return 0;
  const w2 = w - 3, R2 = R - 3;
  const inner = adu <= w2 && (z <= zs ? true : ((adu + c) * (adu + c) + (z - zs) * (z - zs) <= R2 * R2));
  return inner ? 2 : 1;
}
function facadeFn(br, span) {
  return (u, z) => {
    if (u >= 0 && z >= 0) return null;
    if (u >= 0) {
      const r = arch(Math.abs(u - span + .5), z + .5);
      if (r === 2) return z > -22 ? '#10132b' : '#171b38';
      if (r === 1) return ((Math.floor(Math.abs(u - span) / 3) + Math.floor((z + 60) / 3)) & 1) ? '#7a9cca' : '#6684b6';
    }
    return br(u, z);
  };
}

/* ---------- hout / boekenkast / raam ---------- */
const woodEdge = (u, z) => (u === 22 || z === 7) ? '#9b704c' : (hash(u, z >> 2) > .8 ? '#755138' : '#674630');
const woodMid = (u, z) => (hash(u >> 1, z) > .85 ? '#835c3f' : '#6f4b34');
const bookCols = ['#8c2f39', '#2f6e4f', '#3b4f9a', '#b08a3a', '#6a3a8a', '#c0603a', '#2a7a8a', '#7a7a8e'];
const bookRows = [];
for (let r = 0; r < 4; r++) {
  const arr = {}; let u = 24;
  while (u < 64) {
    const w = 2 + Math.floor(hash(u, r) * 3), h = 6 + Math.floor(hash(u * 3, r + 9) * 4);
    const c = bookCols[Math.floor(hash(u, r + 31) * bookCols.length)];
    for (let k = 0; k < w && u < 64; k++, u++) arr[u] = { c, h, first: k === 0 };
    if (hash(u, r + 50) > .86) u += 2;
  }
  bookRows.push(arr);
}
function bookFn(u, z) {
  const r = Math.floor((z - 8) / 12), lz = (z - 8) - r * 12;
  if (lz < 2) return lz === 1 ? '#966846' : '#62412e';
  const b = bookRows[r] && bookRows[r][u];
  if (b && lz - 2 < b.h) {
    if (!b.first && (lz === 4 || lz === b.h) && hash(u >> 1, r) > .65) return '#af8f62';
    return b.first || lz === b.h + 1 ? sh(b.c, 1.14) : sh(b.c, .84);
  }
  return '#28262c';
}
function hatFn(u, z) {
  const hu = u - 11;
  if (z >= 62 && z < 64 && Math.abs(hu) <= 8) return '#2a2160';
  if (z >= 64 && z < 87) {
    const hw = 6 - (z - 64) * .27;
    if (Math.abs(hu) <= hw) {
      if (z < 67) return '#d9a53a';
      if ((u === 10 && z === 73) || (u === 12 && z === 70)) return '#ffd45a';
      return hu > 1 ? '#6354c4' : '#4b3fa8';
    }
  }
  if (z === 87 && hu === 0) return '#222';
  return null;
}

function towerWindowArch(u, z) {
  return Math.hypot(u - 44, Math.max(0, z - 76));
}

function towerWindowCross(u, z) {
  return u >= 43 && u < 45 || z >= 72 && z < 74;
}

function towerWindowGlass(u, z) {
  return z >= 30 && towerWindowArch(u, z) < 18 && !towerWindowCross(u, z);
}

function towerPanel(u, z) {
  if (z >= 28) return null;
  if (z < 3 || z === 25 || z >= 27 || u % 16 < 2) return '#433d36';
  if (z === 26 || u % 16 === 2) return '#766b53';
  return hash(u >> 2, z >> 1) > .86 ? '#4e6257' : '#46594f';
}

function leftFn(u, z) {
  if (z >= 30) {
    const arch = towerWindowArch(u, z);
    if (arch < 18) return towerWindowCross(u, z) ? (u === 43 || z === 73 ? '#967852' : '#614832') : null;
    if (arch < 22) {
      if (arch >= 21 || z % 7 === 0 && z <= 76) return '#35404a';
      if (arch < 19) return '#8e928a';
      return arch >= 20 ? '#606d76' : '#717f86';
    }
  }
  const h = hatFn(u, z); if (h) return h;
  return towerPanel(u, z) ?? towerWallStone(brL, u, z);
}

/* ---------- haard / schoorsteen / portret ---------- */
const soot = (u, z) => (((u + (((z >> 3) & 1) * 4)) % 8 === 0) ? '#221829' : '#17111f');
function portraitFn(u, z) {
  if (u < 34 || u >= 50 || z < 66 || z >= 94)
    return (u === 32 || u === 51 || z === 64 || z === 95) ? '#caaa72' : '#8d6744';
  const pu = u - 34, pz = z - 66, cx = 7.5, d = Math.abs(pu - cx);
  if (pz >= 18 && pz < 28) {
    const hw = (27.5 - pz) * .55 + .5;
    if (d <= hw) { if (pu === 7 && pz === 22) return '#ffd45a'; return pu > cx ? '#5a4cb0' : '#4c3f9a'; }
  }
  if (pz >= 16 && pz < 18 && d <= 7) return '#3a2e7a';
  if (pz >= 8 && pz < 16 && d <= 3.6) { if (pz === 10 && d < 1) return '#b88660'; return '#d6ab84'; }
  if (pz < 10) {
    const hw = pz >= 8 ? 3.6 : 5.4 - Math.abs(pz - 5) * .6;
    if (d <= hw) return d > hw - 1.2 ? '#a9acc6' : '#d9d9ea';
  }
  return pz > 14 ? '#241a44' : '#1a1330';
}
const fireOpen = (u, z) => {
  return Math.hypot(u - 42, Math.max(0, z - 28)) < 12;
};
function rightFn(u, z) {
  if (fireOpen(u, z)) return soot(u, z);
  if (u >= 22 && u < 62 && z < 54) {
    if (u < 24 || u >= 60 || z >= 52) return '#96908b';
    if (fireOpen(u + 2, z) || fireOpen(u - 2, z) || fireOpen(u, z - 2)) {
      return (u + z) % 7 === 0 ? '#4c4546' : '#a49a8d';
    }
    return brC(u, z);
  }
  if (u >= 26 && u < 58 && z >= 54) {
    if (u >= 32 && u < 52 && z >= 64 && z < 96) return portraitFn(u, z);
    if (u < 28 || u >= 56) return '#888280';
    return brC(u, z);
  }
  return towerPanel(u, z) ?? towerWallStone(brR, u, z);
}

function towerWallStone(brick, u, z) {
  const color = brick(u, z);
  if (z < 5) return sh(color, .8 + z * .035);
  const texture = hash(Math.floor(u / 2), z);
  return texture > .91 ? sh(color, 1.12) : texture < .08 ? sh(color, .89) : color;
}

const doorStyles = {
  tower: {
    wood: '#995b37', light: '#bd7943', dark: '#613624', metal: '#efc17a',
    cloth: '#75404d', thread: '#d5ad69', emblem: (x, y) => Math.abs(x) + 2 * Math.abs(y) < 2.6
  },
  library: {
    wood: '#72503c', light: '#a6784f', dark: '#4b332b', metal: '#d6b47a',
    cloth: '#52634d', thread: '#b7a676', emblem: (x, y) => Math.abs(x) < 2.5 && Math.abs(y) < .85 + .13 * Math.abs(x)
  },
  potion: {
    wood: '#9c6545', light: '#c38455', dark: '#644338', metal: '#92b7a0',
    cloth: '#5d505f', thread: '#ac959f', emblem: (x, y) => x * x + (y * 2) ** 2 < 4.5
  },
  stockroom: {
    wood: '#665044', light: '#8c7156', dark: '#45362e', metal: '#9e9281',
    cloth: '#766352', thread: '#a28d6f', emblem: (x, y) => Math.abs(y - x * .23) < .35 && Math.abs(x) < 2.7
  }
};

function passageColor(dx, z, style = doorStyles.tower) {
  const distance = Math.abs(dx);
  const lift = Math.max(0, z - 31);
  const curve = Math.hypot(dx, lift);
  if (curve > 17) return null;
  if (curve > 11) {
    const grain = hash(Math.floor(dx * 2 + Math.sin(z / 5)), Math.floor(z / 6));
    const foot = z < 5 || (z >= 27 && z <= 30);
    const keystone = z >= 44 && distance < 3;
    const stud = z < 26 && distance >= 13 && distance < 15 && [9, 16, 23].includes(z);
    const leaf = (keystone && (distance < .7 || (distance < 2.2 && (z === 45 || z === 47)))) ||
      (lift > 2 && Math.abs(curve - 14) < .65 && (z === 35 || z === 38 || z === 41));
    if (curve > 16.3) return sh(style.dark, .77);
    if (stud || leaf) return dx < 0 ? style.metal : sh(style.metal, .8);
    if (z < 27 && distance >= 14 && distance < 14.7 && [10, 17, 24].includes(z)) return style.dark;
    if (curve > 15 || (foot && (z === 4 || z === 30))) return style.light;
    if (curve < 12.2) return style.dark;
    if (foot || keystone) return sh(style.wood, .94);
    if (curve > 14 && curve < 14.8) return sh(style.dark, 1.14);
    return grain > .72 ? sh(style.wood, 1.15) : grain < .28 ? sh(style.wood, .83) : style.wood;
  }
  if (z < 3) return style.light;
  if (z < 7) return '#644033';
  if (dx > 8.5 && z < 32) return '#4b2a2b';
  return '#27192c';
}

function drawDoorMat(g, a0, b0, width, depth, style) {
  const acrossA = width > depth;
  box(g, a0, b0, 0, width, depth, 1, {
    top: (a, b) => {
      const u = acrossA ? a - a0 : b - b0;
      const v = acrossA ? b - b0 : a - a0;
      const span = acrossA ? width : depth;
      const length = acrossA ? depth : width;
      const edge = Math.min(u, span - u, v, length - v);
      const weave = (Math.floor(u * 2) + Math.floor(v * 2)) % 2;
      if (edge < .5) return '#594035';
      if (edge < 1.15) return weave ? style.thread : sh(style.thread, .78);
      if (edge < 1.6) return '#614339';
      const x = u - span / 2, y = v - length / 2;
      if (style.emblem(x, y)) return Math.abs(x) < .3 ? sh(style.thread, 1.16) : style.thread;
      return weave ? style.cloth : sh(style.cloth, .89);
    },
    left: '#614239',
    right: '#724a37'
  });
}

function drawPassage(g, rear, style) {
  const column = rear ? LIBRARY_TOWER_DOOR_COLUMN : TOWER_LIBRARY_DOOR_COLUMN;
  const center = (column + .5) * TILE_SIZE;
  const wall = rear ? 0 : TOWER_SIZE;
  drawDoorMat(g, center - 7, rear ? 0 : wall - 7, 14, 7, style);
  wallR(g, wall, 2 * center - 17, 2 * center + 18, 0, 49, (u, z) => passageColor(u - 2 * center, z, style));
}

const acrossArchColor = (offset, z, halfWidth = 15, style) => passageColor(offset * 17 / halfWidth, z, style);

function drawAcrossPassage(g, { tile, wallB, archHalfWidth = 15 }, style, foreground = false) {
  const center = (tile[0] + .5) * TILE_SIZE;
  if (!foreground) {
    const matWidth = archHalfWidth - 3;
    drawDoorMat(g, center - matWidth / 2, wallB === 0 ? 0 : wallB - 7, matWidth, 7, style);
    if (wallB > 0) return;
  }
  wallR(g, wallB, 2 * center - archHalfWidth, 2 * center + archHalfWidth + 1, 0, 49,
    (u, z) => acrossArchColor(u - 2 * center, z, archHalfWidth, style));
}

function closedStockDoorColor(offset, z) {
  if (Math.hypot(offset * 17 / 15, Math.max(0, z - 31)) > 11 || z < 3) return null;
  const plank = (offset + 12) % 5;
  if (z >= 13 && z <= 15 || z >= 29 && z <= 31) {
    if (z === 14 || z === 30) return Math.abs(offset) === 7 ? '#d2ad70' : '#53453c';
    return '#3d3030';
  }
  if (offset === 4 && z >= 20 && z <= 23) return z === 22 ? '#ead08e' : '#77583e';
  if (plank === 0) return '#4c3027';
  if (plank === 1) return '#aa6f49';
  return hash(offset, Math.floor(z / 4)) > .65 ? '#96603e' : '#805039';
}

const closedStockDoor = mk();
const stockDoorCenter = (POTION_STOCK_DOOR_COLUMN + .5) * TILE_SIZE * 2;
wallR(closedStockDoor.getContext('2d'), 0, stockDoorCenter - 15, stockDoorCenter + 16, 0, 49,
  (u, z) => closedStockDoorColor(u - stockDoorCenter, z));

function drawSidePassage(g, { wallA, tile }, foreground, style) {
  const center = (tile[1] + .5) * TILE_SIZE;
  if (!foreground) {
    drawDoorMat(g, wallA === 0 ? 0 : wallA - 7, center - 7, 7, 14, style);
    if (wallA !== 0) return;
  }
  wallL(g, wallA, 2 * center - 17, 2 * center + 18, 0, 49, (u, z) => passageColor(2 * center - u, z, style));
}

/* ---------- bibliotheek ---------- */
// Een bank kan meerdere zitplekken in hetzelfde meubel registreren.
const armchairSeat = { tile: [3, 5], approach: [4, 5], direction: 'sw', offsetB: 1, height: 7, hit: [13, 25] };
const readingSeat = { tile: [1, 5], approach: [2, 5], direction: 'ne', offsetB: 0, height: 7, hit: [14, 24] };
const studyTables = [[3, 3], [8, 3], [3, 8], [8, 8]];
const studySeats = studyTables.flatMap(([column, row]) =>
  [column, column + 1, column + 2].flatMap(a => [-1, 1].map(side => ({
    tile: [a, row + side], approach: [a, row + 2 * side],
    direction: side > 0 ? 'ne' : 'sw', height: 7, hit: [9, 16]
  }))));
const librarySeats = [readingSeat, ...studySeats];

const libraryLayout = [
  [1, 6, 'plant'], [7, 1, 'plant'], [1, 5, 'reading chair'], [0, 4, 'tea table'],
  [2, 10, 'plant'], [12, 2, 'plant'], [12, 10, 'plant'],
  ...studySeats.map(({ tile }) => [...tile, 'chair'])
];
const leftShelfRanges = [[4, 64], [115, 126], [132, 184]];
const rightShelfRanges = [[8, 48], [98, 126], [133, 151], [187, 222]];
const libraryLanterns = [[10, 10], [46, 16], [14, 48], [78, 25], [89, 68], [37, 76]];

function shadedLibraryFloor(a, b) {
  const color = libraryFloor(a, b);
  let shade = 1;
  if ((a < 8 && leftShelfRanges.some(([start, end]) => b * 2 >= start && b * 2 < end)) ||
      (b < 8 && rightShelfRanges.some(([start, end]) => a * 2 >= start && a * 2 < end))) {
    shade = Math.min(shade, Math.min(a, b) < 5 ? .65 : .85);
  }
  for (const [column, row, type] of libraryLayout) {
    const radius = 3.4;
    const centerA = (column + .5) * TILE_SIZE + 1;
    const centerB = (row + .5) * TILE_SIZE + 1.5;
    shade = Math.min(shade, contactShade(a, b, centerA, centerB, radius, radius));
  }
  for (const [column, row] of studyTables) {
    shade = Math.min(shade, contactShade(a, b, (column + 1.5) * TILE_SIZE, (row + .5) * TILE_SIZE, 13, 4));
  }
  const lamplight = Math.max(0, ...libraryLanterns.map(([la, lb]) => 1 - Math.hypot((a - la) / 20, (b - lb) / 17)));
  const adjusted = shade * (1 + lamplight * .32);
  if (!lamplight) return sh(color, adjusted);
  const channels = color.startsWith('#')
    ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16))
    : color.slice(4, -1).split(',').map(Number);
  const amber = [255, 190, 106];
  const amount = lamplight * .24;
  return 'rgb(' + channels.map((channel, index) =>
    Math.min(255, Math.round((channel * (1 - amount) + amber[index] * amount) * adjusted))).join(',') + ')';
}

function libraryFloor(a, b) {
  if (a >= 49 && a < 62 && b >= 14 && b < 86) {
    const edge = Math.min(a - 49, 62 - a, b - 14, 86 - b);
    if (edge < 1) return '#ba9a5e';
    if (edge < 2) return '#2c4b47';
    return Math.abs(a - 55.5) + Math.abs(b % 8 - 4) < 3.4 ? '#a48249' : '#385d55';
  }
  const annex = a >= 65 && a < 104 && b >= 14 && b < 86;
  if (annex || (a >= 9 && a < 58 && b >= 15 && b < 58)) {
    const edge = annex ? Math.min(a - 65, 104 - a, b - 14, 86 - b) : Math.min(a - 9, 58 - a, b - 15, 58 - b);
    if (edge < .8 || (edge > 1.8 && edge < 2.7)) return '#bea875';
    if (edge < 4) return '#485b48';
    const pattern = annex ? Math.abs(a - 84.5) + Math.abs(b - 50) : Math.abs(a - 33.5) + Math.abs(b - 36.5);
    const weave = hash(Math.floor(a * 2), Math.floor(b * 2));
    if (Math.abs(pattern - 13) < .85 || Math.abs(pattern - 16) < .55) return '#91a17a';
    return weave > .86 ? '#68795d' : '#52674d';
  }
  const row = Math.floor(b / 8);
  const offsetA = a + (row % 2) * 5;
  const seam = Math.min(offsetA % 10, b % 8);
  const stone = hash(Math.floor(offsetA / 10), row);
  if (seam < .55) return '#33383f';
  if (seam < 1.15) return '#777f7d';
  const speck = hash(Math.floor(a * 2), Math.floor(b * 2));
  return sh('#5e656a', .83 + stone * .24 + (speck > .92 ? .09 : 0));
}

function libraryShelf(start, end, ladderAt) {
  const width = end - start;
  const dividers = width >= 56 ? [Math.floor(width / 2)] : [];
  const isFrame = column => column < 3 || column >= width - 3 ||
    dividers.some(divider => Math.abs(column - divider) <= 1);
  const shelves = Array.from({ length: 6 }, (_, row) => {
    const books = [];
    for (let column = 3; column < width - 3;) {
      if (isFrame(column)) { column++; continue; }
      const seed = hash(start + column, row);
      const size = 2 + Math.floor(seed * 4);
      const height = 6 + Math.floor(hash(start + column, row + 13) * 6);
      const color = bookCols[Math.floor(seed * bookCols.length)];
      for (let spine = 0; spine < size && !isFrame(column); spine++, column++) {
        books[column] = { color, height, spine, gilt: seed > .54 };
      }
      if (seed > .35) column++;
    }
    return books;
  });
  return (u, z) => {
    const column = u - start;
    if (isFrame(column) || z >= 86 || z < 4) return (z === 86 || column === 1) ? '#865a40' : '#603e31';
    const row = Math.floor((z - 4) / 14), height = (z - 4) % 14;
    const ladder = ladderAt === null ? -1 : u - ladderAt - Math.floor(z / 7);
    if (z < 74 && ladder >= 0 && ladder <= 10) {
      if (ladder <= 1 || ladder >= 9) return '#966643';
      if (z % 9 < 2) return '#825536';
    }
    if (height < 2) return height === 1 ? '#80553d' : '#4c3128';
    const book = shelves[row]?.[column];
    const page = height - 2;
    if (!book || page >= book.height) return '#292025';
    if (page === book.height - 1) return '#ad9671';
    if (book.gilt && book.spine > 0 && (page === 1 || page === book.height - 3)) return '#b19a67';
    return sh(book.color, book.spine === 0 ? 1.02 : .75);
  };
}

const sunsetSky = ['#ffce8f', '#f7a279', '#db7b83', '#ae6683', '#795778', '#584763'];

function distantCastle(x, y) {
  const column = Math.floor(x - 49);
  const height = Math.floor(y * 49) - 9;
  if (column < 0 || column > 15 || height < 0) return null;
  const tower = column < 4 || column > 11;
  const wall = column < 9 ? '#685168' : '#59485e';
  const top = tower ? (column < 4 ? 11 : 9) : 6;
  if (height > top || (height === top && column % 2)) return null;
  if (tower && height === top - 3 && (column === 2 || column === 13)) return '#a7797a';
  if (height === top - 1) return '#81607a';
  return wall;
}

function autumnSunset(x, y, showSun = true, showCastle = false) {
  const ridge = .24 + Math.sin(x * .085) * .045 + Math.cos(x * .16) * .028;
  const canopy = .14 + Math.sin(x * .24) * .045 + Math.cos(x * .68) * .026;
  const leaf = hash(Math.floor(x / 2), Math.floor(y * 23));
  if (y < canopy) {
    if (y > canopy - .047) return leaf > .5 ? '#d49555' : '#b7754c';
    return leaf > .7 ? '#a8674d' : '#774853';
  }
  const castle = showCastle && distantCastle(x, y);
  if (castle) return castle;
  if (y < ridge) return '#765773';
  if (showSun && Math.hypot(x - 48, (y - .43) * 49) < 5) return '#ffe8a9';
  if (y > .51 && y < .56 && Math.sin(x * .15) > .35) return '#ffc191';
  return sunsetSky[Math.max(0, Math.min(5, Math.floor((y - .23) * 7.7)))];
}

function readingWindowGlass(u, z) {
  const x = u - 87, y = z - 28;
  return y >= 3 && Math.hypot(x, Math.max(0, y - 37)) <= 17 &&
    x !== 0 && y !== 27 && y !== 28;
}

function drawReadingWindow(g) {
  wallL(g, 0, 66, 108, 28, 88, (u, z) => {
    const x = u - 87, y = z - 28;
    const arch = Math.hypot(x, Math.max(0, y - 37));
    if (arch > 20) return null;
    if (arch > 17 || y < 3) return arch > 19 ? '#394047' : '#947358';
    if (!readingWindowGlass(u, z)) return '#6b5144';
    return autumnSunset(u - 51, y / 53);
  });
}

const libraryClockCenter = 168;
const libraryClockDepth = 2.5;

function drawLibraryClock(g) {
  const a = libraryClockCenter / 2;
  const walnut = woodC('#7f4836');
  const molding = flat('#bd8256', '#60372c', '#87523b');
  box(g, a - 5.5, 0, 25, 11.5, libraryClockDepth, 36, walnut);
  box(g, a - 5.5, 0, 24, 11.5, libraryClockDepth, 3, molding);
  for (let z = 61; z < 70; z += 2) {
    const inset = Math.floor((z - 61) / 2) / 2;
    box(g, a - 5.5 + inset, 0, z, 11.5 - inset * 2, libraryClockDepth, Math.min(2, 70 - z), walnut);
  }
  wallR(g, libraryClockDepth, libraryClockCenter - 11, libraryClockCenter + 12, 24, 70, (u, z) => {
    const x = u - libraryClockCenter, d = Math.abs(x);
    if (z >= 61 && d > 11 - Math.floor((z - 61) / 2)) return null;
    if (d >= 10 || z === 24 || z === 69) return '#3b262c';
    if (z === 26 || z === 62 || (d === 9 && z > 28 && z < 60)) return x <= 0 ? '#d18b62' : '#a36348';
    if (z === 27 || z === 63) return '#603733';
    if (z < 29 || z >= 61 || z === 43) return z % 3 === 0 ? '#b26848' : '#8f4938';
    if (z < 43 && d < 7) {
      if (d === 6 || z === 29 || z === 42) return '#a4794d';
      if (x === -5 && z > 33) return '#695563';
      return z < 32 ? '#291f29' : '#342a34';
    }
    const r = Math.hypot(x, z - 52);
    if (r <= 8) {
      if (r > 7) return '#a3774b';
      const dy = Math.abs(z - 52);
      if ((d === 0 && dy === 6) || (dy === 0 && d === 6)) return '#654835';
      if (d >= 2 && dy >= 2 && Math.abs(r - 6) < .38) return '#98775b';
      return r > 5.9 ? '#c6a47b' : '#e4cba0';
    }
    if (d === 8) return x < 0 ? '#bc7850' : '#613634';
    return hash(u, Math.floor(z / 5)) > .7 ? '#a96346' : x < 0 ? '#97583e' : '#774033';
  });
}

function animateLibraryClock(t) {
  const [faceX, faceY] = P(libraryClockCenter / 2, libraryClockDepth, 52);
  const angle = t / 45 - .85;
  line(ctx, faceX, faceY, faceX + Math.sin(angle) * 5, faceY - Math.cos(angle) * 5, '#674632');
  line(ctx, faceX, faceY, faceX + 3, faceY + 2, '#493237');
  dot(ctx, faceX, faceY, '#875c3a');

  const swing = Math.sin(t * 3.2) * 3.1;
  const [pivotX, pivotY] = P(libraryClockCenter / 2, libraryClockDepth, 41);
  const [bobX, bobY] = P((libraryClockCenter + swing) / 2, libraryClockDepth, 33);
  line(ctx, pivotX, pivotY, bobX, bobY, '#b78b55');
  ell(ctx, bobX, bobY, 3, 2, '#d8ae6e');
  dot(ctx, bobX - 1, bobY - 1, '#f3d29b');
}

function drawLibraryShelves(g) {
  const depth = 3, height = 87;
  const timber = woodC('#926348');
  for (const [start, end] of leftShelfRanges) {
    const narrow = end - start < 24;
    const shelfDepth = narrow ? 2 : depth;
    box(g, 0, start / 2, 0, shelfDepth, (end - start) / 2, height, timber);
    const shelf = libraryShelf(start, end, narrow ? null : 37);
    wallL(g, shelfDepth, start, end, 0, height, (u, z) => {
      if (narrow && (z < 7 || z >= 83)) {
        if (z === 6 || z === 85) return '#ba895d';
        return z % 4 === 0 ? '#51362b' : '#785037';
      }
      return shelf(u, z);
    });
    if (narrow) {
      box(g, 0, start / 2 - .5, height, shelfDepth + .5, (end - start) / 2 + 1, 1.5, timber);
    }
  }
  for (const [start, end] of rightShelfRanges) {
    box(g, start / 2, 0, 0, (end - start) / 2, depth, height, timber);
    wallR(g, depth, start, end, 0, height, libraryShelf(start, end, null));
  }
}

const potionBookcases = [[3, 29], [90, 116]];
const cauldronA = 8 * TILE_SIZE, cauldronB = 4 * TILE_SIZE;
const workbenchA = 4.5 * TILE_SIZE, workbenchB = 6.5 * TILE_SIZE;
const [potionLampX, potionLampY] = P(32, 1, 78);
const rackStart = 2 * TILE_SIZE + 4;
const rackEnd = 6 * TILE_SIZE;
const rackDepth = 5;
const rackHeight = 40;
const rackBubbles = [];
const stockRackBubbles = [];
const rackGlass = mk();
const rackBottleShapes = [
  ['..ccc..', '..gsg..', '..g.g..', '.gh..g.', 'gh...dg', 'gldlldg', 'gdllbdg', '.ddddd.', '..ggg..'],
  ['.ccccc.', '.gsssg.', 'g.....g', 'gh....g', 'ghllldg', 'glkdldg', 'gdkbkdg', 'gdddddg', '.ggggg.'],
  ['ccc', 'gsg', 'g.g', 'ghg', 'g.g', 'glg', 'gbg', 'glg', 'gdg', '.g.'],
  ['..ccc..', '..gsg..', '...g...', '..g.g..', '.gh..g.', 'gllkldg', '.gkbdg.', '..gdg..', '...g...']
];

function drawRackBottle(g, a, z, shape, color, bubbles) {
  const [x, y] = P(a, rackDepth - .5, z);
  const rows = rackBottleShapes[shape];
  const colors = {
    c: '#b0875e', s: sh(color, 1.18), g: '#879ea8', h: '#f4eadd',
    l: color, d: sh(color, .58), b: sh(color, 1.28),
    k: color === '#78a655' ? '#cadc83' : sh(color, 1.53)
  };
  const left = Math.round(x) - (rows[0].length >> 1);
  const top = Math.round(y) - rows.length + 1;
  ell(g, x, y, (rows[0].length >> 1) + 1, 1, '#4b3631');
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === '.') continue;
      const pixel = row[dx];
      const pigment = pixel === 'c' && dx === (row.length >> 1) ? '#d7af7e' : colors[pixel];
      dot(g, left + dx, top + dy, pigment);
    }
  });
  const surface = rows.findIndex(row => row.includes('l'));
  bubbles.push([left + rows[surface].indexOf('l'), top + surface, sh(color, 1.62)]);
}

const rackSupplies = {
  skull: ['.bbb.', 'bbhbb', 'bdhdb', '.bdb.', '.hbh.'],
  herbs: ['....g', '.g.gg', 'ggg..', '..gn.', '.nnt.', 'nttn.', '.nn..'],
  crystal: ['..h..', '.hbh.', 'hbddh', 'hbbdd', '.bdd.', '..d..'],
  vial: ['..n..', '.nnn.', '..h..', '.h.d.', '.h.d.', '.h.d.', '..d..'],
  mushroom: ['.ttt.', 'tbtbt', 'ddddd', '..h..', '.bh..'],
  scroll: ['.n..n', 'nhhhn', 'nbbbn', 'nndnn']
};

const rackSupplyColors = {
  skull: { b: '#cdbb99', h: '#f3dfb7', d: '#50414d' },
  herbs: { g: '#8fa65d', n: '#836048', t: '#bf9c66' },
  crystal: { b: '#ad84d4', h: '#e1c4ff', d: '#684d91' },
  vial: { n: '#ad835d', h: '#c1dbd6', d: '#607f89' },
  mushroom: { t: '#bd7658', b: '#efd4a0', d: '#754457', h: '#d6bc92' },
  scroll: { n: '#926746', h: '#ecd2a0', b: '#bc9c70', d: '#9c4d58' }
};

function drawRackSupply(g, a, z, kind) {
  const [x, y] = P(a, rackDepth - .5, z);
  const rows = rackSupplies[kind];
  const palette = rackSupplyColors[kind];
  ell(g, x, y, 3, 1, '#4b3631');
  for (const [dy, row] of rows.entries()) {
    for (const [dx, pixel] of Array.from(row).entries()) {
      if (pixel !== '.') dot(g, x + dx - 2, y - rows.length + dy + 1, palette[pixel]);
    }
  }
}

function drawPotionRack(g, start = rackStart, end = rackEnd, bubbles = rackBubbles, cabinet = 0) {
  const width = end - start;
  const trim = {
    top: (a, b) => {
      if (b >= rackDepth) return '#c19669';
      if (b >= 2.5 && b < 3) return '#795236';
      return hash(Math.floor(a / 5), Math.floor(b * 2)) > .72 ? '#b0885c' : '#9c714b';
    },
    left: (u, z) => {
      if (z === 2 || z === 14 || z === 26 || z === rackHeight - 1) {
        return hash(u, z) > .86 ? '#a7774e' : '#be9061';
      }
      return '#69452f';
    },
    right: '#573b30'
  };
  const post = flat('#a87b53', (u, z) => {
    const edge = u >= (end - 2) * 2 ? u - (end - 2) * 2 : u - start * 2;
    if (z < 2) return '#63432f';
    if (edge === 0) return '#69452f';
    if (edge === 3) return '#4b3228';
    if (edge === 1) return '#a67b56';
    return hash(u, z >> 2) > .78 ? '#96704d' : '#825936';
  }, (u, z) => {
    if (u === 0 || u === rackDepth * 2 - 1 || z < 3 || z >= rackHeight - 4) return '#765238';
    if (u === 1 || z === rackHeight - 5) return '#49342c';
    return hash(u, z >> 2) > .83 ? '#634735' : '#56402f';
  });
  const inner = flat('#49352f', '#332731', '#392a2c');
  box(g, start, 0, 0, width, 1.5, rackHeight, inner);
  // De sokkel ligt onder de voorstijlen en loopt door tot tegen de muur.
  box(g, start, 0, 0, width, rackDepth, 2, flat('#a97c53', '#63432f', '#50372c'));

  // Wissel per kast welke flesplekken ruimte maken voor brouwvoorraad.
  const supplies = [
    [[1, 'herbs'], [9, 'skull'], [14, 'vial']],
    [[2, 'herbs'], [5, 'mushroom'], [11, 'vial'], [15, 'herbs']],
    [[3, 'crystal'], [7, 'vial'], [10, 'crystal'], [15, 'mushroom']],
    [[2, 'scroll'], [6, 'skull'], [12, 'herbs'], [15, 'scroll']]
  ][cabinet];
  let slot = 0;
  // Op de middelste plank blijft ruimte voor het flesje op de werkbank.
  const stock = [
    [[6.5, 1, 3], [8, 2, 0], [12, 0, 2], [16, 3, 1], [21, 1, 2], [24.5, 2, 4]],
    [[6.5, 0, 1], [8, 2, 3], [11.5, 1, 4], [14, 2, 2], [24, 0, 3]],
    [[6.5, 3, 2], [8.5, 0, 3], [12, 2, 1], [15.5, 1, 0], [20, 0, 4], [25, 3, 1]]
  ];
  const palette = ['#ba6183', '#569aac', '#78a655', '#9e72b3', '#cd9351'];
  stock.forEach((row, index) => {
    const z = 3 + index * 12;
    box(g, start, 0, z - 2, width, rackDepth, 2, trim);
    for (const [offset, shape, color] of row) {
      const supply = supplies.find(([index]) => index === slot);
      if (supply) drawRackSupply(g, start + offset, z, supply[1]);
      else drawRackBottle(g, start + offset, z, shape, palette[color], bubbles);
      slot++;
    }
  });

  // De linker stijl is slanker zodat de flessen dichter bij het hout staan.
  for (const [a, stileWidth] of [[start, 1], [end - 2, 2]]) {
    box(g, a, 0, 0, stileWidth, rackDepth, rackHeight - 2, post);
    for (const z of [4, 16, 28, 36]) {
      const [x, y] = P(a + stileWidth / 2, rackDepth, z);
      dot(g, x, y, '#503a2c');
      dot(g, x, y - 1, '#bf9b69');
    }
  }
  box(g, start - .5, 0, rackHeight - 2, width + 1, rackDepth + .5, 2, trim);
}

function drawRackDoors(g, start = rackStart, end = rackEnd, reflections = true) {
  const left = (start + 1) * 2;
  const right = (end - 2) * 2;
  const middle = Math.floor((left + right) / 2);
  const top = rackHeight - 2;
  wallR(g, rackDepth, left, right, 2, top, (u, z) => {
    if (z === 2 || z === top - 1) return '#bd9567';
    if (u === left || u === right - 1 || u === middle || u === middle - 1) {
      return u === middle - 1 ? '#bc9468' : '#765139';
    }
    if ((u === middle - 2 || u === middle + 1) && z >= 18 && z <= 20) {
      return z === 20 ? '#ecd29a' : '#a47a4a';
    }
    if (!reflections) return 'rgba(131,194,181,.08)';
    const offset = u < middle ? u - left : u - middle;
    if (offset > 2 && offset < 14 && z === 23 + (offset >> 1)) {
      return 'rgba(205,236,230,.30)';
    }
    if (offset >= 4 && offset < 10 && z === 20 + (offset >> 1)) {
      return 'rgba(205,236,230,.17)';
    }
    return 'rgba(131,194,181,.08)';
  });
}
drawRackDoors(rackGlass.getContext('2d'));

function drawRackBubbles(t) {
  rackBubbles.forEach(([x, y, color], index) => {
    const phase = (t * .85 + index * .381) % 1;
    if (phase < .34) dot(ctx, x, y, color);
  });
}

const workshopStone = brickFn({
  mortar: '#232934', c: ['#414b59', '#4d5963', '#586470'],
  hi: '#697783', lo: '#343d49'
}, 22, 10);

const alchemyStone = brickFn({
  mortar: '#1b2029', c: ['#303b45', '#394650', '#43515b'],
  hi: '#53636b', lo: '#27313b'
}, 22, 10);

function drawWallIvy(g, vines) {
  // Getekend vóór de meubels, zodat de ranken tegen het metselwerk blijven.
  for (const [a, b, length] of vines) {
    let previous = P(a, b, 103);
    for (let drop = 3; drop <= length; drop += 3) {
      const sway = Math.sin(drop * .25 + a + b) * 3;
      const [x, y] = P(a ? a + sway : a, b ? b + sway : b, 103 - drop);
      line(g, ...previous, x, y, '#394936');
      previous = [x, y];
      const side = drop % 2 ? -1 : 1;
      const size = drop < length * .65 ? 3 : 2;
      const color = hash(a + b, drop) > .45 ? '#789c60' : '#56794e';
      ell(g, x + side * 3, y + 2, size + 1, 2, '#2e4b3d');
      ell(g, x + side * 3, y + 1, size, 2, color);
      dot(g, x + side * 4, y, '#a5bd74');
    }
  }
}

const potionWindowCenters = [39, 112];
const potionWindowBase = 48;
const potionGlassRadius = 18;

function potionWindowArch(x, y) {
  return Math.hypot(x, Math.max(0, y - 31));
}

function potionWindowCross(x, y) {
  return x >= -1 && x < 1 || y >= 27 && y < 29;
}

function potionWindowLight(a, b) {
  // Licht door de bovenste ruit valt verder de kamer in.
  const y = (b - 5) * 1.3;
  if (y < 3 || y >= 49) return 0;
  const u = 2 * (a - (b - 18) * .36);
  for (const center of potionWindowCenters) {
    const x = u - center;
    const arch = potionWindowArch(x, y);
    if (arch > potionGlassRadius || potionWindowCross(x, y)) continue;
    return (1 - b / 65) * (arch > potionGlassRadius - 1 ? .55 : 1);
  }
  return 0;
}

function drawPotionDryingRack(g, timber) {
  const railZ = 94;
  box(g, 0, 17, railZ - 2, 2, 25, 2, timber);
  for (const b of [17.75, 29, 41.25]) {
    const [x, y] = P(2, b, railZ - 1);
    dot(g, x, y, '#49342c');
    dot(g, x, y - 1, '#d9ad77');
  }

  const bundles = [
    [19.5, 'herb', '#819354'],
    [23, 'flower', '#a87b9c'],
    [35.5, 'mushroom', '#b76d4a'],
    [39.5, 'mushroom', '#94705d'], [26.5, 'garlic', '#d5c9a1']
  ];
  for (const [b, kind, color] of bundles) {
    const [x, y] = P(2, b, railZ - 1);
    line(g, x, y, x, y + 6, '#c29a69');
    if (kind === 'garlic') {
      for (let i = 0; i < 3; i++) {
        const dx = i % 2 ? 2 : -1, dy = 9 + i * 4;
        line(g,x,y+5,x+dx,y+dy,'#9b9472');
        ell(g,x+dx,y+dy,3,2,'#c5b894');
        line(g,x+dx,y+dy-2,x+dx,y+dy+1,'#eee0bb');
      }
    } else if (kind === 'mushroom') {
      line(g, x, y + 6, x - 2, y + 14, '#cbb090');
      line(g, x, y + 6, x + 2, y + 16, '#d6bc99');
      ell(g, x - 2, y + 14, 2, 1, color);
      ell(g, x + 2, y + 16, 3, 2, color);
      dot(g, x + 1, y + 15, '#dab184');
    } else {
      for (const [dx, dy] of [[-3, 9], [2, 11], [-2, 14], [1, 16]]) {
        line(g, x, y + 6, x + dx, y + dy, '#48513b');
        ell(g, x + dx, y + dy, 2, 1, color);
        dot(g, x + dx - 1, y + dy, sh(color, 1.28));
      }
    }
    // Een kort touwtje met een beschreven perkamentlabel.
    dot(g, x + 2, y + 4, '#dbb987');
    rect(g, x + 2, y + 5, 4, 4, '#be925f');
    rect(g, x + 2, y + 5, 3, 3, '#e2bf83');
    dot(g, x + 3, y + 6, '#765340');
    dot(g, x + 4, y + 7, '#96744e');
  }
}

// Low furniture at the edges leaves the central carpet and both entrances clear.
const potionRoomProps = [
  [2, 10, 'station'], [7, 8, 'station'],
  [10, 5, 'barrel'], [10, 6, 'basket'], [9, 1, 'crates'],
  [1, 7, 'plant'], [10, 8, 'plant'], [0, 8, 'cabinet'], [10, 3, 'wash']
];
function drawPotionStation(g, a, b, variant) {
  const wood = woodC('#78503a'), trim = flat('#ac8656','#725035','#8f6540');
  for (const da of [-3, 10]) for (const db of [-3, 2]) box(g, a + da, b + db, 0, 1, 1, 13, wood);
  box(g, a - 3.5, b - 3.5, 12, 15, 7, 2, wood);
  box(g, a - 3, b + 3.3, 10, 14, .5, 2, trim);
  box(g, a - 2, b - 2, 14, 6, 4, .3, flat('#59716a','#3e514d','#4c6058'));
  if (variant) {
    const [x, y] = P(a + 5, b, 14);
    ell(g, x, y - 4, 5, 4, '#a16f4b');
    ell(g, x - 1, y - 5, 3, 3, '#ce9b65');
    rect(g, x - 1, y - 12, 3, 6, '#b88c5b');
    line(g, x, y - 12, x + 7, y - 12, '#dab783');
    line(g, x + 7, y - 12, x + 9, y - 4, '#996e4d');
    flask(g, x + 9, y, '#81b7a4', 'tube', null);
  } else {
    for (const [da, color] of [[0,'#97b18b'],[4,'#b18bae'],[8,'#789eaf']]) {
      const [x, y] = P(a + da, b, 14);
      flask(g, x, y, color, da === 4 ? 'tube' : undefined, null);
    }
  }
  for (const da of [0, 5, 10]) box(g, a + da, b + 3.8, 10.4, 1, .3, .6, trim);
  // Tool rail, labelled ingredients and a scratched, waxed work surface.
  box(g, a - 2, b + 1.5, 3, 12, .6, 1, wood);
  for (const da of [-2, 3, 8]) {
    line(g, ...P(a+da,b+2.5,14.1), ...P(a+da+1.8,b+2.8,14.1), '#b58d61');
    box(g,a+da,b-2.6,14,1.8,1.3,.3,flat('#d5bf93','#9b805b','#b39a70'));
  }
  const [sx,sy] = P(a+7,b+1,14.2);
  ell(g,sx,sy,2,1,'#4c5b50');
  dot(g,sx-1,sy,'#789273');
  if (!variant) {
    // Brass balance with two shallow pans and suspended chains.
    const [x,y] = P(a+4,b-1,14);
    ell(g,x,y,4,1,'#755b3e');
    line(g,x,y,x,y-15,'#b69b62');
    line(g,x-7,y-13,x+7,y-13,'#d0b57d');
    for(const side of [-1,1]) {
      line(g,x+side*7,y-13,x+side*7,y-6,'#968563');
      ell(g,x+side*7,y-5,4,1,'#b49a6c');
    }
    const [mx,my] = P(a+9,b+1,14);
    ell(g,mx,my-2,4,3,'#777c7e'); ell(g,mx,my-4,4,2,'#a2a69b');
    ell(g,mx,my-4,2,1,'#454c4f');
    line(g,mx,my-4,mx+4,my-9,'#bab9a2');
    for(const dx of [-3,0,2]) dot(g,mx+dx,my+1,'#acba85');
  } else {
    // Tall glass condenser, copper joints and a coiled cooling tube.
    const [x,y] = P(a+7,b-1.5,14);
    rect(g,x-2,y-20,5,15,'#527d82');
    rect(g,x-1,y-19,2,12,'#85b2b1');
    line(g,x-2,y-20,x+2,y-20,'#c2d4c8');
    line(g,x-1,y-18,x-1,y-8,'#d7eee1');
    for(let i=0;i<4;i++) {
      line(g,x-3,y-17+i*3,x+3,y-15+i*3,'#bd8e5a');
      dot(g,x+3,y-15+i*3,'#e0b77b');
    }
    line(g,x,y-21,x-6,y-24,'#bd8e5a');
  }

}

function drawAlchemyDetails(t,a,b,kind,distill) {
  ctx.save();
  if(kind==='wash') {
    const [x,y]=P(a-1,b-2,17);
    const age=(t*.65)%1;
    dot(ctx,x,y+Math.floor(age*6),'#b5e3df');
  } else if(distill) {
    const [x,y]=P(a+7,b-1.5,14);
    for(let i=0;i<3;i++) {
      const age=(t*.55+i/3)%1;
      dot(ctx,x+(i%2),y-7-Math.floor(age*10),'#d1e6ce');
    }
    const [dx,dy]=P(a+5,b,14);
    dot(ctx,dx+9,dy-6+Math.floor((t*.7%1)*5),'#a8d4bd');
  } else {
    const [x,y]=P(a,b,14);
    dot(ctx,x-1,y-3-Math.floor((t*.45%1)*4),'#d2e4c1');
  }
  ctx.restore();
}

function drawPotionWorkshop(g) {
  const timber = {
    top: (a, b) => {
      const board = Math.floor(b * 2);
      if (b * 2 - board < .22) return '#745139';
      return sh('#ad8054', .9 + hash(Math.floor(a / 4), board) * .24);
    },
    left: (u, z) => sh('#805337', .82 + hash(u, Math.floor(z / 7)) * .26),
    right: (u, z) => sh('#63402f', .82 + hash(u, Math.floor(z / 7)) * .22)
  };
  // Stone skirting and muted green panels echo the main room's materials.
  for (const paint of [wallL, wallR]) paint(g, 0, 0, 2 * (paint === wallL ? POTION_ROWS : POTION_COLUMNS) * TILE_SIZE, 0, 25,
    (u, z) => {
      if (paint === wallL && Math.abs(u - (POTION_DOOR_ROW + .5) * 16) < 17 ||
          paint === wallR && Math.abs(u - (POTION_STOCK_DOOR_COLUMN + .5) * 16) < 17) return null;
      if (paint === wallR && u >= rackStart * 2 && u < rackEnd * 2) return null;
      return z < 3 || z > 22 || u % 16 < 2 ? '#383b35' : z === 21 ? '#74674e' : '#30463f';
    });

  drawWallIvy(g, [[0, 48, 38], [0, 5, 27], [58, 0, 43], [31, 0, 20]]);
  for (const [start, end] of potionBookcases) {
    if (start === 90) continue; // Replaced by the depth-sorted alchemy cabinet sprite.
    const depth = 3;
    box(g, 0, start / 2, 0, depth, (end - start) / 2, 81, timber);
    // Fit all six shelves inside the shorter cabinet instead of cutting the top row off.
    const books = libraryShelf(start, end, null);
    wallL(g, depth, start, end, 0, 80, (u,z) => {
      const edge = Math.min(u - start, end - 1 - u);
      if (edge < 3) {
        if (edge === 0) return '#4e382c';
        return edge === 1 ? '#b58a5c' : '#80573c';
      }
      if (z < 6) return z === 5 ? '#aa7e51' : '#60422f';
      if (z >= 75) return z === 79 ? '#c09965' : z === 75 ? '#4a342b' : '#926a46';
      return books(u, 4 + Math.floor((z - 6) * 82 / 69));
    });
    // Narrow mouldings close the book recess against the side panels.
    for (const b of [start / 2, end / 2 - .7]) {
      box(g, depth - .15, b, 2, .5, .7, 77, woodC('#946b47'));
    }
    // Separate crown, plinth and a brass catalogue label on each bookcase.
    box(g, 0, start / 2 - .3, 80, depth + .4, (end - start) / 2 + .6, 2, timber);
    box(g, 0, start / 2, 0, depth + .3, (end - start) / 2, 2, woodC('#573e30'));
    const middle = (start + end) / 2;
    wallL(g, depth + .05, middle - 3, middle + 3, 76, 79,
      (u,z) => z === 77 && u > middle - 2 && u < middle + 2 ? '#66503c' : '#c3a26b');
  }

  for (const center of potionWindowCenters) {
    wallR(g, 0, center - 21, center + 22, potionWindowBase, potionWindowBase + 53, (u, z) => {
      const x = u - center, y = z - potionWindowBase;
      const arch = potionWindowArch(x, y);
      if (arch > 21) return null;
      if (arch > potionGlassRadius || y < 3) return arch > 20 || y === 0 ? '#593c34' : '#b68057';
      if (potionWindowCross(x, y)) return '#77513e';
      return autumnSunset(u - 21, y / 49, false, true);
    });
    box(g, (center - 22) / 2, 0, 47, 22, 2, 2, timber);
  }

  // Het recept hangt onder het droogrek, boven de doorgang.
  wallL(g, 0, 48, 66, 59, 82, (u, z) => {
    const x = u - 48, y = z - 59;
    if (y > 20 || y < 2) return '#78523e';
    if (y === 18 && x >= 6 && x <= 11) return '#a06a43';
    if (y > 4 && y < 15 && x > 3 && x < 14 && (y % 4 === 0 || x === 8)) return '#a27754';
    return '#dfbb80';
  });
  drawFramedPaintings(g, [[wallL, [[118, 63, 11, 22, 'herb', ['#b99a6c','#78583e','#453832']]]]]);
  // Recipe board on the extended left wall, above the teaching workbench.
  wallL(g,0,164,204,35,65,(u,z) => {
    const x=u-164,y=z-35;
    if(x<2 || x>37 || y<2 || y>27) return x===0 || y===29 ? '#b08a59' : '#674c37';
    if(y>21 && y<24 && x>5 && x<31) return x%5<3 ? '#c1c8ad' : '#293e39';
    if(y>5 && y<19) {
      const cx=x%12,cy=y-11;
      if(Math.abs(cx-6)+Math.abs(cy)<4 && Math.abs(cx-6)+Math.abs(cy)>2) return '#a7b5a1';
      if(y===7 && x>5 && x<32) return x%6 ? '#8c9e8e' : '#293e39';
      if(x>28 && y===15) return '#b0baa3';
    }
    return '#293e39';
  });
  box(g,.4,82,34,1.8,20,1,woodC('#805f42'));
  box(g,1,86,35,.6,2.5,.5,flat('#d2d1b7','#9eaa96','#b7c0a8'));
  drawPotionDryingRack(g, timber);
  drawPotionRack(g);

}

function drawPotionLight(t) {
  const x = potionLampX, y = potionLampY;
  glow(x, y, 34, 31, '255,181,85', .047 + Math.sin(t * 4) * .009);
  line(ctx, x, y - 13, x, y - 6, '#a7774a');
  ell(ctx, x, y, 5, 7, '#5b3a35');
  ell(ctx, x, y + 1, 4, 5, '#d58c46');
  ell(ctx, x, y + 1, 2, 3, Math.sin(t * 7) > 0 ? '#ffe9a6' : '#ffd080');
  rect(ctx, x - 3, y + 5, 7, 2, '#815237');
}

function drawPotionWorkbench(g) {
  const a = workbenchA, b = workbenchB;
  const wood = woodC('#815334'), trim = woodC('#b78252');
  for (const da of [-3, 2]) for (const db of [-3, 2]) {
    box(g, a + da, b + db, 0, 1, 1, 12, wood);
  }
  box(g, a - 3.8, b - 3.8, 11, 7.6, 7.6, 2, trim);
  const paper = flat('#edcf94', '#ae8053', '#b88c62');
  box(g, a - 2.7, b - 1, 13, 4, 3, 1, paper);
  for (let row = 0; row < 3; row++) {
    line(g, ...P(a - 2, b - .4 + row * .7, 14), ...P(a + (row === 2 ? -.6 : .6), b - .4 + row * .7, 14), '#a47b58');
  }
  // Bound recipe book, central gutter, botanical sketch and cloth bookmark.
  box(g,a-2.9,b-1.2,12.9,4.5,3.5,.3,flat('#644b60','#473447','#594451'));
  line(g,...P(a-.7,b-.8,14.1),...P(a-.7,b+1.8,14.1),'#927a55');
  line(g,...P(a-1.9,b-.6,14.1),...P(a-1.7,b+1,14.1),'#667c57');
  for(const db of [-.3,.3,.8]) line(g,...P(a-1.7,b+db,14.1),...P(a-2.2,b+db+.3,14.1),'#82936a');
  box(g,a+.5,b+1.5,14.1,.45,1.8,.1,flat('#a65f62','#87464e','#98555a'));
  const [stainX, stainY] = P(a + .4, b + 1.25, 14);
  ell(g, stainX, stainY, 2, 1, '#b88e5c');
  const [fx, fy] = P(a - 2.7, b + 2.8, 13);
  // De open fles vangt het brouwsel uit een koperen trechter.
  ell(g, fx, fy - 2, 3, 2, '#82aaa5');
  rect(g, fx - 2, fy - 2, 5, 2, '#668b55');
  dot(g, fx - 2, fy - 3, '#edf1ca');
  rect(g, fx, fy - 6, 2, 3, '#9eaaa0');
  rect(g, fx, fy - 7, 2, 2, '#976047');
  rect(g, fx - 1, fy - 8, 4, 1, '#be8151');
  rect(g, fx - 2, fy - 9, 6, 1, '#dfa26a');
  rect(g, fx - 1, fy - 9, 4, 1, '#624338');
  box(g,a+1.8,b+1.8,13,1.5,1.5,.5,flat('#bc9c62','#7e5e3c','#a1804f'));
  box(g,a+2.2,b+2.2,13.5,.7,.7,2,flat('#e7d3a4','#b99b6a','#c6b083'));
  const [wx,wy]=P(a+2.7,b+2.8,13);
  rect(g,wx,wy,2,1,'#d8c395'); dot(g,wx+2,wy+1,'#c3aa7f');
  const [mx, my] = P(a + 2, b - 2, 13);
  ell(g, mx, my - 1, 4, 3, '#514b5d');
  ell(g, mx, my - 3, 4, 2, '#8c8799');
  ell(g, mx, my - 3, 2, 1, '#3b3846');
  for (const [dx, dy, color] of [[-3, 0, '#687746'], [-2, 1, '#a2a95d'],
    [0, 1, '#78864a'], [1, 2, '#b39c61'], [3, 1, '#84954d']]) {
    dot(g, mx + dx, my + dy, color);
  }
  line(g, mx, my - 3, mx + 3, my - 8, '#c7b3a4');
}

// Opeenvolgende silhouetten van een laag, breed vuur tussen de ketelpoten.
const cauldronFlameFrames = [
  [1, 3, 5, 4, 2, 3, 7, 10, 8, 5, 3, 3, 6, 8, 7, 4, 3, 2, 1],
  [1, 2, 4, 7, 4, 3, 5, 8, 11, 7, 5, 3, 4, 7, 9, 6, 3, 2, 1],
  [1, 3, 5, 8, 5, 3, 4, 6, 9, 10, 6, 4, 3, 5, 8, 8, 5, 3, 1],
  [1, 2, 4, 6, 8, 4, 3, 5, 8, 10, 8, 4, 3, 5, 7, 9, 6, 2, 1],
  [1, 3, 6, 5, 7, 5, 3, 7, 9, 8, 6, 4, 4, 7, 9, 6, 4, 3, 1],
  [1, 4, 6, 5, 3, 4, 6, 9, 8, 6, 4, 3, 5, 9, 7, 5, 4, 2, 1]
];

function drawCauldronFire(x, y, t, intensity) {
  if (intensity <= 0) return;
  ell(ctx, x, y + 1, 11, 3, '#502636');
  ell(ctx, x, y, 9, 2, '#8e342c');
  const frame = cauldronFlameFrames[Math.floor(t * 12) % cauldronFlameFrames.length];
  for (const [i, tip] of frame.entries()) {
    const height = Math.round(tip * intensity);
    if (!height) continue;
    const dx = i - 9;
    const baseY = y - (Math.abs(dx) > 6 ? 1 : 0);
    rect(ctx, x + dx, baseY - height + 1, 1, height, '#b73b2e');
    const orange = Math.floor(height * .8);
    if (orange) rect(ctx, x + dx, baseY - orange + 1, 1, orange, '#f47b31');
    const core = Math.floor(height * (i % 3 === 0 ? .54 : .4));
    if (core) rect(ctx, x + dx, baseY - core + 1, 1, core, '#ffbc45');
    if (core >= 3) rect(ctx, x + dx, baseY - 1, 1, 2, '#ffea89');
  }
  for (let i = 0; i < 4; i++) {
    const age = (t * (1.1 + i * .13) + i * .31) % 1;
    if (intensity < .45 || age >= .82) continue;
    dot(ctx, x + (i - 1.5) * 5 + Math.sin(age * 5 + i) * 2,
      y - 3 - age * 11 * intensity, age < .38 ? '#ffd06a' : '#b85037');
  }
}

function drawCauldron(t, dt) {
  const [x, y] = P(cauldronA, cauldronB, 0);
  const lit = isCauldronLit();
  if (lit) cauldronWarmup = Math.min(1, cauldronWarmup + dt / 2.5);
  ell(ctx, x, y, 19, 6, '#282339');
  ell(ctx, x, y - 1, 10, 3, '#3e302f');
  line(ctx, x - 7, y + 1, x + 6, y - 1, '#76573f');
  line(ctx, x - 5, y - 2, x + 7, y + 1, '#5a4033');
  for (const offset of [-11, 11]) {
    rect(ctx, x + offset - 2, y - 7, 5, 8, '#242733');
    rect(ctx, x + offset - 1, y - 5, 2, 4, '#545561');
  }
  ell(ctx, x, y - 15, 17, 15, '#252632');
  ell(ctx, x - 2, y - 15, 14, 13, '#3b3e4b');
  ell(ctx, x - 9, y - 16, 4, 8, '#4d5662');
  ell(ctx, x - 11, y - 17, 2, 6, '#646a70');
  for (const dx of [-10, -5, 0, 5, 10]) {
    dot(ctx, x + dx, y - 21 + Math.round((1 - Math.abs(dx) / 10) * 2), '#999485');
  }
  ell(ctx, x, y - 11, 12, 7, '#303440');
  drawCauldronFire(x, y + 1, t, Math.min(1, cauldronWarmup * 2.2));
  for (const side of [-1, 1]) {
    ell(ctx, x + side * 17, y - 21, 4, 4, '#787281');
    ell(ctx, x + side * 17, y - 21, 2, 2, '#292632');
  }
  // Open kruidenzak naast de ketel, binnen de schaduw van het brouwstation.
  ell(ctx, x - 21, y - 1, 6, 2, '#322838');
  ell(ctx, x - 21, y - 5, 5, 5, '#886343');
  ell(ctx, x - 22, y - 5, 3, 4, '#ab8157');
  ell(ctx, x - 21, y - 9, 4, 2, '#c19b70');
  ell(ctx, x - 21, y - 9, 2, 1, '#5c6641');
  dot(ctx, x - 22, y - 10, '#9dae64');
  dot(ctx, x - 19, y - 8, '#889b54');

  ell(ctx, x, y - 26, 19, 8, '#242431');
  ell(ctx, x, y - 27, 18, 7, '#73757b');
  const warmth = cauldronWarmup * cauldronWarmup * (3 - 2 * cauldronWarmup);
  const liquidColor = (cold, hot) => `rgb(${cold.map((channel, i) =>
    Math.round(channel + (hot[i] - channel) * warmth)).join(',')})`;
  ell(ctx, x, y - 27, 16, 5, liquidColor([61, 102, 70], [79, 158, 66]));
  ell(ctx, x - 2, y - 27, 12, 4, liquidColor([84, 124, 81], [118, 201, 81]));
  ctx.save();
  for (let i = 0; warmth > i / 8 && i < 7; i++) {
    ctx.globalAlpha = Math.min(1, (warmth - i / 8) * 4);
    const age = (t * (.55 + hash(i, 17) * .27) + hash(i, 8)) % 1;
    const bx = x + (hash(i, 13) - .5) * 22;
    const by = y - 27 + (hash(i, 15) - .5) * 6;
    const radius = age < .45 ? 1 : 2;
    if (age < .8) {
      ell(ctx, bx, by, radius, 1, '#abe86e');
      dot(ctx, bx - 1, by - 1, '#e1ff9c');
    } else {
      dot(ctx, bx + 1, by - 3 - 10 * (age - .8), '#d2f989');
    }
  }
  ctx.restore();

  // Een deels ondergedompelde houten lepel met een verdikte grip.
  ell(ctx, x + 5, y - 28, 4, 2, '#573b30');
  ell(ctx, x + 5, y - 29, 3, 2, '#94633f');
  line(ctx, x + 3, y - 29, x + 6, y - 30, '#c39563');
  line(ctx, x + 6, y - 30, x + 18, y - 40, '#593b30');
  line(ctx, x + 6, y - 31, x + 18, y - 41, '#bd8959');
  line(ctx, x + 15, y - 39, x + 19, y - 42, '#dba873');
  dot(ctx, x + 18, y - 42, '#ecc295');
  dot(ctx, x + 18, y - 40, '#976441');
  ctx.save();
  for (let i = 0; i < 4 && warmth > 0; i++) {
    const age = (t * .39 + i / 4) % 1;
    ctx.globalAlpha = Math.sin(age * Math.PI) * .29 * warmth;
    const steamX = x + (i - 1.5) * 6 + Math.sin(age * 5 + i) * 3 + age * 5;
    const steamY = y - 31 - 25 * age;
    ell(ctx, steamX, steamY, 2 + Math.floor(age * 4), 2, '#bfe88e');
    ell(ctx, steamX - 2, steamY + 1, 2, 1, '#e9edbc');
  }
  ctx.restore();
}

function potionFloor(a, b) {
  const row = Math.floor(b / 8);
  const stagger = row % 2 ? 4 : 0;
  const column = Math.floor((a + stagger) / 10);
  const variation = hash(column, row);
  const grain = hash(Math.floor(a * 2), Math.floor(b * 2));
  const edge = Math.min(a - 13, 49 - a, b - 15, 84 - b);
  const contact = Math.min(
    contactShade(a, b, cauldronA, cauldronB, 9, 7),
    contactShade(a, b, workbenchA, workbenchB, 5, 5),
    b < rackDepth + 2 && a >= rackStart && a < rackEnd ? .74 : 1
  );
  const daylight = potionWindowLight(a, b);

  let color;
  if (edge >= 0) {
    const diamond = Math.abs(a - 31) + Math.abs((b - 17) % 18 - 9);
    if (edge < 1) color = '#442d47';
    else if (edge < 2 || (diamond >= 5 && diamond < 6)) color = '#b78a63';
    else color = grain > .8 ? '#775369' : '#69475e';
  } else {
    const seam = Math.min((a + stagger) % 10, b % 8);
    if (seam < .55) color = '#343843';
    else if (seam < 1.15) color = '#7c8081';
    else color = sh('#606674', .78 + variation * .35 + (grain > .91 ? .13 : 0));
  }
  const sootDistance=Math.hypot((a-cauldronA)/10,(b-cauldronB)/8);
  if(sootDistance<1 && grain>.55) color=sh(color,.72);
  if(Math.hypot((a-65)/3,(b-71)/1.7)<1 && grain>.3) color='#415a54';
  if(Math.hypot((a-27)/2,(b-70)/1.4)<1 && grain>.62) color='#a29370';
  return tintFloor(color, contact, daylight * .84);
}

function tintFloor(color, contact, amount) {
  if (!amount) return contact === 1 ? color : sh(color, contact);
  const rgb = color.startsWith('#')
    ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16))
    : color.slice(4, -1).split(',').map(Number);
  const light = [241, 207, 158];
  return 'rgb(' + rgb.map((channel, index) =>
    Math.round((channel * (1 - amount) + light[index] * amount) * contact)).join(',') + ')';
}

function stockroomFloor(a, b) {
  const column = Math.floor(a / 8), row = Math.floor(b / 8);
  if (a % 8 < .55 || b % 8 < .55) return '#34343e';
  const beam = Math.max(0, 1 - Math.abs(a - 35) / 24) * Math.max(0, 1 - Math.abs(b - 23) / 27);
  const grit = hash(Math.floor(a * 2), Math.floor(b * 2));
  return sh('#66636a', .84 + hash(column, row) * .25 + beam * .3 + (grit > .91 ? .09 : 0));
}

const stockShelfStarts = [4, 34, 64];
const stockBookcases = [[0, 3], [6, 9]];
const pageStackTile = [11, 9];
const stockChestTile = [0, 9];
const [stockChestA, stockChestB] = stockChestTile.map(tile => (tile + .5) * TILE_SIZE);
const stockChestScale = .85;
let stockChestOpening = 0;
const stockLayout = [
  // Keep the entrance aisle clear all the way to the shelves.
  [2, 2, 'table'], [3, 2, 'books'], [4, 2, 'still'], [5, 2, 'chest'],
  [6, 2, 'herbs'], [7, 2, 'glass'], [8, 2, 'rug'], [9, 2, 'crates'], [10, 2, 'barrel'],
  [2, 3, 'chair'], [2, 4, 'crates'],
  // The inner aisles open on alternating ends.
  [4, 4, 'basket'], [5, 4, 'scrolls'], [6, 4, 'glass'], [7, 4, 'crates'],
  [8, 4, 'crystals'], [9, 4, 'still'], [10, 4, 'chest'], [11, 4, 'rug'],
  [1, 5, 'table'], [2, 5, 'barrel'],
  [1, 6, 'chest'], [2, 6, 'herbs'], [3, 6, 'basket'], [4, 6, 'crates'],
  [5, 6, 'mortar'], [6, 6, 'books'], [7, 6, 'chair'], [8, 6, 'glass'],
  [9, 6, 'herbs'], [10, 6, 'chest'],
  [2, 8, 'scrolls'], [3, 8, 'basket'], [4, 8, 'crates'], [5, 8, 'rug'],
  [6, 8, 'chair'], [7, 8, 'table'], [8, 8, 'barrel'], [9, 8, 'mortar'],
  [10, 8, 'crates'], [11, 8, 'chest'], [...pageStackTile, 'books']
];
const stockLanterns = [[0, 28], [0, 47], [49, 0]].map(([a, b]) => P(a, b, 75));

function drawStockLanterns(t) {
  for (const [x, y] of stockLanterns) {
    glow(x, y, 36, 29, '255,170,92', .062 + .012 * Math.sin(t * 4 + x));
    line(ctx, x, y - 12, x, y - 5, '#8c654e');
    ell(ctx, x, y, 4, 5, '#503637');
    ell(ctx, x, y, 3, 3, '#d39051');
    dot(ctx, x, y - 1, '#fff1ad');
    rect(ctx, x - 2, y + 4, 5, 1, '#976442');
  }
}

const stockPortraits = {
  witch: ['#40374f', '#825779', '#c78e73', '#35263d'],
  wizard: ['#35455c', '#565c93', '#c69e82', '#d9c7b5'],
  goblin: ['#514739', '#80614a', '#94a467', '#586a45'],
  necromancer: ['#452b46', '#663f65', '#bea7ad', '#38283e'],
  wraith: ['#283b4b', '#526781', '#8ea4b0', '#2b344b']
};

function stockPortraitArt(subject, x, y, t, gaze = 0) {
  const [background, cloak, skin, detail] = stockPortraits[subject];
  const phase = t + Object.keys(stockPortraits).indexOf(subject) * 1.11;
  const blink = phase % 4.7 > 4.5;
  const head = x - .09 * Math.sin(phase * 1.35);
  const face = Math.abs(head);
  const goblin = subject === 'goblin';
  const sinister = subject === 'necromancer' || subject === 'wraith';
  const eye = Math.abs(Math.abs(head - gaze) - .18) < .09 && Math.abs(y - .21) < .074;
  if (eye) return blink ? detail : sinister ? '#efa17f' : '#292332';
  if (goblin && face < .73 && face > .27 && Math.abs(y - .23 - face * .33) < .12) return skin;
  if (face < .38 && y > -.16 && y < .52) {
    if (Math.abs(y + .06) < .06 && face < .2) return detail;
    return head < -.21 ? sh(skin, .77) : skin;
  }
  if ((subject === 'witch' || subject === 'wizard') &&
      ((y >= .49 && y < .62 && face < .71) ||
       (y >= .62 && face < (1 - y) * 1.25))) return cloak;
  if (sinister && y > .05 && y < .77 && face < .75 - .4 * y) return cloak;
  if (subject === 'wizard' && y < -.12 && y > -.61 && face < .32 + y * .38) return detail;
  if (y < -.1 && y > -.94 && face < .43 - y * .36) return head > 0 ? cloak : sh(cloak, .72);
  return background;
}

// Match the original mantel portrait: violet pointed hat, pale hair and warm skin.
// Work in the same small pixel grid so the new paintings share its level of detail.
function aubertPaintingArt(subject, x, y) {
  // Three narrative compositions use smaller figures and prominent surroundings.
  if (subject !== 'aubert') {
    const studyScene = subject === 'aubert-study';
    const moonScene = subject === 'aubert-moon';
    const cx = studyScene ? -.4 : moonScene ? .35 : -.3;
    const headY = studyScene ? .28 : .35;
    // Foreground desk/book or potion bottle, deliberately in front of the figure.
    if (studyScene) {
      if (y < -.35 && y > -.49) return '#986b46';
      if (y < -.49 && (Math.abs(x + .72) < .07 || Math.abs(x - .68) < .07)) return '#5a3c30';
      if (y > -.35 && y < -.1 && x > -.12 && x < .68) {
        return Math.abs(x - .28) < .045 ? '#826344' : y > -.15 ? '#f0dba9' : '#c7ae80';
      }
      if (x > .65 && x < .75 && y > -.33 && y < .18) return '#d9bf82';
      if ((x - .7) ** 2 + (y - .23) ** 2 < .012) return '#ffda80';
    } else if (!moonScene) {
      if (((x - .38) / .26) ** 2 + ((y + .25) / .24) ** 2 < 1) {
        return x < .3 ? '#b9dfc5' : y < -.25 ? '#4f9b81' : '#83bca4';
      }
      if (x > .3 && x < .46 && y > -.05 && y < .22) return y > .15 ? '#b08c60' : '#a8c8b8';
      if (Math.abs(x - .25) < .25 && y > -.19 && y < -.08) return '#d6ab84';
      if ((x - .4) ** 2 + (y - .38) ** 2 < .014) return '#b8c89c';
    }
    // A small head and hat with the reference's proportions, above a full violet robe.
    if (Math.abs(x - cx) < .31 && y > headY - .16 && y < headY + .55) {
      return aubertPaintingArt('aubert', (x - cx) / .31, (y - headY - .195) / .355);
    }
    if (y < headY - .1 && y > -.72 && Math.abs(x - cx) < .18 + (headY - y) * .18) {
      if (Math.abs(x - cx + .04) < .035) return '#b39c78';
      return x < cx ? '#5a4cb0' : '#3a2e7a';
    }
    if (moonScene) {
      if ((x + .48) ** 2 + (y - .58) ** 2 < .15 &&
          (x + .33) ** 2 + (y - .7) ** 2 > .12) return '#e2cca0';
      if (y < -.68 + Math.sin(x * 8) * .08) return '#414f57';
      if (Math.abs(x + .77) < .07 && y < .53) return '#645044';
      if (y > .15 && Math.abs(x + .72) + Math.abs(y - .35) < .37) return '#4a6158';
      return '#272641';
    }
    if (studyScene) {
      if (x > .15 && y > .28 && y < .87) {
        if (Math.abs(y - .35) < .06 || Math.abs(y - .77) < .05) return '#896344';
        return Math.floor(x * 13) % 3 === 0 ? '#a48c63' : '#4d5c58';
      }
      return '#39424b';
    }
    if (y < -.72) return '#756046';
    return y > .6 ? '#54495a' : '#303e43';
  }
  const study = subject === 'aubert-study';
  const moonlit = subject === 'aubert-moon';
  const side = subject === 'aubert-young' ? -1 : 1;
  const column = Math.round((x * side + 1) * 7.5);
  const level = Math.round((y + 1) * 13.5);
  const center = study ? 8.5 : 7.5;
  const d = Math.abs(column - center);
  // Distinct backgrounds and props, keeping the same face and costume in every frame.
  if (moonlit && (x + .57) ** 2 + (y - .64) ** 2 < .09 &&
      (x + .43) ** 2 + (y - .72) ** 2 > .065) return '#caaa72';
  if (level >= 18 && level < 28) {
    const width = (27.5 - level) * .55 + .5;
    if (d <= width) {
      if (Math.abs(column - center) < .8 && level === 22) return '#ffd45a';
      return column > center ? '#5a4cb0' : '#4c3f9a';
    }
  }
  if (level >= 16 && level < 18 && d <= 7) return '#3a2e7a';
  // Pale locks frame the face below the broad hat brim.
  if (level >= 6 && level < 16 && d > 3 && d < 5) {
    return column < center ? '#e2d7b1' : '#b6afaa';
  }
  if (level >= 8 && level < 16 && d <= 3.6) {
    if (level === 13 && (column === Math.round(center - 2) || column === Math.round(center + 2))) return '#59434b';
    if (level === 10 && d < 1) return '#b88660';
    return column < center - 2 ? '#c39575' : '#d6ab84';
  }
  if (level < 10) {
    const width = level >= 8 ? 3.6 : 5.4 - Math.abs(level - 5) * .6;
    if (d <= width) {
      if (study && level < 5) return Math.abs(column - center) < 1 ? '#8d6744' : '#dbc79d';
      if (level === 6 && d < 1) return '#caaa72';
      return d > width - 1.2 ? '#a9acc6' : '#d9d9ea';
    }
  }
  if (study && level < 5 && column > 10) return '#856348';
  return level > 14 ? (moonlit ? '#252940' : '#241a44') : '#1a1330';
}

function stockPaintingArt(subject, x, y, t) {
  if (stockPortraits[subject]) return stockPortraitArt(subject, x, y, t);
  if (subject.startsWith('aubert')) return aubertPaintingArt(subject, x, y);
  switch (subject) {
    case 'castle': {
      if (y < -.46 + .19 * Math.sin(x * 8)) return '#394752';
      const tower = Math.abs(x + .39) < .13 || Math.abs(x - .34) < .15;
      if (Math.abs(x) < .55 && y < (tower ? .47 : .13)) {
        return tower && Math.abs(y + .04) < .09 ? '#e9b16b' : '#5a4b60';
      }
      return y > .3 ? '#a8717a' : '#cf9382';
    }
    case 'woods':
      if (y < -.64) return '#414b4f';
      if (Math.abs(x + .38) < .07 || Math.abs(x - .49) < .06) return '#63463d';
      if ((x + .48) ** 2 + (y - .37) ** 2 < .32) return '#b4774e';
      if ((x - .42) ** 2 + (y - .49) ** 2 < .31) return '#865448';
      return '#6b7473';
    case 'potion':
      if (Math.abs(x) < .23 && y > .45 && y < .69) return '#bd875a';
      if ((Math.abs(x) < .2 && y > .06 && y <= .45) ||
          (x / .56) ** 2 + ((y + .22) / .48) ** 2 < 1) {
        if (x < -.24 && y > -.46) return '#c3dadd';
        return y < -.16 ? '#677baf' : '#82a8aa';
      }
      return y < -.65 ? '#53515e' : '#3c354a';
    case 'herb': {
      const stem = .14 * y;
      if (Math.abs(x - stem) < .09 && Math.abs(y) < .82) return '#636f4e';
      for (const [leafX, leafY] of [[-.31, -.36], [.34, -.05], [-.26, .25], [.23, .55]]) {
        if (((x - leafX) / .31) ** 2 + ((y - leafY) / .16) ** 2 < 1) {
          return leafX < 0 ? '#788058' : '#94966b';
        }
      }
      return '#b3936d';
    }
    case 'moon':
      if ((x + .22) ** 2 + (y - .24) ** 2 < .31 && (x - .03) ** 2 + (y - .38) ** 2 > .23) return '#e5c891';
      if (y < -.59 + .11 * Math.sin(x * 12)) return '#44475b';
      return '#34344d';
    case 'comet':
      return Math.abs(y - x * .48) < .1 && x > -.68 && x < .65 ? '#e4ab88' : '#403b60';
    case 'mountains':
      return y < .52 - Math.abs(x + .18) * 1.26 ? (y > .14 ? '#c5c7bc' : '#626d83') : '#a88d9b';
    case 'mushrooms': {
      const cap = ((x + .2) / .53) ** 2 + ((y - .15) / .32) ** 2 < 1;
      if (cap && y > .05) return '#a55e5f';
      return Math.abs(x + .22) < .14 && y > -.68 && y < .19 ? '#d3b888' : '#68645e';
    }
    case 'raven':
      return (x + .24) ** 2 + (y - .12) ** 2 < .19 || Math.abs(y + x * .65) < .13 && Math.abs(x) < .83
        ? '#36334a' : '#ae8991';
    case 'hourglass':
      return Math.abs(y) < .72 && Math.abs(x) < .12 + Math.abs(y) * .62
        ? (Math.abs(y) > .57 ? '#956846' : '#dabb83') : '#564458';
    case 'crystal':
      return (Math.abs(x) * 1.55 + Math.abs(y) * .72 < .65)
        ? (x > .04 ? '#876ea0' : '#bda8c6') : '#443751';
    case 'eye':
      if (x * x + Math.abs(y) * 1.24 < .68) return Math.abs(x) < .15 ? '#49334e' : '#c9986f';
      return '#513f53';
    case 'candle':
      if (x * x + (y - .44) ** 2 < .085) return '#e0aa70';
      return Math.abs(x) < .24 && y < .16 && y > -.69 ? '#b89978' : '#444354';
    case 'sea':
      if (y > .14) return '#aa8284';
      return Math.sin(x * 9 + y * 18) > .62 ? '#829a9a' : '#495c70';
    case 'flower':
      if (Math.abs(x) < .08 && y < .3 && y > -.78) return '#7f8b60';
      if (x * x + (y - .27) ** 2 < .25) return Math.abs(x) < .17 && Math.abs(y - .27) < .17 ? '#c9a365' : '#a86983';
      return '#5f5261';
  }
}

function drawStockPaintings(g, t = 0, animateOnly = false) {
  const oak = ['#a57b52', '#765137', '#51382d'];
  const brass = ['#c2a36c', '#927047', '#59443b'];
  const walnut = ['#896656', '#64463d', '#493239'];
  // Frame coordinates are in wall columns and height above the floor.
  const groups = [
    [wallL, [
      [8, 90, 33, 11, 'woods', walnut], [103, 91, 34, 10, 'comet', oak],
      [46, 52, 15, 13, 'herb', oak], [64, 51, 24, 17, 'sea', walnut],
      [90, 50, 11, 15, 'candle', walnut], [65, 80, 22, 18, 'witch', brass],
      [143, 48, 13, 25, 'flower', oak], [143, 79, 13, 16, 'hourglass', brass]
    ]],
    [wallR, [
      [7, 52, 19, 25, 'potion', oak], [8, 82, 18, 16, 'moon', walnut],
      [31, 57, 36, 34, 'wizard', brass], [72, 48, 19, 24, 'crystal', oak],
      [72, 78, 20, 19, 'goblin', walnut], [95, 48, 20, 17, 'mushrooms', walnut],
      [97, 84, 16, 14, 'raven', oak], [115, 69, 23, 26, 'necromancer', brass],
      [121, 46, 26, 16, 'mountains', oak], [143, 69, 30, 25, 'castle', walnut],
      [153, 48, 16, 16, 'eye', brass], [178, 52, 10, 37, 'wraith', oak]
    ]]
  ];
  drawFramedPaintings(g, groups, t, animateOnly);
}

function drawFramedPaintings(g, groups, t = 0, animateOnly = false) {
  for (const [paintWall, frames] of groups) {
    for (const [u, z, width, height, subject, frame, style] of frames) {
      if (animateOnly && !stockPortraits[subject]) continue;
      paintWall(g, 0, animateOnly ? u + 2 : u, animateOnly ? u + width - 2 : u + width + 2,
        animateOnly ? z + 2 : z - 2, animateOnly ? z + height - 2 : z + height, (column, level) => {
        const x = column - u, y = level - z;
        if (style === 'oval') {
          const radius = ((x - width / 2) / (width / 2)) ** 2 + ((y - height / 2) / (height / 2)) ** 2;
          if (radius > 1) return null;
          if (radius > .76) return radius > .9 ? frame[2] : x < width / 2 ? frame[0] : frame[1];
        }
        if (style === 'carved' && x >= 2 && x < width - 2 && y >= 2 && y < height - 2 &&
            (x < 4 || x >= width - 4 || y < 4 || y >= height - 4)) {
          return (x + y) % 4 === 0 ? frame[0] : frame[2];
        }
        if (x >= width || y < 0) return '#32313c';
        if (y === height - 1 || x === 0) return frame[0];
        if (y === 0 || x === width - 1) return frame[2];
        if (x === 1 || y === 1 || x === width - 2 || y === height - 2) return frame[1];
        const color = stockPaintingArt(subject, 2 * (x - 2) / (width - 5) - 1, 2 * (y - 2) / (height - 5) - 1, t);
        return hash(column, level) > .86 ? sh(color, .87) : color;
      });
    }
  }
}

function drawStockShelves(g) {
  const timber = woodC('#83583c');
  for (const [first, limit] of stockBookcases) {
    const start = first * TILE_SIZE + 2, end = limit * TILE_SIZE - 2;
    box(g, 0, start, 0, 4, end - start, 87, timber);
    wallL(g, 4, start * 2, end * 2, 0, 87, libraryShelf(start * 2, end * 2, null));
    box(g, 0, start - .5, 86, 4.5, end - start + 1, 2, timber);
  }
  for (const [index, start] of stockShelfStarts.entries()) {
    const end = start + rackEnd - rackStart;
    drawPotionRack(g, start, end, stockRackBubbles, index + 1);
    drawRackDoors(g, start, end, false);
  }
}

function drawStockContainer(g, a, b, kind, chairFacesBoard = false) {
  const [x, y] = P(a, b, 0);
  ell(g, x, y, 9, 4, '#4b434d');
  ell(g, x, y, 6, 2, '#353039');
  const furnitureWood = woodC('#9b6345'), darkWood = woodC('#673f2c');
  if (kind === 'still') {
    box(g, a - 3, b - 2.5, 0, 6, 5, 2, darkWood);
    ell(g, x - 2, y - 7, 6, 6, '#78463b');
    ell(g, x - 3, y - 8, 4, 4, '#b67650');
    line(g, x - 5, y - 9, x - 3, y - 11, '#e0aa74');
    rect(g, x - 3, y - 15, 3, 4, '#bb8059');
    line(g, x - 2, y - 15, x + 5, y - 15, '#d79865');
    line(g, x + 5, y - 15, x + 7, y - 8, '#a35e45');
    ell(g, x + 7, y - 5, 3, 4, '#466866');
    dot(g, x + 6, y - 6, '#8aaba0');
    return;
  }
  if (kind === 'basket') {
    ell(g, x, y - 3, 9, 5, '#80553d');
    ell(g, x, y - 6, 9, 4, '#bd8958');
    ell(g, x, y - 6, 7, 3, '#60463c');
    for (const [dx, dy, color] of [[-4, -7, '#a57b64'], [-1, -8, '#cfb788'], [3, -6, '#80678d'], [5, -7, '#abb17a']]) {
      ell(g, x + dx, y + dy, 2, 2, color);
    }
    for (const dx of [-6, -3, 0, 3, 6]) dot(g, x + dx, y - 3, '#d2a06a');
    return;
  }
  if (kind === 'rug') {
    for (const [db, color] of [[-2, '#68506d'], [1, '#74657d']]) {
      const start = P(a - 3, b + db, 3);
      const end = P(a + 3, b + db, 3);
      line(g, ...start, ...end, '#493746');
      line(g, start[0], start[1] - 2, end[0], end[1] - 2, color);
      ell(g, ...end, 3, 3, '#ad8e77');
      ell(g, ...end, 1, 1, color);
      const [tieX, tieY] = P(a + 1, b + db, 3);
      line(g, tieX, tieY - 4, tieX, tieY + 2, '#d3b579');
    }
    return;
  }
  if (kind === 'mortar') {
    box(g, a - 2.5, b - 2.5, 0, 5, 5, 3, darkWood);
    ell(g, x, y - 5, 7, 5, '#555564');
    ell(g, x, y - 8, 7, 3, '#92919a');
    ell(g, x, y - 8, 5, 2, '#494754');
    dot(g, x - 2, y - 8, '#8b9b64');
    line(g, x, y - 8, x + 6, y - 15, '#ada7a0');
    line(g, x + 1, y - 8, x + 7, y - 15, '#7a7481');
    return;
  }
  if (kind === 'chair' || kind === 'table') {
    const chair = kind === 'chair';
    const height = chair ? 7 : 11;
    const size = chair ? 4 : 6;
    for (const da of [-size / 2, size / 2 - 1]) {
      for (const db of [-size / 2, size / 2 - 1]) box(g, a + da, b + db, 0, 1, 1, height, darkWood);
    }
    box(g, a - size / 2, b - size / 2, height, size, size, 1.5, furnitureWood);
    const surface = height + 1.5;
    line(g, ...P(a - size / 2 + .5, b + size / 2 - .5, surface),
      ...P(a + size / 2 - .5, b + size / 2 - .5, surface), '#c18d64');
    line(g, ...P(a - 1.5, b + .55, surface), ...P(a + 1.5, b + .55, surface), '#85563d');
    if (chair) {
      const backB = b + (chairFacesBoard ? 1 : -2);
      box(g, a - 2, backB, height, 4, 1, 8, darkWood);
      if (chairFacesBoard) {
        box(g, a - 1.6, backB + .9, height + 2, 3.2, .4, 3.7, woodC('#936343'));
        dot(g, ...P(a, backB + 1.4, height + 4), '#c59f63');
      }
      box(g, a - 2.2, backB - .3, height + 6, 4.4, 1.5, 2, furnitureWood);
      for (const da of [-1.4, 1.4]) dot(g, ...P(a + da, backB + 1.2, height + 7), '#d0a47a');
    } else {
      box(g, a - 2.2, b - 1.75, height + 1.5, 3.5, 2.5, .75,
        flat('#c1ad82', '#8a7559', '#a48a61'));
      line(g, ...P(a - 1.7, b - .9, surface + .75), ...P(a + .5, b - .9, surface + .75), '#8f765d');
    }
    return;
  }
  if (kind === 'chest') {
    box(g, a - 3, b - 2, 0, 6, 4, 5, darkWood);
    box(g, a - 3.2, b - 2.2, 5, 6.4, 4.4, 2, furnitureWood);
    box(g, a - 2.6, b - 1.8, 7, 5.2, 3.6, 1, furnitureWood);
    for (const da of [-2, 2]) {
      line(g, ...P(a + da, b + 2.25, 1), ...P(a + da, b + 2.25, 6), '#b28c59');
    }
    const [lx, ly] = P(a, b + 2.25, 4);
    rect(g, lx - 1, ly - 1, 3, 2, '#d7b572');
    dot(g, lx, ly, '#49312e');
    line(g, ...P(a - 2.6, b + 2.25, 5), ...P(a + 2.6, b + 2.25, 5), '#59372b');
    for (const da of [-2, 2]) {
      dot(g, ...P(a + da, b + 2.25, 2), '#e2bb79');
      dot(g, ...P(a + da, b + 2.25, 6), '#e2bb79');
    }
    return;
  }
  if (kind === 'barrel') {
    ell(g, x, y - 5, 7, 6, '#72503d');
    rect(g, x - 6, y - 12, 13, 9, '#876046');
    for (const dx of [-4, 0, 4]) line(g, x + dx, y - 12, x + dx, y - 2, '#a77950');
    for (const dy of [-9, -4]) rect(g, x - 6, y + dy, 13, 2, '#4c454d');
    ell(g, x, y - 12, 7, 3, '#a47850');
    ell(g, x, y - 12, 5, 2, '#634b3e');
    line(g, x - 4, y - 12, x + 3, y - 11, '#8c6a4e');
    for (const dy of [-8, -3]) {
      dot(g, x - 4, y + dy, '#aaa0a1');
      dot(g, x + 4, y + dy, '#81787e');
    }
    return;
  }
  if (kind === 'herbs') {
    ell(g, x, y - 4, 6, 6, '#8f6c4f');
    ell(g, x - 1, y - 5, 4, 5, '#b28e65');
    ell(g, x, y - 10, 3, 2, '#79573f');
    line(g, x - 3, y - 9, x + 2, y - 9, '#d8b986');
    for (const [dx, dy] of [[-2,-10],[1,-11],[2,-10],[6,0],[8,1],[5,2]]) {
      dot(g, x + dx, y + dy, dy < 0 ? '#a6ad65' : '#788c57');
    }
    for (const [dx, dy] of [[-3,-5],[-2,-4],[-3,-3]]) dot(g, x + dx, y + dy, '#d8b287');
    line(g, x + 2, y - 6, x + 3, y - 3, '#76543e');
    rect(g, x + 1, y - 5, 2, 2, '#c7a27b');
    return;
  }
  const timber = woodC('#9b6b43');
  box(g, a - 2.6, b - 2.6, 0, 5.2, 5.2, 8, timber);
  box(g, a - 2.8, b - 2.8, 7, 5.6, 5.6, 1, woodC('#ae8156'));
  line(g, ...P(a - 2, b + 2.6, 1), ...P(a + 2, b + 2.6, 7), '#bd8b5c');
  line(g, ...P(a + 2.6, b - 2, 7), ...P(a + 2.6, b + 2, 1), '#81573d');
  for (const z of [2, 5]) {
    line(g, ...P(a - 2.5, b + 2.65, z), ...P(a + 2.5, b + 2.65, z), '#785339');
  }
  for (const da of [-2, 2]) for (const z of [1, 6]) {
    dot(g, ...P(a + da, b + 2.7, z), '#c0a28a');
  }
  if (kind === 'crates') {
    box(g, a - 1.6, b - 1.2, 8, 3.6, 3.2, 5, furnitureWood);
    box(g, a - 1.8, b - 1.4, 12.5, 4, 3.6, .75, darkWood);
  } else if (kind === 'books') {
    const covers = ['#782d48', '#405e60', '#735086'];
    for (const [index, cover] of covers.entries()) {
      const offset = index % 2 ? -.5 : 0;
      box(g, a - 2 + offset, b - 1.5, 8 + index * 1.4, 4, 3, 1.4,
        flat(cover, '#bda781', '#8d7359'));
      const spineZ = 8.6 + index * 1.4;
      dot(g, ...P(a - 1.3 + offset, b + 1.55, spineZ), '#dbc18a');
      dot(g, ...P(a + 1.2 + offset, b + 1.55, spineZ), '#ad9063');
      line(g, ...P(a - 2 + offset, b + 1.55, 9 + index * 1.4),
        ...P(a + 2 + offset, b + 1.55, 9 + index * 1.4), cover);
    }
  } else if (kind === 'glass') {
    flask(g, x - 3, y - 7, '#89aaa0', 'tube', null);
    flask(g, x + 3, y - 9, '#628c91', 'round', null);
  } else if (kind === 'crystals') {
    for (const [dx, dy, color] of [[-3, -7, '#b298db'], [0, -10, '#d2b6f5'], [3, -7, '#8975b6']]) {
      line(g, x + dx, y + dy - 4, x + dx - 1, y + dy, color);
      line(g, x + dx, y + dy - 3, x + dx + 1, y + dy, '#614f81');
      dot(g, x + dx, y + dy - 4, '#ebd3fa');
    }
  } else {
    ell(g, x - 4, y - 8, 2, 2, '#d7b87b');
    line(g, x - 4, y - 10, x + 4, y - 9, '#ead095');
    line(g, x - 4, y - 7, x + 4, y - 6, '#b58a5a');
    dot(g, x + 1, y - 8, '#ac5559');
  }
}

const hallWindows = [22, 82, 142, 202];
const hallWindowBase = 18;
const hallChandelier = new Image();
hallChandelier.src = 'assets/sprites/hall-chandelier.png';
let hallChandelierBody;
const hallChandelierBodyStart = 14;
// Sprite coordinates of the three lit candles, measured from the top of the wax.
const hallChandelierCandles = [[3, 27, 3], [14, 22, 4], [25, 27, 3]];
const hallWallCandleShelves = {
  hall: [
    { b: 26.5, candles: [{ offset: -1.25, height: 4 }, { offset: 1.25, height: 6, lit: true }] },
    { b: 57, candles: [{ offset: -1.25, height: 5, lit: true }, { offset: 1.25, height: 3, lit: true }] },
    { b: 86.5, candles: [{ offset: -1.25, height: 5 }, { offset: 1.25, height: 3 }] }
  ],
  hallEnd: [
    { b: 26.5, candles: [{ offset: -1.25, height: 5, lit: true }, { offset: 1.25, height: 3 }] },
    { b: 57, candles: [{ offset: -1.25, height: 3 }, { offset: 1.25, height: 6, lit: true }] },
    { b: 86.5, candles: [{ offset: -1.25, height: 4, lit: true }, { offset: 1.25, height: 5, lit: true }] }
  ]
};
const hallFrames = [
  [43, 45, 18, 26, 'notice'],
  [104, 48, 19, 22, 'castle'],
  [164, 46, 18, 26, 'witch']
];

function hallWindowGlass(u, z) {
  const x = hallWindows.find(center => Math.abs(u - center) <= 13);
  const y = z - hallWindowBase;
  return x !== undefined && y >= 3 && Math.hypot(u - x, Math.max(0, y - 54)) <= 13 &&
    u !== x && y !== 31 && y !== 32;
}

const hallEndFrames = [
  [42, 39, 20, 36, 'family'],
  [103, 47, 21, 23, 'woods'],
  [163, 42, 19, 33, 'crest']
];

function schoolCrestPixel(x, y) {
  if (Math.abs(x) + Math.max(0, -y) * .65 > .67 || y > .65 || y < -.63) return null;
  return Math.abs(x) < .12 || Math.abs(y - .05) < .09 ? '#ead098' : '#936a46';
}

function hallArtwork(subject, x, y, gaze = 0) {
  if (subject === 'notice') {
    if (Math.abs(x + .44) < .24 && y > -.31 && y < .76 ||
        Math.abs(x - .35) < .32 && y > -.74 && y < .25) {
      return Math.floor(y * 13) % 3 === 0 ? '#9f795c' : '#dec49a';
    }
    return '#76523d';
  }
  if (subject === 'crest') return schoolCrestPixel(x, y) ?? '#54445c';
  if (subject === 'family') {
    const left = x < 0;
    const local = x * 2 + (left ? .86 : -.86);
    const headY = y - (left ? .25 : .10);
    if ((local / .57) ** 2 + (headY / .44) ** 2 < 1) {
      if (headY > .19 || Math.abs(local) > .42) return left ? '#8d807f' : '#543341';
      if (Math.abs(headY - .04) < .08 && Math.abs(Math.abs(local - gaze) - .19) < .10) return '#332531';
      if (headY < -.13 && left) return local < 0 ? '#baaba0' : '#958281';
      return local < -.16 ? '#c29180' : '#e0b196';
    }
    if (headY < -.31 && Math.abs(local) < .44 - headY * .34) {
      if (Math.abs(local + .12) < .1) return '#ba945e';
      return left ? '#4d6570' : '#754955';
    }
    return x + y > .1 ? '#60504e' : '#493d43';
  }
  if (subject === 'woods' || subject === 'castle') {
    const ridge = -.26 + Math.sin(x * 7) * .1 + Math.cos(x * 13) * .06;
    const treetops = -.55 + Math.abs(Math.sin(x * 24)) * .17 + Math.sin(x * 8) * .09;
    if (y < treetops) return y < -.74 ? '#454741' : '#5d5a47';
    if (subject === 'castle' && Math.abs(x + .13) < .52 && y > ridge) {
      const tower = Math.abs(x + .5) < .13 || Math.abs(x - .21) < .12;
      if (y < (tower ? .34 : -.02)) return tower && Math.abs(y - .05) < .07 ? '#e0b57c' : '#675165';
    }
    if (y < ridge) return '#817074';
    if ((x - .56) ** 2 + (y - .34) ** 2 < .028) return '#ebc38e';
    return y < .36 ? '#b6857e' : y < .63 ? '#9d737e' : '#785e78';
  }
  return stockPaintingArt(subject, x, y, 0);
}

function drawHallDecor(g, continuation) {
  for (const center of hallWindows) {
    wallL(g, 0, center - 18, center + 19, hallWindowBase, 91, (u, z) => {
      const y = z - hallWindowBase;
      const arch = Math.hypot(u - center, Math.max(0, y - 54));
      if (arch > 18) return null;
      if (arch > 17) return '#38414b';
      if (arch > 15) {
        const joint = y < 54 ? y % 8 === 0 : Math.floor(Math.atan2(y - 54, u - center) * 9) % 4 === 0;
        return joint ? '#4e535b' : arch > 16 ? '#8e9396' : '#666c75';
      }
      if (arch > 13 || y < 3) return u < center ? '#45434b' : '#5f5758';
      if (!hallWindowGlass(u, z)) return '#6b5144';
      if (Math.abs(u - center) === 13 || y === 3) return sh(autumnSunset(u + (continuation ? HALL_DEPTH * 2 : 0), y / 67), .78);
      return autumnSunset(u + (continuation ? HALL_DEPTH * 2 : 0), y / 67);
    });
    box(g, 0, (center - 17) / 2, hallWindowBase - 2, 3.25, 17, 3,
      flat('#a3a09a', '#565b63', '#737982'));
    box(g, 2.75, (center - 18) / 2, hallWindowBase, .75, 18, 1,
      flat('#b4aea0', '#676969', '#858684'));
    line(g, ...P(3.5, (center - 10) / 2, hallWindowBase),
      ...P(3.5, (center - 3) / 2, hallWindowBase), '#c4b7a1');
    dot(g, ...P(3.5, (center + 9) / 2, hallWindowBase), '#5d6062');
  }
  drawWallIvy(g, [[0, 17, 24], [0, 95, 19]]);
  for (const [u, z, width, height, subject] of (continuation ? hallEndFrames : hallFrames)) {
    wallL(g, 0, u, u + width, z, z + height, (column, level) => {
      const x = column - u, y = level - z;
      const edge = Math.min(x, width - 1 - x, y, height - 1 - y);
      if (subject === 'crest' && y < 3) return x % 3 ? '#987650' : null;
      if (edge === 0) return '#392b31';
      if (edge === 1) return x === 1 || y === height - 2 ? '#d2aa6c' : '#9f764f';
      if (edge === 2) return (x + y) % 4 === 0 ? '#a87850' : '#5b3c37';
      const color = hallArtwork(subject, 2 * (x - 3) / (width - 7) - 1, 2 * (y - 3) / (height - 7) - 1);
      return hash(column, level) > .88 ? sh(color, .8) : color;
    });
  }
  const shelves = hallWallCandleShelves[continuation ? 'hallEnd' : 'hall'];
  for (const { b, candles } of shelves) {
    box(g, 0, b - 2.5, 31, 3, 5, 1.5, flat('#99764f', '#59443b', '#7f5c43'));
    for (const { offset, height } of candles) {
      const [x, y] = P(1.5, b + offset, 32.5);
      drawHallCandleWax(g, x, y, height);
    }
  }
}

function drawHallCandleWax(g, x, base, height) {
  const top = base - height;
  rect(g, x - 1, top, 3, height, '#c6ac84');
  rect(g, x + 1, top + 1, 1, height - 1, '#9e805f');
  rect(g, x - 1, top, 1, height - 1, '#e3cba2');
  dot(g, x, top, '#a98c6d');
  dot(g, x + 1, top + 1, '#dbbb91');
  dot(g, x, top - 1, '#493b3b');
}

function drawHallCandleFlame(x, top, t) {
  const flicker = .65 * Math.sin(t * 6.1 + x) + .35 * Math.sin(t * 9.7 + top);
  const lean = Math.round(flicker);
  glow(x, top - 2, 10, 9, '255,176,91', .067 + .014 * flicker);
  rect(ctx, x, top - 4, 1, 3, '#efa353');
  dot(ctx, x + lean, top - 5, '#f6ab59');
  dot(ctx, x, top - 3, '#fff1b6');
  dot(ctx, x + (lean || 1), top - 3, '#ffce81');
  dot(ctx, x, top - 2, '#ffd68c');
}

function makeHallFurnishings(continuation) {
  const canvas = mk(), g = canvas.getContext('2d');
  const wood = woodC('#885a42');
  if (!continuation) {
    ell(g, ...P(2.5, 25.5, 0), 12, 4, 'rgba(29,23,31,.36)');
    for (const b of [21, 29]) {
      box(g, 1, b, 0, 3.5, 1.25, 7, wood);
      box(g, 1, b - .2, 0, 3.7, 1.6, .8, flat('#845941', '#50382f', '#6d4937'));
    }
    box(g, 2.8, 21.5, 2.3, 1, 8, .85, wood);
    box(g, .5, 20, 7, 4.8, 11.5, 1.4, wood);
    box(g, .5, 20, 8, 1, 11.5, 4, wood);
    line(g, ...P(5.25, 20.5, 8), ...P(5.25, 31, 8), '#c18a5b');
    line(g, ...P(1.51, 20.5, 11.5), ...P(1.51, 31, 11.5), '#b88056');
    for (const b of [21.5, 30]) dot(g, ...P(5.3, b, 7.6), '#c4a36b');
    box(g, 2, 21.5, 8.4, 2.6, 3.8, 1, flat('#63816e', '#324741', '#485e52'));
    box(g, 2, 22, 9.4, 2.25, 2.8, .8, flat('#bc9163', '#573c35', '#765547'));
    box(g, 1.8, 27, 8.4, 3, 3, .6, flat('#985369', '#603b4c', '#78465a'));
    box(g, 4.5, 28.9, 6.5, .5, 1, 2.4, flat('#d1a372', '#653849', '#985369'));
    return [{ canvas, depth: 30 }];
  }
  box(g, .4, 54, 0, 4.5, 7, 3, wood);
  box(g, .4, 54, 3, 4.5, 7, 8, flat('#5b4a55', '#382d3c', '#46404b'));
  box(g, .3, 53.7, 11, 4.8, 7.6, 1.4, wood);
  box(g, .35, 54, 0, 4.65, 7, 1, flat('#a07151', '#523a36', '#6e4f44'));
  wallL(g, 4.91, 108, 122, 3, 11, (u, z) => {
    if (z === 10 || u === 108 || u === 121) return '#ad7e54';
    if (z === 4 || u === 114) return '#705140';
    return (u + z) % 7 === 0 ? '#74636c' : '#514451';
  });
  for (const b of [55.5, 58.5]) {
    const [x, y] = P(4.75, b, 7);
    rect(g, x, y - 2, 1, 3, '#d9ac66');
    ell(g, x, y - 3, 1, 1, '#ead098');
    dot(g, x + 1, y - 2, '#c79a57');
    dot(g, x, y + 1, '#b78a56');
  }
  const armor = mk(), armorContext = armor.getContext('2d');
  const steel = flat('#aab2b4', '#535c70', '#788390');
  box(armorContext, .5, 88, 0, 5, 7, 3, flat('#85848a', '#56515d', '#68636f'));
  for (const b of [89.5, 92.5]) box(armorContext, 1.5, b, 3, 2, 1.25, 8, steel);
  box(armorContext, 1, 89.3, 11, 3.4, 4.5, 7, steel);
  box(armorContext, 1.5, 90.1, 18, 2.6, 2.7, 4, steel);
  line(armorContext, ...P(4.1, 90.4, 20), ...P(4.1, 92.5, 20), '#333345');
  const candlestick = mk(), brass = candlestick.getContext('2d');
  const [x, y] = P(3.5, 76, 0);
  ell(brass, x, y, 7, 3, 'rgba(26,20,30,.48)');
  ell(brass, x, y - 1, 5, 2, '#684c39');
  ell(brass, x, y - 2, 4, 1, '#ad7949');
  rect(brass, x - 1, y - 20, 3, 18, '#8f6443');
  line(brass, x - 1, y - 18, x - 1, y - 4, '#cc9b59');
  for (const z of [7, 15, 21]) ell(brass, x, y - z, 2, 1, '#c3955a');
  const candles = [
    { offset: -5, cup: 20, height: 5, lit: true },
    { offset: 0, cup: 25, height: 3 },
    { offset: 5, cup: 21, height: 6, lit: true }
  ];
  for (const { offset, cup, height } of candles) {
    line(brass, x, y - 19, x + offset, y - cup, '#b88a53');
    ell(brass, x + offset, y - cup, 2, 1, '#aa7546');
    drawHallCandleWax(brass, x + offset, y - cup, height);
  }
  return [
    { canvas, depth: 62 }, { canvas: armor, depth: 95 },
    { canvas: candlestick, depth: 79.5, animate: t => {
      for (const { offset, cup, height, lit } of candles) {
        if (lit) drawHallCandleFlame(x + offset, y - cup - height, t);
      }
    } }
  ];

}

function drawHallFloorLight(g) {
  for (const center of hallWindows) {
    const windowB = center / 2;
    topFace(g, .05, 2, HALL_WIDTH, Math.max(0, windowB - 13), Math.min(HALL_DEPTH, windowB + 16), (a, b) => {
      const across = b - windowB - a * .24;
      const width = 5.8 + a * .065;
      const edge = Math.max(0, Math.min(1, (width - Math.abs(across)) / 2.4));
      const reach = Math.max(0, Math.min(1, (a - 2) / 5, (HALL_WIDTH - a) / 6));
      const mullion = Math.abs(across) < .55 || Math.abs(a - 17) < .8 ? .24 : 1;
      const strength = edge * reach * mullion * .23;
      return strength > .015 ? `rgba(255,173,104,${strength.toFixed(2)})` : null;
    });
  }
}

function drawHallCandles(t, continuation) {
  for (const { b, candles } of hallWallCandleShelves[continuation ? 'hallEnd' : 'hall']) {
    for (const { offset, height, lit } of candles) {
      if (lit) drawHallCandleFlame(...P(1.5, b + offset, 32.5 + height), t);
    }
  }
}

function drawHallChandelier(t) {
  if (!hallChandelier.naturalWidth) return;
  if (!hallChandelierBody) {
    // Use the lower part of the sprite and match its metal to the hall fittings.
    hallChandelierBody = document.createElement('canvas');
    const width = hallChandelierBody.width = hallChandelier.naturalWidth;
    const height = hallChandelierBody.height = hallChandelier.naturalHeight - hallChandelierBodyStart;
    const body = hallChandelierBody.getContext('2d');
    body.drawImage(hallChandelier, 0, hallChandelierBodyStart, width, height, 0, 0, width, height);
    for (const [column, waxTop, flameHeight] of hallChandelierCandles) {
      body.clearRect(column - 1, waxTop - hallChandelierBodyStart - flameHeight, 2, flameHeight);
    }
    body.globalCompositeOperation = 'source-atop';
    rect(body, 0, 0, width, height, 'rgba(139,111,86,.34)');
    for (const [column, row] of [[1, 31], [8, 27], [14, 16], [19, 27], [26, 31]]) {
      dot(body, column, row - hallChandelierBodyStart, '#c09561');
    }
    for (const [column, waxTop] of hallChandelierCandles) {
      const row = waxTop - hallChandelierBodyStart;
      dot(body, column - 1, row, '#f2d5a5');
      dot(body, column - 1, row + 2, '#eac292');
    }
  }

  const acrossHall = 20, alongHall = 60, height = 102;
  const [wallX, wallY] = P(0, alongHall, height);
  const [x, y] = P(acrossHall, alongHall, height);
  const bodyX = x - hallChandelierBody.width / 2;
  const bodyY = y + 6;

  // The open ceiling view leaves the wall bracket visible.
  rect(ctx, wallX - 1, wallY - 3, 3, 8, '#564237');
  dot(ctx, wallX, wallY - 2, '#a58461');
  line(ctx, wallX, wallY + 4, wallX + 12, wallY + 6, '#66503f');
  line(ctx, wallX, wallY, x, y, '#564237');
  line(ctx, wallX + 1, wallY - 1, x, y - 1, '#9b7857');
  rect(ctx, x - 1, y, 2, 6, '#655041');
  for (const offset of [0, 3]) dot(ctx, x - 1, y + offset, '#b18b63');

  const flicker = Math.sin(t * 6.7) * .65 + Math.sin(t * 11.2) * .35;
  glow(x, y + 18, 24, 19, '255,185,106', .050 + .012 * flicker);
  ctx.drawImage(hallChandelierBody, bodyX, bodyY);
  for (const [column, waxTop] of hallChandelierCandles) {
    const waxY = bodyY + waxTop - hallChandelierBodyStart;
    drawHallCandleFlame(bodyX + column, waxY, t + column * .07);
    dot(ctx, bodyX + column, waxY - 1, '#554039');
  }
}

function hallFloor(a, b, continuation) {
  const start = continuation ? 0 : 8;
  const end = continuation ? HALL_DEPTH - 7 : HALL_DEPTH;
  if (b >= start && b < end && a >= 9 && a < HALL_WIDTH - 8) {
    const edge = Math.min(a - 9, HALL_WIDTH - 8 - a,
      continuation ? end - b : b - start);
    if (edge < 1) return '#a98b59';
    if (edge < 2) return '#373646';
    if (Math.abs(b % 16 - 8) + Math.abs(a - 16) < 4) return '#96784f';
    return Math.abs(a - 16) < 3 && hash(a * 3, b * 3) > .35 ? '#655a63' : '#514957';
  }
  return stockroomFloor(a, b);
}

function drawHallAtmosphere(t) {
  for (const [index, center] of hallWindows.entries()) {
    for (let mote = 0; mote < 3; mote++) {
      const age = (t * .24 + index * .39 + mote * .32) % 1;
      const [x, y] = P(5 + age * 18, center / 2 + Math.sin(age * 7 + mote) * 4, 4 + mote * 3);
      ctx.globalAlpha = Math.sin(Math.PI * age) * .44;
      dot(ctx, x, y, '#ffe5ae');
    }
  }
  ctx.globalAlpha = 1;
  const continuing = currentRoom === rooms.hallEnd;
  const nearArch = continuing ? wizard.b <= 1 : wizard.b >= HALL_ROWS - 2;
  if (nearArch) {
    const [x, y] = P(HALL_WIDTH / 2, continuing ? 2.5 : HALL_DEPTH, 73);
    glow(x, y, 9, 7, '255,195,116', .24 + Math.sin(t * 3) * .05);
    for (const dx of [-3, 0, 3]) dot(ctx, x + dx, y + Math.abs(dx) / 3, '#e9c179');
  }
  if (!continuing) return;
  const [u, z, width, height] = hallEndFrames[0];
  const gaze = Math.max(-.17, Math.min(.17, (wizard.b * TILE_SIZE - 25) * .02));
  wallL(ctx, 0, u + 3, u + width - 3, z + 3, z + height - 3, (column, level) => {
    const x = 2 * (column - u - 3) / (width - 7) - 1;
    const y = 2 * (level - z - 3) / (height - 7) - 1;
    return hallArtwork('family', x, y, gaze);
  });
}

function drawHallConnector(g, b) {
  const stone = flat('#85929e', '#424956', '#596674');
  const trim = flat('#99a4aa', '#525b66', '#727e88');
  const postDepth = 2.5;
  for (const a of [0, HALL_WIDTH - 2.5]) {
    box(g, a, b, 0, 2.5, postDepth, 54, stone);
    box(g, a, b, 0, 2.5, postDepth, 4, trim);
    box(g, a, b, 50, 2.5, postDepth, 4, trim);
    wallR(g, b + postDepth, a * 2, a * 2 + 5, 4, 50, (u, z) => {
      if (z % 8 === 0) return '#444953';
      if (u === a * 2 || z % 8 === 7) return '#8b969d';
      return '#697581';
    });
  }
  const center = HALL_WIDTH;
  for (const depth of [0, postDepth]) {
    wallR(g, b + depth, 0, HALL_WIDTH * 2, 53, 77, (u, z) => {
      const dx = (u - center) / center;
      const rise = Math.sqrt(Math.max(0, 1 - dx * dx));
      const inner = 53 + rise * 17;
      const outer = 57 + rise * 19;
      if (z < inner || z >= outer) return null;
      if (depth === 0) return '#48525e';
      if (z < inner + 1) return '#3e4650';
      if (Math.abs(u - center) <= 3) {
        return schoolCrestPixel((u - center) / 4, (z - 73) / 3) ?? '#a3a7a3';
      }
      if (z > outer - 2) return '#a3a7a3';
      return Math.floor(u / 7) % 2 ? '#77828b' : '#879197';
    });
  }
}

const classroomRows = [4, 6, 8];
const classroomBanks = [1, 7];
// Room-local pixel sprite. The bronze backplate sits flush against each wall.
function makeClassroomSconce(crystalColors, rune) {
  const canvas = document.createElement('canvas');
  canvas.width = 14;
  canvas.height = 26;
  const g = canvas.getContext('2d');
  const palette = ["#182726","#21a18b","#1a8978","#3ad7b0","#13625b","#563729","#574232","#596b58","#a7fedc","#87583a","#6c4531","#9ec8b3","#60a796","#613d2d","#4a8273","#107469","#392621","#442c24","#88b1a1","#271b1a","#552c1e","#0d5852","#33221d","#7c5237","#314b3f","#955c39","#926340"];
  const keys = 'abcdefghijklmnopqrstuvwxyzA';
  const rows = [
    '..........a...',
    '.........aba..',
    '.........cde..',
    '...fg...hibea.',
    '..ajk...lmece.',
    '..fkn..omeecp.',
    '.qjgrf.pmmpse.',
    'tkkfffupbslmv.',
    'fjqrrqwpcespe.',
    'rfqffqqbbemce.',
    'qfffffacbbmbp.',
    'wkfwwfjvbbpbex',
    'wnnqqqfgpchvgf',
    'wfrrqtafvyzag.',
    'wnqkftwkzjfjjq',
    'qffArt.wfkjkr.',
    'qffkjj..fkknr.',
    'qffnrxj..fnw..',
    'qnqrwtnkrjf...',
    'wfqfrttfnfw...',
    'qkqqwakkt.....',
    'tkkgqqkwjk....',
    '.tkffrzfkk....',
    '.tfkr.fjxw....',
    '..qk..........',
    '..tt..........'
  ];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '.') dot(g, x, y, crystalColors[row[x]] ?? palette[keys.indexOf(row[x])]);
    }
  });
  line(g, 8, 5, 10, 7, rune);
  line(g, 11, 5, 10, 7, rune);
  line(g, 10, 7, 10, 10, rune);
  line(g, 2, 5, 3, 4, '#ba8859');
  line(g, 7, 18, 9, 16, '#ac784c');
  return canvas;
}

const classroomLights = [
  { a: 12, b: 0, z: 65, color: '104,225,177', sprite: makeClassroomSconce({}, '#aff6d5') },
  { a: 0, b: 44, z: 67, color: '186,125,247', sprite: makeClassroomSconce({
    a: '#32233d', b: '#8153ab', c: '#6d438c', d: '#b477ed', e: '#4f356b',
    h: '#ecd7ff', i: '#e6c5ff', l: '#bda1d5', m: '#9874b8', o: '#694f83',
    p: '#624477', s: '#a888bf', u: '#59366e', v: '#472d5e', y: '#4d3963'
  }, '#f0d9ff') }
];

function drawClassroomLights(t) {
  for (const { a, b, z, color, sprite } of classroomLights) {
    const [x, y] = P(a, b, z);
    const facing = a === 0 ? 1 : -1;
    const flicker = .55 * Math.sin(t * 7.6 + a) + .3 * Math.sin(t * 12.9 + b) + .15 * Math.sin(t * 18.3);
    ctx.save();
    ctx.translate(x + 7 * facing, y - 5);
    ctx.scale(1, .85);
    ctx.globalCompositeOperation = 'source-atop';
    const radius = 31 + 2 * flicker;
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    halo.addColorStop(0, `rgba(${color},${.37 + .09 * flicker})`);
    halo.addColorStop(.46, `rgba(${color},${.18 + .05 * flicker})`);
    halo.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(-radius, -radius, 2 * radius, 2 * radius);
    ctx.restore();

    ctx.save();
    ctx.translate(x, y - 13);
    ctx.scale(facing, 1);
    ctx.drawImage(sprite, -3, 0);
    ctx.globalAlpha = .24 + .15 * flicker;
    line(ctx, 5, 5, 7, 7, '#fff3ff');
    line(ctx, 8, 5, 7, 7, '#fff3ff');
    line(ctx, 7, 7, 7, 10, '#fff3ff');
    ctx.restore();
  }
}

function classroomFloor(a, b) {
  // A woven runner follows the clear aisle between the two banks of desks.
  const hem = Math.min(a - 42, 54 - a, b - 23, 85 - b);
  let base = '#785440', finish = 1;
  if (hem >= 0) {
    const diamond = Math.abs(a - 48) + Math.abs((b - 23) % 12 - 6);
    base = hem < .6 ? '#715637' : hem < 1.2 || Math.abs(diamond - 3) < .45
      ? '#bd9d66' : '#446259';
    finish += hash(Math.floor(a * 2), Math.floor(b)) * .08;
  } else {
    const row = Math.floor(b / 4);
    const run = a + hash(row, 7) * 19;
    const joint = run % 21, across = b % 4;
    const board = hash(Math.floor(run / 21), row);
    const grain = Math.sin(across * 7 + Math.sin(run * .21 + board * 9) * .85);
    finish = .88 + board * .17 + (grain > .55 ? -.06 : 0);
    if (across < .32 || joint < .38) finish *= .60;
    else if (across < .7 || joint < .75) finish *= 1.13;
    else if (joint < 1.65 && Math.abs(across - 1) < .28) base = '#715441';
  }
  let shade = Math.min(1, .77 + Math.min(a, b) * .045);
  for (const row of classroomRows) for (const column of classroomBanks) {
    shade = Math.min(shade, contactShade(a, b, column * TILE_SIZE + 16, row * TILE_SIZE + 5, 17, 5));
  }
  const light = Math.max(0, 1 - Math.hypot((a - 47) / 55, (b - 13) / 38));
  return sh(base, Math.round((finish + light * .16) * shade * 64) / 64);
}

const classroomRunes = [
  ['..#..', '.#.#.', '#...#', '.###.', '..#..', '..#..', '..#..'],
  ['#...#', '.#.#.', '..#..', '.#.#.', '#...#', '..#..', '.###.'],
  ['..#..', '.#.#.', '#.#.#', '..#..', '..#..', '.#.#.', '#...#']
];

function classroomRunePixel(index, x, y, scale = 1) {
  const row = 3 - Math.round(y / scale);
  const column = 2 + Math.round(x / scale);
  return classroomRunes[index][row]?.[column] === '#';
}

function drawClassroomChalkboard(g) {
  const left = 17, right = 76, bottom = 30, top = 77, front = 4;
  box(g, left, 0, bottom, right - left, front, top - bottom, woodC('#754c35'));
  // An integer wall offset keeps each chalk pixel on the canvas pixel grid.
  wallR(g, front, 2 * left, 2 * right, bottom, top, (u, z) => {
    const side = Math.min(u - 2 * left, 2 * right - 1 - u);
    const rail = Math.min(z - bottom, top - 1 - z);
    const edge = Math.min(side, rail);
    if (edge === 0) return '#49362e';
    if (side === 3 && rail === 3) return '#d0ac75';
    if (side === rail && edge < 5) return '#6d4a36';
    if (edge === 1) return z >= top - 2 || u < 40 ? '#c79a68' : '#90613e';
    if (edge <= 3) {
      const grain = side < rail ? hash(u, z >> 2) : hash(u >> 2, z);
      return grain > .76 ? '#b48254' : '#9c6b46';
    }
    if (edge === 4) return '#4e392d';
    if (edge === 5) return '#192b28';

    const dust = hash(u, z);
    for (let index = 0; index < 3; index++) {
      const x = u - (60 + 33 * index), y = z - 54;
      if (classroomRunePixel(index, x, y, 3)) return dust > .82 ? '#cbbd98' : '#f1e5c2';
      if (Math.abs(x) <= 9 && y === -12 && dust > .18) return '#8fa299';
      if (y === -15 && x >= -3 && x < -3 + (index + 1) * 3 && (x + 3) % 3 === 0) return '#c1a986';
      if (Math.abs(x) === 13 && Math.abs(y) < 3) return '#859d91';
      if (Math.abs(x) < 5 && y === 13 && (x + index) % 3 !== 0) return '#9ba48c';
    }
    if (z < 39 && dust > .88) return '#59665a';
    const erased = Math.abs(z - 43 - Math.sin(u * .13) * 2.5) < 1.6 ||
      Math.abs(z - 65 - (u % 20) * .14) < 1.4;
    if (erased && dust > .68) return '#465950';
    return dust > .87 ? '#324841' : z < 40 ? '#2d4139' : '#273b35';
  });

  const trayLeft = left + 1.5, trayRight = right - 1.5;
  box(g, trayLeft, front - .15, bottom - .85, trayRight - trayLeft, 2.55, .85, woodC('#795136'));
  box(g, trayLeft, front + .18, bottom - .05, trayRight - trayLeft, 1.65, .12,
    flat('#725238', '#5b402e', '#61442e'));
  box(g, 30, front + .55, bottom, 2.6, .65, .7, flat('#e9ddbd', '#a6967e', '#cbb99b'));
  box(g, 34, front + .45, bottom, 1.5, .75, .65, flat('#c9a2b0', '#91717c', '#ab8793'));
  box(g, 65.5, front + .35, bottom, 3.4, 1.35, .65, flat('#75695c', '#433930', '#5d4d42'));
  box(g, 65.7, front + .4, bottom + .65, 3, 1.15, .45, woodC('#9c6b44'));
  for (const a of [31, 33, 35, 38, 56, 62, 66]) dot(g, ...P(a, front + 1.55, bottom), '#bda787');
  box(g, trayLeft, front + 1.85, bottom - .45, trayRight - trayLeft, .55, .85, woodC('#ab794d'));
  for (const a of [trayLeft, trayRight - .7]) {
    box(g, a, front, bottom - .8, .7, 2.4, 1.3, woodC('#93623f'));
  }
}

function drawClassroomDecor(g) {
  const oak = woodC('#95653f');
  box(g, 23, 2, 0, 50, 18, 1.5, woodC('#916344'));
  box(g, 23, 19, 0, 50, 3, .65, woodC('#a87851'));
  wallL(g, 0, 0, CLASSROOM_DEPTH * 2, 0, 30, (u, z) =>
    z < 3 || z > 26 || u % 15 < 2 ? '#53483c' : '#41554d');
  wallR(g, 0, 0, CLASSROOM_WIDTH * 2, 0, 30, (u, z) =>
    z < 3 || z > 26 || u % 15 < 2 ? '#57493b' : '#485c51');
  drawClassroomChalkboard(g);
  box(g, 78, 0, 0, 16, 3, 48, oak);
  wallR(g, 3, 156, 188, 0, 48, libraryShelf(156, 188, null));
  for (const [start, shade] of [[12, '#b8a078'], [104, '#78898a']]) {
    wallL(g, 0, start, start + 24, 39, 67, (u, z) => {
      const x = u - start, y = z - 39;
      if (y < 2 || y > 25 || x === 0 || x === 23) return '#755038';
      if (classroomRunePixel(start < 50 ? 0 : 2, x - 12, y - 15, 2) || (y < 8 && y % 3 === 0 && x > 3 && x < 20)) return '#e6d3a3';
      return shade;
    });
  }
  const gilt = ['#ccaa73', '#967348', '#5b4032'];
  const walnut = ['#b08462', '#7c5442', '#493638'];
  drawFramedPaintings(g, [
    [wallL, [[139, 43, 30, 40, 'wizard', gilt], [44, 74, 30, 19, 'moon', walnut]]],
    [wallR, [[157, 61, 30, 25, 'castle', gilt]]]
  ]);
}

function buildStatic(sg, room, doorStyle) {
  const library = room === rooms.library;
  const potion = room === rooms.potion;
  const stockroom = room === rooms.stockroom;
  const hall = room.corridor;
  const openHallEntrance = room === rooms.hallEnd;
  const classroom = room === rooms.classroom;
  const width = classroom ? CLASSROOM_WIDTH : hall ? HALL_WIDTH : library ? LIBRARY_WIDTH : stockroom ? STOCK_WIDTH : potion ? POTION_COLUMNS * TILE_SIZE : TOWER_SIZE;
  const depth = classroom ? CLASSROOM_DEPTH : hall ? HALL_DEPTH : library ? LIBRARY_DEPTH : stockroom ? STOCK_DEPTH : potion ? POTION_ROWS * TILE_SIZE : TOWER_SIZE;
  const floor = classroom ? classroomFloor : hall ? (a, b) => hallFloor(a, b, openHallEntrance) : stockroom ? stockroomFloor : potion ? potionFloor : library ? shadedLibraryFloor : shadedTowerFloor;
  topFace(sg, 0, 0, width, 0, depth, floor);
  if (hall) drawHallFloorLight(sg);

  wallL(sg, 0, 0, 2 * depth, 0, WH, room === rooms.tower ? leftFn : potion ? alchemyStone : workshopStone);
  const mer = { top: copingFn, left: brOutL, right: brOutR };
  if (!openHallEntrance) {
    wallR(sg, 0, 0, 2 * width, 0, WH, room === rooms.tower ? rightFn : potion ? alchemyStone : workshopStone);
    topFace(sg, WH, -T, width, -T, 0, copingFn);
    box(sg, -T, -T, WH, T, T, 12, mer);
    box(sg, width - 8, -T, WH, 8, T, 10, mer);
  }
  topFace(sg, WH, -T, 0, 0, depth, copingFn);
  if (room !== rooms.hall) box(sg, -T, depth - 8, WH, T, 8, 10, mer);
  wallR(sg, depth, -2 * T, 2 * width, -F, WH, facadeFn(brOutL, width));
  wallL(sg, width, openHallEntrance ? 0 : -2 * T, 2 * depth, -F, WH, facadeFn(brOutR, depth));
  if (room === rooms.tower) {
    const gildedWood = ['#b6956a', '#856348', '#574337'];
    drawWallIvy(sg, [[0, 32.5, 21], [0, 66, 24]]);
    drawFramedPaintings(sg, [
      [wallL, [[105, 59, 22, 31, 'aubert-young', gildedWood], [139, 64, 20, 28, 'aubert-moon', ['#c6c2ac','#808779','#4f5b58'], 'oval']]],
      [wallR, [[101, 60, 23, 33, 'aubert', gildedWood, 'carved'], [143, 64, 24, 29, 'aubert-study', ['#bd9469','#80543c','#49352f'], 'carved']]]
    ]);
  }
  if (library) {
    drawReadingWindow(sg);
    box(sg, 0, 33, 26, 4, 21, 2.5, woodC('#89654c'));
    box(sg, .5, 40, 28.5, 3, 8, 1.5, flat('#b37959', '#805247', '#64403c'));
    drawWallIvy(sg, [[0, 11, 28], [0, 31, 38], [0, 54, 24], [7, 0, 31], [52, 0, 36]]);
    drawLibraryShelves(sg);
    drawLibraryClock(sg);
  }
  if (hall) drawHallDecor(sg, room === rooms.hallEnd);
  if (room === rooms.classroom) drawClassroomDecor(sg);
  if (openHallEntrance) drawHallConnector(sg, 0);
  if (potion) drawPotionWorkshop(sg);
  if (stockroom) {
    drawWallIvy(sg, [[0, 71, 30], [80, 0, 22]]);
    drawStockPaintings(sg);
    drawStockShelves(sg);
  }
  if (room === rooms.tower || library) drawPassage(sg, library, doorStyle);
  for (const exit of room.exits) {
    if (exit.wallA !== undefined) drawSidePassage(sg, exit, false, doorStyle);
    if (exit.wallB !== undefined) drawAcrossPassage(sg, exit, doorStyle);
  }
}

/* ---------- meubels ---------- */
const furnishings = [];
const flasks = [];
function flask(g, x, y, liq, type, collection = flasks) {
  if (type === 'tube') {
    rect(g, x - 1, y - 9, 3, 9, '#cfe8ff'); rect(g, x - 1, y - 7, 3, 7, liq); dot(g, x, y - 5, sh(liq, 1.4)); rect(g, x - 1, y - 10, 3, 1, '#a8703a');
  } else if (type === 'jar') {
    rect(g, x - 4, y - 7, 9, 7, '#a5cbd9');
    rect(g, x - 3, y - 5, 7, 4, liq);
    rect(g, x - 3, y - 9, 7, 2, '#a8703a');
    rect(g, x - 3, y - 7, 1, 5, '#f3ffff');
  } else if (type === 'diamond') {
    for (let row = 0; row < 9; row++) {
      const w = Math.min(row, 8 - row);
      rect(g, x - w, y - 9 + row, w * 2 + 1, 1, '#cfe8ff');
      if (w > 0 && row >= 3) rect(g, x - w + 1, y - 9 + row, w * 2 - 1, 1, liq);
    }
    rect(g, x - 1, y - 11, 3, 3, '#cfe8ff');
    rect(g, x - 1, y - 12, 3, 1, '#a8703a');
    dot(g, x - 2, y - 5, '#ffffff');
  } else {
    ell(g, x, y - 4, 4, 4, '#cfe8ff'); ell(g, x, y - 4, 3, 3, liq);
    dot(g, x - 2, y - 6, '#ffffff'); dot(g, x - 1, y - 7, '#ffffff');
    rect(g, x - 1, y - 11, 3, 4, '#cfe8ff'); rect(g, x - 1, y - 9, 3, 2, liq); rect(g, x - 1, y - 12, 3, 1, '#a8703a');
  }
  collection?.push({ x, y });
}
const cand = []; // kaarsposities
let KN = null;  // ridderpositie
let chestOpening = 0;

function drawAubertPlant(g, a, b, variety, height = 0) {
  const [x, y] = P(a, b, height);
  if (!height) ell(g, x, y, 7, 3, '#34333c');
  box(g, a - 1.8, b - 1.8, height, 3.6, 3.6, 4,
    flat(variety === 1 ? '#839a91' : '#ba8b63', variety === 1 ? '#415c5b' : '#78503e', variety === 1 ? '#587c76' : '#94654a'));
  ell(g, x, y - 4, 7, 3, variety === 1 ? '#a7b9a6' : '#c3946c');
  ell(g, x, y - 5, 5, 2, '#403c32');
  if (variety === 2) {
    // Arching fronds, rather than the upright flowering stems.
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
      const tx = x + side * (3 + k * 2), ty = y - 18 + k * 3;
      line(g, x, y - 5, tx, ty, '#50735d');
      for (let n = 1; n < 4; n++) {
        const lx = x + (tx - x) * n / 4, ly = y - 5 + (ty - y + 5) * n / 4;
        line(g, lx - 2, ly - 2, lx + 2, ly, n % 2 ? '#77956d' : '#a0ad7d');
      }
    }
    return;
  }
  for (let stem = 0; stem < 5; stem++) {
    const dx = (stem - 2) * 3, top = y - 13 - (stem % 3) * 3;
    line(g, x, y - 5, x + dx, top, '#55745a');
    for (let leaf = 0; leaf < 3; leaf++) {
      const lx = x + dx * (1 - leaf * .2), ly = top + leaf * 3;
      ell(g, lx + (leaf % 2 ? -2 : 2), ly, variety === 0 ? 4 : 3, 2,
        leaf % 2 ? '#638568' : '#8ba077');
    }
    if (variety === 1) {
      ell(g, x + dx, top - 2, 2, 2, '#b59abd');
      dot(g, x + dx, top - 2, '#ead2a2');
    }
  }
  line(g, x - 4, y - 1, x + 3, y + 2, '#d0a67c');
}

function buildFront() {
  let canvas = mk(), g = canvas.getContext('2d');
  // De diepte is a + b op de vloer, zodat meubels de tovenaar kunnen bedekken.
  function store(depth, animate) {
    outline(g, '#0f1226');
    furnishings.push({ canvas, depth, animate });
    canvas = mk();
    g = canvas.getContext('2d');
  }
  const wood = woodC('#7a4a2a'), woodD = woodC('#5a3320');
  const iron = flat('#4a4a5a', '#2e2e3c', '#222230');

  // haard
  const hearthStone = flat('#908882', '#72676a', '#605b60');
  box(g, 9.5, 0, 0, 23, 6.5, 1.2, flat('#6e6664', '#544c50', '#493f48'));
  box(g, 10, 0, 1.2, 22, 6, .8, hearthStone);
  for (const a of [14, 20, 26]) line(g, ...P(a, 4.5, 2), ...P(a, 6, 2), '#65585a');
  // schoorsteenmantel + consoles
  box(g, 9, 0, 52, 24, 4, 4, woodD);
  box(g, 8.75, 0, 55, 24.5, 4.5, 1, wood);
  wallR(g, 4, 18, 66, 52, 54, (u, z) =>
    z === 53 && hash(u >> 1, z) > .32 ? '#a67448' : '#503123');
  for (const a of [11, 21, 31]) {
    const [x, y] = P(a, 4.1, 53);
    dot(g, x, y, '#b48757');
  }
  box(g, 10.5, 0, 48, 1.6, 2.5, 4, woodD); box(g, 29.5, 0, 48, 1.6, 2.5, 4, woodD);

  // ijzeren haardscherm
  for (let a = 11; a <= 30; a += 2) { box(g, a, 3.5, 2, .8, .8, 9, iron); dot(g, CX + 2 * (a - 3.1), CY + a + 3.5 - 12, '#6a6a7e'); }
  box(g, 10.6, 3.5, 7, 20.6, .8, .8, iron);
  box(g, 10.6, 0, 7, .8, 3.5, .8, iron); box(g, 31, 0, 7, .8, 3.5, .8, iron);

  store(26);

  // Fauteuil met de rug naar de haard en de zitting naar het bureau.
  const seatA = 24.5, seatB = 40.5;
  const upholstery = flat('#75917f', '#3a5349', '#4b695b');
  const cushion = flat('#8fa995', '#526e60', '#638272');
  const chairPart = (a, b, z, da, db, dz, material) =>
    box(g, seatA + a, seatB + 7 - b - db, z, da, db, dz, material);
  for (const a of [.5, 5.3]) {
    for (const b of [.5, 5.3]) chairPart(a, b, 0, 1.2, 1.2, 3, woodD);
  }
  chairPart(.15, .15, 3, 6.7, 6.7, 2, woodD);
  chairPart(0, 0, 5, 7, 7, 3, upholstery);
  chairPart(.15, .55, 8, 1.55, 5.7, 4, upholstery);
  chairPart(.25, .7, 12, 1.35, 5.35, 1, cushion);
  chairPart(1.45, .5, 8, 4.1, 4.8, 2.5, cushion);

  // De bies en sierknopen liggen in het zichtbare vlak van de rugleuning.
  const back = flat('#7c9886', (u, z) => {
    const column = u - Math.floor((seatA + .65) * 2);
    if (column <= 1 || column >= 10 || z === 20 || z === 10) return '#415a50';
    if (z === 19 && column >= 3 && column <= 8) return '#a78e60';
    if (z === 16 && (column === 4 || column === 7)) return '#30473f';
    return column <= 3 ? '#577466' : '#4a6659';
  }, '#5d7c6d');
  chairPart(.65, 5, 8, 5.7, 2, 13, back);
  chairPart(1.05, 5.15, 21, 4.9, 1.7, 2, cushion);

  store(seatA + seatB + 7, t => drawSeatedWizard(t, armchairSeat));
  chairPart(5.3, .55, 8, 1.55, 5.7, 4, upholstery);
  chairPart(5.4, .7, 12, 1.35, 5.35, 1, cushion);
  // Een geweven plaid over de voorste armleuning, buiten de zitting.
  const throwWool = flat('#bc785d', '#8b4947', (u, z) => {
    if (z <= 8) return u % 2 ? '#d0a17b' : '#823f41';
    if (z === 10 || z === 11) return '#d2a074';
    return u % 3 === 0 ? '#a75950' : '#9b514a';
  });
  chairPart(6.62, 1.35, 8, .34, 3, 5.2, throwWool);
  chairPart(5.62, 1.35, 13, 1.34, 3, .3, throwWool);
  store(seatA + seatB + 7);

  // Move the complete desk, including its animated props, away from the hearth.
  g.save(); g.translate(-48, 24);
  // Donker schrijfbureau met uitgesneden panelen.
  const deskWood = woodC('#64412d');
  const gilding = flat('#aa7f4c', '#7c5233', '#8e633d');
  box(g, 16.5, 25, 0, 23, 6, 2, deskWood);
  box(g, 16.5, 25, 2, 23, 6, 12, deskWood);
  wallR(g, 31, 33, 79, 2, 14, (u, z) => {
    const column = (u - 33) % 9;
    if (column === 0 || u === 78 || z === 2 || z === 13) return '#987044';
    const curve = Math.hypot(column - 4.5, Math.max(0, z - 8));
    if (curve < 2.15 && z > 4) return '#3c2924';
    if (curve < 3 && z > 3) return '#9c7147';
    if (z === 12 || (column === 1 && z > 4)) return '#805234';
    return hash(u, z >> 1) > .8 ? '#704b34' : '#65432e';
  });
  box(g, 16, 24.5, 13, 24, 7, 2.5, deskWood);
  box(g, 16.25, 31, 14, 23.5, .4, 1, gilding);
  const pages = flat('#dbc79d', '#8c6c4c', '#ad9064');
  box(g, 26, 27, 15.5, 2.25, 2.5, .8, pages);
  box(g, 28.35, 27, 15.5, 2.25, 2.5, .8, pages);
  for (const a of [26.5, 28.75]) {
    line(g, ...P(a, 27.7, 16.3), ...P(a + 1.25, 27.7, 16.3), '#987b57');
    line(g, ...P(a, 28.4, 16.3), ...P(a + 1, 28.4, 16.3), '#ae8d60');
  }
  line(g, ...P(28.25, 27, 16.3), ...P(28.25, 29.5, 16.3), '#7e5c45');
  for (const [z, color] of [[15.5, '#723e42'], [16.3, '#486659'], [17.1, '#846041']]) {
    box(g, 22.8, 26, z, 2.8, 2.2, .8, flat(color, '#5d3c2d', '#aa8e66'));
  }
  box(g, 25.6, 29.5, 15.5, 1.4, 1.4, 1.5, flat('#555279', '#2c2949', '#3e3a5b'));
  box(g, 31.2, 26, 15.5, 1.6, 1.6, 3, gilding);
  box(g, 30.9, 25.7, 18, 2.2, 2.2, 1, gilding);
  box(g, 35.5, 27, 15.5, 4, 3, 1.5, flat('#2f7a3a', '#e8dcb0', '#17481f'));
  // Lage bijenwaskaars bij het open boek.
  const candleA = 20.5, candleB = 28.5;
  box(g, candleA - .9, candleB - .8, 15.5, 1.8, 1.6, .7, gilding);
  box(g, candleA - .45, candleB - .45, 16.2, .9, .9, 2.7,
    flat('#f1d29f', '#c48a59', '#ad704d'));
  const [candleX, candleY] = P(candleA, candleB, 19);
  g.restore();
  store(80, t => {
    ctx.save(); ctx.translate(-48, 24);
    drawDeskOrb(t);
    flame(candleX, candleY - 1, t, 3);
    glow(candleX, candleY + 3, 16, 11, '255,188,105', .025);
    ctx.restore();
  });

  // Hoge zitstok voor de sneeuwuil.
  box(g, TOWER_OWL_A - 5, 0, 55, 10, 4.5, 3, woodD);
  box(g, TOWER_OWL_A - 1, 0, 50, 2, 2, 5, woodD);
  store(0, drawOwl);

  // planken: rechter plank + drankjes
  box(g, 33, 0, 44, 7, 5.5, 2, wood); box(g, 34, 0, 40, 1.2, 3, 4, woodD); box(g, 38, 0, 40, 1.2, 3, 4, woodD);
  let [x, y] = P(35.5, 2.6, 46); flask(g, x, y, '#46d6e8');
  [x, y] = P(38.2, 2.6, 46); flask(g, x, y, '#f0509a');
  // linker plank + drankjes
  box(g, 0, 33, 44, 5.5, 16, 2, wood); box(g, 0, 34, 40, 3, 1.2, 4, woodD); box(g, 0, 38, 40, 3, 1.2, 4, woodD);
  [x, y] = P(2.6, 35.5, 46); flask(g, x, y, '#5be05b');
  [x, y] = P(2.6, 38.4, 46); flask(g, x, y, '#ff6fa8', 'tube');

  // Vensterbank en tussenplank voor de kat.
  box(g, 0, 11, 58, 3.5, 22, 2, flat('#9c998e', '#696b68', '#7c817c'));
  line(g, ...P(3.55, 12, 60), ...P(3.55, 32, 60), '#b4ad98');
  box(g, 0, 35, 68, 5.5, 12, 2, wood);
  box(g, 0, 43, 64, 3, 1.5, 4, woodD);

  store(0, t => {
    drawFlaskGlints(t);
    drawCat(t);
  });

  // Vrijstaande kandelaar naast het schrijfhoekje, ruim buiten de zitbank.
  { const [bx, by] = P(58, 36, 0);
    ell(g, bx, by - 1, 6, 3, '#16161f'); ell(g, bx, by - 2, 5, 2, '#2c2c3a');
    rect(g, bx - 1, by - 24, 2, 22, '#23232f'); dot(g, bx + 1, by - 20, '#3c3c4e'); ell(g, bx, by - 8, 2, 1, '#3c3c4e');
    line(g, bx, by - 22, bx - 8, by - 28, '#23232f'); line(g, bx, by - 22, bx + 8, by - 28, '#23232f');
    line(g, bx, by - 22, bx, by - 30, '#23232f');
    for (const [dx, ty, height, lit] of [[-8, by - 28, 6, true], [0, by - 30, 4, false], [8, by - 28, 5, true]]) {
      rect(g, bx + dx - 2, ty, 5, 2, '#2c2c3a');
      drawHallCandleWax(g, bx + dx, ty, height);
      if (lit) cand.push([bx + dx, ty - height - 2]);
    } }

  store(94, t => {
    for (const [x, y] of cand) flame(x, y, t, x);
  });

  // ridder
  { const [bx, by] = P(4, 4, 0); KN = [bx, by];
    const lt = '#c9d0de', md = '#8f99ab', dk = '#5c6579';
    const part = (x0, y0, w, h) => { rect(g, x0, y0, w, h, md); rect(g, x0 + w - Math.ceil(w / 3), y0, Math.ceil(w / 3), h, lt); rect(g, x0, y0, Math.max(1, Math.floor(w / 4)), h, dk); };
    part(bx - 6, by - 3, 5, 3); part(bx + 1, by - 3, 5, 3);          // laarzen
    part(bx - 5, by - 13, 4, 10); part(bx + 1, by - 13, 4, 10);      // benen
    part(bx - 6, by - 17, 12, 4);                                    // heupstuk
    part(bx - 6, by - 28, 12, 11);                                   // romp
    rect(g, bx - 5, by - 24, 10, 1, dk); dot(g, bx, by - 26, lt);
    part(bx - 9, by - 30, 5, 5); part(bx + 4, by - 30, 5, 5);        // schouders
    part(bx - 9, by - 25, 3, 10); part(bx + 6, by - 25, 3, 10);      // armen
    part(bx - 4, by - 37, 8, 9);                                     // helm
    rect(g, bx - 3, by - 33, 6, 1, '#1a1d2a');
    rect(g, bx - 1, by - 40, 2, 3, '#b8232f'); }

  store(8, t => {
    if ((t % 7) > 6.4) rect(ctx, KN[0] - 3, KN[1] - 33, 6, 1, '#ff3a3a');
  });

  // Voorraadkist langs de rechterwand
  drawChestBody(g, towerChestA, towerChestB, woodD);
  store(towerChestA + towerChestB, drawChest);

  // Kristal op een sokkel langs de linkerwand
  box(g, 1, TOWER_DIAMOND_B - 3, 0, 6, 6, 3, flat('#777aa1', '#515579', '#616587'));
  box(g, 2, TOWER_DIAMOND_B - 2, 3, 4, 4, 11, flat('#9194ae', '#535776', '#686d91'));
  box(g, 1, TOWER_DIAMOND_B - 3, 14, 6, 6, 2, flat('#9194ae', '#535776', '#686d91'));
  // Messing plakkaat met een gegraveerd diamantje.
  box(g, 6, TOWER_DIAMOND_B - 1.7, 6, .5, 3.4, 5, flat('#e2bf78', '#8b6339', (u, z) => {
    const column = u - 2 * (TOWER_DIAMOND_B - 2);
    if (z === 10 || column === 0) return '#e2bf78';
    if (z === 6 || column === 6) return '#91663b';
    if (Math.abs(column - 3) + Math.abs(z - 8) <= 1) return '#6b4b36';
    return '#bd9257';
  }));
  store(4 + TOWER_DIAMOND_B, drawDiamond);

  // Aubert's herb cabinet: drawers, labelled jars and a sealed letter.
  box(g, 49, 1, 0, 13, 5, 18, woodD);
  for (const z of [3, 8, 13]) {
    box(g, 49.6, 5.8, z, 11.8, .4, 4, wood);
    for (const a of [52, 59]) box(g, a, 6.2, z + 1.8, 1, .4, .6, gilding);
  }
  box(g, 48.5, .5, 18, 14, 6, 1.5, wood);
  for (const [a, color] of [[51, '#6c956c'], [55, '#a384aa'], [59, '#c5a066']]) {
    box(g, a, 2, 19.5, 1.7, 1.7, 3, flat(color, '#51424f', '#6e6470'));
    box(g, a, 2, 22.5, 1.7, 1.7, .6, gilding);
    box(g, a, 3.7, 20.2, 1.4, .1, 1, pages);
  }
  // Raised corner caps, recessed drawer panels and little worn handles.
  for (const a of [49, 61]) box(g, a, 5.9, 1, .6, .5, 17, gilding);
  for (const z of [3, 8, 13]) {
    line(g, ...P(50.5, 6.3, z + .5), ...P(60.5, 6.3, z + .5), '#49312b');
    line(g, ...P(50.5, 6.3, z + 3.4), ...P(60.5, 6.3, z + 3.4), '#a47650');
  }
  // A scalloped runner and tiny botanical labels on each drawer.
  box(g, 50, 1, 19.6, 11, 4.5, .2, flat('#586d61', '#3f5149', '#47584c'));
  for (const a of [50, 53, 56, 59]) line(g, ...P(a, 5.7, 19.7), ...P(a, 6.1, 18.5), '#c0a77c');
  for (const z of [5, 10, 15]) box(g, 54, 6.3, z, 3, .15, 1, pages);
  store(68);

  // Velvet chaise beneath the window, with cushions and an abandoned shawl.
  for (const b of [18, 34]) box(g, 1, b, 0, 5, 1, 3, woodD);
  box(g, 1, 17, 3, 6, 19, 3, wood);
  box(g, 1, 17, 6, 6, 19, 3, flat('#795571', '#4d344e', '#60435f'));
  box(g, 1, 17, 9, 1.3, 19, 8, flat('#87657f', '#49344d', '#67495f'));
  for (const b of [18, 31]) box(g, 2, b, 9, 4, 3, 2, flat('#b39a71', '#806045', '#927456'));
  box(g, 3, 26, 9, 4, 4, .5, flat('#557e75', '#36524d', '#47645b'));
  // Upholstery seams, brass tacks and woven threads in the shawl.
  for (const b of [22, 27, 32]) line(g, ...P(2.4, b, 9.1), ...P(6.5, b, 9.1), '#b18a9b');
  for (let b = 18; b < 36; b += 2) dot(g, ...P(7, b, 5), '#bb9b65');
  for (let b = 26; b < 30; b += .8) line(g, ...P(3, b, 9.6), ...P(7, b, 9.6), '#99ac90');
  // Rolled arms and carved feet make this a chaise, distinct from the desk chair.
  for (const b of [17, 34]) {
    box(g, 2, b, 9, 5, 1.5, 4, flat('#906c82','#573d56','#725168'));
    line(g, ...P(2, b + 1.5, 12.5), ...P(7, b + 1.5, 12.5), '#b3969c');
  }
  store(43);

  // Narrow correspondence table, loose parchment and a broken wax seal.
  for (const a of [71, 83]) for (const b of [20, 25]) box(g, a, b, 0, 1, 1, 12, woodD);
  box(g, 70, 19, 12, 15, 8, 2, wood);
  box(g, 73, 21, 14, 6, 3, .3, pages);
  line(g, ...P(74, 22, 14.4), ...P(77, 22, 14.4), '#866e53');
  box(g, 78, 23, 14.3, 1, 1, .3, flat('#ad515b', '#73313d', '#984650'));
  box(g, 81, 20, 14, 1.5, 1.5, 2, iron);
  // Loose quill, cup on a saucer and a second folded note.
  const [qx, qy] = P(81.5, 21, 16);
  line(g, qx, qy, qx + 5, qy - 9, '#e3dbc4');
  for (let i = 2; i < 8; i++) line(g, qx + i * .5, qy - i, qx + i * .5 + 2, qy - i - 1, '#b4bfbb');
  box(g, 71, 23, 14, 2, 2, .3, pages);
  const [cupX, cupY] = P(74, 20, 14.3);
  ell(g, cupX, cupY, 3, 1, '#c3b68e');
  rect(g, cupX - 1, cupY - 3, 3, 3, '#ded1ad');
  rect(g, cupX - 1, cupY - 3, 3, 1, '#674c3c');
  dot(g, cupX + 2, cupY - 2, '#baa376');
  // Cross stretcher, apron moulding and an inlaid edge on the writing table.
  box(g, 71, 24.9, 9, 13, .5, 2, woodD);
  box(g, 71, 22.3, 3, 13, .8, .8, woodD);
  line(g, ...P(70.5, 26.6, 14), ...P(84.5, 26.6, 14), '#c19b68');
  for (const a of [72, 82]) box(g, a, 25.5, 9, .7, .5, 3, gilding);
  store(112);

  // Travel trunk and folded blankets; the owner never packed them.
  drawStockContainer(g, 76, 44, 'chest');
  box(g, 73.5, 42, 8, 5, 3.5, 1.2, flat('#738b7d', '#3c5953', '#526d62'));
  // Leather straps, rivets and a tarnished lock on the travel trunk.
  for (const a of [74, 78]) {
    box(g, a, 42, 9.3, .6, 4, .3, flat('#b19762','#66503d','#927951'));
    for (const z of [2, 5]) dot(g, ...P(a, 46.1, z), '#cfb47d');
  }
  box(g, 75.4, 46.1, 3, 1.3, .3, 2, gilding);
  dot(g, ...P(76, 46.5, 4), '#302c33');
  store(124);
  drawAubertPlant(g, 6, 51, 0);
  store(63);

  // Distinct fern, flowering plant and climbing vine along the room edges.
  drawAubertPlant(g, 84, 68, 1);
  store(159);
  drawAubertPlant(g, 6, 61, 2);
  store(74);
  // A small herb pot on the window sill.
  drawAubertPlant(g, 2, 15, 2, 60);
  store(20);

  // Brass coat stand and Madame Aubert's plum-coloured cloak.
  box(g, 3, 75, 0, 6, 4, 1, woodD);
  box(g, 5.5, 76.5, 1, 1, 1, 27, gilding);
  for (const b of [75, 79]) box(g, 3, b, 24, 6, .6, .7, gilding);
  box(g, 3, 77, 6, 3.5, 1.2, 17, flat('#74506b', '#3f2a46', '#593c58'));
  line(g, ...P(4, 78.3, 7), ...P(4, 78.3, 21), '#a6856a');
  store(86);

  // tafel
  { const [tx, ty] = P(TABLE_A, TABLE_B, 0);
    ell(g, tx, ty - 1, 9, 4, '#3e2414'); ell(g, tx, ty - 2, 8, 3, '#5a3320');
    rect(g, tx - 1, ty - 18, 3, 16, '#5a3320'); rect(g, tx - 1, ty - 18, 1, 16, '#7a4a2a');
    ell(g, tx, ty - 17, 15, 7, '#4a2a16');
    ell(g, tx, ty - 19, 15, 7, '#b0723e'); ell(g, tx, ty - 19, 13, 6, '#94582e');
    // paars boek
    box(g, TABLE_A - 3.5, TABLE_B - 2.5, 19, 5, 4, 2.5, flat('#7a46ac', '#5a2e88', '#3f1f66'));
    // inktpot + veer
    box(g, TABLE_A + 2, TABLE_B + 1.5, 19, 2.5, 2.5, 3, flat('#3a4aa8', '#26307a', '#1a2258'));
    const [qx, qy] = P(TABLE_A + 3.2, TABLE_B + 2.7, 22);
    for (let i = 0; i < 12; i++) { dot(g, qx - i * .5, qy - i, '#f4f0e6'); if (i > 2 && i < 11) dot(g, qx - i * .5 - 1, qy - i, '#d6d1c4'); }
    dot(g, qx + 1, qy + 1, '#222'); }
  store(TABLE_A + TABLE_B, (t, dt) => { drawSlime(t); drawSparkles(t, dt); });
  furnishings.sort((a, b) => a.depth - b.depth);

}

/* ---------- outline-pass ---------- */
function outline(g, hex) {
  const id = g.getImageData(0, 0, W, H), d = id.data;
  const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 128;
  const pts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 128) continue;
    if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) pts.push(x, y);
  }
  g.fillStyle = hex;
  for (let i = 0; i < pts.length; i += 2) g.fillRect(pts[i], pts[i + 1], 1, 1);
}

const loadingScreen = document.getElementById('game-loading');
const loadingProgress = document.getElementById('game-loading-progress');
if (loadingProgress) loadingProgress.value = 1;

for (const [roomName, room] of Object.entries(rooms)) {
  const doorStyle = room.corridor || room === rooms.classroom ? doorStyles.library : doorStyles[roomName];
  const background = room.canvas.getContext('2d');
  buildStatic(background, room, doorStyle);
  outline(background, '#14183a');
  const frontExits = room.exits.filter(({ wallA, wallB }) => wallA > 0 || wallB > 0);
  if (frontExits.length || room === rooms.hall) {
    room.foreground = mk();
    const foreground = room.foreground.getContext('2d');
    if (room === rooms.hall) drawHallConnector(foreground, HALL_DEPTH - 2.5);
    for (const exit of frontExits) {
      if (exit.wallA > 0) drawSidePassage(foreground, exit, true, doorStyle);
      if (exit.wallB > 0) drawAcrossPassage(foreground, exit, doorStyle, true);
    }
  }
}
buildFront();
if (loadingProgress) loadingProgress.value = 2;

const libraryFurnishings = libraryLayout.map(([column, row, type]) => {
  const canvas = mk(), g = canvas.getContext('2d');
  const a = (column + .5) * TILE_SIZE, b = (row + .5) * TILE_SIZE;
  const wood = woodC('#9b6345'), darkWood = woodC('#673f2c');
  const seat = librarySeats.find(({ tile }) => tile[0] === column && tile[1] === row);
  if (type === 'reading chair') {
    const fabric = woodC('#895450'), cushion = woodC('#ac7161');
    box(g, a - 3.3, b - 3.3, 1, 6.6, 6.6, 6, fabric);
    box(g, a - 2.45, b - 2.5, 6, 4.9, 5, 1.5, cushion);
    box(g, a - 3, b - 3.3, 6, 6, 1.9, 12, fabric);
    for (const side of [-3.3, 2]) {
      box(g, a + side, b - 2.5, 7, 1.3, 5.6, 3, cushion);
    }
    line(g, ...P(a - 2.7, b - 1.4, 17), ...P(a + 2.7, b - 1.4, 17), '#c29270');
  } else if (type === 'tea table') {
    box(g, a - 1, b - 1, 0, 2, 2, 7, darkWood);
    box(g, a - 2.6, b - 2.6, 7, 5.2, 5.2, 1.4, wood);
    box(g, a - 1.9, b, 8.4, 2.1, 1.9, .75, flat('#ae9eb8', '#634d70', '#543b5e'));
    const [x, y] = P(a + 1, b - 1.2, 8.4);
    ell(g, x, y, 3, 1, '#d1b99e');
    rect(g, x - 1, y - 3, 3, 3, '#ddc6af');
    dot(g, x + 2, y - 2, '#ddc6af');
    dot(g, x, y - 3, '#785349');
  } else if (type === 'chair') {
    for (const da of [-2, 1.4]) for (const db of [-2, 1.4]) {
      box(g, a + da, b + db, 0, .65, .65, 6, darkWood);
    }
    box(g, a - 2.2, b - 2.2, 6, 4.4, 4.4, 1.4, wood);
    const backB = b + (seat?.direction === 'sw' ? -2.2 : 1.5);
    const fabric = flat('#648072', '#3e514b', '#4d655a');
    box(g, a - 1.8, b - 1.8, 7.4, 3.6, 3.6, .65, fabric);
    box(g, a - 2.2, backB, 7, .75, .75, 8, darkWood);
    box(g, a + 1.45, backB, 7, .75, .75, 8, darkWood);
    box(g, a - 1.65, backB, 10, 3.3, .75, 3.5, fabric);
    box(g, a - 2.3, backB - .1, 14, 4.6, .95, 1, wood);
    for (const rail of [-1.5, 1.5]) dot(g, ...P(a + rail, backB + .6, 14.4), '#c49965');
  } else {
    box(g, a - 2, b - 2, 0, 4, 4, 5, flat('#986644', '#653f36', '#75473a'));
    const [x, y] = P(a, b, 5);
    ell(g, x, y - 6, 5, 6, '#2c493b');
    ell(g, x - 3, y - 8, 3, 4, '#608353');
    ell(g, x + 2, y - 5, 3, 4, '#446a49');
  }
  outline(g, '#241d27');
  const animate = seat ? t => drawSeatedWizard(t, seat) : type === 'tea table' ? t => {
    const [x, y] = P(a + 1, b - 1.2, 8.4);
    const age = (t * .6) % 1;
    ctx.globalAlpha = Math.sin(age * Math.PI) * .6;
    dot(ctx, x + Math.sin(t * 3), y - 5 - age * 6, '#f0e7da');
    ctx.globalAlpha = 1;
  } : null;
  return { canvas, depth: a + b, animate };
}).sort((a, b) => a.depth - b.depth);

for (const [column, row] of studyTables) {
  const canvas = mk(), g = canvas.getContext('2d');
  const a = (column + 1.5) * TILE_SIZE, b = (row + .5) * TILE_SIZE;
  const wood = woodC('#a56b48'), darkWood = woodC('#673d2d');
  for (const legA of [-10, 9]) for (const legB of [-2.6, 1.5]) {
    box(g, a + legA, b + legB, 0, 1.3, 1.3, 13, darkWood);
  }
  box(g, a - 10.5, b - 2.8, 10, 21, 5.6, 3, darkWood);
  box(g, a - 11.5, b - 3.5, 13, 23, 7, 2, wood);
  line(g, ...P(a - 11, b + 3.4, 15), ...P(a + 11, b + 3.4, 15), '#cc9766');
  line(g, ...P(a - 10.5, b + 3.51, 13.8), ...P(a + 10.5, b + 3.51, 13.8), '#794a36');
  for (const [from, to, across] of [[-10, -5, -2.1], [-4, 3, 2.7], [3, 10, -2.6], [6, 10, 1.9]]) {
    line(g, ...P(a + from, b + across, 15.05), ...P(a + to, b + across, 15.05), '#8b563b');
  }
  for (const offset of [-9.4, 9.4]) {
    dot(g, ...P(a + offset, b + 3.55, 14), '#d2a068');
    box(g, a + offset - .35, b + 1.6, 1, 1.5, 1.4, 1.1, darkWood);
  }

  for (const [offset, side] of [[-8, -1], [-5, 1], [6, -1], [8.5, 1]]) {
    const bookB = b + side * 1.3 - 1;
    const cover = side < 0 ? '#4e695c' : '#784957';
    box(g, a + offset - 1.7, bookB, 15, 3.5, 2, .5, flat(cover, '#50332e', '#604339'));
    box(g, a + offset - 1.5, bookB + .15, 15.5, 3.1, 1.7, .6, flat('#dbc69a', '#9a7858', '#bda17a'));
    line(g, ...P(a + offset, bookB + .2, 16.1), ...P(a + offset, bookB + 1.75, 16.1), '#877252');
  }
  const [x, y] = P(a, b, 15);
  ell(g, x, y, 4, 2, '#a27b4f');
  rect(g, x - 1, y - 9, 3, 8, '#a47742');
  line(g, x - 5, y - 8, x + 5, y - 8, '#bd9256');
  for (const arm of [-5, 5]) {
    ell(g, x + arm, y - 9, 4, 2, '#57796a');
    rect(g, x + arm - 2, y - 9, 5, 2, '#fff0bb');
  }
  outline(g, '#241d27');
  libraryFurnishings.push({ canvas, depth: a + b, animate: t => {
    glow(x, y - 7, 16, 10, '255,198,107', .14 + .018 * Math.sin(t * 1.6 + a + b));
  } });
}

function drawLibraryPortrait(t) {
  const blink = t % 5.1 > 4.94;
  const glance = Math.floor(t / 2.8) % 3 - 1;
  wallR(ctx, 0, 56, 88, 50, 94, (u, z) => {
    const x = u - 56, y = 93 - z;
    const edge = Math.min(x, 31 - x, y, 43 - y);
    if (edge === 0) return '#382538';
    if (edge === 1 || edge === 3) return x < 16 ? '#f1cf83' : '#a97542';
    if (edge === 2) return '#8a5939';

    if (y >= 15 && y <= 17 && x >= 6 && x <= 25) return y === 15 ? '#80618c' : '#342843';
    // Schouders, blonde lokken en het gezicht onder de hoed.
    if (y >= 32 && Math.abs(x - 16) < (y - 29) * 1.2) {
      if (y === 35 && Math.abs(x - 16) <= 1) return '#86ddf2';
      return x < 16 ? '#744d82' : '#503658';
    }
    if (y >= 15 && y <= 35 && Math.abs(x - 16) <= (y > 31 ? 7 : 9)) {
      const faceWidth = y < 20 ? 4 : y > 28 ? 4 : 6;
      if (y >= 17 && y <= 30 && Math.abs(x - 16) <= faceWidth) {
        if (y === 23 && (Math.abs(x - 12) <= 1 || Math.abs(x - 20) <= 1)) {
          if (blink) return '#845966';
          return x === 12 + glance || x === 20 + glance ? '#347ec5' : '#e8f6ff';
        }
        if (y === 28 && x >= 15 && x <= 17) return '#a95668';
        return x > 18 ? '#cf9984' : '#f4bd9b';
      }
      return (x + Math.floor(y / 4)) % 4 === 0 ? '#fff0a6' : x < 16 ? '#d6a553' : '#b98446';
    }
    if (y >= 6 && y <= 16 && Math.abs(x - 15) <= Math.floor((y - 4) * .67)) {
      return y >= 13 ? '#9d638d' : x < 15 ? '#624977' : '#443452';
    }

    if (hash(x, y) > .98) return '#8b748b';
    return '#322b48';
  });
}

const hallLanterns = [[3, 26.5], [3, 57], [3, 86.5]];
const firstHallLanterns = hallLanterns.filter(([, b]) => b !== 57);

function drawLibraryLights(t, lanterns = libraryLanterns) {
  for (const [a, b] of lanterns) {
    const [x, y] = P(a, b, 72);
    line(ctx, x, y - 37, x, y - 6, '#443139');
    glow(x, y, 29, 26, '255,189,100', .085 + .015 * Math.sin(t * 1.4 + a));
    ell(ctx, x, y, 6, 6, '#684a3a');
    ell(ctx, x, y, 5, 5, '#d48e4d');
    ell(ctx, x - 1, y, 3, 4, '#ffe5a6');
    dot(ctx, x - 1, y + 1, '#fff5d9');
    line(ctx, x + 2, y - 4, x + 2, y + 4, '#a87349');
    rect(ctx, x - 3, y - 7, 6, 2, '#9e7150');
    rect(ctx, x - 3, y + 5, 6, 2, '#835638');
  }
}

/* ---------- animaties ---------- */
// Zelfde herfstlucht als in het leesraam en de potionkamer.
function drawSky() {
  wallL(ctx, 0, 26, 62, 30, 94, (u, z) => towerWindowGlass(u, z) ? autumnSunset(u + 1, (z - 30) / 64) : null);
}

function windowPixels(paint, start, bottom, inGlass) {
  return (column, level, color) => {
    const u = start + Math.round(column), z = bottom + Math.round(level);
    if (inGlass(u, z)) paint(ctx, 0, u, u + 1, z, z + 1, () => color);
  };
}

function drawWindowBirds(t, pixel, width, height, seed) {
  const clock = t + seed * 2.7;
  const cycle = Math.floor(clock / 13);
  const flight = (clock % 13 - 2 - 4 * hash(cycle, seed)) / ((width + 16) / 16.5);
  if (flight >= 0 && flight <= 1) {
    const direction = hash(cycle, seed + 1) > .5 ? 1 : -1;
    const x = (direction > 0 ? flight : 1 - flight) * (width + 16) - 8;
    const y = height * (.55 + hash(cycle, seed + 2) * .22) + Math.sin(flight * Math.PI) * 3;
    const count = hash(cycle, seed + 3) > .46 ? 3 : 1;
    for (let bird = 0; bird < count; bird++) {
      const bx = x - bird * 6 * direction, by = y + bird % 2 * 3;
      const wing = Math.floor(t * 7 + bird) % 2 ? 1 : -1;
      pixel(bx, by, '#49374e');
      pixel(bx - 1, by + wing, '#49374e');
      pixel(bx + 1, by + wing, '#49374e');
    }
  }

}

function drawWindowLeaves(t, pixel, width, height, seed) {
  const clock = t + seed * 2.7;
  const colors = ['#d88a45', '#eeae62', '#b95743'];
  for (let leaf = 0; leaf < 3; leaf++) {
    const time = clock + leaf * 2.19;
    const drift = (time % 7.6) / 5.6;
    if (drift >= 1) continue;
    const x = (width - 1) * hash(Math.floor(time / 7.6) + leaf, seed + 9)
      + Math.sin(drift * 9 + leaf) * 3 + drift * 5;
    const y = height * (1 - drift);
    const color = colors[leaf];
    pixel(x, y, color);
    if (Math.floor(time * 5) % 2) pixel(x + 1, y + 1, color);
  }
}

function drawRoomWindowLife(t) {
  if (currentRoom.corridor) {
    const pixel = windowPixels(wallL, 0, hallWindowBase, hallWindowGlass);
    drawWindowBirds(t, pixel, HALL_DEPTH * 2, 67, 5);
    for (const [index, center] of hallWindows.entries()) {
      drawWindowLeaves(t, (x, y, color) => pixel(center - 13 + x, y, color), 27, 67, 6 + index);
    }
  } else if (currentRoom === rooms.tower) {
    const pixel = windowPixels(wallL, 26, 60, towerWindowGlass);
    drawWindowBirds(t, pixel, 36, 34, 1);
    drawWindowLeaves(t, pixel, 36, 34, 1);
  } else if (currentRoom === rooms.library) {
    const pixel = windowPixels(wallL, 70, 31, readingWindowGlass);
    drawWindowBirds(t, pixel, 35, 53, 2);
    drawWindowLeaves(t, pixel, 35, 53, 2);
  } else if (currentRoom === rooms.potion) {
    const [left, right] = potionWindowCenters;
    const bottom = potionWindowBase + 3;
    const inPane = (u, z, center) => {
      const x = u - center, y = z - potionWindowBase;
      return y >= 3 && potionWindowArch(x, y) <= potionGlassRadius && !potionWindowCross(x, y);
    };
    // Eén vlucht in muurcoördinaten. Het metselwerk tussen de ramen verbergt de vogels.
    const birdPixel = windowPixels(wallR, left - potionGlassRadius, bottom,
      (u, z) => potionWindowCenters.some(center => inPane(u, z, center)));
    drawWindowBirds(t, birdPixel, right - left + 2 * potionGlassRadius + 1, 46, 3);

    for (const [index, center] of potionWindowCenters.entries()) {
      const leafPixel = windowPixels(wallR, center - potionGlassRadius, bottom,
        (u, z) => inPane(u, z, center));
      drawWindowLeaves(t, leafPixel, 2 * potionGlassRadius + 1, 46, 3 + index);
    }
  }
}

// banieren
function banner(t, u0, w, phase) {
  const zt = 99, zb = 67;
  for (let u = u0 - 1; u < u0 + w + 1; u++) { pxR(ctx, u, zt + 1, '#3a2414'); pxR(ctx, u, zt, '#6b4224'); }
  for (let z = zt - 1; z >= zb; z--) {
    const k = (zt - z) / (zt - zb), sw = Math.round(Math.sin(t * 1.7 + phase + k * 1.6) * k * 1.8);
    for (let u = 0; u < w; u++) {
      const zbot = zb + Math.round((w / 2 - Math.abs(u + .5 - w / 2)) * .9);
      if (z < zbot) continue;
      let c = u < 2 || u >= w - 2 ? '#a38a5d' : u % 5 === 0 ? '#586d62' : '#4e645a';
      if (z === zt - 5) c = '#b69a66';
      if (z === zbot) c = '#91805b';
      pxR(ctx, u0 + u + sw, z, c);
    }
    // maansikkel
    if (z >= zt - 20 && z <= zt - 14) {
      const m = u0 + Math.floor(w / 2) + sw, dz = z - (zt - 17);
      for (let du = -3; du <= 3; du++) if (du * du + dz * dz <= 9 && (du - 1) * (du - 1) + dz * dz > 5) pxR(ctx, m + du, z, '#d9be84');
    }
  }
}

// vuur
const sparks = [];
let hearthLit = true;
let hearthSteam = 0;

// Use the actual stream segment, so facing away or casting elsewhere cannot toggle the hearth.
function streamHitsHearth(a, b, da, db, reach) {
  if (currentRoom !== rooms.tower || db >= 0 || b < 0) return false;
  const distance = Math.max(0, (b - 4) / -db);
  if (distance > reach) return false;
  const hitA = a + da * distance;
  return hitA >= 15 && hitA <= 27;
}
function setHearthLit(lit) {
  if (hearthLit === lit) return;
  hearthLit = lit;
  sparks.length = 0;
  hearthSteam = lit ? 0 : .9;
}
function drawFire(t, dt) {
  // houtblokken
  for (let u = 33; u < 52; u++) for (let z = 2; z < 5; z++) pxR(ctx, u, z, (z === 4 ? '#6b3b1f' : '#4b2a18'));
  for (let u = 36; u < 49; u++) pxR(ctx, u, 5, '#3b2012');
  if (!hearthLit) {
    if (hearthSteam > 0) {
      hearthSteam = Math.max(0, hearthSteam - dt);
      ctx.save();
      ctx.globalAlpha = hearthSteam * .45;
      for (let i = 0; i < 5; i++) {
        const [x, y] = P(17 + i * 2, 1, 8 + (1 - hearthSteam) * 17);
        rect(ctx, x - 2, y - i % 2 * 3, 5, 2, '#b7c6cc');
      }
      ctx.restore();
    }
    return;
  }
  for (let u = 32; u <= 52; u++) {
    const d = (u - 42) / 11, env = Math.max(0, 1 - d * d);
    const n = (Math.sin(u * .9 + t * 9) + Math.sin(u * .37 - t * 7.3) + Math.sin(u * 1.7 + t * 13.1)) / 3;
    const h = Math.round(env * (19 + 4 * n) + 2 * Math.sin(t * 20 + u));
    for (let z = 0; z < h; z++) {
      const rel = z / h;
      pxR(ctx, u, z + 4, rel < .25 ? '#fff4b0' : rel < .5 ? '#ffc83a' : rel < .78 ? '#f58a22' : '#d8441c');
    }
  }
  for (let u = 34; u < 51; u++) if (hash(u, Math.floor(t * 6)) > .6) pxR(ctx, u, 3, '#ff5a1e');
  if (Math.random() < dt * 14) sparks.push({ u: 36 + Math.random() * 12, z: 14, vz: 14 + Math.random() * 12, vu: (Math.random() - .5) * 6, l: 1 });
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.z += s.vz * dt; s.u += s.vu * dt; s.l -= dt * 1.2;
    if (s.l <= 0 || s.z > 38 || fireOpen(Math.round(s.u), Math.round(s.z)) === false) { sparks.splice(i, 1); continue; }
    pxR(ctx, Math.round(s.u), Math.round(s.z), s.l > .5 ? '#ffd060' : '#ff7a2a');
  }
}

// portret-ogen
function drawPortrait(t) {
  const ph = t % 3.7, blink = ph > 3.55;
  const flash = (t % 9.3) > 8.7;
  const look = (Math.floor(t / 2.5) % 3) - 1;
  for (const eu of [40, 44]) {
    const u = eu + (look > 0 ? 0 : 0);
    if (blink) pxR(ctx, u, 78, '#b88660');
    else {
      pxR(ctx, u, 78, flash ? '#ffffff' : '#e8fff6'); pxR(ctx, u + (look > 0 ? 1 : 0), 78, flash ? '#7fffd4' : '#2a9a7a');
      if (flash) { pxR(ctx, u, 79, '#7fffd4'); pxR(ctx, u, 77, '#7fffd4'); }
    }
  }
  if (!blink) { pxR(ctx, 41, 79, '#4a3220'); pxR(ctx, 43, 79, '#4a3220'); }
}

// vlammetjes, bubbels, dieren, deeltjes
function flame(x, y, t, seed) {
  const sw = Math.round(Math.sin(t * 9 + seed * 3)), tall = Math.sin(t * 13 + seed) > 0;
  dot(ctx, x, y, '#fff0a0'); dot(ctx, x, y - 1, '#ffe27a');
  dot(ctx, x + sw, y - 2, '#ffb030'); if (tall) dot(ctx, x + sw, y - 3, '#ff7a20');
}
const CAT_PERCHES = [[2.6, 25.5, 60], [3.5, 39, 70], [3.5, 45, 46], [3.5, 39, 70]];
const CAT_REST = 7, CAT_JUMP = .8;
const CAT_FUR = '#14141f', CAT_LIGHT = '#363655', CAT_PAW = '#28283b';

function drawJumpingCat(x, y, direction, progress) {
  const tuck = Math.sin(Math.PI * progress);
  const reach = Math.round(3 * progress);
  const legY = y - 2 - Math.round(2 * tuck);
  const frontX = x + direction * (5 + reach);
  const rearX = x - direction * (7 - Math.round(3 * tuck));
  const headX = x + 7 * direction;

  // Achterste poten verdwijnen gedeeltelijk achter de romp.
  ell(ctx, frontX - 2 * direction, legY - 1, 2, 1, CAT_PAW);
  ell(ctx, rearX + 2 * direction, legY - 1, 2, 1, CAT_PAW);
  for (let i = 0; i < 8; i++) {
    ell(ctx, x - (6 + i) * direction, y - 5 - Math.round(i * .55), 1, 1, CAT_FUR);
  }
  ell(ctx, x, y - 5, 8, 4, CAT_FUR);
  ell(ctx, x - direction, y - 7, 5, 1, CAT_LIGHT);

  // De voorpoten strekken uit bij de landing, de achterpoten trekken in.
  ell(ctx, frontX - direction, legY - 1, 2, 2, CAT_FUR);
  ell(ctx, rearX + direction, legY - 1, 2, 2, CAT_FUR);
  ell(ctx, frontX, legY, 2, 1, CAT_PAW);
  ell(ctx, rearX, legY, 2, 1, CAT_PAW);
  dot(ctx, frontX + direction, legY, CAT_LIGHT);
  dot(ctx, rearX + direction, legY, CAT_LIGHT);

  ell(ctx, headX, y - 9, 4, 3, CAT_FUR);
  rect(ctx, headX - 2, y - 14, 2, 4, CAT_FUR);
  rect(ctx, headX + 1, y - 13, 2, 3, CAT_FUR);
  dot(ctx, headX - 1, y - 13, '#a65b73');
  dot(ctx, headX + direction, y - 10, '#ffd23a');
}


function drawCat(t) {
  const interval = CAT_REST + CAT_JUMP;
  const index = Math.floor(t / interval) % CAT_PERCHES.length;
  const from = CAT_PERCHES[index], to = CAT_PERCHES[(index + 1) % CAT_PERCHES.length];
  const progress = Math.max(0, (t % interval - CAT_REST) / CAT_JUMP);
  const position = from.map((coordinate, axis) => coordinate + (to[axis] - coordinate) * progress);
  position[2] += 15 * Math.sin(Math.PI * progress);
  const [bx, by] = P(...position);
  if (progress > 0) {
    drawJumpingCat(bx, by, to[1] > from[1] ? -1 : 1, progress);
    return;
  }
  drawRestingCat(t, bx, by, '#ffd23a');
}

function drawRestingCat(t, bx, by, eyes) {
  const k = CAT_FUR, k2 = CAT_LIGHT;
  // staart
  for (let i = 0; i < 10; i++) { const x = bx + 5 + i * .8, y = by - 2 - Math.sin(i * .45 + t * 2.4) * (1 + i * .25); rect(ctx, x, y, 2, 2, k); }
  ell(ctx, bx, by - 5, 5, 5, k);
  ell(ctx, bx + 2, by - 6, 2, 3, k2);
  for (const offset of [-2, 2]) {
    ell(ctx, bx + offset, by - 2, 1, 2, CAT_PAW);
    ell(ctx, bx + offset, by - 1, 2, 1, CAT_PAW);
    dot(ctx, bx + offset, by - 1, k2);
  }
  drawCatHead(t, bx, by, eyes);
}

function drawCatHead(t, bx, by, eyes) {
  const k = CAT_FUR, k2 = CAT_LIGHT;
  rect(ctx, bx - 4, by - 16, 8, 7, k);
  rect(ctx, bx - 4, by - 18, 2, 2, k); rect(ctx, bx + 2, by - 18, 2, 2, k);
  rect(ctx, bx - 4, by - 16, 8, 1, k2);
  dot(ctx, bx - 3, by - 17, '#a65b73'); dot(ctx, bx + 3, by - 17, '#a65b73');
  const blink = (t % 4.6) > 4.45;
  if (blink) { rect(ctx, bx - 3, by - 13, 2, 1, '#3a3a50'); rect(ctx, bx + 1, by - 13, 2, 1, '#3a3a50'); }
  else { rect(ctx, bx - 3, by - 14, 2, 2, eyes); rect(ctx, bx + 1, by - 14, 2, 2, eyes); dot(ctx, bx - 2, by - 14, '#111'); dot(ctx, bx + 2, by - 14, '#111'); }
  dot(ctx, bx, by - 11, '#7a3a4a');
}
function drawDiamond(t) {
  const [x, y] = P(4, TOWER_DIAMOND_B, 16);
  const facet = (color, points) => {
    ctx.beginPath();
    ctx.moveTo(x + points[0][0], y + points[0][1]);
    for (const [dx, dy] of points.slice(1)) ctx.lineTo(x + dx, y + dy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  facet('#102c46', [[-7,-8],[-4,-13],[4,-13],[7,-8],[0,1]]);
  facet('#bbf5ff', [[-6,-8],[-4,-12],[4,-12],[6,-8]]);
  facet('#6cc2e8', [[-6,-8],[-2,-8],[0,0]]);
  facet('#3281b5', [[2,-8],[6,-8],[0,0]]);
  facet('#9bdef6', [[-2,-8],[2,-8],[0,0]]);
  line(ctx, x - 6, y - 8, x + 6, y - 8, '#e1faff');
  const sparkles = [[-8, -5, .5], [7, -13, 1.1], [3, -17, 1.7], [-5, -16, 2.3]];
  for (const [dx, dy, delay] of sparkles) {
    const phase = (t + delay) % 3.2 / .65;
    if (phase >= 1) continue;
    ctx.globalAlpha = Math.sin(Math.PI * phase);
    const sy = y + dy - Math.round(2 * phase);
    dot(ctx, x + dx, sy, '#effdff');
    if (phase > .3 && phase < .7) {
      dot(ctx, x + dx + 1, sy, '#79c6ef');
      dot(ctx, x + dx, sy - 1, '#79c6ef');
    }
  }
  ctx.globalAlpha = 1;
  const pulse = t % 3.2 / .42;
  if (pulse < 1) {
    const sx = x + (Math.floor(t / 3.2) % 2 ? 4 : -3);
    ctx.globalAlpha = Math.sin(Math.PI * pulse);
    line(ctx, sx - 3, y - 11, sx + 3, y - 11, '#a8e9ff');
    line(ctx, sx, y - 14, sx, y - 8, '#a8e9ff');
    dot(ctx, sx, y - 11, '#ffffff');
    ctx.globalAlpha = 1;
  }
}

function drawChest(t, dt) {
  chestOpening = Math.max(0, Math.min(1, chestOpening + (chestInventory?.open ? dt : -dt) * 2.2));
  drawChestLid(t, towerChestA, towerChestB, chestOpening);
}

function drawChestBody(g, a, b, wood) {
  box(g, a - 4, b - 3, 0, 8, 6, 8, wood);
  box(g, a - 1, b + 2.5, 4, 2, 1, 4, flat('#dfbc68', '#a78040', '#c4974d'));
}

function drawStockChest(t, dt) {
  stockChestOpening = Math.max(0, Math.min(1, stockChestOpening + (chestInventory?.open ? dt : -dt) * 2.2));
  drawChestLid(t, stockChestA, stockChestB, stockChestOpening, true, window.CHEST_INVENTORY?.hasStockLoot());
}

function drawChestLid(t, a, b, progress, halfOpen = false, sparkling = true) {
  const opening = progress * progress * (3 - 2 * progress);
  const angle = opening * (halfOpen ? 1.18 : 1.7);
  const scale = halfOpen ? stockChestScale : 1;
  const project = (width, depth, height) => halfOpen
    ? P(a + depth * scale, b + width * scale, height * scale)
    : P(a + width, b + depth, height);
  const [x, y] = project(0, 0, 8);
  if (opening && sparkling) {
    const glow = ctx.createRadialGradient(x, y - 6, 1, x, y - 6, 44);
    glow.addColorStop(0, 'rgba(255, 235, 169, ' + .65 * opening + ')');
    glow.addColorStop(.4, 'rgba(255, 192, 75, ' + .3 * opening + ')');
    glow.addColorStop(1, 'rgba(255, 192, 75, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 44, y - 50, 88, 88);
  }

  if (opening) {
    const extentA = (halfOpen ? 3 : 4) * scale;
    const extentB = (halfOpen ? 4 : 3) * scale;
    topFace(ctx, 8 * scale, a - extentA, a + extentA, b - extentB, b + extentB, (u, v) => {
      if (Math.abs(u - a) > extentA - .5 || Math.abs(v - b) > extentB - .5) return '#e1a750';
      if (halfOpen) return '#563923';
      return opening > .4 ? '#fff4bd' : '#d8983f';
    });

  }

  // Het deksel draait om het scharnier langs de achterzijde van de kist.
  const lid = (offset, length, thickness = 0) => {
    // Schaal de vorm naar de buitenmaten van de bak (8 × 6).
    const span = length * 6 / 7;
    return project(
      -4 + offset * 8 / 9,
      -3 + span * Math.cos(angle) - thickness * Math.sin(angle),
      8 + span * Math.sin(angle) + thickness * Math.cos(angle)
    );
  };
  const face = (color, points) => {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const panel = (color, left, right, start, end) =>
    face(color, [lid(left, start), lid(right, start), lid(right, end), lid(left, end)]);

  const rim = [0, 1, 2.25, 3.5, 4.75, 6, 7];
  const arch = [1, 3.6, 5.2, 5.9, 5.2, 3.6, 1];
  const boards = [.88, 1.03, 1.24, 1.16, 1.02, .87].map(light => sh('#5a3320', light));
  const brass = ['#8c653a', '#b7864a', '#e4be76', '#d6a65f', '#ad7941', '#8b6037'];
  const curvedStrip = (color, left, right, i) => face(color, [
    lid(left, rim[i], arch[i]), lid(right, rim[i], arch[i]),
    lid(right, rim[i + 1], arch[i + 1]), lid(left, rim[i + 1], arch[i + 1])
  ]);

  if (angle < Math.atan(2)) {
    for (let i = 0; i < boards.length; i++) {
      curvedStrip(boards[i], 0, 9, i);
      for (const band of [.65, 7.3]) curvedStrip(brass[i], band, band + 1, i);
      if (i % 2 === 0) {
        for (const band of [1.15, 7.8]) dot(ctx, ...lid(band, rim[i], arch[i]), '#ffe2a2');
      }
    }
  } else {
    face('#62422d', [lid(9, 0), lid(9, 7), lid(9, 7, 1.5), lid(9, 0, 1.5)]);
    face('#ad7843', [lid(0, 7), lid(9, 7), lid(9, 7, 1.5), lid(0, 7, 1.5)]);
    panel('#63412c', 0, 9, 0, 7);
    panel('#b57841', .5, 8.5, .5, 3.3);
    panel('#ce9251', .5, 8.5, 3.6, 6.5);
    for (const strip of [1, 7]) {
      panel('#8e673e', strip, strip + 1, 0, 7);
      for (const end of [1, 6]) dot(ctx, ...lid(strip + .5, end), '#ffe3a0');
    }
    line(ctx, ...lid(0, 7, 1.5), ...lid(9, 7, 1.5), '#e3ae68');

  }
  face('#5a3320', [lid(9, 0), ...rim.map((length, i) => lid(9, length, arch[i])), lid(9, 7)]);
  for (let i = 0; i < boards.length; i++) {
    line(ctx, ...lid(9, rim[i], arch[i]), ...lid(9, rim[i + 1], arch[i + 1]), '#75472e');
  }
  if (!opening || !sparkling) return;

  for (let i = 0; i < (halfOpen ? 14 : 40); i++) {
    const age = (t * (.46 + hash(i, 9) * .3) + hash(i, 3)) % 1;
    const dx = (hash(i, 1) - .5) * (15 + 36 * age) + 2 * Math.sin(t * 2.5 + i);
    const dy = 3 + age * (27 + hash(i, 2) * 24) * (halfOpen ? .55 : 1);
    ctx.globalAlpha = opening * (1 - age * .85) * (.65 + .35 * Math.sin(t * 6 + i) ** 2);
    dot(ctx, x + dx, y - dy, i % 3 ? '#ffdc7a' : '#fffbdc');
    if (i % 9 === 0) {
      dot(ctx, x + dx - 1, y - dy, '#ffe49a');
      dot(ctx, x + dx, y - dy + 1, '#ffe49a');
    }
  }
  ctx.globalAlpha = 1;
}

function drawSlime(t) {
  const [sx, sy] = P(TABLE_A + 3.2, TABLE_B - 4, 19), s = Math.sin(t * 3), rx = Math.round(5.5 - s * .9), ry = Math.round(4 + s * .9);
  ell(ctx, sx, sy - ry + 1, rx, ry, '#e0559a'); ell(ctx, sx, sy - ry, rx - 1, ry - 1, '#ff7fbf');
  dot(ctx, sx - 2, sy - ry - 1, '#ffd0ea'); dot(ctx, sx - 1, sy - ry - 2, '#ffd0ea');
  dot(ctx, sx - 2, sy - ry + 1, '#3a1030'); dot(ctx, sx + 1, sy - ry + 1, '#3a1030');
}
const sparkles = [];
function drawSparkles(t, dt) {
  const [ox, oy] = P(TABLE_A - 1.5, TABLE_B - .5, 21.5);
  if (Math.random() < dt * 6) sparkles.push({ x: ox + (Math.random() - .5) * 8, y: oy, vx: (Math.random() - .5) * 4, vy: -(6 + Math.random() * 6), l: 1.4 + Math.random(), m: 0, c: ['#9ff', '#f9f', '#fff', '#fd6'][Math.floor(Math.random() * 4)] });
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i]; s.l -= dt; s.m += dt;
    if (s.l <= 0) { sparkles.splice(i, 1); continue; }
    s.x += s.vx * dt + Math.sin(s.m * 5 + i) * .15; s.y += s.vy * dt;
    ctx.globalAlpha = Math.min(1, s.l);
    dot(ctx, s.x, s.y, s.c);
    if (s.l > 1) { dot(ctx, s.x - 1, s.y, s.c); dot(ctx, s.x + 1, s.y, s.c); dot(ctx, s.x, s.y - 1, s.c); dot(ctx, s.x, s.y + 1, s.c); }
    ctx.globalAlpha = 1;
  }
}
function glow(x, y, rx, ry, rgb, a) {
  ctx.globalCompositeOperation = 'source-atop';
  for (const f of [1, .72, .45]) { ctx.fillStyle = 'rgba(' + rgb + ',' + a + ')'; ctx.beginPath(); ctx.ellipse(x, y, rx * f, ry * f, 0, 0, 6.2832); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
}

function drawFlaskGlint(g, x, y, t, phase, size = 1) {
  g.save();
  g.globalAlpha *= .85;
  for (let k = 0; k < 2; k++) {
    dot(g, x + (k ? size : -size), y - (2 + ((t * 4 + phase * 1.7 + k * 2.3) % 5)) * size, '#f4fff8');
  }
  g.restore();
}

function drawFlaskGlints(t) {
  flasks.forEach(({ x, y }, i) => drawFlaskGlint(ctx, x, y, t, i));
}

/* ---------- speelbare tovenaar ---------- */
const STEP_TIME = WIZARD.FRAMES.walk / WIZARD.FPS.walk;
// Rijen lopen over b, kolommen over a. X staat voor een meubel of de haard.
const towerFloor = Array.from({ length: TOWER_TILES }, () => Array(TOWER_TILES).fill('.'));
towerFloor[0].fill('X', 0, 4);
towerFloor[CHEST_TILE[1]][CHEST_TILE[0]] = 'X';
towerFloor[armchairSeat.tile[1]][armchairSeat.tile[0]] = 'X';
towerFloor[6].fill('X', 2, 5);
// Furniture footprints leave the central hearth approach and both doorway lanes open.
for (const [column, row] of [[6,0],[7,0],[0,2],[0,3],[0,4],[0,6],[0,9],[9,2],[10,2],[9,3],[10,3],[9,5],[10,8],[0,7]]) towerFloor[row][column] = 'X';
towerFloor[4][0] = 'X';
towerFloor[4][7] = 'X'; // Vrijstaande kandelaar.
towerFloor[Math.floor(TABLE_B / TILE_SIZE)].fill('X', TABLE_A / TILE_SIZE - 1, TABLE_A / TILE_SIZE + 1);
towerFloor[Math.floor(TOWER_DIAMOND_B / TILE_SIZE)][0] = 'X';
const libraryFloorMap = Array.from({ length: LIBRARY_ROWS }, () => Array(LIBRARY_COLUMNS).fill('.'));
for (let row = LIBRARY_OUTER_SHELF_TILE; row < LIBRARY_ROWS; row++) libraryFloorMap[row][0] = 'X';
for (let column = LIBRARY_OUTER_SHELF_TILE; column < LIBRARY_COLUMNS; column++) libraryFloorMap[0][column] = 'X';
for (const [a, b] of libraryLayout) libraryFloorMap[b][a] = 'X';
for (const [a, b] of studyTables) libraryFloorMap[b].fill('X', a, a + 3);
rooms.tower.floor = towerFloor;
rooms.library.floor = libraryFloorMap;
for (const room of [rooms.hall, rooms.hallEnd]) {
  room.floor = Array.from({ length: HALL_ROWS }, () => Array(HALL_COLUMNS).fill('.'));
}
rooms.hall.floor[2][0] = rooms.hall.floor[3][0] = 'X';
rooms.classroom.floor = Array.from({ length: CLASSROOM_ROWS }, () => Array(CLASSROOM_COLUMNS).fill('.'));
for (const row of classroomRows) for (const column of classroomBanks) {
  rooms.classroom.floor[row].fill('X', column, column + 4);
  rooms.classroom.floor[row + 1].fill('X', column, column + 4);
}
rooms.classroom.floor[0][0] = 'X'; // Owl perch
rooms.classroom.floor[0][Math.floor(TEACHER_CHAIR_A / TILE_SIZE)] = 'X';
rooms.classroom.floor[1].fill('X', 4, 8);
rooms.classroom.floor[2][10] = 'X';
rooms.classroom.floor[0][10] = rooms.classroom.floor[0][11] = 'X';
rooms.hallEnd.floor[6][0] = rooms.hallEnd.floor[7][0] = rooms.hallEnd.floor[9][0] = rooms.hallEnd.floor[11][0] = 'X';
// De boekenkasten, het flessenrek en de ketel nemen elk vloertegels in.
rooms.potion.floor = Array.from({ length: POTION_ROWS }, () => Array(POTION_COLUMNS).fill('.'));
for (const [first, end] of potionBookcases) {
  for (let row = Math.floor(first / 16); row <= Math.floor((end - 1) / 16); row++) rooms.potion.floor[row][0] = 'X';
}
for (let column = 2; column < 6; column++) rooms.potion.floor[0][column] = 'X';
for (const row of [3, 4]) for (const column of [7, 8]) rooms.potion.floor[row][column] = 'X';
rooms.potion.floor[6][4] = rooms.potion.floor[6][6] = 'X';
// Every extra piece registers the same footprint used by its drawing.
for (const [column, row, kind] of potionRoomProps) {
  rooms.potion.floor[row][column] = 'X';
  if (kind === 'station') rooms.potion.floor[row][column + 1] = 'X';
}
rooms.potion.floor[0][POTION_STOCK_DOOR_COLUMN] = '.';
rooms.potion.floor[POTION_DOOR_ROW][0] = '.';
rooms.stockroom.floor = Array.from({ length: STOCK_ROWS }, (_, row) =>
  Array(STOCK_COLUMNS).fill(row === 0 ? 'X' : '.'));
for (const [first, limit] of stockBookcases) {
  for (let row = first; row < limit; row++) rooms.stockroom.floor[row][0] = 'X';
}
for (const [a, b] of stockLayout) rooms.stockroom.floor[b][a] = 'X';
const stockFurnishings = stockLayout.map(([column, row, kind]) => {
  const canvas = mk();
  const a = (column + .5) * TILE_SIZE, b = (row + .5) * TILE_SIZE;
  drawStockContainer(canvas.getContext('2d'), a, b, kind);
  const isPageStack = column === pageStackTile[0] && row === pageStackTile[1];
  return { canvas, depth: a + b, animate: isPageStack ? drawMissingPage : undefined };
});
rooms.stockroom.floor[stockChestTile[1]][stockChestTile[0]] = 'X';
const stockChestCanvas = mk();
const stockChestContext = stockChestCanvas.getContext('2d');
box(stockChestContext, stockChestA - 3 * stockChestScale, stockChestB - 4 * stockChestScale,
  0, 6 * stockChestScale, 8 * stockChestScale, 8 * stockChestScale, woodC('#805037'));
box(stockChestContext, stockChestA + 2.5 * stockChestScale, stockChestB - stockChestScale,
  4 * stockChestScale, stockChestScale, 2 * stockChestScale, 4 * stockChestScale,
  flat('#dfbc68', '#a78040', '#c4974d'));
stockFurnishings.push({ canvas: stockChestCanvas, depth: stockChestA + stockChestB, animate: drawStockChest });
const workbenchCanvas = mk();
drawPotionWorkbench(workbenchCanvas.getContext('2d'));
const skeletonMage = new Image();
skeletonMage.src = 'assets/sprites/skeleton-mage.png';
const skeletonMageTile = [6, 6];
const [skeletonMageA, skeletonMageB] = skeletonMageTile.map(tile => (tile + .5) * TILE_SIZE);

function drawSkeletonMage(t) {
  if (!skeletonMage.naturalWidth) return;
  const [x, y] = P(skeletonMageA, skeletonMageB, 0);
  const width = skeletonMage.naturalWidth, height = skeletonMage.naturalHeight;
  const left = Math.round(x - width / 2), top = Math.round(y - height);
  ell(ctx, x, y, 7, 2, 'rgba(25,20,34,.42)');

  const headWidth = 23, headHeight = 21;
  const nod = Math.sin(t * 2.4) > .62 ? -1 : 0;
  ctx.drawImage(skeletonMage, 0, headHeight, width, height - headHeight,
    left, top + headHeight, width, height - headHeight);
  ctx.drawImage(skeletonMage, headWidth, 0, width - headWidth, headHeight,
    left + headWidth, top, width - headWidth, headHeight);
  ctx.drawImage(skeletonMage, 0, 0, headWidth, headHeight,
    left, top + nod, headWidth, headHeight);

  const eyeY = top + nod;
  dot(ctx, left + 14, eyeY + 16, '#8f263b');
  dot(ctx, left + 15, eyeY + 16, '#ff5159');
  dot(ctx, left + 18, eyeY + 14, '#ff5159');

  const flicker = Math.sin(t * 11) + .45 * Math.sin(t * 18);
  dot(ctx, left + 27, top + 11, flicker > 0 ? '#d1ffd9' : '#81edac');
  dot(ctx, left + 6, top + 35, flicker > -.3 ? '#c5f8b1' : '#81ba75');
  const ember = (t * 1.3) % 1;
  if (ember < .72) {
    ctx.save();
    ctx.globalAlpha = 1 - ember;
    dot(ctx, left + 28 + Math.sin(t * 6), top + 7 - ember * 5, '#9cf6bd');
    ctx.restore();
  }
}

const pumpkinA = 6.5 * TILE_SIZE, pumpkinB = .5 * TILE_SIZE;

const pumpkinPixels = [
  '............s......',
  '...........sbg.....',
  '..........sbg......',
  '.........gbg.......',
  '.........gg........',
  '.....dddrggrdd.....',
  '...ddrohhoorwrd....',
  '..dohhohwwwowrrd...',
  '.dohhroowwwowrrrd..',
  '.dhhorodhwoodwrrd..',
  'dohorodfddodfdwrrd.',
  'dohorofffdoffdwrrd.',
  'dohoowwwdfdwwwrrrd.',
  '.dohodwwofowwdrrd..',
  '.dorodfdfdfdfdrrd..',
  '..drrrdfffffdrrd...',
  '...ddrrdddddrrd....',
  '.....dddddddd......'
];
const pumpkinPalette = {
  s: '#c4cc82', b: '#829650', g: '#536043', d: '#572e39', r: '#a34830',
  w: '#c45b30', o: '#e27636', h: '#f49a52'
};

function drawPotionPumpkin(t) {
  const [x, y] = P(pumpkinA, pumpkinB, 0);
  const pulse = .5 + .32 * Math.sin(t * 2.4) + .1 * Math.sin(t * 4.8);
  ell(ctx, x, y, 9, 3, '#332938');
  glow(x, y - 2, 17, 9, '255,149,59', .035 + pulse * .025);
  const candle = `rgb(255,${Math.round(206 + 14 * pulse)},${Math.round(115 + 19 * pulse)})`;
  for (const [dy, row] of pumpkinPixels.entries()) {
    for (const [dx, pixel] of Array.from(row).entries()) {
      if (pixel === '.') continue;
      dot(ctx, x + dx - 9, y + dy - pumpkinPixels.length + 1, pixel === 'f' ? candle : pumpkinPalette[pixel]);
    }
  }
}

const alchemyBookcase = new Image();
alchemyBookcase.src = 'assets/sprites/alchemy-bookcase.png';
function drawAlchemyBookcase() {
  if (!alchemyBookcase.naturalWidth) return;
  const [x,y] = P(0,58,0);
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.drawImage(alchemyBookcase,Math.round(x),Math.round(y+3-96),36,96);
  ctx.restore();
}

const potionFurnishings = [
  {depth:61, animate:drawAlchemyBookcase},
  { depth: pumpkinA + pumpkinB, animate: drawPotionPumpkin },
  { depth: skeletonMageA + skeletonMageB, animate: drawSkeletonMage },
  { depth: workbenchA + workbenchB, canvas: workbenchCanvas, animate: t => { drawReturnedPage(t); const [x,y]=P(workbenchA+2.55,workbenchB+2.55,15.7); flame(x,y-1,t,12); } },
  { depth: cauldronA + cauldronB, animate: drawCauldron }
];
for (const [column, row, kind] of potionRoomProps) {
  const canvas = mk(), g = canvas.getContext('2d');
  const a = (column + .5) * TILE_SIZE, b = (row + .5) * TILE_SIZE;
  if (kind === 'station') drawPotionStation(g, a, b, column > 4);
  else if (kind === 'wash') {
    const stone=flat('#8c9390','#525f64','#687779');
    box(g,a-2.8,b-3,0,5.6,6,10,stone);
    box(g,a-3,b-3.2,10,6,6.4,1.5,stone);
    const [x,y]=P(a,b,11.5);
    ell(g,x,y,8,3,'#3d5763'); ell(g,x,y,6,2,'#709caa');
    line(g,x-5,y,x+2,y+1,'#afd6cf');
    line(g,...P(a+1,b-2,12),...P(a+1,b-2,18),'#b69a65');
    line(g,...P(a+1,b-2,18),...P(a-1,b-2,18),'#d4bb80');
    box(g,a-3,b+.8,11.6,2,2.5,.2,flat('#b7b2a0','#787c75','#969f90'));
    const [bx,by]=P(a,b+1.5,0);
    ell(g,bx,by-2,4,2,'#86664a'); rect(g,bx-3,by-6,6,4,'#9b7b51');
    ell(g,bx,by-6,4,2,'#c0a477'); ell(g,bx,by-6,2,1,'#526d75');
    line(g,bx-3,by-7,bx-2,by-11,'#625d50');
    line(g,bx-2,by-11,bx+2,by-11,'#bda16e');
    line(g,bx+2,by-11,bx+3,by-7,'#625d50');
  }
  else if (kind === 'cabinet') {
    const timber = woodC('#78523c'), brass = flat('#ba9a63','#765638','#977447');
    box(g, 0, b - 4, 0, 6, 8, 20, timber);
    box(g, 0, b - 4.3, 20, 6.5, 8.6, 1.5, timber);
    for (const level of [3, 9, 15]) {
      box(g, 6, b - 3.5, level, .3, 7, 4, woodC('#936b49'));
      box(g, 6.3, b - .7, level + 1, .3, 1.4, 1, brass);
    }
    for (const offset of [-2.3, 0, 2.3]) {
      const [jx,jy] = P(3,b+offset,21.5);
      flask(g,jx,jy,offset < 0 ? '#a6b890' : '#b19ab2','tube',null);
      rect(g,jx-1,jy-4,3,2,'#dec69d'); dot(g,jx,jy-3,'#806847');
    }
  }
  else if (kind === 'plant') drawAubertPlant(g, a, b, column > 4 ? 1 : 2);
  else drawStockContainer(g, a, b, kind);
  outline(g, '#0f1226');
  potionFurnishings.push({ canvas, depth: a + b + (kind === 'station' ? 7 : 0),
    animate: kind === 'station' || kind === 'wash' ? t => drawAlchemyDetails(t,a,b,kind,column>4) : undefined });
}
potionFurnishings.sort((a,b) => a.depth - b.depth);
let currentRoom = rooms.tower;
const currentFloor = () => currentRoom.floor;
const wizard = { a: 5, b: 5, direction: 'se', step: null };
const moves = new Map([
  ['arrowup', [0, -1, 'ne']], ['arrowright', [1, 0, 'se']],
  ['arrowdown', [0, 1, 'sw']], ['arrowleft', [-1, 0, 'nw']]
]);
const aliases = { w: 'arrowup', d: 'arrowright', s: 'arrowdown', a: 'arrowleft' };
const heldKeys = new Set();
let wandLight = false;
let wandLightFade = 0;
let waterHeld = false;
let waterCharge = 0;
let fireHeld = false;
let fireCharge = 0;
const chestInventory = document.getElementById('chest-inventory');
const loreScroll = document.getElementById('lore-scroll');
const teleportDialogue = document.getElementById('teleport-room-dialogue');
let requestedSeat = null, activeSeat = null;
let requestedChest = false;
let seatProgress = 0;
let route = [];
let destination = null;
const isWalkable = (a, b) => currentFloor()[b]?.[a] === '.' &&
  (currentRoom !== rooms.potion || a !== POTION_STOCK_DOOR_COLUMN || b !== 0 || isStockroomUnlocked());

const questDialogue = document.getElementById('quest-dialogue');
const resetQuestDialogue = document.getElementById('reset-quest-dialogue');
const resetQuestChoice = document.getElementById('reset-quest-choice');
const questObjective = document.getElementById('quest-objective');
const questManager = preview ? null : createQuestManager(QUEST_DEFINITIONS, {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value)
});
const cauldronQuest = preview ? null : QUEST_DEFINITIONS.find(quest => quest.id === CAULDRON_QUEST);
const pageQuest = preview ? null : QUEST_DEFINITIONS.find(quest => quest.id === PAGE_QUEST);
const searchBookStack = document.getElementById('search-book-stack');
let cauldronHeat = 0;
let cauldronWarmup = isCauldronLit() ? 1 : 0;
let dialogueQuest = null;

function isStockroomUnlocked() {
  const stage = questManager?.status(pageQuest);
  return stage === 'active' || stage === 'ready' || stage === 'complete';
}

function isCauldronLit() {
  const stage = questManager?.status(cauldronQuest);
  return stage === 'ready' || stage === 'complete';
}

function questContext() {
  return { hasWand: document.getElementById('hotbar')?.dataset.hasWand === 'true' };
}

function trackedQuest() {
  return QUEST_DEFINITIONS.find(quest => ['active', 'ready'].includes(questManager.status(quest)));
}

function renderQuestObjective() {
  if (!questObjective) return;
  const quest = trackedQuest();
  const objective = quest && (questManager.status(quest) === 'ready' ? quest.returnTo : quest.objective(questContext()));
  questObjective.hidden = !objective;
  if (objective) questObjective.textContent = `${quest.title} · ${objective}`;
  const labels = { available: 'Available', active: 'In progress', ready: 'Ready to turn in', complete: 'Completed' };
  const entries = QUEST_DEFINITIONS.flatMap(item => {
    const status = questManager.status(item);
    if (status === 'locked') return [];
    const row = document.createElement('li');
    row.textContent = `${item.title} · ${labels[status]}`;
    return [row];
  });
  document.getElementById('quest-log-entries').replaceChildren(...entries);
}

const dialogueTyping = new WeakMap();

const dialoguePages = new WeakMap();
function typeDialogue(element, text, panel, onComplete) {
  dialoguePages.get(element)?.();
  dialogueTyping.get(element)?.();
  const copy = element.closest('.npc-dialogue-copy');
  const controls = [...copy.children].filter(child => child !== element && child.tagName !== 'H2');
  const saved = controls.map(child => [child, child.hidden]);
  const next = document.createElement('button');
  next.type = 'button'; next.className = 'dialogue-page-next'; next.textContent = 'Next';
  copy.append(next);
  let remaining = text, currentStop;
  const restore = () => { for (const [child, hidden] of saved) child.hidden = hidden; };
  const cleanup = () => { currentStop?.(); next.remove(); restore(); dialoguePages.delete(element); };
  dialoguePages.set(element, cleanup);
  function showPage() {
    for (const [child] of saved) child.hidden = true;
    next.hidden = false;
    // Measure complete words against two lines; prefer a sentence boundary when possible.
    const style = getComputedStyle(element);
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = style.font || `${style.fontSize} ${style.fontFamily}`;
    const width = Math.max(40, element.clientWidth || copy.clientWidth - 32);
    const words = remaining.match(/\S+\s*/g) || [''];
    let line = '', lines = 1, used = 0, sentenceEnd = 0;
    for (const word of words) {
      if (measure.measureText(line + word.trimEnd()).width > width && line) {
        lines++; line = '';
      }
      if (lines > 2 && used) break;
      line += word; used += word.length;
      if (/[.!?]["’']?\s*$/.test(word)) sentenceEnd = used;
    }
    if (used < remaining.length && sentenceEnd > 0) used = sentenceEnd;
    const page = remaining.slice(0, Math.max(1, used)).trim();
    remaining = remaining.slice(Math.max(1, used)).trimStart();
    const last = !remaining;
    next.hidden = last;
    next.onclick = () => {
      dialogueTyping.get(element)?.();
      showPage();
    };
    typeDialoguePage(element, page, panel, last ? onComplete : undefined, () => {
      if (last) { next.remove(); restore(); }
    });
    currentStop = dialogueTyping.get(element);
  }
  showPage();
}

function typeDialoguePage(element, text, panel, onComplete, onFinish) {
  dialogueTyping.get(element)?.();
  const characters = Array.from(text);
  let timer, position = 0;
  const stop = () => {
    clearTimeout(timer);
    element.textContent = text;
    element.removeAttribute('aria-label');
    dialogueTyping.delete(element);
  };
  dialogueTyping.set(element, stop);
  element.setAttribute('aria-label', text);
  element.textContent = '';
  const tick = () => {
    if (panel.hidden || (panel.tagName === 'DIALOG' && !panel.open) ||
        matchMedia('(prefers-reduced-motion: reduce)').matches || position >= characters.length) {
      const finished = !panel.hidden && (panel.tagName !== 'DIALOG' || panel.open);
      stop();
      if (finished && onFinish) onFinish();
      if (finished && onComplete) {
        timer = setTimeout(() => { dialogueTyping.delete(element); onComplete(); }, 1200);
        dialogueTyping.set(element, () => { clearTimeout(timer); dialogueTyping.delete(element); });
      }
      return;
    }
    element.textContent += characters[position++];
    timer = setTimeout(tick, /[.!?]/.test(characters[position - 1]) ? 240 : 32);
  };
  timer = setTimeout(tick, 32);
}

function talkToSkeletonMage() {
  if (!questDialogue || questDialogue.open || chestInventory?.open) return;
  const quest = questManager.forGiver('skeleton-mage');
  if (!quest) return;
  dialogueQuest = quest;
  document.getElementById('quest-title').hidden = true;
  document.getElementById('quest-action').hidden = true;
  document.getElementById('quest-dismiss').textContent = 'Goodbye';
  document.getElementById('quest-dismiss').hidden = false;
  document.getElementById('skeleton-next').hidden = false;
  document.getElementById('skeleton-topics').hidden = true;
  clearRoute();
  heldKeys.clear();
  fireHeld = false; waterHeld = false;
  questDialogue.returnValue = '';
  questDialogue.showModal();
  const greeting = questManager.status(cauldronQuest) === 'complete'
    ? 'Ah, a friendly face! There is always something brewing in this classroom. What brings you here?'
    : "Oh no, my wand doesn't work, and the cauldron is turning cold fast... I could really use a moment to think.";
  typeDialogue(document.getElementById('quest-message'), greeting, questDialogue);
}

document.getElementById('skeleton-next')?.addEventListener('click', () => {
  dialogueTyping.get(document.getElementById('quest-message'))?.();
  document.getElementById('skeleton-next').hidden = true;
  document.getElementById('quest-action').hidden = true;
  const topics = document.getElementById('skeleton-topics');
  topics.replaceChildren();
  topics.hidden = false;
  const choices = [
    ["What happened to your wand?", "A little too much enthusiasm and one badly pronounced spell. Now it only produces sparks. I should have listened to my own lessons."],
    ["What are you brewing?", "A warming draught for the students. The ingredients are ready, but the recipe demands a steady flame and a careful hand."],
    ["Tell me about yourself.", "I have taught potion-making here for longer than I care to count. Losing my flesh did little to dull my curiosity, though it has made tasting my own recipes rather difficult."],
    [dialogueQuest.title, null]
  ];
  for (const [label, response] of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      topics.hidden = true;
      document.getElementById('quest-title').hidden = !!response;
      document.getElementById('quest-title').textContent = response ? '' : dialogueQuest.title;
      document.getElementById('skeleton-next').hidden = !response;
      const stage = questManager.status(dialogueQuest);
      const messages = {
        available: dialogueQuest.offer,
        active: dialogueQuest.remind(questContext()),
        ready: dialogueQuest.turnIn,
        complete: 'Thanks for your help, wizard.'
      };
      const action = document.getElementById('quest-action');
      action.hidden = !!response || (stage !== 'available' && stage !== 'ready');
      action.textContent = stage === 'ready' ? 'Complete quest' : 'Start quest';
      typeDialogue(document.getElementById('quest-message'), response ?? messages[stage], questDialogue);
      document.getElementById(response ? 'skeleton-next' : action.hidden ? 'quest-dismiss' : 'quest-action').focus();
    });
    topics.append(button);
  }
  topics.querySelector('button').focus();
});

document.getElementById('quest-dismiss')?.addEventListener('click', event => {
  event.preventDefault();
  document.getElementById('quest-title').hidden = true;
  document.getElementById('skeleton-topics').hidden = true;
  document.getElementById('skeleton-next').hidden = true;
  document.getElementById('quest-action').hidden = true;
  document.getElementById('quest-dismiss').hidden = true;
  typeDialogue(document.getElementById('quest-message'),
    'Safe travels, young wizard. May your spells be steady and your cauldron stay warm!',
    questDialogue, () => questDialogue.close('dismiss'));
});

function canResetQuest(quest) {
  return ['active', 'ready', 'complete'].includes(questManager.status(quest));
}

document.getElementById('reset-quest')?.addEventListener('click', () => {
  const quests = QUEST_DEFINITIONS.filter(canResetQuest);
  const placeholder = quests.length ? 'Select a quest' : 'No quests to reset yet';
  resetQuestChoice.replaceChildren(new Option(placeholder, ''),
    ...quests.map(quest => new Option(quest.title, quest.id)));
  document.getElementById('confirm-quest-reset').disabled = !quests.length;
  clearRoute();
  heldKeys.clear();
  fireHeld = false; waterHeld = false;
  resetQuestDialogue.showModal();
});

document.getElementById('reset-quest-form')?.addEventListener('submit', event => {
  if (event.submitter?.value !== 'reset') return;
  event.preventDefault();
  const quest = QUEST_DEFINITIONS.find(item => item.id === resetQuestChoice.value);
  if (!quest || !canResetQuest(quest)) return;
  questManager.reset(quest);
  if (quest === cauldronQuest) {
    cauldronHeat = 0;
    cauldronWarmup = 0;
  }
  renderQuestObjective();
  resetQuestDialogue.close();
});

resetQuestDialogue?.addEventListener('close', () => cv.focus({ preventScroll: true }));

questDialogue?.addEventListener('close', () => {
  dialogueTyping.get(document.getElementById('quest-message'))?.();
  if (questDialogue.returnValue === 'advance' && dialogueQuest) {
    const stage = questManager.status(dialogueQuest);
    if (stage === 'available') questManager.accept(dialogueQuest);
    else if (stage === 'ready') questManager.complete(dialogueQuest);
    renderQuestObjective();
  }
  dialogueQuest = null;
  cv.focus({ preventScroll: true });
});
if (!preview) {
  new MutationObserver(renderQuestObjective).observe(document.getElementById('hotbar'),
    { attributes: true, attributeFilter: ['data-has-wand'] });
  renderQuestObjective();
}

function canSearchBookStack() {
  return currentRoom === rooms.stockroom && questManager?.status(pageQuest) === 'active' &&
    !questDialogue?.open && !resetQuestDialogue?.open && !wizard.step &&
    Math.abs(wizard.a - pageStackTile[0]) + Math.abs(wizard.b - pageStackTile[1]) === 1;
}

function findMissingPage() {
  if (!canSearchBookStack() || !questManager.record('missing-page-found')) return;
  clearRoute();
  renderQuestObjective();
  cv.focus({ preventScroll: true });
}
searchBookStack?.addEventListener('click', findMissingPage);

const stockDarkness = mk();

function updateWandLight(dt) {
  if (!WIZARD.staffEquipped) wandLight = false;
  const step = dt / .45;
  wandLightFade = wandLight ? Math.min(1, wandLightFade + step) : Math.max(0, wandLightFade - step);
}

function wandLightIntensity() {
  return wandLightFade * wandLightFade * (3 - 2 * wandLightFade);
}

function drawStockDarkness(x, y, wandTip, t) {
  const light = wandTip ? wandLightIntensity() : 0;
  const tipRadius = 38 + 26 * light + Math.sin(t * 3) * 2;
  const floorRadius = 33 + 19 * light;
  const mask = stockDarkness.getContext('2d');
  mask.clearRect(0, 0, W, H);
  mask.fillStyle = 'rgba(13, 12, 31, .81)';
  mask.fillRect(0, 0, W, H);
  mask.globalCompositeOperation = 'destination-out';

  function reveal(cx, cy, radius, strength) {
    const hole = mask.createRadialGradient(cx, cy, 5, cx, cy, radius);
    hole.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
    hole.addColorStop(.45, `rgba(0, 0, 0, ${strength * .75})`);
    hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
    mask.fillStyle = hole;
    mask.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  reveal(...P(5, (STOCK_DOOR_ROW + .5) * TILE_SIZE, 14), 45, .7);
  if (stockChestOpening > 0 && window.CHEST_INVENTORY?.hasStockLoot()) {
    reveal(...P(stockChestA, stockChestB, 14), 30, .85 * stockChestOpening);
  }
  if (light > 0) {
    const [tipX, tipY] = wandTip;
    reveal(tipX, tipY, tipRadius, light);
    reveal(x, y - 4, floorRadius, .82 * light);
  }
  mask.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.drawImage(stockDarkness, 0, 0);
  ctx.restore();
  if (light > 0) {
    ctx.save();
    for (const [index, [px, py, color]] of stockRackBubbles.entries()) {
      const phase = (t * .85 + index * .381) % 1;
      if (phase >= .34) continue;
      const tipExposure = 1 - Math.hypot(px - wandTip[0], py - wandTip[1]) / tipRadius;
      const floorExposure = 1 - Math.hypot(px - x, py - (y - 4)) / floorRadius;
      const exposure = Math.max(0, tipExposure, .82 * floorExposure);
      if (exposure <= 0) continue;
      ctx.globalAlpha = light * Math.min(1, exposure * 2) * Math.sin(phase / .34 * Math.PI);
      dot(ctx, px, py, color);
    }
    ctx.restore();
    glow(...wandTip, 11, 10, '158,225,255', .16 * light);
    ctx.save();
    ctx.globalAlpha = light;
    dot(ctx, wandTip[0], wandTip[1], '#f2fbff');
    ctx.restore();
  }
}

function drawMissingPage(t) {
  if (questManager?.status(pageQuest) !== 'active') return;
  const distance = Math.hypot(wizard.a - pageStackTile[0], wizard.b - pageStackTile[1]);
  const light = WIZARD.staffEquipped ? wandLightIntensity() : 0;
  const visibility = Math.max(0, Math.min(1, 3 + 2 * light - distance));
  if (!visibility) return;
  const [a, b] = pageStackTile.map(tile => (tile + .5) * TILE_SIZE);
  const [x, y] = P(a + 1, b + 1.7, 11);
  const pulse = .5 + .5 * Math.sin(t * 2.3);
  ctx.save();
  const halo = ctx.createRadialGradient(x - 2, y, 1, x - 2, y, 20);
  halo.addColorStop(0, `rgba(255, 219, 137, ${.34 + pulse * .11})`);
  halo.addColorStop(.5, 'rgba(241, 178, 81, .19)');
  halo.addColorStop(1, 'rgba(241, 178, 81, 0)');
  ctx.globalAlpha = visibility;
  ctx.fillStyle = halo;
  ctx.fillRect(x - 22, y - 20, 40, 40);
  for (const [offset, delay] of [[-9, 0], [4, .31], [10, .65], [-3, .83]]) {
    const age = (t * .7 + delay) % 1;
    const sx = x + offset + Math.sin(age * 4 + offset) * 2;
    const sy = y - 3 - age * 19;
    ctx.globalAlpha = visibility * Math.sin(age * Math.PI);
    rect(ctx, sx - 1, sy, 3, 1, '#f5c769');
    rect(ctx, sx, sy - 1, 1, 3, '#f5c769');
    dot(ctx, sx, sy, '#fff4cb');
  }
  ctx.globalAlpha = visibility;
  rect(ctx, x - 1, y, 4, 2, '#efd79f');
  dot(ctx, x + 2, y, '#fff2c6');
  ctx.restore();
}

function drawReturnedPage() {
  if (questManager?.status(pageQuest) !== 'complete') return;
  const [x, y] = P(workbenchA + .7, workbenchB + 1.25, 14);
  rect(ctx, x - 1, y - 1, 3, 2, '#f4dba4');
  dot(ctx, x, y, '#ac865c');
}

function warmCauldron(hit, dt) {
  if (questManager?.status(cauldronQuest) !== 'active') return;
  cauldronHeat = hit ? cauldronHeat + dt : 0;
  if (cauldronHeat >= 1 && questManager.record('cauldron-heated')) renderQuestObjective();
}

function drawDialogueBubble(x, y, t) {
  x = Math.round(x); y = Math.round(y);
  // A one-pixel outline and lower body keep the indicator light at game scale.
  rect(ctx, x - 8, y - 6, 16, 11, '#242426');
  rect(ctx, x - 10, y - 4, 20, 7, '#242426');
  rect(ctx, x - 11, y - 2, 22, 3, '#242426');
  rect(ctx, x - 8, y - 5, 16, 9, '#ffffff');
  rect(ctx, x - 9, y - 3, 18, 5, '#ffffff');
  rect(ctx, x - 10, y - 1, 20, 1, '#ffffff');
  rect(ctx, x - 7, y + 3, 14, 1, '#d8d8db');
  rect(ctx, x - 4, y + 4, 4, 1, '#242426');
  rect(ctx, x - 4, y + 5, 3, 1, '#242426');
  rect(ctx, x - 4, y + 6, 2, 1, '#242426');
  dot(ctx, x - 4, y + 7, '#242426');
  rect(ctx, x - 3, y + 3, 2, 1, '#ffffff');
  dot(ctx, x - 3, y + 4, '#ffffff');
  dot(ctx, x - 3, y + 5, '#d8d8db');
  const count = matchMedia('(prefers-reduced-motion: reduce)').matches ? 3 : Math.min(3, Math.floor(t % 3.2 / .8) + 1);
  for (let index = 0; index < count; index++) {
    dot(ctx, x - 4 + index * 4, y, '#302c36');
  }
}

function drawDialogueIndicators(t) {
  if (preview) return;
  if (currentRoom === rooms.library && librarianDialogue.hidden && librarianHit && librarianSprite.naturalWidth) {
    drawDialogueBubble(librarianHit[0] + 8, librarianHit[1] - librarianSprite.naturalHeight - 7, t);
  }
  if(currentRoom===rooms.library && librarianDialogue.hidden && libraryStudents[0]) {
    const student=libraryStudents[0];
    const [sx,sy]=P((student.a+.5)*TILE_SIZE,(student.b+.5)*TILE_SIZE,48);
    drawDialogueBubble(sx,sy-5,t);
  }
  if (currentRoom === rooms.potion && !questDialogue?.open && skeletonMage.naturalWidth) {
    const [x, y] = P(skeletonMageA, skeletonMageB, skeletonMage.naturalHeight);
    drawDialogueBubble(x + 19, y - 5, t);
  }
}

function drawQuestMarker(t) {
  if (preview || !skeletonMage.naturalWidth) return;
  const quest = questManager.forGiver('skeleton-mage');
  if (!quest) return;
  const questStage = questManager.status(quest);
  if (questStage === 'complete') return;
  const [x, y] = P(skeletonMageA, skeletonMageB, skeletonMage.naturalHeight);
  const top = Math.round(y - 8 + Math.sin(t * 3));
  const color = { available: '#ffe15b', active: '#c4cfde', ready: '#f6b844' }[questStage];
  const rows = questStage === 'available'
    ? ['..##..', '..##..', '..##..', '..##..', '..##..', '......', '..##..', '..##..']
    : ['.####.', '##..##', '....##', '...##.', '..##..', '......', '..##..', '..##..'];
  for (const [dy, row] of rows.entries()) {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === '#') rect(ctx, x + dx - 4, top + dy - 1, 3, 3, '#21192a');
    }
  }
  for (const [dy, row] of rows.entries()) {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === '#') dot(ctx, x + dx - 3, top + dy, color);
    }
  }
}

const iceBalls = [];
let iceCooldown = 0;
let castTime = 0;
const castStrength = () => Math.max(fireCharge, waterCharge,
  castTime > .2 ? (.32 - castTime) / .12 : Math.max(0, castTime / .2));

function canBreatheFire() {
  return fireHeld && WIZARD.staffEquipped && !seatProgress &&
    !chestInventory?.open && !questDialogue?.open && !resetQuestDialogue?.open && librarianDialogue.hidden;
}

const fireSprite = new Image();
fireSprite.src = 'assets/sprites/fire-breath.png';
const fireFrameWidth = 88, fireFrameHeight = 38, fireFrameCount = 16;

function drawFireBreathSmoke(t, length) {
  if (length < 12) return;
  for (let index = 0; index < 4; index++) {
    const age = (t * 1.35 + index / 4) % 1;
    const radius = 1 + Math.floor(age * 3);
    const x = length * (.68 + age * .23) + Math.sin(age * 5 + index) * 2;
    const y = -3 - age * 18 - index % 2 * 3;
    ctx.globalAlpha = Math.sin(age * Math.PI) * .46;
    rect(ctx, x - radius, y, 2 * radius + 1, 2, '#786b6b');
    rect(ctx, x - radius + 1, y - 1, 2 * radius - 1, 1, '#a2968d');
    dot(ctx, x + radius - 1, y + 2, '#655a60');
  }
}

function drawFireBreath(t, a, b, dt) {
  if (!canBreatheFire() || !fireCharge || !fireSprite.naturalWidth) {
    warmCauldron(false, dt);
    return;
  }
  const [da, db] = Array.from(moves.values()).find(move => move[2] === wizard.direction);
  const hand = WIZARD.castingHand(wizard.direction, castStrength());
  const z = 13;
  const originA = a + (hand.y + z + hand.x / 2) / 2;
  const originB = b + (hand.y + z - hand.x / 2) / 2;
  const reach = 22 * fireCharge;
  const floor = currentFloor();
  const inPotionRoom = currentRoom === rooms.potion;
  const stockroomDoorClosed = inPotionRoom && !isStockroomUnlocked();
  const aimsAtCauldron = inPotionRoom && (cauldronA - a) * da + (cauldronB - b) * db > 0;
  let visibleReach = reach;
  let hitsCauldron = false;
  for (let distance = 0; distance < reach; distance += .5) {
    const column = Math.floor((originA + distance * da) / TILE_SIZE);
    const row = Math.floor((originB + distance * db) / TILE_SIZE);
    if (!floor[row]?.[column] || (stockroomDoorClosed && column === POTION_STOCK_DOOR_COLUMN && row === 0)) {
      visibleReach = Math.max(0, distance - .5);
      break;
    }
    hitsCauldron ||= aimsAtCauldron &&
      Math.abs(column + .5 - cauldronA / TILE_SIZE) < 1 &&
      Math.abs(row + .5 - cauldronB / TILE_SIZE) < 1;
  }
  warmCauldron(hitsCauldron, dt);
  if (streamHitsHearth(originA, originB, da, db, visibleReach)) setHearthLit(true);
  if (!visibleReach) return;
  const [x, y] = P(originA, originB, z);
  const dx = 2 * (da - db), dy = da + db;
  const projected = Math.hypot(dx, dy);
  const ux = dx / projected, uy = dy / projected;
  const side = Math.sign(dx);
  const scale = .73;
  const widthScale = .92;
  const visibleLength = visibleReach * projected;
  const frame = Math.floor(t / .06) % fireFrameCount;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.transform(ux, uy, -uy * side, ux * side, 0, 0);
  ctx.beginPath();
  ctx.rect(0, -fireFrameHeight * widthScale, visibleLength, fireFrameHeight * widthScale * 2);
  ctx.clip();
  ctx.drawImage(fireSprite, frame % 4 * fireFrameWidth, Math.floor(frame / 4) * fireFrameHeight,
    fireFrameWidth, fireFrameHeight, -5 * scale, -24 * widthScale,
    fireFrameWidth * scale, fireFrameHeight * widthScale);
  drawFireBreathSmoke(t, visibleLength);
  ctx.restore();
}

// Four generated water frames, cropped to equal 88 by 38 cells.
const waterSprite = new Image();
waterSprite.src = 'assets/sprites/water-breath.png';
function canCastWater() {
  return waterHeld && WIZARD.staffEquipped && !seatProgress && !chestInventory?.open &&
    !questDialogue?.open && !resetQuestDialogue?.open && !loreScroll?.open &&
    !teleportDialogue?.open && librarianDialogue.hidden;
}
function drawWaterBreath(t, a, b) {
  if (!canCastWater() || !waterCharge || !waterSprite.naturalWidth) return;
  const [da, db] = Array.from(moves.values()).find(move => move[2] === wizard.direction);
  const hand = WIZARD.castingHand(wizard.direction, castStrength());
  const z = 13;
  const originA = a + (hand.y + z + hand.x / 2) / 2;
  const originB = b + (hand.y + z - hand.x / 2) / 2;
  let reach = 22 * waterCharge;
  const floor = currentFloor();
  for (let d = 0; d < reach; d += .5) {
    const column = Math.floor((originA + d * da) / TILE_SIZE);
    const row = Math.floor((originB + d * db) / TILE_SIZE);
    if (!floor[row]?.[column] || (currentRoom === rooms.potion && !isStockroomUnlocked() &&
        column === POTION_STOCK_DOOR_COLUMN && row === 0)) { reach = Math.max(0, d - .5); break; }
  }
  if (streamHitsHearth(originA, originB, da, db, reach)) setHearthLit(false);
  if (!reach) return;
  const [x, y] = P(originA, originB, z);
  const dx = 2 * (da - db), dy = da + db, projected = Math.hypot(dx, dy);
  const ux = dx / projected, uy = dy / projected, side = Math.sign(dx);
  const length = reach * projected;
  const frame = Math.floor(t / .11) % 4;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.transform(ux, uy, -uy * side, ux * side, 0, 0);
  // Fit the full splash to the reachable segment; the old fixed 66px width cut its tip off.
  ctx.beginPath(); ctx.rect(0, -24, length, 48); ctx.clip();
  const thickness = Math.min(32, 12 + length * .3);
  ctx.drawImage(waterSprite, frame % 2 * 88, Math.floor(frame / 2) * 38, 88, 38,
    0, -thickness / 2, length, thickness);
  // A few bright flecks follow the curved foam crest at the tip.
  for (let i = 0; i < 4; i++) {
    const phase = (t * 2.5 + i * .27) % 1;
    const fx = length - 2 - phase * 7;
    const fy = -3 - Math.sin(phase * Math.PI) * thickness * .3;
    ctx.globalAlpha = (1 - phase) * .8;
    rect(ctx, fx, fy, 2, 1, '#d8fcf5');
  }
  // Small falling droplets follow the stream, instead of smoke.
  for (let i = 0; i < 7; i++) {
    const age = (t * 1.9 + i / 7) % 1;
    const px = length * (.4 + age * .57), py = 4 + age * age * 12;
    ctx.globalAlpha = (1 - age) * .8;
    rect(ctx, px, py, 1, 2, i % 2 ? '#9de9ef' : '#5da6d5');
  }
  ctx.restore();
  // Screen-aligned pixel bubbles rise above the jet in every casting direction.
  ctx.save();
  for (let i = 0; i < 8; i++) {
    const age = (t * .85 + i / 8) % 1;
    const distance = length * (.18 + (i * .137 % .74));
    const bx = Math.round(x + ux * distance + Math.sin(age * 5 + i) * 2);
    const by = Math.round(y + uy * distance - 3 - age * 18);
    const radius = i % 3 === 0 ? 3 : 2;
    ctx.globalAlpha = Math.sin(age * Math.PI) * .72 * waterCharge;
    const edge = '#75bed3';
    line(ctx, bx - radius + 1, by - radius, bx + radius - 1, by - radius, edge);
    line(ctx, bx - radius, by - radius + 1, bx - radius, by + radius - 1, edge);
    line(ctx, bx + radius, by - radius + 1, bx + radius, by + radius - 1, edge);
    line(ctx, bx - radius + 1, by + radius, bx + radius - 1, by + radius, '#438cae');
    dot(ctx, bx - 1, by - radius, '#e1fff6');
    if (age > .87) {
      dot(ctx, bx - radius - 2, by - 1, '#b6efef');
      dot(ctx, bx + radius + 2, by + 1, '#b6efef');
    }
  }
  ctx.restore();
}

function castIceBall() {
  if (!WIZARD.staffEquipped || iceCooldown > 0 || chestInventory?.open ||
      !librarianDialogue.hidden) return;
  const [da, db] = Array.from(moves.values()).find(move => move[2] === wizard.direction);
  const progress = wizard.step ? wizard.step.elapsed / STEP_TIME : 0;
  const a = (wizard.a + .5 + (wizard.step ? (wizard.step.a - wizard.a) * progress : 0)) * TILE_SIZE;
  const b = (wizard.b + .5 + (wizard.step ? (wizard.step.b - wizard.b) * progress : 0)) * TILE_SIZE;
  const seated = activeSeat && seatProgress >= .75;
  const originA = seated ? (activeSeat.tile[0] + .5) * TILE_SIZE : a;
  const originB = seated ? (activeSeat.tile[1] + .5) * TILE_SIZE + (activeSeat.offsetB ?? -1) : b;
  iceBalls.push({
    a: originA, b: originB,
    z: seated ? activeSeat.height + 14 : 14,
    delay: .12, direction: wizard.direction,
    da, db, age: 0, impact: 0,
    startA: Math.floor(originA / TILE_SIZE), startB: Math.floor(originB / TILE_SIZE)
  });
  iceCooldown = .55;
  castTime = .32;
}

function updateIceBalls(dt) {
  iceCooldown = Math.max(0, iceCooldown - dt);
  castTime = Math.max(0, castTime - dt);
  for (let i = iceBalls.length - 1; i >= 0; i--) {
    const ball = iceBalls[i];
    if (ball.delay > 0) {
      if (!WIZARD.staffEquipped) { iceBalls.splice(i, 1); continue; }
      ball.delay -= dt;
      if (ball.delay > 0) continue;
      const hand = WIZARD.castingHand(ball.direction, 1);
      const dy = hand.y + 14;
      ball.a += (dy + hand.x / 2) / 2;
      ball.b += (dy - hand.x / 2) / 2;
    }
    ball.age += dt;
    if (ball.impact) {
      ball.impact += dt;
      if (ball.impact > .3) iceBalls.splice(i, 1);
      continue;
    }
    const steps = Math.ceil(dt * 36);
    for (let step = 0; step < steps; step++) {
      const a = ball.a + ball.da * dt * 36 / steps;
      const b = ball.b + ball.db * dt * 36 / steps;
      const tileA = Math.floor(a / TILE_SIZE), tileB = Math.floor(b / TILE_SIZE);
      const outside = a < 0 || b < 0 || tileA >= currentFloor()[0].length || tileB >= currentFloor().length;
      const blocked = (tileA !== ball.startA || tileB !== ball.startB) && !isWalkable(tileA, tileB);
      if (outside || blocked || ball.age > 2) {
        ball.impact = .001;
        break;
      }
      ball.a = a; ball.b = b;
    }
  }
}

function iceBallLayers() {
  return iceBalls.filter(ball => ball.delay <= 0).map(ball => ({
    depth: ball.a + ball.b,
    animate() {
      const [x, y] = P(ball.a, ball.b, ball.z);
      ctx.save();
      if (ball.impact) {
        ctx.globalAlpha = Math.max(0, 1 - ball.impact / .3);
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4;
          const radius = 2 + ball.impact * 26;
          rect(ctx, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 2, 2, '#c4f8ff');
        }
      } else {
        glow(x, y, 10, 8, '99,211,255', .16);
        for (let i = 1; i <= 5; i++) {
          const [tx, ty] = P(ball.a - ball.da * i * 1.1, ball.b - ball.db * i * 1.1, ball.z);
          ctx.globalAlpha = (1 - i / 6) * .65;
          dot(ctx, tx, ty + Math.round(Math.sin(ball.age * 16 + i) * 2), '#bcefff');
        }
        ctx.globalAlpha = 1;
        // Een spits kristal wijst steeds in de vliegrichting.
        const dx = 2 * (ball.da - ball.db), dy = ball.da + ball.db;
        const length = Math.hypot(dx, dy);
        const ux = dx / length, uy = dy / length;
        const nx = -uy, ny = ux;
        for (let along = -4; along <= 6; along++) {
          const width = along < -2 ? 1 : Math.max(0, Math.floor((6 - along) / 2.5));
          for (let across = -width; across <= width; across++) {
            const color = across === -width ? '#e8ffff'
              : across < 0 ? '#a9efff' : across === width ? '#347fae' : '#64c8ed';
            dot(ctx, x + ux * along + nx * across, y + uy * along + ny * across, color);
          }
        }
      }
      ctx.restore();
    }
  }));
}

function clearRoute() {
  route = [];
  destination = null;
  requestedChest = false;
}

function roomChestTile() {
  if (currentRoom === rooms.tower) return CHEST_TILE;
  if (currentRoom === rooms.stockroom) return stockChestTile;
}

function nextToChest(a = wizard.a, b = wizard.b) {
  const tile = roomChestTile();
  return tile && Math.abs(a - tile[0]) + Math.abs(b - tile[1]) === 1;
}

function requestChest() {
  if (chestInventory.open) return;
  const start = wizard.step ?? wizard;
  const [a, b] = roomChestTile();
  const approaches = Array.from(moves.values(), ([da, db]) => [a + da, b + db]);
  const paths = approaches.filter(tile => isWalkable(...tile))
    .map(tile => ({ tile, path: findRoute(start, ...tile) }))
    .filter(({ path }) => path !== null)
    .sort((first, second) => first.path.length - second.path.length);
  if (!paths.length) return;
  const [{ tile, path }] = paths;
  heldKeys.clear();
  requestedSeat = null;
  requestedChest = true;
  route = path;
  destination = path.length ? tile : null;
}

if (!preview) {
  addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
        event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (questDialogue?.open || resetQuestDialogue?.open || loreScroll?.open || teleportDialogue?.open) return;
    if(key==='e' && !event.repeat && currentRoom===rooms.library && libraryStudents[0] &&
       Math.abs(wizard.a-libraryStudents[0].a)+Math.abs(wizard.b-libraryStudents[0].b)<=1) {
      event.preventDefault();talkToLibraryStudent();return;
    }
    if (key === 'e' && !event.repeat && canSearchBookStack()) {
      event.preventDefault();
      findMissingPage();
      return;
    }
    if (key === 'e' && !event.repeat && currentRoom === rooms.potion &&
        Math.abs(wizard.a - skeletonMageTile[0]) + Math.abs(wizard.b - skeletonMageTile[1]) <= 1) {
      event.preventDefault();
      talkToSkeletonMage();
      return;
    }
    if (key === 'e' && currentRoom === rooms.stockroom) {
      event.preventDefault();
      if (!event.repeat && WIZARD.staffEquipped) wandLight = !wandLight;
      if (!event.repeat) updateStockroomHint();
      return;
    }
    if (key === 'r') {
      event.preventDefault();
      waterHeld = true; fireHeld = false;
      if (WIZARD.staffEquipped && !chestInventory?.open && librarianDialogue.hidden) requestedSeat = null;
      return;
    }
    if (key === 'q') {
      event.preventDefault();
      fireHeld = true; waterHeld = false;
      if (WIZARD.staffEquipped && !chestInventory?.open && librarianDialogue.hidden) requestedSeat = null;
      return;
    }
    if (key === 'f') {
      event.preventDefault();
      if (!event.repeat) castIceBall();
      return;
    }
    if (key === 'e' && chestInventory && !event.repeat && !wizard.step && nextToChest()) {
      event.preventDefault();
      requestChest();
      return;
    }
    if (!moves.has(aliases[key] || key)) return;
    unlockHallAudio();
    event.preventDefault();
    clearRoute();
    requestedSeat = null;
    heldKeys.add(key);
  });
  addEventListener('keyup', event => {
    const key = event.key.toLowerCase();
    if (key === 'q') fireHeld = false;
    if (key === 'r') waterHeld = false;
    heldKeys.delete(key);
  });
  const releaseControls = () => {
    heldKeys.clear();
    fireHeld = false; waterHeld = false;
  };
  addEventListener('blur', releaseControls);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseControls();
  });
}

let hoveredTile = null;
function pointerPosition(event) {
  const bounds = cv.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * W / bounds.width - CX;
  const y = (event.clientY - bounds.top) * H / bounds.height - CY;
  return [x, y];
}

function tileAtPointer(event) {
  const [x, y] = pointerPosition(event);
  // Keer P(a, b, 0) om om te bepalen boven welke vloertegel de muis staat.
  const a = Math.floor((y + x / 2) / (2 * TILE_SIZE));
  const b = Math.floor((y - x / 2) / (2 * TILE_SIZE));
  return currentFloor()[b]?.[a] ? [a, b] : null;
}

if (!preview) {
  cv.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') hoveredTile = tileAtPointer(event);
  });
  cv.addEventListener('click', event => {
    unlockHallAudio();
    const [px, py] = pointerPosition(event);
    const floorTile = tileAtPointer(event);
    const boardU = -px - 1;
    const boardZ = Math.floor(boardU / 2) - 1 - py;
    if (currentRoom === rooms.hall && boardU >= 43 && boardU < 61 && boardZ >= 45 && boardZ < 71) {
      movementHint.textContent = 'Notice board · Charms at dusk. Lost: one library book. Beware of the runaway inkpot.';
      return;
    }
    if (canSearchBookStack() && floorTile?.[0] === pageStackTile[0] && floorTile[1] === pageStackTile[1]) {
      findMissingPage();
      return;
    }
    if (currentRoom === rooms.potion && floorTile &&
        floorTile[0] === skeletonMageTile[0] && floorTile[1] === skeletonMageTile[1]) {
      talkToSkeletonMage();
      return;
    }
    if (roomChestTile() && chestInventory) {
      const inStockroom = currentRoom === rooms.stockroom;
      const [x, y] = inStockroom ? P(stockChestA, stockChestB, 8 * stockChestScale) : P(towerChestA, towerChestB, 8);
      if (Math.abs(px + CX - x) <= 15 && py + CY >= y - (inStockroom ? 13 : 10) && py + CY <= y + 12) {
        requestChest();
        return;
      }
    }
    if(currentRoom===rooms.library && libraryStudents[0]) {
      const student=libraryStudents[0];
      const [sx,sy]=P((student.a+.5)*TILE_SIZE,(student.b+.5)*TILE_SIZE,0);
      if(Math.abs(px+CX-sx)<=14 && py+CY>=sy-52 && py+CY<=sy) {
        talkToLibraryStudent();return;
      }
    }
    if (currentRoom === rooms.library && librarianHit) {
      const [x, y] = librarianHit;
      if (Math.abs(px + CX - x) <= 13 && py + CY >= y - 43 && py + CY <= y) {
        libraryDialogueSpeaker='librarian';
        if(librarianDialogue.hidden) librarianDialogue.hidden=false;
        else showLibrarianConversation('greeting');
        clearRoute();
        requestedSeat = null;
        heldKeys.clear();
        return;
      }
    }
    librarianDialogue.hidden = true;
    const seats = currentRoom === rooms.library ? librarySeats : currentRoom === rooms.tower ? [armchairSeat] : [];
    const seat = seats.find(({ tile, hit }) => {
      const [x, y] = P((tile[0] + .5) * TILE_SIZE, (tile[1] + .5) * TILE_SIZE, 0);
      return Math.abs(px + CX - x) <= hit[0] && py + CY >= y - hit[1] && py + CY <= y + 3;
    });
    if (seat && seat === requestedSeat) {
      requestedSeat = null;
      clearRoute();
      return;
    }
    const clickedExit = currentRoom.exits.find(({ wallA, wallB, tile, archHalfWidth }) => {
      if (wallB !== undefined) {
        const u = px + 2 * wallB;
        const z = wallB + Math.floor(u / 2) - 1 - py;
        return z >= 0 && z < 49 && acrossArchColor(u - 2 * (tile[0] + .5) * TILE_SIZE, z, archHalfWidth);
      }
      if (wallA === undefined) return false;
      const u = 2 * wallA - px - 1;
      const z = wallA + Math.floor(u / 2) - 1 - py;
      return z >= 0 && passageColor(2 * (tile[1] + .5) * TILE_SIZE - u, z);
    });
    const tile = clickedExit?.tile ?? (seat ? seat.approach : floorTile);
    if (!tile || !isWalkable(...tile)) return;
    const start = wizard.step ?? wizard;
    const nextRoute = findRoute(start, ...tile);
    if (!nextRoute) return;
    heldKeys.clear();
    requestedSeat = clickedExit ? null : seat ?? null;
    requestedChest = false;
    route = nextRoute;
    destination = route.length ? tile : null;
  });
}

// Doorzoek de vloer vanaf de eerstvolgende vaste positie, één tegel per stap.
function findRoute(start, targetA, targetB, canVisit = () => true) {
  const queue = [{ a: start.a, b: start.b, previous: null }];
  const columns = currentFloor()[0].length;
  const tileId = (a, b) => b * columns + a;
  const visited = new Set([tileId(start.a, start.b)]);
  for (let index = 0; index < queue.length; index++) {
    const tile = queue[index];
    if (tile.a === targetA && tile.b === targetB) {
      const path = [];
      for (let step = tile; step.previous; step = step.previous) path.push(step.move);
      return path;
    }
    for (const move of moves.values()) {
      const [da, db] = move;
      const a = tile.a + da, b = tile.b + db;
      const id = tileId(a, b);
      if (!isWalkable(a, b) || !canVisit(a,b) || visited.has(id)) continue;
      visited.add(id);
      queue.push({ a, b, previous: tile, move });
    }
  }
  return null;
}
function clearHover() { hoveredTile = null; }
if (!preview) {
  cv.addEventListener('pointerleave', clearHover);
  cv.addEventListener('pointercancel', clearHover);
}

function drawTileBorder(tile, color) {
  if (!tile) return;
  const [a, b] = tile.map(tile => tile * TILE_SIZE);
  const corners = [
    P(a, b, 0), P(a + TILE_SIZE, b, 0),
    P(a + TILE_SIZE, b + TILE_SIZE, 0), P(a, b + TILE_SIZE, 0)
  ];
  for (let index = 0; index < corners.length; index++) {
    const [x0, y0] = corners[index];
    const [x1, y1] = corners[(index + 1) % corners.length];
    line(ctx, x0, y0, x1, y1, color);
  }
}

const movementHint = document.getElementById('movement-hint');
const defaultHint = movementHint ? movementHint.textContent : undefined;

const roomTitleBanner = document.getElementById('room-title');
const roomTitlePlaque = document.getElementById('room-title-plaque');
let roomTitleAnimation;

function showRoomTitle(title) {
  if (!roomTitleBanner) return;
  roomTitlePlaque.textContent = title;
  roomTitleAnimation?.cancel();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const keyframes = reduceMotion
    ? [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }]
    : [{ opacity: 0 }, { opacity: 1, offset: .13 }, { opacity: 1, offset: .78 }, { opacity: 0 }];
  roomTitleAnimation = roomTitleBanner.animate(keyframes, { duration: 3500 });
}

function updateStockroomHint() {
  if (currentRoom !== rooms.stockroom) return;
  const hint = !WIZARD.staffEquipped ? 'Equip your wand, then press E to cast Wand Light.'
    : wandLight ? 'Wand Light is on. Press E to turn it off.' : 'Press E to cast Wand Light.';
  if (movementHint.textContent !== hint) movementHint.textContent = hint;
}

function enterRoom(exit) {
  if (exit.target === 'stockroom' && !isStockroomUnlocked()) return;
  currentRoom = rooms[exit.target];
  iceBalls.length = 0;
  castTime = 0;
  fireCharge = 0; waterCharge = 0;
  librarianDialogue.hidden = true;
  [wizard.a, wizard.b] = exit.arrival;
  wizard.direction = exit.direction;
  requestedSeat = null;
  clearRoute();
  clearHover();
  heldKeys.clear();
  const hints = {
    library: 'Library · The back arch leads to the main room. The front arches lead to the potion room and the hall.',
    hall: 'Hall · Click the far edge to continue. The arch leads back to the library.',
    hallEnd: 'Hall · The side door leads to a classroom. The open arch leads back.',
    classroom: 'Runes Classroom · The door leads back to the hall.',
    potion: 'Potion room · Click the Skeleton Mage’s floor tile to talk, or press E when beside him. The arch beside the display cabinet leads to the stockroom.',
    stockroom: 'Potion stockroom · Equip your wand and press E to light the way.'
  };
  movementHint.textContent = hints[exit.target] ?? defaultHint;
  fit();
  showRoomTitle(currentRoom.title);
}

const teleportChoice = document.getElementById('teleport-room-choice');
document.getElementById('teleport-room')?.addEventListener('click', () => {
  const stockroomOption = teleportChoice.querySelector('[value="stockroom"]');
  stockroomOption.disabled = !isStockroomUnlocked();
  stockroomOption.textContent = stockroomOption.disabled ? 'Potion Stockroom (locked)' : 'Potion Stockroom';
  teleportChoice.value = Array.from(teleportChoice.options).find(option => rooms[option.value] === currentRoom)?.value ?? 'library';
  heldKeys.clear();
  fireHeld = false; waterHeld = false;
  teleportDialogue.showModal();
});

document.getElementById('teleport-room-form')?.addEventListener('submit', event => {
  if (event.submitter?.value !== 'teleport') return;
  const target = teleportChoice.value;
  const entrance = Object.values(rooms).flatMap(room => room.exits).find(exit => exit.target === target);
  if (!entrance || rooms[target] === currentRoom || (target === 'stockroom' && !isStockroomUnlocked())) return;
  event.preventDefault();
  chestInventory?.close();
  wizard.step = null;
  activeSeat = null;
  seatProgress = 0;
  enterRoom(entrance);
  teleportDialogue.close();
  cv.focus({ preventScroll: true });
});

let hallAudio, hallFootstep;
let hallMuted = false;
document.getElementById('mute')?.addEventListener('click', () => { hallMuted = !hallMuted; });
document.getElementById('vol')?.addEventListener('input', () => { hallMuted = false; });

function unlockHallAudio() {
  if (!currentRoom.corridor || !window.AudioContext) return;
  if (!hallAudio) {
    hallAudio = new AudioContext();
    const length = Math.floor(hallAudio.sampleRate * .045);
    hallFootstep = hallAudio.createBuffer(1, length, hallAudio.sampleRate);
    const samples = hallFootstep.getChannelData(0);
    for (let i = 0; i < length; i++) {
      samples[i] = (Math.random() - .5) * Math.exp(-i / (length * .22));
    }
  }
  if (hallAudio.state === 'suspended') hallAudio.resume().catch(() => {});
}

function playHallStep() {
  if (!currentRoom.corridor || hallAudio?.state !== 'running' || hallMuted) return;
  const arch = currentRoom === rooms.hallEnd ? wizard.b < 2 : wizard.b >= HALL_ROWS - 2;
  const volume = Number(document.getElementById('vol')?.value ?? 60) / 100;
  const taps = arch ? [[0, .33], [.075, .13], [.15, .06]] : [[0, .24]];
  for (const [delay, amount] of taps) {
    const step = hallAudio.createBufferSource();
    const gain = hallAudio.createGain();
    step.buffer = hallFootstep;
    gain.gain.value = amount * volume;
    step.connect(gain).connect(hallAudio.destination);
    step.start(hallAudio.currentTime + delay);
    step.onended = () => { step.disconnect(); gain.disconnect(); };
  }
}

function updateWizard(dt) {
  if (questDialogue?.open || resetQuestDialogue?.open || loreScroll?.open || teleportDialogue?.open) return;
  if (seatProgress > 0 && activeSeat !== requestedSeat) {
    seatProgress = Math.max(0, seatProgress - dt / .3);
    if (!seatProgress) activeSeat = null;
    return;
  }
  if (requestedChest && !wizard.step && !route.length && nextToChest()) {
    clearRoute();
    clearHover();
    const [a, b] = roomChestTile();
    const [da, db] = [a - wizard.a, b - wizard.b];
    wizard.direction = Array.from(moves.values()).find(([a, b]) => a === da && b === db)[2];
    window.CHEST_INVENTORY.open(currentRoom === rooms.stockroom);
    return;
  }
  if (requestedSeat && !wizard.step &&
      wizard.a === requestedSeat.approach[0] && wizard.b === requestedSeat.approach[1]) {
    activeSeat = requestedSeat;
    wizard.direction = activeSeat.direction;
    seatProgress = Math.min(1, seatProgress + dt / .4);
    return;
  }
  if (!wizard.step) {
    const key = Array.from(heldKeys).pop();
    const move = key ? moves.get(aliases[key] || key) : route.pop();
    if (!move) return;
    const [da, db, direction] = move;
    const a = wizard.a + da, b = wizard.b + db;
    wizard.direction = direction;
    if (isWalkable(a, b)) {
      if (chestInventory?.open && !nextToChest(a, b)) chestInventory.close();
      wizard.step = { a, b, elapsed: 0 };
    }
  }
  if (wizard.step) {
    wizard.step.elapsed += dt;
    if (wizard.step.elapsed >= STEP_TIME) {
      if (!isWalkable(wizard.step.a, wizard.step.b)) {
        wizard.step = null;
        clearRoute();
        return;
      }
      wizard.a = wizard.step.a;
      wizard.b = wizard.step.b;
      playHallStep();
      const exit = currentRoom.exits.find(({ tile }) => wizard.a === tile[0] && wizard.b === tile[1]);
      if (exit) enterRoom(exit);
      wizard.step = null;
      if (!route.length) destination = null;
    }
  }
}

function drawOwl(t) {
  const [x, feet] = P(TOWER_OWL_A, 2.5, 58);
  const headX = x + Math.round(Math.sin(t * .72) * 1.5);
  const headY = feet - 16 + Math.round(Math.sin(t * 1.7) * .55);
  const outline = '#263248', feather = '#e8edf0', shade = '#9cb5c9';
  ell(ctx, x - 3, feet - 3, 4, 2, outline);
  ell(ctx, x, feet - 8, 6, 8, outline);
  ell(ctx, x, feet - 8, 5, 7, shade);
  ell(ctx, x + 1, feet - 9, 4, 6, feather);
  ell(ctx, x - 2, feet - 8, 3, 5, '#c3d4df');
  for (const [dx, dy] of [[-3,-7],[-2,-5],[-4,-9],[0,-8],[1,-5]]) {
    dot(ctx, x + dx, feet + dy, '#8da6ba');
  }
  // Oorpluimen lopen schuin naar buiten en bewegen mee met de kop.
  for (const side of [-1, 1]) {
    const tip = headX + 6 * side;
    line(ctx, tip, headY - 8, headX + 3 * side, headY - 3, outline);
    line(ctx, tip - side, headY - 7, headX + 2 * side, headY - 3, feather);
    dot(ctx, tip - side, headY - 6, shade);
  }
  ell(ctx, headX, headY, 6, 5, outline);
  ell(ctx, headX, headY, 5, 4, feather);
  const blink = t % 4.7 > 4.52;
  for (const dx of [-2, 2]) {
    if (blink) rect(ctx, headX + dx - 1, headY, 3, 1, '#46536a');
    else {
      rect(ctx, headX + dx - 1, headY - 1, 3, 3, '#e7b956');
      dot(ctx, headX + dx, headY, '#11182a');
    }
  }
  dot(ctx, headX, headY + 2, '#53657a');
  rect(ctx, x - 4, feet - 1, 3, 1, '#b59256');
  rect(ctx, x + 1, feet - 1, 3, 1, '#b59256');
}

function drawDeskOrb(t) {
  const [x, y] = P(32, 26.8, 22);
  const radius = 11 + Math.sin(t * 2) * 1.5;
  const halo = ctx.createRadialGradient(x, y, 1, x, y, radius);
  halo.addColorStop(0, 'rgba(255, 244, 219, .58)');
  halo.addColorStop(1, 'rgba(255, 244, 219, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ell(ctx, x, y, 4, 4, '#8e8490');
  ell(ctx, x, y - 1, 3, 3, '#fbf2df');
  dot(ctx, x - 1, y - 2, '#ffffff');
}

// Elk punt beschrijft de positie en de tijd tot het volgende punt.
const libraryCatRoute = [
  [12, 20, 0, 2.4], [20, 20, 0, .7], [20, 30, 15, 4.2],
  [20, 30, 15, .7], [28, 28, 0, 1.7], [28, 40, 0, 2.8],
  [28, 40, 0, 2.1], [44, 40, 0, 1.2], [52, 40, 0, 1.6],
  [52, 28, 0, .7], [44, 30, 15, 3.8], [44, 30, 15, .7],
  [44, 20, 0, 1.4], [34, 20, 0, 1.5], [8, 20, 0, 1.2],
  [8, 30, 0, .9], [2, 44, 30, 12], [2, 44, 30, .9], [8, 30, 0, 1.1]
];
const libraryCatCycle = libraryCatRoute.reduce((total, point) => total + point[3], 0);

function libraryCatLayer(t) {
  let elapsed = t % libraryCatCycle;
  let index = 0;
  while (index < libraryCatRoute.length - 1 && elapsed >= libraryCatRoute[index][3]) {
    elapsed -= libraryCatRoute[index][3];
    index++;
  }
  const [a, b, z, duration] = libraryCatRoute[index];
  const [nextA, nextB, nextZ] = libraryCatRoute[(index + 1) % libraryCatRoute.length];
  const progress = elapsed / duration;
  const jumping = z !== nextZ;
  const walking = !jumping && (a !== nextA || b !== nextB);
  const ca = a + (nextA - a) * progress, cb = b + (nextB - b) * progress;
  const lift = z + (nextZ - z) * progress + (jumping ? 9 * Math.sin(Math.PI * progress) : 0);
  const [x, y] = P(ca, cb, lift);
  const face = nextA - a >= nextB - b ? 1 : -1;
  if (!walking && !jumping && z === 30) {
    return { depth: ca + cb + 3, animate: () => {
      ell(ctx, x, y - 3, 6, 3, CAT_FUR);
      ell(ctx, x - 1, y - 4, 4, 2, CAT_LIGHT);
      ell(ctx, x + 4, y - 4, 2, 2, CAT_FUR);
      dot(ctx, x + 5, y - 4, '#74626f');
    } };
  }
  return { depth: ca + cb + (lift > 0 ? 3 : 0), animate: () => drawLibraryCat(t, x, y, face, jumping, walking, progress) };
}

// Afzet, ingetrokken poten en landing hebben elk een eigen silhouet.
const catMotionFrames = [
  [
    '.....................',
    '.....................',
    '.........oooooo......',
    '.......ooffffffoo....',
    '......oofflfffffoo...',
    '.....oofffffflfffo...',
    '....offlffffffffo....',
    '....offffffffffo.....',
    '.....oflooooflo......',
    '....oflo.....ofllo...',
    '...oooo.......oooo...'
  ],
  [
    '.....................',
    '.....................',
    '.........oooooo......',
    '.......ooffffffoo....',
    '......oofflfffffo....',
    '....offflfffflffo....',
    '.....offffffffffo....',
    '.....offffffffoo.....',
    '......offlooflo......',
    '........ooo.ooo......',
    '.....................'
  ],
  [
    '.....................',
    '.....................',
    '.........oooooo......',
    '.......ooffffffo.....',
    '......oofflfffffo....',
    '.....offoffflfffo....',
    '...offlfffffffffo....',
    '....offffffffffo.....',
    '.....oloooollo.......',
    '.....olo....olo......',
    '.....ooo....ooo......'
  ]
];
const movingCatColors = { o: CAT_FUR, f: CAT_PAW, l: CAT_LIGHT };
const LIBRARY_CAT_EYES = '#79d8ff';

function drawLibraryCat(t, x, y, face, jumping, walking, progress) {
  if (!walking && !jumping) {
    drawRestingCat(t, x, y, LIBRARY_CAT_EYES);
    return;
  }
  const gait = [0, 2, 1, 2];
  const pose = jumping ? (progress < .26 ? 0 : progress < .76 ? 1 : 2) : gait[Math.floor(t * 9) % gait.length];
  // Teken de staart achter de heup, met meer beweging aan het uiteinde.
  const tailPhase = jumping ? progress * Math.PI * 2 : t * 14;
  for (let i = 0; i < 9; i++) {
    const sway = Math.round(Math.sin(tailPhase - i * .25) * i / 4);
    const tailY = y - 4 - Math.round(i * .45) + sway;
    rect(ctx, x - face * (4 + i), tailY, 2, i < 4 ? 3 : 2, CAT_FUR);
  }
  for (const [row, pixels] of catMotionFrames[pose].entries()) {
    for (let column = 0; column < pixels.length; column++) {
      const pixel = pixels[column];
      if (pixel === '.') continue;
      dot(ctx, x + face * (column - 10), y + row - 10, movingCatColors[pixel]);
    }
  }
  drawCatHead(t, x + face * (6 - pose), y + (pose === 1 ? 2 : 3), LIBRARY_CAT_EYES);
}

const librarianStops = [
  { a: 6, b: 1, face: 1 },
  { a: 9, b: 1, face: 1 },
  { a: 11, b: 5, face: 1 },
  { a: 11, b: 6, face: -1 },
  { a: 6, b: 6, face: -1 }
];
function librarianTileClear(a,b) {
  return !libraryStudents.some(student => student.id === 0
    ? Math.abs(a-student.a)+Math.abs(b-student.b)<=2
    : (a===student.a && b===student.b)||(a===student.step?.a && b===student.step?.b));
}
const librarian = {
  a: 6, b: 1, stop: librarianStops[0], route: [], step: null,
  elapsed: 0, dwell: 2.4
};

function updateLibrarian(dt) {
  librarian.elapsed += dt;
  if (librarian.step) {
    if (librarian.elapsed < 1) return;
    librarian.a = librarian.step.a;
    librarian.b = librarian.step.b;
    librarian.step = null;
    librarian.elapsed = 0;
  }
  if (!librarian.route.length && librarian.elapsed >= librarian.dwell) {
    const stops = librarianStops.filter(stop => stop !== librarian.stop);
    const stop = stops[Math.floor(Math.random() * stops.length)];
    const route = findRoute(librarian, stop.a, stop.b, librarianTileClear);
    if (!route?.length) {
      librarian.elapsed = 0;
      return;
    }
    librarian.stop = stop;
    librarian.route = route;
    librarian.dwell = 2.4 + Math.random() * 2.8;
  }
  const move = librarian.route.pop();
  if (move) {
    const [da, db] = move;
    if(!librarianTileClear(librarian.a+da,librarian.b+db)) {
      librarian.route=[];librarian.elapsed=0;return;
    }
    librarian.step = { a: librarian.a + da, b: librarian.b + db };
    librarian.elapsed = 0;
  }
}

const librarianDialogue = document.getElementById('librarian-dialogue');
const librarianConversations = {
  greeting: { text: 'Keep your voice down, apprentice. Someone has been returning books that were never borrowed... and one of them bears Madame Aubert’s handwriting.',
    choices: [['What happened to Madame Aubert?', 'aubert'], ['Which book was returned?', 'book'], ['Tell me about yourself.', 'keeper'], ['Where should I look?', 'explore']] },
  aubert: { text: 'She came here before she vanished. She asked whether a portrait could remember something its painter had forgotten. When I turned around, her chair was empty. Her tea was still warm.',
    choices: [['What did she leave behind?', 'note'], ['Could the portrait know?', 'portrait'], ['Ask something else.', 'greeting']] },
  note: { text: 'A note between two blank pages: "If it answers in my voice, ask what I was afraid of." I have read it a hundred times. I still cannot decide whether it is a warning or a test.',
    choices: [['What was she afraid of?', 'fear'], ['Ask about the portrait.', 'portrait'], ['Ask something else.', 'greeting']] },
  fear: { text: 'Forgetting a student’s name. Such a small fear for someone so powerful. Whatever happened to her, remember that she cared about the people in this castle.',
    choices: [['Ask something else.', 'greeting']] },
  portrait: { text: 'People say her painted eyes open after midnight. I have only seen them move once. They were watching the doorway behind me. There was nobody there when I looked.',
    choices: [['Which book was returned?', 'book'], ['Ask something else.', 'greeting']] },
  book: { text: 'A register of Oakhaven’s students. The binding was wet, though it had not rained. Its last entry was written in fresh ink. The name had been carefully scratched away.',
    choices: [['Did you touch the ink?', 'ink'], ['Who brought it back?', 'visitor'], ['Ask something else.', 'greeting']] },
  ink: { text: 'With a paper knife. The ink crawled toward the blade. I closed the book before it reached the handle. Since then, I have kept a clean sheet between every page.',
    choices: [['Who brought it back?', 'visitor'], ['Ask something else.', 'greeting']] },
  visitor: { text: 'I heard three knocks and found it on the desk. No footsteps. No voice. Only the smell of cold candle wax. Whoever returned it knew exactly when I would be alone.',
    choices: [['Ask something else.', 'greeting']] },
  keeper: { text: 'I used to teach protective charms. Now I look after the books. Books are easier to keep safe than students... usually. Madame Aubert used to tease me about that.',
    choices: [['Were you friends?', 'friend'], ['Ask something else.', 'greeting']] },
  friend: { text: 'She always returned her books late and brought me tea as an apology. I kept a list of her overdue loans. I have not had the heart to erase it.',
    choices: [['Ask about her disappearance.', 'aubert'], ['Ask something else.', 'greeting']] },
  explore: { text: 'Take your time in the castle. The hall leads to the runes classroom. In the potion room, our skeletal colleague may need a steady hand. Bring your wand. Curiosity is safer with a little light.',
    choices: [['What about the stockroom?', 'stockroom'], ['Ask something else.', 'greeting']] },
  stockroom: { text: 'Speak to the Skeleton Mage before trying that door. The stockroom is his responsibility. If he sends you inside, keep your wand close: the shelves cast very long shadows.',
    choices: [['Ask something else.', 'greeting']] }
};

let libraryDialogueSpeaker = 'librarian';
const studentConversations = {
  greeting:{text:"Oh! Sorry, I thought you were another moving bookshelf. I’m Mira. I’m looking for an atlas that refuses to stay on the same shelf.",choices:[["What are you looking for?",'atlas'],["Can I help?",'help'],["How is studying here?",'school']]},
  atlas:{text:"The Atlas of Wandering Places. Its maps change whenever a hidden passage opens. Yesterday, a staircase appeared in the margin. Today, the whole book has disappeared.",choices:[["Any clues?",'help'],["Ask something else.",'greeting']]},
  help:{text:"Look for a blue spine with a little silver compass. And listen carefully. The atlas rustles its pages when someone mentions a place it has never visited.",choices:[["Does the librarian know?",'keeper'],["Ask something else.",'greeting']]},
  keeper:{text:"He told me to search patiently. Then he winked. I suspect finding the book is part of the lesson.",choices:[["Ask something else.",'greeting']]},
  school:{text:"The lessons are wonderful. The homework less so. My last essay turned into a moth and escaped through a window. I’m still hoping that counts as practical magic.",choices:[["Ask something else.",'greeting']]}
};
function talkToLibraryStudent() {
  libraryDialogueSpeaker='student';
  clearRoute();heldKeys.clear();requestedSeat=null;fireHeld=false;waterHeld=false;
  if(librarianDialogue.hidden) librarianDialogue.hidden=false;
  else showLibrarianConversation('greeting');
}

function showLibrarianConversation(key) {
  const student=libraryDialogueSpeaker==='student';
  const conversation = (student ? studentConversations : librarianConversations)[key];
  document.getElementById('librarian-name').textContent=student ? 'Mira · Apprentice' : 'Librarian';
  document.getElementById('librarian-portrait').style.backgroundImage=student ? 'url("assets/sprites/student-mira-portrait.png")' : '';
  const message = librarianDialogue.querySelector('.npc-dialogue-copy p');
  const topics = document.getElementById('librarian-topics');
  document.getElementById('close-librarian-dialogue').hidden = false;
  topics.replaceChildren();
  for (const [label, destination] of conversation.choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      showLibrarianConversation(destination);
      topics.querySelector('button')?.focus();
    });
    topics.append(button);
  }
  typeDialogue(message, conversation.text, librarianDialogue);
}

let librarianHit = null;
if (!preview) {
  librarianDialogue.hidden = true;
  const librarianMessage = librarianDialogue.querySelector('.npc-dialogue-copy p');

  new MutationObserver(() => {
    if (librarianDialogue.hidden) dialogueTyping.get(librarianMessage)?.();
    else showLibrarianConversation('greeting');
  }).observe(librarianDialogue, { attributes: true, attributeFilter: ['hidden'] });
  document.getElementById('close-librarian-dialogue').addEventListener('click', () => {
    document.getElementById('librarian-topics').replaceChildren();
    document.getElementById('close-librarian-dialogue').hidden = true;
    typeDialogue(librarianMessage, libraryDialogueSpeaker==='student' ? 'Good luck exploring! If you spot that atlas, tell it I’m still waiting.' : 'Walk carefully, apprentice. And if a book whispers your name... let it finish before you answer.',
      librarianDialogue, () => { librarianDialogue.hidden = true; });
  });
  addEventListener('keydown', event => {
    if (event.key === 'Escape') librarianDialogue.hidden = true;
  });
}

function librarianLayer() {
  const { a, b, step, stop, elapsed } = librarian;
  const progress = step ? elapsed : 0;
  const da = (a + .5 + (step ? (step.a - a) * progress : 0)) * TILE_SIZE;
  const db = (b + .5 + (step ? (step.b - b) * progress : 0)) * TILE_SIZE;
  const [x, y] = P(da, db, 0);
  const wa = (wizard.a + .5) * TILE_SIZE, wb = (wizard.b + .5) * TILE_SIZE;
  const watching = !librarianDialogue.hidden || Math.hypot(wa - da, wb - db) < 14;
  const face = watching ? Math.sign(wa - wb - da + db) || 1
    : step ? Math.sign(step.a - a - step.b + b) || 1 : stop.face;
  librarianHit = [x, y];
  return { depth: da + db, animate: () => drawLibrarian(x, y, face, progress) };
}

const librarianSprite = new Image();
librarianSprite.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAqCAYAAABGB/BgAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRAD/AP8A/6C9p5MAAAAHdElNRQfqCxQNEBps2BvlAAAHb0lEQVRYw72Xe3BcdRXHP+d372Z3s5tkn3k176SkSUpLpU1aItCWYrHqSKEv5CEdGAYZZxh1UMRxFGZkfAyPQZFBqMCMg4JFUBhgQFuMUEZBKUxLk9JHJgGSNNnd5rHJZnfvPf7R0ilg0jY6nj/v+f1+n9893/O4F/4PJp98EIkE8luv7xQxlhw8MKhdO/aTSKat/xkkGg06a9a2IUYwglRWhhBBcZVHH9m1c3h4fM1/Dbni6hXOoYNHUJSGhjL6+kYQlM7zmsRx0cd+/Td3ZCTtOVOIOekt8seYSl1dnB0v7RXbEj57frOIZWEZ2Hr9BSYaC+bPFGIBbNzU4RaFvAwOjTI8PEk+l2M0NUUkGqS/L0kqlSaXV8bGprA9Ipmp3PzJyezTZxSuq67tdF54djeJxDGBo5FAPlYWlkjMRzI5zbrPN2PbNqICImRzee696yUb0NOB2AAHDw6eAAAkkmkbEUcJ0d5Rw67XDwPCvMoQYgkGIRYL5EdGTi/rBCAcDk4irjeVnDyxKRYrcowR6ufHMcYwb14YgIGBFPv3DOC6CqIkTtozq/Cp1ERh6hOLR0bGrZJIEUYEEcEywo6X32XbZosHrvQiAt2/WsSl5517ykQwszm9PpvxdI753gqO7p/kS0vPZfVth1j/zTsocjPYti2ZbEZi0WDulOH6TxaLBZ1c3mVVWyvTuay4ruqbhw8TiRVxNDFBJuPSurhM5lVG1XWVBc1xtj30KqrI1us69bFHXnv5yJHxS2aFXLSkzRlPTxANFTPqzaCqlJYVi8e21XWViooiQiWF3H/fDjwFNmIgEPRjLCOuqno9Ft3vflAAODOGy2MZ+kZHGfVO4fN5KK8I4bFtbV1QIc1nxXnqid0MHSzlrjt+zrWbbiBYFECMERAMInkHAHdGTS5Y1eyM+adoPruCsvIwJaEALc3lvPjC2wwdiGtT+WX88ffPcXNHhVxe2k96bEKeeOSZ47tVAa2sLIbjdWR/EhAq8Tu5nMO8qgh1tVEefrALn99DibZwy43fkdqaGm1dtFAQl5bFDWAsKSgY0Q/6BzByjBAvDdC1c9+Jsz+mybL2emfNxW28vusAu9/qo6DAZnX7Wi5avYaenh5q6uvoOG8Ze97ey6IlC1ni7JW3aMX2Fei69Wvw+b3ES4vkH6+/Z3FSNzgB2bSlw3njzV7So5MosHnd1bSv6JDpzDT7e7p141c2yV93dummirTc2TWoP7kwQLCxVVyx6B9KaPtNP9BEIv2pyHwM0tBU7ijguspYcoJf/PgBtv9hO8ayZPXFqxjoH9K10VGWLyjHxKv53o9upvfItOTcvEY9Od+7R7y/fbV/esOsxRgvDSAioGCMsP2ZpzCW4cmbV2tj75+1ra2VweoLccizdONW+odtead/Wrff/6C80luQmQnwKU2ikeA0qFHE3H37fXT37CM4dojvfv0Ktr+TJePkxGheN4X6eag3THtnhxw4cEgbm+rpOH/FjD3sYymcSE54E8m0p7mulb1799C8oIWDmQDxtV8lm8/T0noWb/3rHf6UbaG9s0Pu+dnd6uYdfvj92+WC9vMnT+tNTrYVS9qz6y7+gnXPwz8lXl7EVV/8Go6bl7qGeqampplIj7Jy1YXs7z6IZdu6ZesW64whH/lXrpyfz2RdxBLi/mY2rN8oPfu6ddE550j9/Dq1jKH//QEu3fzluUFCIb+zcHENtsegrjKdcxkfm2Jp40qms9NctvEyuebGqzQzlZ91pszYuyLhwrxlGX55ufDSrbUCBoOSK/DyzM6nKXJeIZ9z+PY1jZREip05QZKpSVsVve53eaq2vMbSyLi8fFs1k2okm3Xk2X9m2FD7qH6uehrjzj63Zg1XWVmxU1Ufl7raiHbt6KawJCDlOkpv2quB4kISQ0c5+zO18urOfbMOv1mdVbUxAD12F5H62rDesKFBxRL8AR9NZ1dJgcfoqS47IyQaDTqISHVVGBQU1VC4EH8oJN9a5vKba/wE/V6dGJ8iEg7k5wTZdWfjscatrvT2J1FXUVUmxsZ5pcfwwJNHEUvkqZuK5P3Hl82qiT2TY/mt72km68hrd9SBFkvllYPYtsHy+vn7cF7K/F6Nu8qB3QtY8ujzc4OkUpNWLF7kdL0YFst1tG5+KYhFsc8GVVzHxXVcXb/tOfw+a/uchXfzLqtXtrPl8b9QUxXh8KFhPkxlpaDQi2UZ2XalH8syDAyOb54zxOO1aPjGXVrTVIqxjBhLQFVFBNd1VFBx3VN/Ds8KqWuII0B1dehYgh03X2EBYIjFAixd3jR3SCQSyBrLEI4FAaGvb4TKyjCXNLv4/AUIyPCRcRxVIpHARxeQM4K0La62QKmpLkFURUQwgBFABQSNRv1qRE4+W88Isnd3fz6VmkaMxYcDR1UAV93jxQ/ReAnJo1mcXI5kcmLWij/VPCEaDTotC+dhbJvnb4mRHp2k7aZuor5Cej4YOq3/E3OqBYnEhOUdt/Akleotbzhlm9+wXFeprYiyeeVy53Qgp2WxSHDP4sZqp/Ocljkd+m+UA/tEc1WS4QAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyNi0xMS0yMFQxMzoxNjoxNyswMDowMP2MC4QAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjYtMTEtMjBUMTM6MTY6MTcrMDA6MDCM0bM4AAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDI2LTExLTIwVDEzOjE2OjI2KzAwOjAw8zyesAAAAABJRU5ErkJggg==';

function drawLibrarian(x, y, face, progress) {
  const stride = Math.round(Math.sin(progress * Math.PI * 6));
  ell(ctx, x, y, 6, 2, '#49392e');
  if (!librarianSprite.naturalWidth) return;

  const width = librarianSprite.naturalWidth;
  const height = librarianSprite.naturalHeight;
  const left = -Math.floor(width / 2);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(face < 0 ? -1 : 1, 1);
  ctx.imageSmoothingEnabled = false;
  if (stride === 0) {
    ctx.drawImage(librarianSprite, left, -height);
  } else {
    const bodyHeight = height - 5;
    const split = Math.floor(width / 2);
    ctx.drawImage(librarianSprite, 0, 0, width, bodyHeight, left, -height, width, bodyHeight);
    ctx.drawImage(librarianSprite, 0, bodyHeight, split, 5, left + stride, -5, split, 5);
    ctx.drawImage(librarianSprite, split, bodyHeight, width - split, 5,
      split + left - stride, -5, width - split, 5);
  }
  ctx.restore();

}

const dittoPixels = [
  '.......ooo..........',
  '......ohhho.ooo.....',
  '......ohppooohho....',
  '..oo.ohpppppppppo...',
  '.ohhoopppppppppppo..',
  '.ohppppppppppppppooo',
  '.oppppppppppppppphpo',
  '..oppppppppppppppppo',
  '...oppppppppppppppo.',
  '...opppppppppppppo..',
  '..opppppppppppppso..',
  '..osppppppppppppsso.',
  '.ossssppppppppsssso.',
  '.osssssssssssssssso.',
  '..oossssssssssssoo..',
  '....ooooossooooo....',
  '.........oo.........'
];
const dittoColors = { o: '#33243c', h: '#f0c9ec', p: '#ce97d9', s: '#a36cad' };
const libraryDitto = { depth: 107, animate: drawLibraryDitto };

function drawLibraryDitto(t) {
  const [x, y] = P(58, 49, 0);
  const jump = Math.min(1, Math.max(0, (t % 6.4 - 5.65) / .6));
  const lift = Math.sin(Math.PI * jump);
  const wobble = Math.sin(t * 3.2);
  const top = y - dittoPixels.length - Math.round(5 * lift);
  ell(ctx, x, y, Math.round(6 - lift * 2), 2, '#3e4738');
  for (const [row, pixels] of dittoPixels.entries()) {
    const sway = Math.round(wobble * (dittoPixels.length - 1 - row) / 14);
    for (let column = 0; column < pixels.length; column++) {
      const color = dittoColors[pixels[column]];
      if (color) dot(ctx, x - 10 + column + sway, top + row, color);
    }
  }
  const faceX = x + Math.round(wobble * 9 / 14);
  dot(ctx, faceX - 3, top + 6, dittoColors.o);
  dot(ctx, faceX + 3, top + 6, dittoColors.o);
  dot(ctx, faceX - 2, top + 9, '#79527e');
  rect(ctx, faceX - 1, top + 9, 3, 1, dittoColors.o);
  dot(ctx, faceX + 2, top + 8, '#79527e');
}

const hallFurnishings = new Map([[rooms.hall, makeHallFurnishings(false)], [rooms.hallEnd, makeHallFurnishings(true)]]);

const classroomFurnishings = [];
for (const row of classroomRows) for (const column of classroomBanks) {
  const canvas = mk(), g = canvas.getContext('2d');
  const a = column * TILE_SIZE, b = row * TILE_SIZE;
  const oak = woodC('#a57147'), frame = woodC('#714734');
  ell(g, ...P(a + 16, b + 4, 0), 25, 5, 'rgba(45,30,30,.22)');
  box(g, a + 2, b + 3.6, 3, 27, 1, 1.4, frame);
  for (const end of [1.5, 28.5]) {
    box(g, a + end - .4, b + 1.5, 0, 2.2, 5.1, 1.6, frame);
    box(g, a + end, b + 2, 1.6, 1.3, 4, 9.4, frame);
  }
  box(g, a + 1, b + 3.9, 8, 30, 1.1, 3, frame);
  for (let section = 0; section < 8; section++) {
    const curve = Math.floor(Math.abs(section - 3.5) / 2) * .65;
    box(g, a + .5 + section * 3.9, b + 1 + curve, 11, 3.9, 5.15, 1.5, oak);
    const from = a + .5 + section * 3.9, lip = b + 6.15 + curve;
    line(g, ...P(from, lip, 12.5), ...P(from + 3.6, lip, 12.5), '#ca9668');
    if (section % 3 === 0) line(g, ...P(from + .4, lip - 1, 12.5), ...P(from + 3, lip - 1, 12.5), '#956341');
  }
  for (const offset of [6, 17, 26]) {
    if (hash(row, column + offset) < .3) continue;
    const cover = offset === 17 ? '#784957' : '#476254';
    box(g, a + offset - 1.9, b + 2.4, 12.5, 3.9, 2.7, .5, flat(cover, '#543c34', '#594336'));
    box(g, a + offset - 1.6, b + 2.6, 13, 3.2, 2.2, .55, flat('#dcca9d', '#9b7851', '#bf996a'));
    line(g, ...P(a + offset, b + 2.7, 13.55), ...P(a + offset, b + 4.55, 13.55), '#8a6a4c');
    dot(g, ...P(a + offset + .9, b + 3.4, 13.55), '#755250');
    dot(g, ...P(a + offset + 1.15, b + 4, 13.55), '#9c775d');
  }
  classroomFurnishings.push({ canvas, depth: a + 16 + b + 4 });
  for (let seat = 0; seat < 4; seat++) {
    const chair = mk();
    const chairA = a + (seat + .5) * TILE_SIZE, chairB = b + 12;
    drawStockContainer(chair.getContext('2d'), chairA, chairB, 'chair', true);
    classroomFurnishings.push({ canvas: chair, depth: chairA + chairB });
  }
}

// The stand occupies the rear corner tile, clear of the doorway and dais.
const owlStand = mk();
{
  const g = owlStand.getContext('2d');
  const a = 6, b = 6;
  const [x, y] = P(a, b, 0);
  ell(g, x + 2, y + 1, 8, 3, 'rgba(40,28,27,.37)');
  box(g, a - 2.5, b - 2, 0, 5, 4, 2, woodC('#694935'));
  rect(g, x - 1, y - 22, 3, 20, '#52392f');
  line(g, x - 1, y - 21, x - 1, y - 4, '#a17852');
  line(g, x - 6, y - 22, x + 7, y - 24, '#4d372d');
  line(g, x - 6, y - 23, x + 7, y - 25, '#ad855d');
  line(g, x + 5, y - 25, x + 8, y - 28, '#876244');

  // Tawny owl in three-quarter view. The long wing covers the right flank.
  const plumage = {
    X: '#392e2b', d: '#584032', b: '#79553d', r: '#986b49',
    t: '#b78c64', p: '#d3b28b', c: '#e2caa3', k: '#292328', g: '#b19871'
  };
  const rows = [
    '.....ddbbbd......',
    '...dbrrtrrbbd....',
    '..dbtrbrtrbrbd...',
    '..brpptbpttrbd...',
    '.dbtcpprppttbd...',
    '.drpckptpkctbd...',
    '.dbpkktbpkktbd...',
    '..brpptgpttrbd...',
    '..dbtttgttbrbd...',
    '...dbtpptrbbbd...',
    '...brptpttrbrbd..',
    '..drptbptptbrtbd.',
    '..dbpbtpbtprbrbd.',
    '..dbtptptbtbtrbd.',
    '...btbptpttrbrbd.',
    '...drttbptbrbrbd.',
    '....btptrtbbrbdb.',
    '....dbrtbtbbrbd..',
    '.....dbttbdbbd...',
    '......gg.ggbbd...',
    '......g..g.dbXd..',
    '............dd...'
  ];
  const turnedHead = [
    '.....ddbbbd......',
    '...dbrrtrrbbd....',
    '..dbtrbrtrbrbd...',
    '..brrbpptbtpbd...',
    '.dbbrptcpptctd...',
    '.drbrptckptkcd...',
    '.dbbrptkkbtktd...',
    '..brbrppttgtbd...',
    '..dbrrttptgrbd...',
    '...dbtrpptbbbd...'
  ];
  classroomFurnishings.push({ canvas: owlStand, depth: a + b, animate(t) {
    const glance = t % 9;
    const turned = glance >= 5.2 && glance < 7;
    const lean = glance >= 5 && glance < 7.2 ? 1 : 0;
    const raised = Math.sin(t * 2.1) > .35 ? 1 : 0;
    const blink = t % 4.3 < .16;
    rows.forEach((rest, dy) => {
      const head = dy < turnedHead.length;
      const row = head && turned ? turnedHead[dy] : rest;
      const top = y + dy - 44 - (dy <= 10 ? raised : 0);
      for (let dx = 0; dx < row.length; dx++) {
        const pixel = row[dx];
        if (pixel === '.') continue;
        const color = blink && pixel === 'k' ? plumage[dy === 5 ? 't' : 'b'] : plumage[pixel];
        rect(ctx, x + dx - 8 + (head ? lean : 0), top, 1, dy === 10 ? 1 + raised : 1, color);
      }
    });
  } });
}

const teacherChair = mk();
drawStockContainer(teacherChair.getContext('2d'), TEACHER_CHAIR_A, TEACHER_CHAIR_B, 'chair');
classroomFurnishings.push({ canvas: teacherChair, depth: TEACHER_CHAIR_A + TEACHER_CHAIR_B });

function drawTeacherDesk(g) {
  const frame = woodC('#744b36'), walnut = woodC('#97613e'), trim = woodC('#ad7850');
  const surface = 15.5;
  ell(g, ...P(48, 12, 1.5), 29, 5, 'rgba(46,28,24,.28)');

  // Drawers open toward the teacher's chair. Pupils see the framed modesty panel.
  for (const a of [33, 61]) {
    for (const b of [8.75, 14]) {
      box(g, a - .25, b - .25, 1.5, 2.25, 2, 1.25, frame);
      box(g, a, b, 2.75, 1.55, 1.35, 9.75, walnut);
    }
  }
  box(g, 54, 9, 3.75, 7, 6, 8.75, frame);
  for (const z of [5, 8.75]) {
    box(g, 54.5, 8.4, z, 6, .65, 2.75, trim);
    line(g, ...P(56.75, 8.4, z + 1.25), ...P(58.25, 8.4, z + 1.25), '#d2ab70');
  }
  box(g, 34.5, 14.45, 4.5, 27, .75, 8, frame);
  for (const a of [36, 44.5, 53]) {
    box(g, a, 15.2, 5.5, 7, .35, 5.75, walnut);
    line(g, ...P(a + .5, 15.55, 10.5), ...P(a + 6.5, 15.55, 10.5), '#b68255');
    line(g, ...P(a + .5, 15.55, 6.25), ...P(a + 6.5, 15.55, 6.25), '#5d4031');
  }
  const [carvingX, carvingY] = P(48, 15.6, 8.25);
  line(g, carvingX - 3, carvingY - 1, carvingX, carvingY - 2, '#c3945f');
  line(g, carvingX, carvingY - 2, carvingX + 3, carvingY + 1, '#c3945f');
  line(g, carvingX + 3, carvingY + 1, carvingX, carvingY + 2, '#6e4833');
  line(g, carvingX, carvingY + 2, carvingX - 3, carvingY - 1, '#6e4833');
  box(g, 32.5, 8.25, 12.25, 31, 7.5, 1.4, frame);
  box(g, 32, 8, 13.65, 32, 8, 1.85, trim);
  line(g, ...P(32.5, 15.75, surface), ...P(63.5, 15.75, surface), '#dbad7e');

  // Bound reference books and an open rune workbook.
  const pages = flat('#ead6ab', '#b68e60', '#c6a374');
  box(g, 34.5, 9, surface, 6.4, 4.9, 1.4, flat('#536660', '#384d47', '#30423d'));
  box(g, 35, 9.65, surface + .3, 5.75, 4.45, .75, pages);
  box(g, 35, 10, surface + 1.4, 5.45, 3.7, .9, flat('#87534d', '#653c40', '#54333a'));
  line(g, ...P(35.5, 10.5, surface + 2.3), ...P(39.5, 10.5, surface + 2.3), '#cda06a');
  box(g, 42, 9.2, surface, 10.2, 5.8, .65, flat('#514452', '#463442', '#382d38'));
  const pageTop = surface + 1.45;
  box(g, 42.35, 9.45, surface + .65, 4.6, 5.25, .8, pages);
  box(g, 47.05, 9.45, surface + .65, 4.8, 5.25, .8, pages);
  line(g, ...P(47, 9.6, pageTop), ...P(47, 14.7, pageTop), '#90714e');
  for (const b of [10.5, 11.6, 12.7, 13.8]) {
    line(g, ...P(43, b, pageTop), ...P(b === 13.8 ? 45 : 46, b, pageTop), '#ab8b65');
  }
  line(g, ...P(49.45, 10.5, pageTop), ...P(49.45, 13.85, pageTop), '#785258');
  line(g, ...P(48.35, 12.45, pageTop), ...P(49.45, 10.5, pageTop), '#785258');
  line(g, ...P(49.45, 10.5, pageTop), ...P(50.55, 12.45, pageTop), '#785258');

  // A feather in a glass inkwell and two practice stones.
  box(g, 58.7, 9.85, surface, 2.3, 2.2, 2.25, flat('#68778a', '#3a475b', '#303b50'));
  box(g, 59.35, 10.4, surface + 2.25, 1.15, 1.15, .7, flat('#282938', '#71615d', '#4c464a'));
  const [inkX, inkY] = P(59.9, 10.9, surface + 2.95);
  line(g, inkX, inkY, inkX + 5, inkY - 12, '#e4d3ad');
  line(g, inkX + 1, inkY - 4, inkX + 4, inkY - 10, '#aa947f');
  line(g, inkX + 3, inkY - 6, inkX + 6, inkY - 11, '#f1e3bc');
  for (const [a, b, color] of [[55, 13, '#798a83'], [57.6, 13.6, '#8e8377']]) {
    box(g, a, b, surface, 1.85, 1.45, 1.15, flat(color, '#50595a', '#434849'));
    line(g, ...P(a + .55, b + .45, surface + 1.15), ...P(a + 1.2, b + 1, surface + 1.15), '#ced1ad');
  }
}

const teacherDesk = mk();
drawTeacherDesk(teacherDesk.getContext('2d'));
classroomFurnishings.push({ canvas: teacherDesk, depth: 60 });

const classroomDemo = mk();
const demo = classroomDemo.getContext('2d');
drawStockContainer(demo, 84, 20, 'table');
for (const [offset, sides] of [[-2, flat('#9fa7c7', '#645e95', '#7974a7')], [2, flat('#9ac3ad', '#4f786a', '#5d9680')]]) {
  box(demo, 83.4 + offset, 21, 12.5, 1.2, 1.5, 2.4, sides);
  box(demo, 83.7 + offset, 21.3, 14.9, .6, .6, .9, flat('#cabda5', '#8d8076', '#a19483'));
}
classroomFurnishings.push({ canvas: classroomDemo, depth: 104, animate: t => {
  const [x, y] = P(84, 19, 27 + Math.sin(t * 2) * 1.5);
  const corners = [[x, y - 7], [x + 7, y], [x, y + 7], [x - 7, y]];
  glow(x, y + 4, 23, 19, '105,211,242', .24);
  for (let i = 0; i < corners.length; i++) {
    line(ctx, ...corners[i], ...corners[(i + 1) % corners.length], '#a1ddeb');
    dot(ctx, ...corners[i], '#eaf9ff');
  }
  for (let dy = -3; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (classroomRunePixel(0, dx, -dy)) dot(ctx, x + dx, y + dy, '#eaf9ff');
  }
  dot(ctx, x + 10 * Math.sin(t * 1.5), y + 4 * Math.cos(t * 1.5), '#eaf9ff');
} });

// Ambient library students share the walkable floor without blocking player routes.
const studentSprite = new Image();
studentSprite.src = 'assets/sprites/library-students.png';
const libraryStudents = [];
function studentTileOpen(a,b) {
  return a>0 && b>0 && a<LIBRARY_COLUMNS-1 && b<LIBRARY_ROWS-1 &&
    rooms.library.floor[b]?.[a] === '.' &&
    !rooms.library.exits.some(exit => Math.abs(exit.tile[0]-a)+Math.abs(exit.tile[1]-b)<2);
}
function initLibraryStudents() {
  if(libraryStudents.length) return;
  for(const [id,anchor] of [[1,3],[6,6],[7,5],[9,5]].entries()) {
    const free=[];
    for(let b=1;b<LIBRARY_ROWS-1;b++) for(let a=1;a<LIBRARY_COLUMNS-1;a++) {
      if(studentTileOpen(a,b) && !libraryStudents.some(s=>s.a===a && s.b===b)) free.push([a,b]);
    }
    free.sort((l,r)=>Math.abs(l[0]-anchor[0])+Math.abs(l[1]-anchor[1])-Math.abs(r[0]-anchor[0])-Math.abs(r[1]-anchor[1]));
    if(free.length) { const [a,b]=free[0];libraryStudents.push({id,a,b,home:[a,b],step:null,wait:1+id*.8,elapsed:0,turn:0,face:id===2 || id===1 ? 1 : -1}); }
  }
}
function updateLibraryStudents(dt) {
  initLibraryStudents();
  if(!librarianDialogue.hidden || chestInventory?.open || questDialogue?.open) return;
  for(const student of libraryStudents) {
    if(student.id !== 1) {student.face=student.id === 2 ? 1 : -1;continue;}
    if(student.step) {
      student.elapsed+=dt;
      if(student.elapsed>=.65) {
        student.a=student.step.a; student.b=student.step.b;student.step=null;
        student.elapsed=0;student.wait=.15;
      }
      continue;
    }
    student.wait-=dt;
    if(student.wait>0) continue;
    const choices=[[1,0],[0,1],[-1,0],[0,-1]].map(([da,db])=>[student.a+da,student.b+db]);
    const free=choices.filter(([a,b])=>studentTileOpen(a,b) &&
      Math.abs(a-wizard.a)+Math.abs(b-wizard.b)>1 &&
      !(wizard.step && wizard.step.a===a && wizard.step.b===b) &&
      Math.abs(a-librarian.a)+Math.abs(b-librarian.b)>1 &&
      !(librarian.step && librarian.step.a===a && librarian.step.b===b) &&
      !libraryStudents.some(other=>other!==student &&
        ((other.a===a && other.b===b)||(other.step?.a===a && other.step?.b===b))));
    student.turn++;
    if(!free.length || student.turn%5===0) {student.wait=2+hash(student.id,student.turn)*3;continue;}
    const [a,b]=free[Math.floor(hash(student.id+7,student.turn)*free.length)];
    student.face=Math.sign(a-student.a-b+student.b)||student.face;
    student.step={a,b};student.elapsed=0;
  }
}
function libraryStudentLayers(t) {
  return libraryStudents.map(student=>{
    const progress=student.step ? Math.min(1,student.elapsed/.65) : 0;
    const a=(student.a+.5+(student.step ? student.step.a-student.a : 0)*progress)*TILE_SIZE;
    const b=(student.b+.5+(student.step ? student.step.b-student.b : 0)*progress)*TILE_SIZE;
    const [x,y]=P(a,b,0);
    return {depth:a+b,animate:()=>{
      if(!studentSprite.naturalWidth) return;
      ctx.save();ctx.imageSmoothingEnabled=false;
      ell(ctx,x,y-1,6,2,'rgba(18,20,33,.3)');
      ctx.translate(Math.round(x),Math.round(y));ctx.scale(student.face,1);
      const frame=student.step ? Math.floor(progress*4)%4 : 1;
      ctx.drawImage(studentSprite,frame*32,student.id*48,32,48,-16,-46,32,48);
      ctx.restore();
      if(student.id===0) {
        // An open book and a small reaching movement suggest browsing the shelves.
        const reach=Math.floor(t%6)>3 ? 1 : 0;
        rect(ctx,x-11,y-16-reach,7,5,'#826b49');
        rect(ctx,x-10,y-15-reach,5,3,'#d6c49b');
        line(ctx,x-8,y-15-reach,x-8,y-12-reach,'#8e7857');
      }
    }};
  });
}

// Additional school population: ten students and two subject teachers.
const schoolSprite = new Image();
schoolSprite.src = 'assets/sprites/school-population.png';
const schoolActors = [];
const populatedSchoolRooms = new Set();
function schoolTileFree(room,a,b) {
  const floor=rooms[room].floor;
  return floor[b]?.[a]==='.' && !rooms[room].exits.some(exit=>
    Math.abs(exit.tile[0]-a)+Math.abs(exit.tile[1]-b)<2);
}
function initSchoolRoom(room) {
  if(populatedSchoolRooms.has(room)) return;
  populatedSchoolRooms.add(room);
  function place(id,anchor,role,face=1) {
    const free=[];
    const floor=rooms[room].floor;
    for(let b=0;b<floor.length;b++) for(let a=0;a<floor[b].length;a++)
      if(schoolTileFree(room,a,b) && !schoolActors.some(n=>n.room===room && n.a===a && n.b===b)) free.push([a,b]);
    free.sort((l,r)=>Math.abs(l[0]-anchor[0])+Math.abs(l[1]-anchor[1])-Math.abs(r[0]-anchor[0])-Math.abs(r[1]-anchor[1]));
    if(!free.length)return;
    const [a,b]=free[0];schoolActors.push({id,room,a,b,role,face,step:null,elapsed:0,wait:1+id*.23,turn:0,previous:null});
  }
  function pair(first,anchor) {
    const floor=rooms[room].floor,candidates=[];
    for(let b=1;b<floor.length-1;b++) for(let a=0;a<floor[b].length-2;a++) {
      if([a,a+1,a+2].every(x=>schoolTileFree(room,x,b) && !schoolActors.some(n=>n.room===room&&n.a===x&&n.b===b))) candidates.push([a,b]);
    }
    candidates.sort((l,r)=>Math.abs(l[0]-anchor[0])+Math.abs(l[1]-anchor[1])-Math.abs(r[0]-anchor[0])-Math.abs(r[1]-anchor[1]));
    const [a,b]=candidates[0] || anchor;
    place(first,[a,b],'talk',1);place(first+1,[a+2,b],'talk',-1);
  }
  if(room==='hall') {pair(0,[1,5]);place(2,[0,8],'window',-1);}
  if(room==='hallEnd') {pair(3,[1,3]);pair(5,[1,10]);}
  if(room==='classroom') {pair(7,[5,9]);place(9,[6,5],'walk');place(10,[4,2],'walk');}
  if(room==='potion') place(11,[Math.floor(cauldronA/TILE_SIZE),Math.floor(cauldronB/TILE_SIZE)-2],'stand');
}
function updateSchoolPopulation(dt) {
  if(preview)return;
  const room=Object.keys(rooms).find(key=>rooms[key]===currentRoom);
  if(!['hall','hallEnd','classroom','potion'].includes(room))return;
  initSchoolRoom(room);
  if(chestInventory?.open || questDialogue?.open || !librarianDialogue.hidden || resetQuestDialogue?.open || teleportDialogue?.open)return;
  for(const actor of schoolActors.filter(n=>n.room===room&&n.role==='walk')) {
    if(actor.step) {
      actor.elapsed+=dt;
      if(actor.elapsed>=(actor.id===10?.9:.7)) {
        actor.previous=[actor.a,actor.b];actor.a=actor.step.a;actor.b=actor.step.b;
        actor.step=null;actor.elapsed=0;actor.wait=.12;
      }
      continue;
    }
    actor.wait-=dt;if(actor.wait>0)continue;actor.turn++;
    let choices=[[1,0],[0,1],[-1,0],[0,-1]].map(([da,db])=>[actor.a+da,actor.b+db]).filter(([a,b])=>
      schoolTileFree(room,a,b) && Math.abs(a-wizard.a)+Math.abs(b-wizard.b)>1 &&
      !(wizard.step?.a===a && wizard.step?.b===b) &&
      !schoolActors.some(other=>other!==actor&&other.room===room&&
        ((other.a===a&&other.b===b)||(other.step?.a===a&&other.step?.b===b))));
    if(choices.length>1 && actor.previous) choices=choices.filter(([a,b])=>a!==actor.previous[0]||b!==actor.previous[1]);
    if(!choices.length || actor.turn%6===0) {actor.wait=1.5+hash(actor.id,actor.turn)*2;continue;}
    const [a,b]=choices[Math.floor(hash(actor.id+19,actor.turn)*choices.length)];
    actor.face=Math.sign(a-actor.a-b+actor.b)||actor.face;actor.step={a,b};actor.elapsed=0;
  }
}
function schoolPopulationLayers(t) {
  if(preview)return [];
  return schoolActors.filter(n=>rooms[n.room]===currentRoom).map(actor=>{
    const progress=actor.step ? Math.min(1,actor.elapsed/(actor.id===10?.9:.7)) : 0;
    const a=(actor.a+.5+(actor.step?actor.step.a-actor.a:0)*progress)*TILE_SIZE;
    const b=(actor.b+.5+(actor.step?actor.step.b-actor.b:0)*progress)*TILE_SIZE;
    const [x,y]=P(a,b,0);
    return {depth:a+b,animate:()=>{
      if(!schoolSprite.naturalWidth)return;
      ctx.save();ctx.imageSmoothingEnabled=false;
      ell(ctx,x,y-1,6,2,'rgba(18,20,33,.3)');
      ctx.translate(Math.round(x),Math.round(y));ctx.scale(actor.face,1);
      const frame=actor.step ? Math.floor(progress*4)%4 : actor.role==='talk' && Math.floor(t*.45+actor.id)%4===0 ? 3 : 1;
      ctx.drawImage(schoolSprite,frame*32,actor.id*48,32,48,-16,-47,32,48);
      ctx.restore();
    }};
  });
}

function drawRoomOccupants(t, dt) {
  const step = wizard.step;
  const progress = step ? step.elapsed / STEP_TIME : 0;
  const a = (wizard.a + (step ? (step.a - wizard.a) * progress : 0) + .5) * TILE_SIZE;
  const b = (wizard.b + (step ? (step.b - wizard.b) * progress : 0) + .5) * TILE_SIZE;
  const [x, y] = P(a, b, 0);
  const roomFurnishings = currentRoom === rooms.classroom ? classroomFurnishings : currentRoom.corridor ? hallFurnishings.get(currentRoom) : currentRoom === rooms.library
    ? [...libraryFurnishings, libraryCatLayer(t), librarianLayer(), libraryDitto, ...libraryStudentLayers(t)].sort((left, right) => left.depth - right.depth)
    : currentRoom === rooms.tower ? furnishings
      : currentRoom === rooms.potion ? potionFurnishings : currentRoom === rooms.stockroom ? stockFurnishings : [];
  const occupants = [...roomFurnishings, ...schoolPopulationLayers(t), ...iceBallLayers()].sort((left, right) => left.depth - right.depth);
  let index = 0;
  for (; index < occupants.length && occupants[index].depth <= a + b; index++) {
    drawFurnishing(occupants[index], t, dt);
  }
  const wandTip = !preview && !seatProgress
    ? WIZARD.draw(ctx, wizard.direction, step ? 'walk' : 'idle', step ? step.elapsed : t, x, y, castStrength())
    : undefined;
  for (; index < occupants.length; index++) drawFurnishing(occupants[index], t, dt);
  drawFireBreath(t, a, b, dt);
  drawWaterBreath(t, a, b);
  if (currentRoom === rooms.stockroom) drawStockDarkness(x, y, wandTip, t);
}

function drawSeatedWizard(t, seat) {
  if (seat !== activeSeat || !seatProgress) return;
  const ease = seatProgress ** 2 * (3 - 2 * seatProgress);
  const [x, y] = P((seat.approach[0] + .5) * TILE_SIZE, (seat.approach[1] + .5) * TILE_SIZE, 0);
  const [sx, sy] = P((seat.tile[0] + .5) * TILE_SIZE, (seat.tile[1] + .5) * TILE_SIZE + (seat.offsetB ?? -1), seat.height);
  const px = Math.round(x + (sx - x) * ease);
  const py = Math.round(y + (sy - y) * ease);
  const settling = seatProgress < .75;
  const frame = WIZARD.canvas(seat.direction, 'idle', t, settling && WIZARD.staffEquipped);
  const head = 23;
  const torso = Math.round(WIZARD.CH - head - 11 * ease);
  const left = px - WIZARD.FX;
  const top = py - head - torso + 5;
  ctx.drawImage(frame, 0, 0, WIZARD.CW, head, left, top, WIZARD.CW, head);
  if (settling) {
    ctx.drawImage(frame, 0, head, WIZARD.CW, WIZARD.CH - head,
      left, top + head, WIZARD.CW, torso);
    return;
  }

  const mirror = seat.direction.endsWith('w');
  ctx.save();
  if (mirror) {
    ctx.translate(px * 2, 0);
    ctx.scale(-1, 1);
  }
  const collar = top + head;
  // De cape volgt de schouders en vouwt over de gebogen benen.
  const folds = [
    [-5, 5], [-6, 6], [-6, 6], [-6, 6], [-5, 7], [-5, 8],
    [-4, 9], [-3, 9], [-2, 8], [0, 7]
  ];
  for (const [row, [start, end]] of folds.entries()) {
    const yy = collar + row;
    rect(ctx, px + start, yy, end - start + 1, 1, '#30283e');
    rect(ctx, px + start + 1, yy, end - start - 1, 1, '#554a66');
    dot(ctx, px + start + 2, yy, '#80728f');
    dot(ctx, px + Math.floor(row / 2), yy, '#3f354e');
    if (row >= 6) dot(ctx, px + end - 1, yy, '#736381');
  }
  rect(ctx, px + 6, collar + 9, 4, 2, '#282135');
  dot(ctx, px + 8, collar + 9, '#49405c');
  if (WIZARD.staffEquipped) {
    if (castTime > 0) {
      WIZARD.drawCastingPose(ctx, seat.direction[0] + 'e', px, py, castStrength(), true);
    } else {
      WIZARD.drawSeatedStaff(ctx, px + 3, top + 1);
    }
  }
  ctx.restore();
}

function drawFurnishing({ canvas, animate }, t, dt) {
  if (canvas) ctx.drawImage(canvas, 0, 0);
  if (animate) animate(t, dt);
}

let last = 0;
function frame(ms) {
  const t = ms / 1000, dt = Math.min(.1, last ? t - last : .016); last = t;
  updateWizard(dt);
  updateSchoolPopulation(dt);
  if (!preview && zoom > 100) positionCamera();
  updateWandLight(dt);
  updateStockroomHint();
  if (searchBookStack) searchBookStack.hidden = !canSearchBookStack();
  waterCharge = canCastWater() ? Math.min(1, waterCharge + dt * 7) : 0;
  fireCharge = canBreatheFire() ? Math.min(1, fireCharge + dt * 7) : 0;
  ctx.clearRect(0, 0, W, H);
  if (!preview && !chestInventory?.open && librarianDialogue.hidden) updateIceBalls(dt);
  if (currentRoom === rooms.tower) drawSky();
  ctx.drawImage(currentRoom.canvas, 0, 0);
  drawRoomWindowLife(t);
  if (currentRoom === rooms.potion) {
    if (!isStockroomUnlocked()) ctx.drawImage(closedStockDoor, 0, 0);
    drawRackBubbles(t);
    ctx.drawImage(rackGlass, 0, 0);
  }
  drawTileBorder(hoveredTile, '#ffe083');
  drawTileBorder(destination, '#9dffdb');
  if (currentRoom !== rooms.tower) {
    if (currentRoom === rooms.library) {
      if (librarianDialogue.hidden) updateLibrarian(dt);
      updateLibraryStudents(dt);
      drawLibraryPortrait(t);
      animateLibraryClock(t);
      drawLibraryLights(t);
    } else if (currentRoom === rooms.potion) {
      drawPotionLight(t);
    } else {
      if (currentRoom === rooms.stockroom) {
        drawStockPaintings(ctx, t, true);
        drawStockLanterns(t);
      } else if (currentRoom === rooms.classroom) {
        drawClassroomLights(t);
      } else {
        drawLibraryLights(t, currentRoom === rooms.hall ? firstHallLanterns : hallLanterns);
        drawHallCandles(t, currentRoom === rooms.hallEnd);
        if (currentRoom === rooms.hall) drawHallChandelier(t);
      }
    }
    drawRoomOccupants(t, dt);
    // De voorste muur staat vóór de meubels en personages op de vloer.
    if (currentRoom.foreground) ctx.drawImage(currentRoom.foreground, 0, 0);
    if (currentRoom === rooms.potion) drawQuestMarker(t);
    drawDialogueIndicators(t);
    if (currentRoom.corridor) drawHallAtmosphere(t);
    requestAnimationFrame(frame);
    return;
  }
  banner(t, 7, 12, 0); banner(t, 89, 14, 3);
  drawPortrait(t);
  drawFire(t, dt);
  drawRoomOccupants(t, dt);
  const n = (Math.sin(t * 9) + Math.sin(t * 13.7) + Math.sin(t * 5.3)) / 3;
  const [gx, gy] = P(21, 6, 14);
  if (hearthLit) glow(gx, gy, 80, 56, '255,166,75', .052 + .015 * n);
  for (const [x, y] of cand) glow(x, y + 4, 22, 16, '255,200,120', .03);
  if (loadingScreen && !loadingScreen.hidden) {
    loadingProgress.value = loadingProgress.max;
    document.getElementById('wrap').removeAttribute('aria-busy');
    loadingScreen.hidden = true;
    showRoomTitle(currentRoom.title);
  }
  if (preview && cv.hidden) {
    cv.hidden = false;
    cv.previousElementSibling.hidden = true;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (preview) return;

/* ---------- zoom ---------- */
const sceneView = document.getElementById('scene-view');
const zoomOut = document.getElementById('zoom-out');
const zoomIn = document.getElementById('zoom-in');
const zoomReset = document.getElementById('zoom-reset');
const MIN_ZOOM = 75, MAX_ZOOM = 200, ZOOM_STEP = 25;
let zoom = 100;
let cameraScale = 1;
let roomWidth, roomHeight;

function positionCamera() {
  const { clientWidth, clientHeight } = sceneView;
  const step = wizard.step;
  const progress = step ? step.elapsed / STEP_TIME : 0;
  const a = (wizard.a + (step ? (step.a - wizard.a) * progress : 0) + .5) * TILE_SIZE;
  const b = (wizard.b + (step ? (step.b - wizard.b) * progress : 0) + .5) * TILE_SIZE;
  const [x, y] = P(a, b, 16);
  const roomLeft = currentRoom.corridor ? CX - 2 * (HALL_DEPTH + T) - 5 : (W - roomWidth) / 2;
  const offset = (viewport, start, length, focus) => {
    const scaled = length * cameraScale;
    if (scaled <= viewport) return (viewport - scaled) / 2 - start * cameraScale;
    const withinRoom = (focus - start) * cameraScale - viewport / 2;
    return -start * cameraScale - Math.max(0, Math.min(scaled - viewport, withinRoom));
  };
  const left = Math.round(offset(clientWidth, roomLeft, roomWidth, x));
  const top = Math.round(offset(clientHeight, 0, roomHeight, y));
  const transform = `translate(${left}px, ${top}px)`;
  if (cv.style.transform !== transform) {
    cv.style.transform = transform;
    clearHover();
  }
}

function fit() {
  const stockroom = currentRoom === rooms.stockroom;
  const library = currentRoom === rooms.library;
  const hall = currentRoom.corridor;
  const classroom = currentRoom === rooms.classroom;
  const width = classroom ? CLASSROOM_WIDTH : hall ? HALL_WIDTH : library ? LIBRARY_WIDTH : stockroom ? STOCK_WIDTH : currentRoom === rooms.tower ? TOWER_SIZE : POTION_COLUMNS * TILE_SIZE;
  const depth = classroom ? CLASSROOM_DEPTH : hall ? HALL_DEPTH : library ? LIBRARY_DEPTH : stockroom ? STOCK_DEPTH : currentRoom === rooms.tower ? TOWER_SIZE : POTION_COLUMNS * TILE_SIZE;
  roomWidth = hall ? 2 * (width + depth + 2 * T) + 10 : 4 * (Math.max(width, depth) + T) + 10;
  roomHeight = CY + width + depth + F + 12;
  const fitScale = Math.min(sceneView.clientWidth / roomWidth, sceneView.clientHeight / roomHeight);
  cameraScale = fitScale * zoom / 100;
  cv.style.width = W * cameraScale + 'px';
  cv.style.height = H * cameraScale + 'px';
  clearHover();
  positionCamera();
  zoomOut.disabled = zoom === MIN_ZOOM;
  zoomIn.disabled = zoom === MAX_ZOOM;
  zoomReset.textContent = zoom === 100 ? 'Fit' : zoom + '%';
  zoomReset.setAttribute('aria-label', `Zoom ${zoom} percent. Fit the full room.`);
}
function setZoom(value) {
  zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  fit();
}
zoomOut.addEventListener('click', () => setZoom(zoom - ZOOM_STEP));
zoomIn.addEventListener('click', () => setZoom(zoom + ZOOM_STEP));
zoomReset.addEventListener('click', () => setZoom(100));
new ResizeObserver(fit).observe(sceneView);
fit();

})();
