(function(){
// Generic cubie-based cube engine. Works for 2x2 and 3x3 via `size`.
// Position/orientation of every sticker is tracked as a 3D direction vector,
// so a single rotation formula handles every move for any cube size.

const FACE_DIR = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
const DIR_FACE = {};
for (const f in FACE_DIR) DIR_FACE[FACE_DIR[f].join(',')] = f;
const COLORS = { U: 'white', D: 'yellow', F: 'green', B: 'blue', R: 'red', L: 'orange' };

// 90/−90/180 degree rotation of a 2D pair, right-hand-rule convention.
function rot2(a, b, theta) {
  if (theta === 90) return [-b, a];
  if (theta === -90) return [b, -a];
  return [-a, -b]; // 180
}
function rotatePoint([x, y, z], axis, theta) {
  if (axis === 'x') { const [y2, z2] = rot2(y, z, theta); return [x, y2, z2]; }
  if (axis === 'y') { const [z2, x2] = rot2(z, x, theta); return [x2, y, z2]; }
  const [x2, y2] = rot2(x, y, theta); return [x2, y2, z];
}

// Each move: axis, the coordinate value(s) it grabs, and its base quarter-turn angle.
const MOVE_DEFS = {
  R: { axis: 'x', layer: 'max', theta: -90 },
  L: { axis: 'x', layer: 'min', theta: 90 },
  U: { axis: 'y', layer: 'max', theta: -90 },
  D: { axis: 'y', layer: 'min', theta: 90 },
  F: { axis: 'z', layer: 'max', theta: -90 },
  B: { axis: 'z', layer: 'min', theta: 90 },
  M: { axis: 'x', layer: 'mid', theta: 90 },
  E: { axis: 'y', layer: 'mid', theta: 90 },
  S: { axis: 'z', layer: 'mid', theta: -90 },
  x: { axis: 'x', layer: 'all', theta: -90 },
  y: { axis: 'y', layer: 'all', theta: -90 },
  z: { axis: 'z', layer: 'all', theta: -90 },
};

class Cube {
  constructor(size) {
    this.size = size; // 2 or 3
    this.coords = size === 2 ? [-1, 1] : [-1, 0, 1];
    this.cubies = [];
    for (const x of this.coords) for (const y of this.coords) for (const z of this.coords) {
      if (x === 0 && y === 0 && z === 0) continue; // invisible core
      this.cubies.push(this.makeCubie(x, y, z));
    }
  }
  makeCubie(x, y, z) {
    const max = this.coords[this.coords.length - 1], min = this.coords[0];
    const colors = {};
    if (x === max) colors.R = COLORS.R;
    if (x === min) colors.L = COLORS.L;
    if (y === max) colors.U = COLORS.U;
    if (y === min) colors.D = COLORS.D;
    if (z === max) colors.F = COLORS.F;
    if (z === min) colors.B = COLORS.B;
    return { x, y, z, colors };
  }
  get(x, y, z) { return this.cubies.find(c => c.x === x && c.y === y && c.z === z); }
  clone() {
    const c = new Cube(this.size);
    c.cubies = this.cubies.map(cb => ({ x: cb.x, y: cb.y, z: cb.z, colors: { ...cb.colors } }));
    return c;
  }
  layerValues(axis, layer) {
    const max = this.coords[this.coords.length - 1], min = this.coords[0];
    if (layer === 'max') return [max];
    if (layer === 'min') return [min];
    if (layer === 'mid') return this.size === 3 ? [0] : [];
    return this.coords; // 'all'
  }
  // Rotate the cubies on `axis` whose coordinate is in `layerValues` by `theta`.
  turn(axis, layerVals, theta) {
    for (const c of this.cubies) {
      if (!layerVals.includes(c[axis])) continue;
      const [nx, ny, nz] = rotatePoint([c.x, c.y, c.z], axis, theta);
      const newColors = {};
      for (const face in c.colors) {
        const dir = FACE_DIR[face];
        const [dx, dy, dz] = rotatePoint(dir, axis, theta);
        newColors[DIR_FACE[[dx, dy, dz].join(',')]] = c.colors[face];
      }
      c.x = nx; c.y = ny; c.z = nz; c.colors = newColors;
    }
  }
  // Apply one move token, e.g. "R", "R'", "R2", "Rw", "x2".
  move(token) {
    const m = token.match(/^([A-Za-z])(w)?('|2)?$/);
    if (!m) throw new Error('bad move: ' + token);
    const [, letter, wide, suffix] = m;
    const def = MOVE_DEFS[letter];
    if (!def) throw new Error('unknown move: ' + token);
    let layer = def.layer;
    if (wide) layer = def.layer === 'max' ? ['max', 'mid'] : def.layer === 'min' ? ['min', 'mid'] : layer;
    const layerVals = Array.isArray(layer) ? layer.flatMap(l => this.layerValues(def.axis, l)) : this.layerValues(def.axis, layer);
    let theta = def.theta;
    if (suffix === "'") theta = -theta;
    if (suffix === '2') theta = 180;
    this.turn(def.axis, layerVals, theta);
  }
  algorithm(str) {
    str.trim().split(/\s+/).filter(Boolean).forEach(tok => this.move(tok));
  }
  isSolved() {
    return this.cubies.every(c => Object.keys(c.colors).every(f => c.colors[f] === COLORS[f]));
  }
}

// Parse one move token into { letter, wide, suffix }.
function parseToken(token) {
  const m = token.match(/^([A-Za-z])(w)?('|2)?$/);
  if (!m) throw new Error('bad move: ' + token);
  return { letter: m[1], wide: !!m[2], suffix: m[3] || '' };
}
function pieceInLayer(coord, layer, size) {
  if (layer === 'max') return coord === 1;
  if (layer === 'min') return coord === -1;
  if (layer === 'mid') return size === 3 && coord === 0;
  return true; // 'all'
}
// Apply one move token to a single lightweight piece ({x,y,z,colors}), independent
// of any Cube instance — used by the solver to search over just a few tracked
// pieces instead of the whole cube, which is dramatically cheaper.
function applyTokenToPiece(piece, token, size) {
  const { letter, wide, suffix } = parseToken(token);
  const def = MOVE_DEFS[letter];
  if (!def) throw new Error('unknown move: ' + token);
  const layers = wide
    ? (def.layer === 'max' ? ['max', 'mid'] : def.layer === 'min' ? ['min', 'mid'] : [def.layer])
    : [def.layer];
  if (!layers.some(l => pieceInLayer(piece[def.axis], l, size))) return piece;
  let theta = def.theta;
  if (suffix === "'") theta = -theta;
  if (suffix === '2') theta = 180;
  const [nx, ny, nz] = rotatePoint([piece.x, piece.y, piece.z], def.axis, theta);
  const newColors = {};
  for (const face in piece.colors) {
    const [dx, dy, dz] = rotatePoint(FACE_DIR[face], def.axis, theta);
    newColors[DIR_FACE[[dx, dy, dz].join(',')]] = piece.colors[face];
  }
  return { x: nx, y: ny, z: nz, colors: newColors };
}

function inverseMove(token) {
  const m = token.match(/^([A-Za-z]w?)('|2)?$/);
  const [, base, suffix] = m;
  if (suffix === '2') return base + '2';
  if (suffix === "'") return base;
  return base + "'";
}
function inverseAlgorithm(str) {
  return str.trim().split(/\s+/).filter(Boolean).reverse().map(inverseMove).join(' ');
}

const api = { Cube, COLORS, FACE_DIR, inverseMove, inverseAlgorithm, applyTokenToPiece };
if (typeof module !== 'undefined') module.exports = api;
else globalThis.CubeEngine = api;
})();
