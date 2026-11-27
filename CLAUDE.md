# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Vanilla JS + Canvas Tetris. All logic is in `game.js`; no build step or dependencies.

- The board canvas is 300×600 (`COLS`=10, `ROWS`=20, `BLOCK`=30). If you change `COLS`, `ROWS` or `BLOCK`, update `width`/`height` of `<canvas id="board">` in `index.html` too.
- The preview canvas `#next-canvas` is 120×120 and is independent of `BLOCK`: `drawNext` hard-codes `NB=30` on a 4×4 grid. Change both together.
- Fall speed: `max(100, 1000 − (level−1)×90)` ms. Level is `max(gameStartLevel, floor(lines/10)+1)`: it rises every 10 lines but never drops below the starting level. `startLevel` is the pause-menu selection; `init()` copies it into `gameStartLevel`, so changing it mid-game only affects the next game. The formula (1000 and 90 included) is duplicated in `init()` and `clearLines`, so change both.
- Scoring: `LINE_SCORES` `[0,100,300,500,800]` × level, plus 2 per cell for hard drop and 1 per row for soft drop. Automatic gravity in `loop` gives no points on purpose, because it duplicates the move logic instead of calling `softDrop`. Don't "fix" that.
- The README documents the constants (`COLS`, `ROWS`, `BLOCK`, `SKINS`, `LINE_SCORES`, `dropInterval`). Keep it in sync when they change.
- Block rendering is per skin (`SKINS` in `game.js`; `drawBlock` dispatches to the active one). Each skin needs all 9 `colors`, must reset `globalAlpha`/`shadowBlur`, and keep the ghost (alpha 0.2) visible. `null` `boardBg`/`grid` (retro) means follow the light/dark theme.
- Comments are in Spanish. Some UI labels (SCORE, LINES, LEVEL, NEXT, CONTROLS, GAME OVER) are in English; new text should be in Spanish.
- Use `/verify-tetris` to check changes in the browser.
