'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
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
];

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

function applyTheme(light) {
  if (light) document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  if (current && next) { draw(); drawNext(); }
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// combo: fijados consecutivos que limpian líneas; pendingRecord: puntuación aún sin guardar
let combo, maxCombo, pendingRecord = null;

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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
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
  combo = 0;
  maxCombo = 0;
  pendingRecord = null;
  gameOverRecords.classList.add('hidden');
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
  // En la pantalla de inicio o escribiendo el nombre las teclas no afectan al juego
  if (!startScreen.classList.contains('hidden') || e.target === recordName) return;
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

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked);
  themeToggle.blur(); // evita que Space active el switch en vez de la caída
});

// Siempre inicia en modo oscuro
themeToggle.checked = false;
applyTheme(false);

// La partida no arranca sola: se espera a "Jugar"
showStartScreen();
