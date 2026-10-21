(function(){
// Shared solving primitives: generic bounded search for "make this goal true
// without breaking previously-solved pieces" — reused by every CFOP/CLL stage
// instead of hand-written case tables per stage.
const { Cube, inverseMove, applyTokenToPiece } = typeof module !== 'undefined' ? require('./cube.js') : globalThis.CubeEngine;

const ALL_FACES = ['U', 'D', 'L', 'R', 'F', 'B'];
function allMoves(faces = ALL_FACES) {
  const out = [];
  for (const f of faces) out.push(f, f + "'", f + '2');
  return out;
}

function findByColorSet(cube, colors) {
  const want = [...colors].sort().join(',');
  return cube.cubies.find(c => Object.values(c.colors).sort().join(',') === want);
}

const FACE_ORDER = ['U', 'D', 'F', 'B', 'R', 'L'];
function stateKey(cube) {
  let s = '';
  for (const c of cube.cubies) {
    s += c.x + ',' + c.y + ',' + c.z + ':';
    for (const f of FACE_ORDER) s += c.colors[f] ? c.colors[f][0] : '.';
    s += '|';
  }
  return s;
}

// Breadth-first search over the move group, deduping visited states so the
// same configuration is never re-explored via a different move order — this
// is what keeps it fast; plain depth-first blows up combinatorially past ~6
// moves. Operates on cloned cubes (frontier holds {cube, path} pairs) so no
// state is replayed from scratch at each level. Returns the winning move
// string and leaves `cube` mutated to the solved state, or null.
function search(cube, movePool, goalFn, maxDepth = 8, visitBudget = 400000) {
  if (goalFn(cube)) return '';
  const visited = new Set([stateKey(cube)]);
  let frontier = [{ cube, path: [] }];
  let visits = 0;
  for (let d = 1; d <= maxDepth; d++) {
    const next = [];
    for (const { cube: c, path } of frontier) {
      for (const tok of movePool) {
        if (++visits > visitBudget) return null; // bail out rather than exhaust memory
        const nc = c.clone();
        nc.move(tok);
        if (goalFn(nc)) {
          const sol = [...path, tok].join(' ');
          cube.cubies = nc.cubies;
          return sol;
        }
        const key = stateKey(nc);
        if (!visited.has(key)) { visited.add(key); next.push({ cube: nc, path: [...path, tok] }); }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return null;
}

function pieceKey(p) {
  let s = p.x + ',' + p.y + ',' + p.z + ':';
  for (const f of FACE_ORDER) s += p.colors[f] ? p.colors[f][0] : '.';
  return s;
}

// Same idea as `search`, but tracks only a handful of individual pieces
// (plain {x,y,z,colors} objects, no Cube instance) instead of the whole
// cube. Each move's effect on a piece depends only on that piece's own
// coordinates, so this is exactly equivalent to a full-cube search but
// orders of magnitude cheaper — the only pieces worth tracking are the ones
// the goal cares about (the target + anything already solved that could be
// disturbed). `goalFn(piecesByName)` receives the same name->piece map it
// was given, with pieces now in the state reached after the moves so far.
function searchPieces(piecesByName, movePool, goalFn, maxDepth, size = 3, visitBudget = 400000) {
  const names = Object.keys(piecesByName);
  if (goalFn(piecesByName)) return '';
  const key = pieces => names.map(n => pieceKey(pieces[n])).join('|');
  const visited = new Set([key(piecesByName)]);
  let frontier = [{ pieces: piecesByName, path: [] }];
  let visits = 0;
  for (let d = 1; d <= maxDepth; d++) {
    const next = [];
    for (const { pieces, path } of frontier) {
      for (const tok of movePool) {
        if (++visits > visitBudget) return null; // bail out rather than exhaust memory
        const moved = {};
        for (const n of names) moved[n] = applyTokenToPiece(pieces[n], tok, size);
        if (goalFn(moved)) return [...path, tok].join(' ');
        const k = key(moved);
        if (!visited.has(k)) { visited.add(k); next.push({ pieces: moved, path: [...path, tok] }); }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return null;
}
// BFS over a small toolkit of ALGORITHMS (each a verified bottom-preserving
// multi-move string, e.g. Sune) plus U-rotations, treating each whole
// algorithm as one search "move". This is what makes last-layer fixes
// tractable: searching raw quarter-turns needs huge depth (each algorithm is
// 6-14 tokens) and explodes; searching algorithm-units needs depth ~3-4 and
// stays tiny. Safe to ignore bottom-layer pieces entirely — composing
// bottom-preserving algorithms always preserves the bottom layer.
function searchAlgorithmUnits(piecesByName, toolkit, goalFn, maxDepth, size = 3) {
  const names = Object.keys(piecesByName);
  if (goalFn(piecesByName)) return '';
  // Conjugate by the setup rotation (rot, alg, rot⁻¹) rather than just
  // prefixing it — a plain prefix would permanently rotate away any already-
  // solved pieces the algorithm itself doesn't touch (e.g. corners, once a
  // prior phase fixed them, while this phase's algorithm only cycles edges).
  // Conjugation accesses the same set of "angles" but always undoes the
  // setup afterward, so anything the bare algorithm fixes stays fixed.
  const rotations = [['', ''], ['U', "U'"], ["U'", 'U'], ['U2', 'U2']];
  const units = [];
  for (const [rot, rotInv] of rotations) for (const alg of toolkit) {
    const label = [rot, alg, rotInv].filter(Boolean).join(' ');
    units.push({ label, tokens: label.trim().split(/\s+/) });
  }
  const key = pieces => names.map(n => pieceKey(pieces[n])).join('|');
  const visited = new Set([key(piecesByName)]);
  let frontier = [{ pieces: piecesByName, path: [] }];
  for (let d = 1; d <= maxDepth; d++) {
    const next = [];
    for (const { pieces, path } of frontier) {
      for (const unit of units) {
        let moved = pieces;
        for (const tok of unit.tokens) {
          const stepped = {};
          for (const n of names) stepped[n] = applyTokenToPiece(moved[n], tok, size);
          moved = stepped;
        }
        if (goalFn(moved)) return [...path, unit.label].join(' ');
        const k = key(moved);
        if (!visited.has(k)) { visited.add(k); next.push({ pieces: moved, path: [...path, unit.label] }); }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return null;
}

const api = { allMoves, findByColorSet, search, searchPieces, searchAlgorithmUnits };
if (typeof module !== 'undefined') module.exports = api;
else globalThis.SolverCore = api;
})();
