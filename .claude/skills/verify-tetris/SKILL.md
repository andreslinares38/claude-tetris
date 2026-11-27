---
name: verify-tetris
description: Manual browser checklist to verify the Tetris game works after changes to game.js, index.html or style.css.
---

Serve the folder (`python3 -m http.server 8000` in `03-tetris/`) and open it in a browser. Check each item and report what you did and did not verify:

1. No console errors on load. The start screen shows the records table and the game does not start until "Jugar" (game keys and P do nothing before that).
2. Controls: ←/→ move, ↑ or X rotate, ↓ soft drop, Space hard drop, P or Esc pause/resume.
3. Wall kicks: rotating a piece against a wall or the floor still works.
4. Line clears: completing 1–4 lines clears them and scores `[100,300,500,800]` × level.
5. Drop points: hard drop adds 2 per cell, soft drop 1 per row.
6. Ghost piece and next-piece preview render correctly.
7. Level goes up every 10 lines and fall speed increases.
8. Game over triggers when the stack reaches the top, and "Reiniciar" starts a new game.
9. The pause menu (P or Esc) stops the game and input does not move pieces; Reanudar resumes without a jump, Reiniciar starts a new game, Ver controles lists the keys, and Nivel inicial applies to the next game only.
10. Records: a top-5 score shows "¡Nuevo récord!" with a highlighted row; typing a name (including p, x and space) does not affect the game; "Guardar" saves once; after reload the table, best combo and max lines persist.
11. "Borrar récords" empties the table and stats. It uses `confirm`, which can freeze browser automation: override `window.confirm = () => true` from JavaScript before clicking.
12. Skins: Retro, Neon, Pastel and Pixel art change board and preview immediately, persist after reload, and game keys still work afterwards.

If you couldn't open a browser, say so instead of claiming the checks passed.
