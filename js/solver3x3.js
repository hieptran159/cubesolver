(function(){
// 3x3 CFOP-style solver: Cross -> F2L -> OLL -> PLL. Returns { steps: [{name, moves}] }.
// Each stage is solved via a small bounded search (see solverCore.js) rather than
// hand-written case tables — the search always verifies the real engine state, so
// correctness doesn't depend on memorized algorithms being transcribed perfectly.
const CubeMod = typeof module !== 'undefined' ? require('./cube.js') : globalThis.CubeEngine;
const CoreMod = typeof module !== 'undefined' ? require('./solverCore.js') : globalThis.SolverCore;
const { Cube, COLORS } = CubeMod;
const { allMoves, findByColorSet, search, searchPieces } = CoreMod;

function poolFor(faces) { const out = []; for (const f of faces) out.push(f, f + "'", f + '2'); return out; }
function clonePiece(p) { return { x: p.x, y: p.y, z: p.z, colors: { ...p.colors } }; }

const SIDES = ['F', 'R', 'B', 'L'];
const EDGE_SLOT = { F: [0, -1, 1], R: [1, -1, 0], B: [0, -1, -1], L: [-1, -1, 0] };
const CORNER_SLOT = { FR: [1, -1, 1], FL: [-1, -1, 1], BR: [1, -1, -1], BL: [-1, -1, -1] };
const F2L_EDGE_SLOT = { FR: [1, 0, 1], FL: [-1, 0, 1], BR: [1, 0, -1], BL: [-1, 0, -1] };
const AXISV = { U: ['y', 1], D: ['y', -1], F: ['z', 1], B: ['z', -1], R: ['x', 1], L: ['x', -1] };
function inRegion(piece, faces) { return faces.some(f => { const [ax, v] = AXISV[f]; return piece[ax] === v; }); }

function solveCross(cube) {
  const moves = [];
  const placed = [];
  function edgeOk(c, s) {
    const p = findByColorSet(c, [COLORS.D, COLORS[s]]); const [x, y, z] = EDGE_SLOT[s];
    return p.x === x && p.y === y && p.z === z && p.colors.D === COLORS.D;
  }
  for (const s of SIDES) {
    const sol = search(cube, allMoves(), c => edgeOk(c, s) && placed.every(p => edgeOk(c, p)), 8, 250000);
    if (sol === null) throw new Error('Không tìm được bước giải Cross cho mặt ' + s);
    if (sol) moves.push(sol);
    placed.push(s);
  }
  return moves.join(' ').trim();
}

function solveF2L(cube) {
  const order = ['FR', 'FL', 'BL', 'BR'];
  const solvedChecks = [];
  const moves = [];
  for (const key of order) {
    const s1 = key[0], s2 = key[1];
    const region = ['U', s1, s2];
    let corner = findByColorSet(cube, [COLORS.D, COLORS[s1], COLORS[s2]]);
    let edge = findByColorSet(cube, [COLORS[s1], COLORS[s2]]);
    for (const colors of [[COLORS.D, COLORS[s1], COLORS[s2]], [COLORS[s1], COLORS[s2]]]) {
      const piece = findByColorSet(cube, colors);
      if (!inRegion(piece, region)) {
        const sol = search(cube, allMoves(), c => inRegion(findByColorSet(c, colors), region), 2);
        if (sol === null) throw new Error('Không thể đưa khối vào vị trí cho F2L ' + key);
        if (sol) moves.push(sol);
        corner = findByColorSet(cube, [COLORS.D, COLORS[s1], COLORS[s2]]);
        edge = findByColorSet(cube, [COLORS[s1], COLORS[s2]]);
      }
    }
    const [cx, cy, cz] = CORNER_SLOT[key], [ex, ey, ez] = F2L_EDGE_SLOT[key];
    const piecesByName = { corner: clonePiece(corner), edge: clonePiece(edge) };
    // Pool options below sometimes include D, which (unlike a single face
    // turn) disturbs ALL 4 cross edges and interacts with every previously
    // solved F2L pair at once — so once D is on the table, everything
    // already solved must be tracked, not just pieces sharing a face.
    const crossPieces = SIDES.map(s => ({ s, p: clonePiece(findByColorSet(cube, [COLORS.D, COLORS[s]])) }));
    crossPieces.forEach(({ p }, i) => { piecesByName['cr' + i] = p; });
    solvedChecks.forEach((pk, i) => { piecesByName['pc' + i] = clonePiece(pk.corner); piecesByName['pe' + i] = clonePiece(pk.edge); });
    const goal = pieces => {
      const co = pieces.corner, ed = pieces.edge;
      if (!(co.x === cx && co.y === cy && co.z === cz && co.colors.D === COLORS.D)) return false;
      if (!(ed.x === ex && ed.y === ey && ed.z === ez && ed.colors[s1] === COLORS[s1])) return false;
      for (let i = 0; i < crossPieces.length; i++) {
        const { s } = crossPieces[i]; const p = pieces['cr' + i]; const [sx, sy, sz] = EDGE_SLOT[s];
        if (!(p.x === sx && p.y === sy && p.z === sz && p.colors.D === COLORS.D)) return false;
      }
      for (let i = 0; i < solvedChecks.length; i++) {
        const pk = solvedChecks[i]; const pc = pieces['pc' + i], pe = pieces['pe' + i];
        if (!(pc.x === pk.cx && pc.y === pk.cy && pc.z === pk.cz && pc.colors.D === COLORS.D)) return false;
        if (!(pe.x === pk.ex && pe.y === pk.ey && pe.z === pk.ez && pe.colors[pk.s1] === COLORS[pk.s1])) return false;
      }
      return true;
    };
    const extraFace = ['F', 'B', 'R', 'L'].find(f => f !== s1 && f !== s2);
    let sol = searchPieces(piecesByName, poolFor(['U', s1, s2]), goal, 11, 3, 400000);
    if (sol === null) sol = searchPieces(piecesByName, poolFor(['U', s1, s2]), goal, 15, 3, 1500000);
    if (sol === null) sol = searchPieces(piecesByName, poolFor(['U', s1, s2, extraFace]), goal, 13, 3, 1500000);
    if (sol === null) sol = searchPieces(piecesByName, poolFor(['U', 'D', s1, s2]), goal, 13, 3, 1500000);
    if (sol === null) sol = searchPieces(piecesByName, poolFor(['U', 'D', s1, s2, extraFace]), goal, 14, 3, 2500000);
    if (sol === null) throw new Error('Không tìm được bước giải F2L cho góc ' + key);
    if (sol) { cube.algorithm(sol); moves.push(sol); }
    solvedChecks.push({ corner: clonePiece(corner), edge: clonePiece(edge), s1, s2, cx, cy, cz, ex, ey, ez });
  }
  return moves.join(' ').trim();
}

function isCorner(p) { return Math.abs(p.x) === 1 && Math.abs(p.z) === 1; }
function isEdgePiece(p) { return Math.abs(p.x) + Math.abs(p.z) === 1; }

// Last-layer algorithms, each independently verified (see dev notes) to
// leave the bottom two layers untouched — so any combination of them does
// too, by simple composition. That means orienting/permuting the last layer
// can search over just the 8 top pieces and completely ignore the bottom:
// no tracking, no risk of disturbing F2L.
const SUNE = "R U R' U R U2 R'", ANTISUNE = "R U2 R' U' R U' R'";
const EDGE_ORIENT_TOOLKIT = ["F R U R' U' F'", "F U R U' R' F'"];
const CORNER_ORIENT_TOOLKIT = [SUNE, ANTISUNE];
const CORNER_PERM_TOOLKIT = ["R' F R' B2 R F' R' B2 R2"]; // A-perm: corners only
const EDGE_PERM_TOOLKIT = ["R2 U R U R' U' R' U' R' U R'", "R U' R U R U R U' R' U' R2"]; // U-perms: edges only
const MIXED_TOOLKIT = [
  "R U R' U' R' F R2 U' R' U' R U R' F'", // T-perm
  "F R U' R' U' R U R' F' R U R' U' R' F R F'", // Y-perm
];

function solveLastLayer(cube) {
  const moves = [];
  function fixAspect(filterFn, goalCheckFn, toolkit, depth) {
    const pieces = cube.cubies.filter(p => p.y === 1 && filterFn(p)).map(clonePiece);
    const piecesByName = {}; pieces.forEach((p, i) => { piecesByName['p' + i] = p; });
    const goal = ps => Object.values(ps).every(goalCheckFn);
    if (goal(piecesByName)) return true;
    const sol = CoreMod.searchAlgorithmUnits(piecesByName, toolkit, goal, depth, 3);
    if (sol === null) return false;
    if (sol) { cube.algorithm(sol); moves.push(sol); }
    return true;
  }
  const oriented = p => p.colors.U === COLORS.U;
  const fullySolvedPiece = p => Object.keys(p.colors).every(f => p.colors[f] === COLORS[f]);

  if (!fixAspect(isEdgePiece, oriented, EDGE_ORIENT_TOOLKIT, 5)) throw new Error('Không định hướng được cạnh tầng cuối (OLL)');
  if (!fixAspect(isCorner, oriented, CORNER_ORIENT_TOOLKIT, 5)) throw new Error('Không định hướng được góc tầng cuối (OLL)');
  if (!fixAspect(isCorner, fullySolvedPiece, CORNER_PERM_TOOLKIT.concat(MIXED_TOOLKIT), 5)) throw new Error('Không đổi vị trí được góc tầng cuối (PLL)');
  if (!fixAspect(isEdgePiece, fullySolvedPiece, EDGE_PERM_TOOLKIT.concat(MIXED_TOOLKIT), 5)) throw new Error('Không đổi vị trí được cạnh tầng cuối (PLL)');
  if (!cube.isSolved()) throw new Error('Không hoàn thiện được tầng cuối sau nhiều vòng thử');
  return moves.join(' ').trim();
}

function solve3x3(cube) {
  const working = cube.clone();
  const steps = [];
  steps.push({ name: 'Cross', moves: solveCross(working) });
  steps.push({ name: 'F2L', moves: solveF2L(working) });
  const llMoves = solveLastLayer(working);
  // Report OLL/PLL as one combined "last layer" pass — the alternating fixer
  // doesn't cleanly separate into two independent move groups.
  steps.push({ name: 'OLL + PLL', moves: llMoves });
  if (!working.isSolved()) throw new Error('Lời giải không chính xác (lỗi nội bộ)');
  return { steps };
}

const api = { solve3x3 };
if (typeof module !== 'undefined') module.exports = api;
else globalThis.Solver3x3 = api;
})();
