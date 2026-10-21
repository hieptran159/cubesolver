(function(){
// Random scramble generator. Avoids immediately repeating/cancelling the same axis.
function randomScramble(size, length) {
  const faces3 = ['U', 'D', 'L', 'R', 'F', 'B'];
  const faces2 = ['U', 'D', 'R', 'F']; // 2x2: fixing L/B/D-centerless redundancy, any 4 independent faces suffice
  const faces = size === 2 ? faces2 : faces3;
  const AXIS = { U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };
  const suffixes = ['', "'", '2'];
  const moves = [];
  let lastAxis = null;
  for (let i = 0; i < length; i++) {
    let face;
    do { face = faces[Math.floor(Math.random() * faces.length)]; } while (AXIS[face] === lastAxis);
    lastAxis = AXIS[face];
    moves.push(face + suffixes[Math.floor(Math.random() * suffixes.length)]);
  }
  return moves.join(' ');
}

if (typeof module !== 'undefined') module.exports = { randomScramble };
else globalThis.randomScramble = randomScramble;
})();
