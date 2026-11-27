'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (centro vacío)
  [[9]],                                       // P - punto (1×1)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Rectángulo relleno con esquinas redondeadas (con arcTo, porque
// roundRect no existe en navegadores antiguos)
function fillRounded(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.fill();
}

// Cada skin define: colors (índices 1-9 = tipo de pieza), boardBg y grid
// (null = seguir el tema claro/oscuro de la página) y drawBlock.
const SKINS = {
  retro: {
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#64b5f6', // J - light blue
      '#ffb74d', // L - orange
      '#90a4ae', // N - tuerca, gris metálico
      '#8d6e63', // P - punto, café
    ],
    boardBg: null,
    grid: null,
    drawBlock(context, x, y, color, size, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // brillo superior
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },

  neon: {
    colors: [null, '#00f0ff', '#fff200', '#d500f9', '#00ff66', '#ff1744', '#2979ff', '#ff9100', '#e0f7ff', '#ff4fa3'],
    boardBg: '#000000',
    grid: '#14141f',
    drawBlock(context, x, y, color, size, alpha) {
      const px = x * size + 3;
      const py = y * size + 3;
      const s = size - 6;
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      context.shadowBlur = 0;
      // centro oscuro para que parezca un tubo de neón
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(px + 3, py + 3, s - 6, s - 6);
      context.globalAlpha = 1;
    },
  },

  pastel: {
    colors: [null, '#a8e6ef', '#fff1a8', '#d7b8f3', '#b9ebc0', '#f7b2b7', '#b5cdfb', '#ffd0a6', '#d5dde5', '#d9bba9'],
    boardBg: '#343045',
    grid: '#413c55',
    drawBlock(context, x, y, color, size, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      fillRounded(context, x * size + 1.5, y * size + 1.5, size - 3, size - 3, 8);
      // reflejo suave
      context.fillStyle = 'rgba(255,255,255,0.35)';
      fillRounded(context, x * size + 6, y * size + 5, size - 12, 5, 2.5);
      context.globalAlpha = 1;
    },
  },

  pixel: {
    colors: [null, '#00b8d4', '#f9c80e', '#9c27b0', '#43a047', '#e53935', '#1e66d0', '#f57c00', '#78909c', '#8d5524'],
    boardBg: '#101018',
    grid: '#1c1c28',
    drawBlock(context, x, y, color, size, alpha) {
      const unit = (size - 2) / 7; // cada bloque es una textura de 7×7 "píxeles"
      const left = x * size + 1;
      const top = y * size + 1;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(left, top, size - 2, size - 2);
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || c === 0) context.fillStyle = 'rgba(255,255,255,0.4)';
          else if (r === 6 || c === 6) context.fillStyle = 'rgba(0,0,0,0.4)';
          else if ((r + c) % 2 === 0) context.fillStyle = 'rgba(0,0,0,0.18)';
          else continue;
          context.fillRect(left + c * unit, top + r * unit, unit, unit);
        }
      }
      context.globalAlpha = 1;
    },
  },
};

const SKIN_KEY = 'tetris.skin';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let gridColor = '#22222e';
let activeSkin = SKINS.retro;

function applyTheme(light) {
  if (light) document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  if (current && next) { draw(); drawNext(); }
}

function loadSkinName() {
  try {
    const name = localStorage.getItem(SKIN_KEY);
    if (Object.hasOwn(SKINS, name)) return name;
  } catch {
    // localStorage no disponible: usar retro
  }
  return 'retro';
}

function saveSkinName(name) {
  try {
    localStorage.setItem(SKIN_KEY, name);
  } catch {
    // sin persistencia: la skin solo dura esta sesión
  }
}

function applySkin(name) {
  activeSkin = SKINS[name];
  skinSelect.value = name;
  // '' quita el estilo en línea y vuelve al --board-bg del tema
  canvas.style.background = activeSkin.boardBg ?? '';
  nextCanvas.style.background = activeSkin.boardBg ?? '';
  if (current && next) { draw(); drawNext(); }
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  activeSkin.drawBlock(context, x, y, activeSkin.colors[colorIndex], size, alpha ?? 1);
}

function drawGrid() {
  ctx.strokeStyle = activeSkin.grid ?? gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // Si lockPiece terminó el juego, no reprogramar el bucle
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked);
  themeToggle.blur(); // evita que Space active el switch en vez de la caída
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  saveSkinName(skinSelect.value);
  skinSelect.blur(); // evita que Space abra el selector en vez de la caída
});

// Si el selector conserva el foco durante la partida, las teclas de juego
// no deben cambiar la skin. "P" se bloquea siempre: también reanuda desde la
// pausa y, escrita en el selector, elegiría Pastel o Pixel art.
skinSelect.addEventListener('keydown', e => {
  const playing = !paused && !gameOver;
  const gameKey = e.code.startsWith('Arrow') || ['KeyX', 'Space'].includes(e.code);
  if (e.code === 'KeyP' || (playing && gameKey)) {
    e.preventDefault();
    skinSelect.blur();
  }
});

applySkin(loadSkinName());

// Siempre inicia en modo oscuro
themeToggle.checked = false;
applyTheme(false);

init();
