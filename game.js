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

const RECORDS_KEY = 'tetris.records';
const STATS_KEY = 'tetris.stats';
const MAX_RECORDS = 5;
const MAX_NAME = 12;

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
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');
const startScreen = document.getElementById('start-screen');
const startRecordsEl = document.getElementById('start-records');
const playBtn = document.getElementById('play-btn');
const clearRecordsBtn = document.getElementById('clear-records-btn');
const gameOverRecords = document.getElementById('gameover-records');
const newRecordEl = document.getElementById('new-record');
const recordForm = document.getElementById('record-form');
const recordName = document.getElementById('record-name');
const recordError = document.getElementById('record-error');
const overRecordsEl = document.getElementById('over-records');
const menuBtn = document.getElementById('menu-btn');

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
// combo: fijados consecutivos que limpian líneas; pendingRecord: puntuación aún sin guardar
let combo, maxCombo, pendingRecord = null;

let startLevel = 1;   // elegido en el menú de pausa; se aplica en la próxima partida
let gameStartLevel;   // nivel inicial de la partida en curso
const freshKeys = new Set(); // teclas pulsadas desde que se (re)anudó el juego

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
  combo = cleared ? combo + 1 : 0;
  maxCombo = Math.max(maxCombo, combo);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.max(gameStartLevel, Math.floor(lines / 10) + 1);
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

// ---- Récords (localStorage) ----

