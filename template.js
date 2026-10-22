(function () {
  const { Cube, COLORS, inverseAlgorithm } = window.CubeEngine;
  const data = window.ALGORITHMS_DATA;

  // 'orientation' = binary gray/yellow diagram (only whether U-color is up
  // matters, like every OLL reference); 'full' = real colors (permutation
  // cases, where WHICH piece is where is the point).
  const GROUPS = [
    { key: '3x3-oll', label: '3x3 — OLL', size: 3, mode: 'orientation', entries: data.threeByThree.oll, desc: `${data.threeByThree.oll.length} trường hợp định hướng tầng cuối (OLL) — đã kiểm chứng tự động bằng chính engine của trang.` },
    { key: '3x3-pll', label: '3x3 — PLL', size: 3, mode: 'full', entries: data.threeByThree.pll, desc: `${data.threeByThree.pll.length} thuật toán hoán vị tầng cuối (PLL) theo tên chuẩn (Aa, T, Y, Ua, Ub, H, Z, ...).` },
    { key: '3x3-f2l', label: '3x3 — F2L', size: 3, mode: 'full', entries: data.threeByThree.f2l, desc: `${data.threeByThree.f2l.length} trường hợp cơ bản: góc + cạnh cùng nằm ở tầng trên (U), cross và 3 cặp F2L còn lại đã xong.` },
    { key: '2x2-oll', label: '2x2 — OLL', size: 2, mode: 'orientation', entries: data.twoByTwo.orient, desc: `${data.twoByTwo.orient.length} trường hợp định hướng 4 góc tầng cuối (sau khi đã đặt xong tầng 1).` },
    { key: '2x2-pbl', label: '2x2 — PBL', size: 2, mode: 'full', entries: data.twoByTwo.perm, desc: `${data.twoByTwo.perm.length} trường hợp hoán vị 4 góc tầng cuối (các góc đã định hướng đúng).` },
  ];
  const GRAY = '#3a3e4a';

  const CORNER_POS = [[-1, -1], [1, -1], [-1, 1], [1, 1]]; // (x,z): UBL,UBR,UFL,UFR
  const EDGE_POS = [[0, -1], [-1, 0], [1, 0], [0, 1]]; // UB,UL,UR,UF

  function cloneCube(size) { return new Cube(size); }

  // Build the "before" state a case's algorithm solves, by inverting it from
  // a solved cube — guarantees the diagram always matches the algorithm,
  // since it's derived FROM it rather than recalled separately.
  function beforeState(entry, size) {
    const c = new Cube(size);
    c.algorithm(inverseAlgorithm(entry.alg));
    return c;
  }

  // 'orientation' mode: just gray/yellow, like every standard OLL chart —
  // only whether the U-color sticker faces up matters, not which piece it is.
  function buildCellOrientation(piece) {
    const cell = document.createElement('div');
    cell.className = 'diagram-cell';
    cell.style.background = piece.colors.U === COLORS.U ? COLORS.U : GRAY;
    return cell;
  }

  // 'full' mode: real colors — background is whatever's actually facing up,
  // plus small accent bars for the side-facing colors, so permutation (which
  // piece ended up where) is visible even though orientation is already solved.
  function buildCellFull(piece) {
    const cell = document.createElement('div');
    cell.className = 'diagram-cell';
    cell.style.background = piece.colors.U || GRAY;
    const ACCENT = { F: 'bottom', B: 'top', L: 'left', R: 'right' };
    for (const face of ['F', 'B', 'L', 'R']) {
      const color = piece.colors[face];
      if (!color) continue;
      const bar = document.createElement('div');
      bar.className = 'accent';
      const side = ACCENT[face];
      const thick = '5px';
      Object.assign(bar.style, {
        position: 'absolute', background: color,
        left: side === 'left' ? '0' : side === 'right' ? 'auto' : '0',
        right: side === 'right' ? '0' : 'auto',
        top: side === 'top' ? '0' : side === 'bottom' ? 'auto' : '0',
        bottom: side === 'bottom' ? '0' : 'auto',
        width: (side === 'left' || side === 'right') ? thick : '100%',
        height: (side === 'top' || side === 'bottom') ? thick : '100%',
      });
      cell.appendChild(bar);
    }
    return cell;
  }

  function renderDiagram(entry, size, mode) {
    const cube = beforeState(entry, size);
    const buildCell = mode === 'orientation' ? buildCellOrientation : buildCellFull;
    const wrap = document.createElement('div');
    wrap.className = 'diagram';
    const grid = document.createElement('div');
    grid.className = 'diagram-grid';
    if (size === 3) {
      grid.style.gridTemplateColumns = 'repeat(3, 26px)';
      const layout = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], [0, 0], [1, 0],
        [-1, 1], [0, 1], [1, 1],
      ];
      for (const [x, z] of layout) grid.appendChild(buildCell(cube.get(x, 1, z)));
    } else {
      grid.style.gridTemplateColumns = 'repeat(2, 26px)';
      const layout = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const [x, z] of layout) grid.appendChild(buildCell(cube.get(x, 1, z)));
    }
    wrap.appendChild(grid);
    return wrap;
  }

  function renderCard(entry, size, mode) {
    const card = document.createElement('div');
    card.className = 'case-card';
    card.appendChild(renderDiagram(entry, size, mode));
    const name = document.createElement('div');
    name.className = 'case-name';
    name.textContent = entry.name;
    card.appendChild(name);
    const alg = document.createElement('div');
    alg.className = 'case-alg';
    alg.textContent = entry.alg;
    card.appendChild(alg);
    return card;
  }

  const tabsEl = document.getElementById('tabs');
  const sectionsEl = document.getElementById('sections');

  GROUPS.forEach((g, i) => {
    const tab = document.createElement('button');
    tab.className = 'tab-btn' + (i === 0 ? ' active' : '');
    tab.textContent = g.label;
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('section-' + g.key).classList.add('active');
    });
    tabsEl.appendChild(tab);

    const section = document.createElement('div');
    section.className = 'section' + (i === 0 ? ' active' : '');
    section.id = 'section-' + g.key;
    const desc = document.createElement('p');
    desc.className = 'section-desc';
    desc.textContent = g.desc;
    section.appendChild(desc);
    const grid = document.createElement('div');
    grid.className = 'case-grid';
    for (const entry of g.entries) grid.appendChild(renderCard(entry, g.size, g.mode));
    section.appendChild(grid);
    sectionsEl.appendChild(section);
  });
})();
