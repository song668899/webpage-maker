(function () {
  'use strict';

  /* ==========================================================
     1. 配置 —— 常改的东西都在这里
     ========================================================== */
  var LEVELS = [
    { id: 'easy', name: '简单', rows: 8, cols: 8, mines: 10 },
    { id: 'medium', name: '中等', rows: 12, cols: 12, mines: 25 },
    { id: 'hard', name: '困难', rows: 16, cols: 16, mines: 45 }
  ];

  var LONG_PRESS = 400;
  var MOVE_TOLERANCE = 12;
  var RESULT_DELAY = 900;
  var STORE_PREFIX = 'minesweeper.best.';

  /* ==========================================================
     2. 状态
     ========================================================== */
  var levelIndex = 0;
  var ROWS = 0;
  var COLS = 0;
  var MINES = 0;
  var board = [];
  var revealed = [];
  var flagged = [];
  var mines = [];
  var gameOver = false;
  var firstClick = true;
  var elapsed = 0;
  var flagsPlaced = 0;
  var timerId = null;
  var resultTimer = null;
  var flagMode = false;
  var press = null;

  /* ==========================================================
     3. 元素
     ========================================================== */
  var levelsEl = document.getElementById('levels');
  var headEl = document.getElementById('head');
  var footEl = document.getElementById('foot');
  var boardEl = document.getElementById('board');
  var mineCountEl = document.getElementById('mineCount');
  var timeEl = document.getElementById('time');
  var restartEl = document.getElementById('restart');
  var flagModeEl = document.getElementById('flagMode');
  var modeTextEl = document.getElementById('modeText');
  var flashEl = document.getElementById('flash');
  var scrimEl = document.getElementById('scrim');
  var resultEl = document.getElementById('result');
  var resultTitleEl = document.getElementById('resultTitle');
  var resultMsgEl = document.getElementById('resultMsg');
  var resultTimeEl = document.getElementById('resultTime');
  var resultLevelEl = document.getElementById('resultLevel');
  var resultBestEl = document.getElementById('resultBest');

  /* ==========================================================
     4. 布局 —— 按屏幕和当前难度算格子尺寸
     ========================================================== */
  function layout() {
    var gap = 2;
    var pad = 6;
    var availW = Math.min(window.innerWidth - 16, 560) - pad * 2 - (COLS - 1) * gap;
    var availH = window.innerHeight - levelsEl.offsetHeight - headEl.offsetHeight
      - footEl.offsetHeight - 44 - pad * 2 - (ROWS - 1) * gap;

    var size = Math.floor(Math.min(availW / COLS, availH / ROWS));
    if (size < 14) size = 14;
    if (size > 64) size = 64;

    boardEl.style.gridTemplateColumns = 'repeat(' + COLS + ', ' + size + 'px)';
    boardEl.style.gridAutoRows = size + 'px';
    document.documentElement.style.setProperty('--cell', size + 'px');
    document.documentElement.style.setProperty('--font', Math.round(size * 0.46) + 'px');
  }

  /* ==========================================================
     5. 难度切换
     ========================================================== */
  var levelEls = LEVELS.map(function (lv, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = lv.name;
    b.addEventListener('click', function () {
      levelIndex = i;
      updateLevelTabs();
      vibrate(8);
      newGame();
    });
    levelsEl.appendChild(b);
    return b;
  });

  function updateLevelTabs() {
    for (var i = 0; i < levelEls.length; i++) {
      if (i === levelIndex) levelEls[i].classList.add('active');
      else levelEls[i].classList.remove('active');
    }
  }

  /* ==========================================================
     6. 开新局
     ========================================================== */
  function newGame() {
    var lv = LEVELS[levelIndex];
    ROWS = lv.rows;
    COLS = lv.cols;
    MINES = lv.mines;

    stopTimer();
    clearTimeout(resultTimer);
    hideResult();

    board = [];
    revealed = [];
    flagged = [];
    mines = [];
    gameOver = false;
    firstClick = true;
    elapsed = 0;
    flagsPlaced = 0;
    press = null;
    setFlagMode(false);
    mineCountEl.textContent = MINES;
    timeEl.textContent = '0';
    restartEl.textContent = '😊';
    boardEl.classList.remove('shake');
    boardEl.innerHTML = '';

    var frag = document.createDocumentFragment();
    for (var r = 0; r < ROWS; r++) {
      board[r] = [];
      revealed[r] = [];
      flagged[r] = [];
      for (var c = 0; c < COLS; c++) {
        board[r][c] = 0;
        revealed[r][c] = false;
        flagged[r][c] = false;
        var cell = document.createElement('div');
        cell.className = 'cell closed';
        cell.dataset.r = r;
        cell.dataset.c = c;
        frag.appendChild(cell);
      }
    }
    boardEl.appendChild(frag);
    layout();
  }

  /* ==========================================================
     7. 交互 —— 触摸/鼠标统一，长按或标记模式插旗
     ========================================================== */
  function cellFrom(target) {
    var el = target;
    while (el && el !== boardEl) {
      if (el.classList && el.classList.contains('cell')) return el;
      el = el.parentNode;
    }
    return null;
  }

  function onDown(e) {
    if (gameOver) return;
    var cell = cellFrom(e.target);
    if (!cell) return;

    var r = parseInt(cell.dataset.r);
    var c = parseInt(cell.dataset.c);

    if (e.pointerType === 'mouse' && e.button === 2) {
      doFlag(r, c, cell);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (revealed[r][c]) return;

    press = { cell: cell, r: r, c: c, x: e.clientX, y: e.clientY, fired: false };
    cell.classList.add('press');
    press.timer = setTimeout(function () {
      if (!press) return;
      press.fired = true;
      press.cell.classList.remove('press');
      doFlag(press.r, press.c, press.cell);
    }, LONG_PRESS);
  }

  function onUp(e) {
    if (!press) return;
    var p = press;
    press = null;
    clearTimeout(p.timer);
    p.cell.classList.remove('press');
    if (p.fired) return;

    var moved = Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
    if (moved > MOVE_TOLERANCE) return;

    if (flagMode) doFlag(p.r, p.c, p.cell);
    else doOpen(p.r, p.c);
  }

  function onCancel() {
    if (!press) return;
    clearTimeout(press.timer);
    press.cell.classList.remove('press');
    press = null;
  }

  boardEl.addEventListener('pointerdown', onDown);
  boardEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);

  flagModeEl.addEventListener('click', function () {
    setFlagMode(!flagMode);
    vibrate(8);
  });

  restartEl.addEventListener('click', newGame);

  document.getElementById('againBtn').addEventListener('click', newGame);
  document.getElementById('closeBtn').addEventListener('click', hideResult);
  scrimEl.addEventListener('click', hideResult);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'r' || e.key === 'R') newGame();
    else if (e.key === 'Escape') hideResult();
  });

  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () {
    setTimeout(layout, 150);
  });

  /* ==========================================================
     8. 玩法
     ========================================================== */
  function setFlagMode(on) {
    flagMode = on;
    if (on) flagModeEl.classList.add('active');
    else flagModeEl.classList.remove('active');
    flagModeEl.setAttribute('aria-pressed', on ? 'true' : 'false');
    modeTextEl.textContent = on ? '标记中' : '标记模式';
  }

  function doOpen(r, c) {
    if (gameOver || revealed[r][c] || flagged[r][c]) return;
    if (firstClick) {
      firstClick = false;
      startTimer();
      placeMines(r, c);
      calcNumbers();
    }
    reveal(r, c);
    checkWin();
  }

  function doFlag(r, c, cell) {
    if (gameOver || revealed[r][c]) return;
    flagged[r][c] = !flagged[r][c];
    if (flagged[r][c]) {
      cell.classList.add('flagged');
      flagsPlaced++;
      vibrate(12);
    } else {
      cell.classList.remove('flagged');
      flagsPlaced--;
      vibrate(6);
    }
    mineCountEl.textContent = Math.max(0, MINES - flagsPlaced);
  }

  function placeMines(safeR, safeC) {
    var placed = 0;
    while (placed < MINES) {
      var r = Math.floor(Math.random() * ROWS);
      var c = Math.floor(Math.random() * COLS);
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      if (board[r][c] === 'M') continue;
      board[r][c] = 'M';
      mines.push([r, c]);
      placed++;
    }
  }

  function calcNumbers() {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (board[r][c] === 'M') continue;
        var n = 0;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            var nr = r + dr;
            var nc = c + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === 'M') n++;
          }
        }
        board[r][c] = n;
      }
    }
  }

  function reveal(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    if (revealed[r][c] || flagged[r][c]) return;

    revealed[r][c] = true;
    var cell = getCell(r, c);
    cell.classList.remove('closed', 'press');
    cell.classList.add('revealed');

    if (board[r][c] === 'M') {
      boom(r, c, cell);
      return;
    }

    if (board[r][c] > 0) {
      cell.dataset.n = board[r][c];
      cell.textContent = board[r][c];
    } else {
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          reveal(r + dr, c + dc);
        }
      }
    }
  }

  function boom(r, c, cell) {
    gameOver = true;
    stopTimer();
    cell.classList.add('mine-death');
    restartEl.textContent = '😵';
    vibrate([90, 50, 180]);
    revealAll(r, c);
    flashEl.classList.add('on');
    boardEl.classList.add('shake');
    setTimeout(function () {
      flashEl.classList.remove('on');
      boardEl.classList.remove('shake');
    }, 480);
    showResult(false, false);
  }

  function revealAll(deathR, deathC) {
    var r, c, cell;

    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        if (flagged[r][c] && board[r][c] !== 'M') {
          getCell(r, c).classList.add('misflagged');
        }
      }
    }

    for (var i = 0; i < mines.length; i++) {
      var mr = mines[i][0];
      var mc = mines[i][1];
      if (mr === deathR && mc === deathC) continue;
      if (flagged[mr][mc]) continue;
      cell = getCell(mr, mc);
      cell.classList.remove('closed', 'press');
      cell.classList.add('revealed', 'mine');
    }
  }

  function getCell(r, c) {
    return boardEl.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
  }

  function checkWin() {
    if (gameOver) return;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (board[r][c] !== 'M' && !revealed[r][c]) return;
      }
    }

    gameOver = true;
    stopTimer();
    restartEl.textContent = '😎';

    for (var i = 0; i < mines.length; i++) {
      var mr = mines[i][0];
      var mc = mines[i][1];
      if (flagged[mr][mc]) continue;
      getCell(mr, mc).classList.add('flagged');
    }
    flagsPlaced = MINES;
    mineCountEl.textContent = 0;

    vibrate([30, 60, 30, 60, 30]);
    var isRecord = saveBest(elapsed);
    showResult(true, isRecord);
  }

  /* ==========================================================
     9. 结算面板
     ========================================================== */
  function showResult(win, isRecord) {
    clearTimeout(resultTimer);
    resultTimer = setTimeout(function () {
      resultTitleEl.textContent = win ? '🎉 扫雷成功' : '💥 踩到雷了';
      if (win && isRecord) resultTitleEl.textContent = '🏆 新纪录！';
      resultMsgEl.textContent = win
        ? '一颗雷都没碰，厉害。'
        : '再来一局？这次会更好。';
      resultTimeEl.textContent = elapsed + ' 秒';
      resultLevelEl.textContent = LEVELS[levelIndex].name;
      var best = loadBest();
      resultBestEl.textContent = best ? best + ' 秒' : '--';
      scrimEl.classList.add('show');
      resultEl.classList.add('show');
    }, RESULT_DELAY);
  }

  function hideResult() {
    clearTimeout(resultTimer);
    scrimEl.classList.remove('show');
    resultEl.classList.remove('show');
  }

  /* ==========================================================
     10. 最佳记录（存在本机）
     ========================================================== */
  function bestKey() {
    return STORE_PREFIX + LEVELS[levelIndex].id;
  }

  function loadBest() {
    try {
      return parseInt(localStorage.getItem(bestKey()), 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBest(sec) {
    try {
      var b = loadBest();
      if (!b || sec < b) {
        localStorage.setItem(bestKey(), String(sec));
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ==========================================================
     11. 计时、震动
     ========================================================== */
  function startTimer() {
    if (timerId) return;
    var t0 = Date.now() - elapsed * 1000;
    timerId = setInterval(function () {
      elapsed = Math.floor((Date.now() - t0) / 1000);
      timeEl.textContent = elapsed;
    }, 250);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  updateLevelTabs();
  newGame();
})();