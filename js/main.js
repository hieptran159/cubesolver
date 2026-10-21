(function () {
  const { Cube } = window.CubeEngine;

  let size = 2;
  let cube = new Cube(size);
  const container = document.getElementById('scene-container');
  let renderer = new CubeRenderer(cube, container);
  let worker = null;
  let busy = false;

  const statusEl = document.getElementById('status');
  const btnScramble = document.getElementById('btn-scramble');
  const btnSolve = document.getElementById('btn-solve');
  const btnReset = document.getElementById('btn-reset');
  const solutionPanel = document.getElementById('solution-panel');
  const solutionSteps = document.getElementById('solution-steps');
  const btnPlay = document.getElementById('btn-play');
  const btnSkip = document.getElementById('btn-skip');
  const moveButtonsEl = document.getElementById('move-buttons');

  let currentSteps = null;
  // Running log of every move applied to `cube` since it was last solved —
  // used to tell the worker what algorithm, from solved, produced the
  // current on-screen state (the worker solves a fresh cube + this scramble).
  let moveLog = [];

  function setStatus(text) { statusEl.textContent = text; }
  function setBusy(v) {
    busy = v;
    [btnScramble, btnSolve, btnReset, btnPlay, btnSkip].forEach(b => b.disabled = v);
    moveButtonsEl.querySelectorAll('button').forEach(b => b.disabled = v);
  }

  function rebuildMoveButtons() {
    moveButtonsEl.innerHTML = '';
    const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
    for (const f of faces) {
      for (const suffix of ['', "'", '2']) {
        const btn = document.createElement('button');
        btn.className = 'move-btn';
        btn.textContent = f + suffix;
        btn.addEventListener('click', async () => {
          if (busy) return;
          setBusy(true);
          await renderer.animateMove(f + suffix);
          setBusy(false);
        });
        moveButtonsEl.appendChild(btn);
      }
    }
  }

  function resetSolutionPanel() {
    currentSteps = null;
    solutionPanel.hidden = true;
    solutionSteps.innerHTML = '';
  }

  function rebuildCube(newSize) {
    size = newSize;
    cube = new Cube(size);
    renderer = new CubeRenderer(cube, container);
    moveLog = [];
    resetSolutionPanel();
    setStatus('');
  }

  document.getElementById('btn-2x2').addEventListener('click', () => {
    if (busy) return;
    document.getElementById('btn-2x2').classList.add('active');
    document.getElementById('btn-3x3').classList.remove('active');
    rebuildCube(2);
  });
  document.getElementById('btn-3x3').addEventListener('click', () => {
    if (busy) return;
    document.getElementById('btn-3x3').classList.add('active');
    document.getElementById('btn-2x2').classList.remove('active');
    rebuildCube(3);
  });

  btnScramble.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    resetSolutionPanel();
    setStatus('Đang xáo khối...');
    const alg = randomScramble(size, size === 2 ? 11 : 20);
    await renderer.animateAlgorithm(alg, 120);
    setStatus('Đã xáo khối. Bấm "Giải" để xem lời giải.');
    setBusy(false);
  });

  btnReset.addEventListener('click', () => {
    if (busy) return;
    rebuildCube(size);
  });

  function getWorker() {
    if (!worker) worker = new Worker('js/worker.js');
    return worker;
  }

  btnSolve.addEventListener('click', () => {
    if (busy) return;
    if (cube.isSolved()) { setStatus('Khối đã được giải rồi!'); return; }
    setBusy(true);
    setStatus('Đang tính lời giải... (có thể mất vài giây, hiếm khi lâu hơn)');
    resetSolutionPanel();

    const w = getWorker();
    w.onmessage = async (e) => {
      setBusy(false);
      if (!e.data.ok) {
        setStatus('Không tìm được lời giải: ' + e.data.error + ' — hãy thử xáo lại khối.');
        return;
      }
      currentSteps = e.data.steps;
      renderSteps(currentSteps);
      setStatus('Đã có lời giải! Bấm "Phát lời giải" để xem khối tự giải.');
    };
    w.onerror = (err) => {
      setBusy(false);
      setStatus('Lỗi worker: ' + err.message);
    };
    w.postMessage({ size, scramble: cubeStateToAlgorithm() });
  });

  function cubeStateToAlgorithm() { return moveLog.join(' '); }

  // Patch animateMove once, globally, to also log every move it plays.
  const origAnimateMove = CubeRenderer.prototype.animateMove;
  CubeRenderer.prototype.animateMove = async function (token, duration) {
    moveLog.push(token);
    return origAnimateMove.call(this, token, duration);
  };

  function renderSteps(steps) {
    solutionPanel.hidden = false;
    solutionSteps.innerHTML = '';
    steps.forEach((step, i) => {
      const row = document.createElement('div');
      row.className = 'step-row';
      row.dataset.index = i;
      row.innerHTML = `<span class="step-name">${step.name}</span><span class="step-moves">${step.moves || '(không cần)'}</span>`;
      solutionSteps.appendChild(row);
    });
  }

  btnPlay.addEventListener('click', async () => {
    if (busy || !currentSteps) return;
    setBusy(true);
    const rows = solutionSteps.querySelectorAll('.step-row');
    for (let i = 0; i < currentSteps.length; i++) {
      rows.forEach(r => r.classList.remove('active'));
      rows[i].classList.add('active');
      const moves = currentSteps[i].moves;
      if (moves) await renderer.animateAlgorithm(moves, 150);
    }
    rows.forEach(r => r.classList.remove('active'));
    moveLog = [];
    setStatus('Đã giải xong!');
    setBusy(false);
  });

  btnSkip.addEventListener('click', () => {
    if (busy || !currentSteps) return;
    const allMovesStr = currentSteps.map(s => s.moves).filter(Boolean).join(' ');
    if (allMovesStr) cube.algorithm(allMovesStr);
    renderer.render();
    moveLog = [];
    setStatus('Đã giải xong (bỏ qua animation).');
    resetSolutionPanel();
  });

  rebuildMoveButtons();
  setStatus('Bấm "Xáo khối" để bắt đầu, hoặc xoay tay bằng các nút dưới.');
})();
