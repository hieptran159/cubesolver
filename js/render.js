(function(){
// CSS-3D renderer for the Cube model. Pure DOM, no libraries.
const STEP = 46; // px between cubie centers
const SIZE = 44; // cubie face size
const HALF = SIZE / 2;

const FACE_CSS = {
  F: `translateZ(${HALF}px)`,
  B: `rotateY(180deg) translateZ(${HALF}px)`,
  R: `rotateY(90deg) translateZ(${HALF}px)`,
  L: `rotateY(-90deg) translateZ(${HALF}px)`,
  U: `rotateX(90deg) translateZ(${HALF}px)`,
  D: `rotateX(-90deg) translateZ(${HALF}px)`,
};

function buildCubieEl(cubie, unitStep) {
  const el = document.createElement('div');
  el.className = 'cubie';
  el.dataset.x = cubie.x; el.dataset.y = cubie.y; el.dataset.z = cubie.z;
  el.style.transform = `translate3d(${cubie.x * unitStep}px, ${-cubie.y * unitStep}px, ${cubie.z * unitStep}px)`;
  for (const face of ['F', 'B', 'R', 'L', 'U', 'D']) {
    const f = document.createElement('div');
    f.className = 'face';
    f.style.transform = FACE_CSS[face];
    f.style.background = cubie.colors[face] || '#1a1a1a';
    el.appendChild(f);
  }
  return el;
}

class CubeRenderer {
  constructor(cube, container) {
    this.cube = cube;
    this.container = container;
    this.scene = container.querySelector('.scene');
    this.group = container.querySelector('.cube-group');
    this.pitch = -25; this.yaw = -35;
    this.render();
    this.applyView();
    this.bindDrag();
  }
  render() {
    this.group.innerHTML = '';
    // Coordinates step by 1 for a 3x3 (-1,0,1) but by 2 for a 2x2 (-1,1) —
    // halve the pixel step in that case so adjacent faces still touch.
    const unitStep = this.cube.size === 2 ? STEP / 2 : STEP;
    for (const cubie of this.cube.cubies) this.group.appendChild(buildCubieEl(cubie, unitStep));
  }
  applyView() {
    this.scene.style.transform = `rotateX(${this.pitch}deg) rotateY(${this.yaw}deg)`;
  }
  bindDrag() {
    let dragging = false, lastX = 0, lastY = 0;
    const start = (x, y) => { dragging = true; lastX = x; lastY = y; };
    const move = (x, y) => {
      if (!dragging) return;
      this.yaw += (x - lastX) * 0.5;
      this.pitch -= (y - lastY) * 0.5;
      this.pitch = Math.max(-89, Math.min(89, this.pitch));
      lastX = x; lastY = y;
      this.applyView();
    };
    const end = () => { dragging = false; };
    this.container.addEventListener('mousedown', e => start(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    window.addEventListener('mouseup', end);
    this.container.addEventListener('touchstart', e => start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    window.addEventListener('touchmove', e => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    window.addEventListener('touchend', end);
  }
  // Animate one move token, then commit it to the data model.
  async animateMove(token, duration = 180) {
    const m = token.match(/^([A-Za-z])(w)?('|2)?$/);
    const [, letter, wide] = m;
    const MOVE_AXIS = { R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z', M: 'x', E: 'y', S: 'z', x: 'x', y: 'y', z: 'z' };
    const MOVE_LAYER = { R: 'max', L: 'min', U: 'max', D: 'min', F: 'max', B: 'min', M: 'mid', E: 'mid', S: 'mid', x: 'all', y: 'all', z: 'all' };
    const MOVE_THETA = { R: -90, L: 90, U: -90, D: 90, F: -90, B: 90, M: 90, E: 90, S: -90, x: -90, y: -90, z: -90 };
    const axis = MOVE_AXIS[letter];
    let layer = MOVE_LAYER[letter];
    if (wide) layer = layer === 'max' ? ['max', 'mid'] : layer === 'min' ? ['min', 'mid'] : layer;
    const layerVals = Array.isArray(layer)
      ? layer.flatMap(l => this.cube.layerValues(axis, l))
      : this.cube.layerValues(axis, layer);
    let theta = MOVE_THETA[letter];
    if (token.includes("'")) theta = -theta;
    if (token.includes('2')) theta = 180;

    const cssTheta = axis === 'y' ? theta : -theta;
    const axisVec = { x: '1,0,0', y: '0,1,0', z: '0,0,1' }[axis];

    const wrapper = document.createElement('div');
    wrapper.className = 'turn-wrapper';
    const affected = [...this.group.children].filter(el => layerVals.includes(Number(el.dataset[axis])));
    affected.forEach(el => wrapper.appendChild(el));
    this.group.appendChild(wrapper);

    await new Promise(resolve => {
      wrapper.style.transition = `transform ${duration}ms ease-in-out`;
      requestAnimationFrame(() => {
        wrapper.style.transform = `rotate3d(${axisVec}, ${cssTheta}deg)`;
      });
      setTimeout(resolve, duration);
    });

    this.cube.move(token);
    this.render();
  }
  async animateAlgorithm(str, duration = 180) {
    for (const tok of str.trim().split(/\s+/).filter(Boolean)) {
      await this.animateMove(tok, duration);
    }
  }
}

if (typeof module !== 'undefined') module.exports = { CubeRenderer };
else globalThis.CubeRenderer = CubeRenderer;
})();
