(function(){
// 2x2 solver: place one full layer's corners, then fix the last layer
// (orientation + permutation) — the exact same small-bounded-search technique
// as the 3x3 solver's F2L-corner and last-layer stages, just without edges.
const CubeMod = typeof module !== 'undefined' ? require('./cube.js') : globalThis.CubeEngine;
const CoreMod = typeof module !== 'undefined' ? require('./solverCore.js') : globalThis.SolverCore;
const { COLORS } = CubeMod;
const { findByColorSet, searchPieces } = CoreMod;

function poolFor(faces) { const out = []; for (const f of faces) out.push(f, f + "'", f + '2'); return out; }
function clonePiece(p) { return { x: p.x, y: p.y, z: p.z, colors: { ...p.colors } }; }
const AXIS_VAL = { U: ['y', 1], D: ['y', -1], F: ['z', 1], B: ['z', -1], R: ['x', 1], L: ['x', -1] };
function touchesFace(piece, face) { const [ax, v] = AXIS_VAL[face]; return piece[ax] === v; }
const CORNER_SLOT = { FR: [1, -1, 1], FL: [-1, -1, 1], BR: [1, -1, -1], BL: [-1, -1, -1] };
function isCorner(p) { return true; } // every 2x2 piece is a corner

function solveFirstLayer(cube) {
  const order = ['FR', 'FL', 'BR', 'BL'];
  const solvedChecks = [];
  const moves = [];
  for (const key of order) {
    const s1 = key[0], s2 = key[1];
    const [cx, cy, cz] = CORNER_SLOT[key];
    const corner = findByColorSet(cube, [COLORS.D, COLORS[s1], COLORS[s2]]);
    const piecesByName = { corner: clonePiece(corner) };
    // Any pool that includes D disturbs ALL 4 D-layer corners at once (2x2
    // has no separate edge layer to absorb it) — so every previously placed
    // one must be tracked/preserved, not just ones sharing a face with this slot.
    solvedChecks.forEach((pk, i) => { piecesByName['p' + i] = clonePiece(pk.corner); });
    const goal = ps => {
      const co = ps.corner;
      if (!(co.x === cx && co.y === cy && co.z === cz && co.colors.D === COLORS.D)) return false;
      for (let i = 0; i < solvedChecks.length; i++) {
        const pk = solvedChecks[i], p = ps['p' + i];
        if (!(p.x === pk.cx && p.y === pk.cy && p.z === pk.cz && p.colors.D === COLORS.D)) return false;
      }
      return true;
    };
    const extraFace = ['F', 'B', 'R', 'L'].find(f => f !== s1 && f !== s2);
    let sol = searchPieces(piecesByName, poolFor(['U', 'D', s1, s2]), goal, 11, 2, 250000);
    if (sol === null) sol = searchPieces(piecesByName, poolFor(['U', 'D', s1, s2]), goal, 14, 2, 400000);
    if (sol === null) sol = searchPieces(piecesByName, poolFor(['U', 'D', s1, s2, extraFace]), goal, 12, 2, 600000);
    if (sol === null) throw new Error('Không tìm được bước đặt góc ' + key);
    if (sol) { cube.algorithm(sol); moves.push(sol); }
    solvedChecks.push({ corner: clonePiece(corner), s1, s2, cx, cy, cz });
  }
  return moves.join(' ').trim();
}

// Verified to leave the bottom layer untouched — any composition of them
// does too — so orientation and (even, i.e. 3-cycle-reachable) permutation
// of the last layer can search over just the 4 top pieces.
const SUNE = "R U R' U R U2 R'", ANTISUNE = "R U2 R' U' R U' R'";
const ORIENT_TOOLKIT = [SUNE, ANTISUNE];
// A-perm alone only reaches even permutations (3-cycles); adding a bare U
// turn as its own unit (not just a conjugation setup) lets the search reach
// odd ones too — an odd unit composed with even ones covers all of S4.
const PERM_TOOLKIT = ["R' F R' B2 R F' R' B2 R2", 'U'];

function solveLastLayer(cube) {
  const moves = [];
  function fixAspect(goalCheckFn, toolkit, depth) {
    const pieces = cube.cubies.filter(p => p.y === 1).map(clonePiece);
    const piecesByName = {}; pieces.forEach((p, i) => { piecesByName['p' + i] = p; });
    const goal = ps => Object.values(ps).every(goalCheckFn);
    if (goal(piecesByName)) return true;
    const sol = CoreMod.searchAlgorithmUnits(piecesByName, toolkit, goal, depth, 2);
    if (sol === null) return false;
    if (sol) { cube.algorithm(sol); moves.push(sol); }
    return true;
  }
  const oriented = p => p.colors.U === COLORS.U;
  const fullySolvedPiece = p => Object.keys(p.colors).every(f => p.colors[f] === COLORS[f]);

  if (fixAspect(oriented, ORIENT_TOOLKIT, 6) && fixAspect(fullySolvedPiece, PERM_TOOLKIT, 6) && cube.isSolved()) {
    return moves.join(' ').trim();
  }
  // A-perm alone only reaches even permutations of the 4 corners — about half
  // of all cases need an odd one. Those fall back to a plain, unrestricted
  // search of the whole cube (small for 2x2: 8 pieces), which is slow but
  // always finds a solution eventually.
  const fullySolved = p => Object.keys(p.colors).every(f => p.colors[f] === COLORS[f]);
  const all = cube.cubies.map(clonePiece);
  const piecesByName = {}; all.forEach((p, i) => { piecesByName['p' + i] = p; });
  const goal = ps => Object.values(ps).every(fullySolved);
  const sol = searchPieces(piecesByName, poolFor(['U', 'D', 'R', 'F', 'L', 'B']), goal, 11, 2, 10000000);
  if (sol === null) throw new Error('Không giải được tầng cuối (trường hợp hiếm, hãy thử xáo lại khối)');
  if (sol) { cube.algorithm(sol); moves.push(sol); }
  if (!cube.isSolved()) throw new Error('Không hoàn thiện được tầng cuối');
  return moves.join(' ').trim();
}

function solve2x2(cube) {
  const working = cube.clone();
  const steps = [];
  steps.push({ name: 'Tầng đầu (First layer)', moves: solveFirstLayer(working) });
  steps.push({ name: 'CLL (tầng cuối)', moves: solveLastLayer(working) });
  if (!working.isSolved()) throw new Error('Lời giải không chính xác (lỗi nội bộ)');
  return { steps };
}

const api = { solve2x2 };
if (typeof module !== 'undefined') module.exports = api;
else globalThis.Solver2x2 = api;
})();
