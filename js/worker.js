// Runs the solver off the main thread so the UI doesn't freeze for the
// (occasionally many-second) search.
importScripts('cube.js', 'solverCore.js', 'solver3x3.js', 'solver2x2.js');

self.onmessage = (e) => {
  const { size, scramble } = e.data;
  try {
    const cube = new self.CubeEngine.Cube(size);
    cube.algorithm(scramble);
    const result = size === 2 ? self.Solver2x2.solve2x2(cube) : self.Solver3x3.solve3x3(cube);
    self.postMessage({ ok: true, steps: result.steps });
  } catch (err) {
    self.postMessage({ ok: false, error: err.message });
  }
};
