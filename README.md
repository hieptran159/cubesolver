# Cube Solver

A browser-based 2x2/3x3 Rubik's cube solver: scramble, then watch it solve itself with a CSS-3D animated cube.

- 3x3: Cross → F2L → OLL+PLL (CFOP-style)
- 2x2: First layer → CLL
- Pure HTML/CSS/JS, no build step, no dependencies
- Solver runs in a Web Worker so the UI never freezes

## Run locally

Serve the folder over HTTP (needed for the Web Worker — opening `index.html` directly via `file://` won't work):

```
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy

Static site — push to GitHub and enable Pages on the repo (Settings → Pages → deploy from branch).