// Devuelve null si no hay dato, está corrupto o el almacenamiento no está disponible
function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function toCount(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function loadRecords() {
  const data = readStorage(RECORDS_KEY);
  if (!Array.isArray(data)) return [];
  return data
    .filter(r => r && typeof r.name === 'string' && Number.isFinite(r.score))
    .map(r => ({
      name: r.name.slice(0, MAX_NAME),
      score: toCount(r.score),
      lines: toCount(r.lines),
      level: toCount(r.level),
      date: typeof r.date === 'string' ? r.date : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
}

function loadStats() {
  const data = readStorage(STATS_KEY);
  return { bestCombo: toCount(data?.bestCombo), maxLines: toCount(data?.maxLines) };
}

// Inserta la entrada detrás de las de igual puntuación; index es -1 si no entra en el top
function insertRecord(records, entry) {
  let index = records.findIndex(r => entry.score > r.score);
  if (index === -1) index = records.length;
  const list = [...records];
  list.splice(index, 0, entry);
  return {
    list: list.slice(0, MAX_RECORDS),
    index: entry.score > 0 && index < MAX_RECORDS ? index : -1,
  };
}

// Usa textContent (nunca innerHTML): el nombre lo escribe el jugador
function createEl(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}

function formatDate(iso) {
  const date = new Date(iso);
  return iso && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es') : '—';
}

function renderRecords(container, records, stats, highlight = -1) {
  container.replaceChildren();
  if (records.length) {
    const table = createEl('table');
    const head = table.createTHead().insertRow();
    for (const title of ['#', 'Nombre', 'Puntos', 'Líneas', 'Nivel', 'Fecha'])
      head.appendChild(createEl('th', title));
    const body = table.createTBody();
    records.forEach((r, i) => {
      const row = body.insertRow();
      if (i === highlight) row.className = 'highlight';
      for (const value of [i + 1, r.name, r.score.toLocaleString(), r.lines, r.level, formatDate(r.date)])
        row.appendChild(createEl('td', value));
    });
    container.appendChild(table);
  } else {
    container.appendChild(createEl('p', 'Aún no hay récords', 'records-empty'));
  }
  container.appendChild(createEl('p', `Mejor combo: ${stats.bestCombo} · Máx. líneas: ${stats.maxLines}`, 'records-stats'));
}

// Actualiza las mejores marcas y prepara la sección de récords del game over
function showGameOverRecords() {
  const stats = loadStats();
  stats.bestCombo = Math.max(stats.bestCombo, maxCombo);
  stats.maxLines = Math.max(stats.maxLines, lines);
  writeStorage(STATS_KEY, stats);

  const entry = { name: 'Tú', score, lines, level, date: new Date().toISOString() };
  const records = loadRecords();
  const { list, index } = insertRecord(records, entry);
  const isRecord = index !== -1;
  pendingRecord = isRecord ? entry : null;

  renderRecords(overRecordsEl, isRecord ? list : records, stats, index);
  newRecordEl.classList.toggle('hidden', !isRecord);
  recordForm.classList.toggle('hidden', !isRecord);
  recordError.classList.add('hidden');
  recordName.value = '';
  gameOverRecords.classList.remove('hidden');
}

function saveRecord(e) {
  e.preventDefault();
  if (!pendingRecord) return; // evita guardar dos veces
  const entry = { ...pendingRecord, name: recordName.value.trim() || 'Anónimo' };
  const { list, index } = insertRecord(loadRecords(), entry);
  if (!writeStorage(RECORDS_KEY, list)) {
    recordError.classList.remove('hidden');
    return;
  }
  pendingRecord = null;
  recordForm.classList.add('hidden');
  recordError.classList.add('hidden');
  // Si otra pestaña llenó el top mientras tanto, la puntuación ya no entra
  newRecordEl.classList.toggle('hidden', index === -1);
  renderRecords(overRecordsEl, list, loadStats(), index);
}

function clearRecords() {
  if (!window.confirm('¿Borrar todos los récords?')) return;
  try {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(STATS_KEY);
  } catch {
    // almacenamiento no disponible: no hay nada que borrar
  }
  renderRecords(startRecordsEl, loadRecords(), loadStats());
}

// ---- Inicio y fin de partida ----

function showStartScreen() {
  renderRecords(startRecordsEl, loadRecords(), loadStats());
  startScreen.classList.remove('hidden');
}

function startGame() {
  startScreen.classList.add('hidden');
  playBtn.blur(); // evita que Space vuelva a activar el botón
  init();
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  showGameOverRecords();
  overlay.classList.remove('hidden');
  if (pendingRecord) recordName.focus(); // solo se puede enfocar con el overlay visible
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  cancelAnimationFrame(animId);
  if (paused) {
    showControls(false);
    pauseMenu.classList.remove('hidden');
  } else {
    closePauseMenu();
    dropAccum = 0; // evita que la pieza salte al reanudar
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }
}

function closePauseMenu() {
  pauseMenu.classList.add('hidden');
  // Sin foco en el menú, Space no puede activar un botón durante la partida
  if (pauseMenu.contains(document.activeElement)) document.activeElement.blur();
  freshKeys.clear();
}

function showControls(show) {
  pauseControls.hidden = !show;
  controlsBtn.setAttribute('aria-expanded', show);
  controlsBtn.textContent = show ? 'Ocultar controles' : 'Ver controles';
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
  gameStartLevel = startLevel;
  level = gameStartLevel;
  combo = 0;
  maxCombo = 0;
  pendingRecord = null;
  gameOverRecords.classList.add('hidden');
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  closePauseMenu();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // En la pantalla de inicio o escribiendo el nombre las teclas no afectan al juego
  if (!startScreen.classList.contains('hidden') || e.target === recordName) return;
  // No interceptar lo que se escribe en campos de texto
  if (e.target.matches('input:not([type="checkbox"]), textarea')) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // respeta Ctrl/Cmd+P
    e.preventDefault();
    if (!e.repeat) togglePause();
    return;
  }
  // Con el menú abierto no se procesa ninguna tecla de juego
  if (paused || gameOver) return;
  // Una tecla mantenida desde antes de (re)anudar no actúa hasta soltarla
  if (!e.repeat) freshKeys.add(e.code);
  else if (!freshKeys.has(e.code)) { e.preventDefault(); return; }
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

restartBtn.addEventListener('click', () => {
  restartBtn.blur(); // evita que Space vuelva a activar el botón
  init();
});
playBtn.addEventListener('click', startGame);
clearRecordsBtn.addEventListener('click', clearRecords);
recordForm.addEventListener('submit', saveRecord);
// Una tecla de juego aún pulsada al terminar la partida no debe escribirse en el nombre
recordName.addEventListener('keydown', e => {
  if (e.repeat && ['Space', 'KeyP', 'KeyX'].includes(e.code)) e.preventDefault();
});
menuBtn.addEventListener('click', () => {
  menuBtn.blur();
  overlay.classList.add('hidden');
  showStartScreen();
});

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => showControls(pauseControls.hidden));
startLevelSelect.addEventListener('change', () => {
  startLevel = Number(startLevelSelect.value);
});
startLevelSelect.value = startLevel; // el navegador puede restaurar otro valor al recargar

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
  // En la pantalla de inicio aún no hay partida (paused/gameOver sin definir)
  const playing = startScreen.classList.contains('hidden') && !paused && !gameOver;
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

// La partida no arranca sola: se espera a "Jugar"
showStartScreen();
