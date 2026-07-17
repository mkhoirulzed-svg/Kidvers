(() => {
  'use strict';

  const worldCanvas = document.getElementById('worldCanvas');
  const ctx = worldCanvas.getContext('2d');
  const miniCanvas = document.getElementById('miniGameCanvas');
  const miniCtx = miniCanvas.getContext('2d');

  const UI = {
    coin: document.getElementById('coinValue'),
    xp: document.getElementById('xpValue'),
    level: document.getElementById('levelValue'),
    progressText: document.getElementById('progressText'),
    progressFill: document.getElementById('progressFill'),
    parkStatus: document.getElementById('parkStatus'),
    missionTitle: document.getElementById('missionTitle'),
    missionText: document.getElementById('missionText'),
    soundButton: document.getElementById('soundButton'),
    actionButton: document.getElementById('actionButton'),
    resetButton: document.getElementById('resetButton'),
    dialogBackdrop: document.getElementById('dialogBackdrop'),
    dialogIcon: document.getElementById('dialogIcon'),
    dialogTitle: document.getElementById('dialogTitle'),
    dialogText: document.getElementById('dialogText'),
    dialogActions: document.getElementById('dialogActions'),
    quizBackdrop: document.getElementById('quizBackdrop'),
    closeQuizButton: document.getElementById('closeQuizButton'),
    closeMiniGameButton: document.getElementById('closeMiniGameButton'),
    quizProgress: document.getElementById('quizProgress'),
    questionText: document.getElementById('questionText'),
    answerGrid: document.getElementById('answerGrid'),
    quizFeedback: document.getElementById('quizFeedback'),
    miniGameBackdrop: document.getElementById('miniGameBackdrop'),
    timeValue: document.getElementById('timeValue'),
    scoreValue: document.getElementById('scoreValue'),
    startMiniGameButton: document.getElementById('startMiniGameButton')
  };

  const STORAGE_KEY = 'kidverse-demo-progress-v1';
  const WORLD = { width: 1600, height: 1000 };
  const view = { x: 0, y: 0, width: worldCanvas.width, height: worldCanvas.height };
  const keys = new Set();
  let lastTime = performance.now();
  let soundEnabled = true;
  let currentNearby = null;
  let audioContext = null;

  const initialState = {
    coins: 0,
    xp: 0,
    level: 1,
    quizCorrect: 0,
    parkUnlocked: false,
    hasPlayedMiniGame: false,
    player: { x: 790, y: 780, speed: 245, direction: 'down', moving: false }
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved ? { ...cloneInitialState(), ...saved, player: { ...initialState.player, ...saved.player } } : cloneInitialState();
    } catch {
      return cloneInitialState();
    }
  }

  function cloneInitialState() { return JSON.parse(JSON.stringify(initialState)); }

  let state = loadState();

  const buildings = [
    { id: 'school', name: 'Sekolah Pintar', x: 250, y: 135, w: 330, h: 230, doorX: 392, doorY: 350, color: '#ffcf66' },
    { id: 'park', name: 'Taman Bintang', x: 1030, y: 110, w: 370, h: 285, doorX: 1192, doorY: 380, color: '#8ad7ff' },
    { id: 'home', name: 'Rumah', x: 650, y: 555, w: 300, h: 225, doorX: 783, doorY: 766, color: '#ff9fa7' }
  ];

  const trees = [
    [115,95],[650,115],[790,120],[920,110],[1480,105],[90,330],[670,390],[890,400],[1470,380],
    [125,560],[260,510],[1120,520],[1280,540],[1490,580],[80,840],[230,870],[1050,850],[1270,825],[1480,865]
  ];

  const flowers = Array.from({ length: 55 }, (_, i) => ({
    x: 60 + ((i * 137) % 1460),
    y: 70 + ((i * 83) % 850),
    color: ['#fff7a8', '#ff9ec6', '#d5b4ff', '#ffffff'][i % 4]
  }));

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  function updateHUD() {
    UI.coin.textContent = state.coins;
    UI.xp.textContent = state.xp;
    UI.level.textContent = state.level;
    UI.progressText.textContent = state.parkUnlocked
      ? (state.hasPlayedMiniGame ? 'Petualangan pertama selesai!' : 'Taman Bintang sudah terbuka')
      : `${state.quizCorrect} dari 3 soal benar`;
    UI.parkStatus.textContent = state.parkUnlocked ? 'Terbuka' : 'Terkunci';
    UI.parkStatus.style.color = state.parkUnlocked ? 'var(--success)' : '';

    const currentLevelXP = state.xp % 100;
    UI.progressFill.style.width = `${currentLevelXP}%`;

    if (!state.parkUnlocked) {
      UI.missionTitle.textContent = 'Misi pertama';
      UI.missionText.textContent = 'Pergi ke sekolah dan selesaikan 3 soal.';
    } else if (!state.hasPlayedMiniGame) {
      UI.missionTitle.textContent = 'Taman terbuka!';
      UI.missionText.textContent = 'Pergi ke Taman Bintang dan mainkan mini-game.';
    } else {
      UI.missionTitle.textContent = 'Misi selesai';
      UI.missionText.textContent = 'Kumpulkan lebih banyak bintang dan koin.';
    }
  }

  function addXP(amount) {
    state.xp += amount;
    state.level = Math.floor(state.xp / 100) + 1;
  }

  function initAudio() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    }
  }

  function beep(type = 'good') {
    if (!soundEnabled) return;
    initAudio();
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    osc.type = type === 'bad' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(type === 'bad' ? 170 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(type === 'bad' ? 110 : 760, now + 0.13);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  function drawRoundedRect(context, x, y, w, h, r, fill, stroke = null, lineWidth = 1) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + w - radius, y);
    context.quadraticCurveTo(x + w, y, x + w, y + radius);
    context.lineTo(x + w, y + h - radius);
    context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    context.lineTo(x + radius, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    if (fill) { context.fillStyle = fill; context.fill(); }
    if (stroke) { context.strokeStyle = stroke; context.lineWidth = lineWidth; context.stroke(); }
  }

  function drawWorld() {
    const scaleX = worldCanvas.width / view.width;
    const scaleY = worldCanvas.height / view.height;
    ctx.setTransform(scaleX, 0, 0, scaleY, -view.x * scaleX, -view.y * scaleY);
    ctx.clearRect(view.x, view.y, view.width, view.height);

    const grass = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height);
    grass.addColorStop(0, '#a8df80');
    grass.addColorStop(1, '#79c974');
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    drawPaths();
    drawPond();
    flowers.forEach(drawFlower);
    trees.forEach(([x, y]) => drawTree(x, y));
    buildings.forEach(drawBuilding);
    drawSigns();
    drawPlayer();
    drawInteractionHint();
  }

  function drawPaths() {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#edd5a8';
    ctx.lineWidth = 105;
    ctx.beginPath();
    ctx.moveTo(795, 950);
    ctx.lineTo(795, 765);
    ctx.lineTo(795, 470);
    ctx.lineTo(420, 470);
    ctx.lineTo(420, 350);
    ctx.moveTo(795, 470);
    ctx.lineTo(1195, 470);
    ctx.lineTo(1195, 380);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 20]);
    ctx.beginPath();
    ctx.moveTo(795, 950);
    ctx.lineTo(795, 765);
    ctx.lineTo(795, 470);
    ctx.lineTo(420, 470);
    ctx.lineTo(420, 350);
    ctx.moveTo(795, 470);
    ctx.lineTo(1195, 470);
    ctx.lineTo(1195, 380);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawPond() {
    ctx.save();
    ctx.translate(220, 690);
    ctx.fillStyle = 'rgba(66, 166, 232, 0.30)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 125, 72, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#60b8df';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#72d37a';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(-60 + i * 30, -4 + (i % 2) * 17, 14, 8, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFlower(f) {
    ctx.fillStyle = '#4e9d4d';
    ctx.fillRect(f.x - 1, f.y, 2, 9);
    ctx.fillStyle = f.color;
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(angle) * 4, f.y + Math.sin(angle) * 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f7c948';
    ctx.beginPath(); ctx.arc(f.x, f.y, 2.3, 0, Math.PI * 2); ctx.fill();
  }

  function drawTree(x, y) {
    ctx.fillStyle = 'rgba(43,74,38,0.16)';
    ctx.beginPath(); ctx.ellipse(x + 8, y + 38, 39, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8f5f3f';
    drawRoundedRect(ctx, x - 8, y + 13, 16, 42, 7, '#8f5f3f');
    ctx.fillStyle = '#3f9e58';
    ctx.beginPath(); ctx.arc(x, y, 31, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#58b966';
    ctx.beginPath(); ctx.arc(x - 17, y + 4, 21, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 18, y + 5, 23, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.beginPath(); ctx.arc(x - 12, y - 12, 8, 0, Math.PI * 2); ctx.fill();
  }

  function drawBuilding(b) {
    const locked = b.id === 'park' && !state.parkUnlocked;
    ctx.save();
    ctx.fillStyle = 'rgba(38,44,54,0.16)';
    ctx.beginPath(); ctx.ellipse(b.x + b.w / 2 + 13, b.y + b.h + 25, b.w * 0.43, 30, 0, 0, Math.PI * 2); ctx.fill();

    drawRoundedRect(ctx, b.x, b.y + 70, b.w, b.h - 70, 20, locked ? '#a9adb7' : b.color, '#ffffff', 5);

    ctx.fillStyle = locked ? '#7f8490' : (b.id === 'school' ? '#ef6b5b' : b.id === 'park' ? '#6b5dfc' : '#7d4dce');
    ctx.beginPath();
    ctx.moveTo(b.x - 22, b.y + 78);
    ctx.lineTo(b.x + b.w / 2, b.y);
    ctx.lineTo(b.x + b.w + 22, b.y + 78);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.stroke();

    for (let i = 0; i < 2; i++) {
      const wx = b.x + 50 + i * (b.w - 140);
      drawRoundedRect(ctx, wx, b.y + 105, 70, 58, 12, locked ? '#c8ccd4' : '#dbf4ff', '#ffffff', 5);
      ctx.strokeStyle = locked ? '#a0a4ae' : '#78b9d7'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(wx + 35, b.y + 108); ctx.lineTo(wx + 35, b.y + 160); ctx.moveTo(wx + 3, b.y + 134); ctx.lineTo(wx + 67, b.y + 134); ctx.stroke();
    }

    drawRoundedRect(ctx, b.doorX, b.doorY - 92, 56, 92, 13, locked ? '#757a85' : '#6a4938', '#ffffff', 4);
    ctx.fillStyle = '#ffd86b'; ctx.beginPath(); ctx.arc(b.doorX + 44, b.doorY - 46, 4, 0, Math.PI * 2); ctx.fill();

    ctx.font = '800 26px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#25223b';
    ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h + 52);

    if (b.id === 'school') {
      ctx.fillStyle = '#fff'; drawRoundedRect(ctx, b.x + b.w / 2 - 42, b.y + 50, 84, 44, 12, '#ffffff');
      ctx.font = '900 25px system-ui'; ctx.fillStyle = '#6d5dfc'; ctx.fillText('1 + 2', b.x + b.w / 2, b.y + 80);
    }
    if (b.id === 'park') {
      ctx.font = '36px system-ui'; ctx.fillText(locked ? '🔒' : '⭐', b.x + b.w / 2, b.y + 83);
    }
    ctx.restore();
  }

  function drawSigns() {
    drawSign(445, 435, 'BELAJAR');
    drawSign(1218, 435, state.parkUnlocked ? 'BERMAIN' : 'TERKUNCI');
  }

  function drawSign(x, y, text) {
    ctx.fillStyle = '#8b5c3c'; ctx.fillRect(x - 6, y, 12, 46);
    drawRoundedRect(ctx, x - 58, y - 20, 116, 38, 10, '#fff7d4', '#8b5c3c', 3);
    ctx.fillStyle = '#5f4936'; ctx.font = '800 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText(text, x, y + 5);
  }

  function drawPlayer() {
    const p = state.player;
    const bounce = p.moving ? Math.sin(performance.now() / 90) * 2 : 0;
    ctx.save();
    ctx.translate(p.x, p.y + bounce);
    ctx.fillStyle = 'rgba(25,30,45,0.20)';
    ctx.beginPath(); ctx.ellipse(0, 22, 23, 10, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#4b3d38';
    ctx.beginPath(); ctx.arc(0, -19, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5c79e';
    ctx.beginPath(); ctx.arc(0, -15, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4b3d38';
    ctx.beginPath(); ctx.arc(-6, -21, 10, Math.PI, Math.PI * 2); ctx.arc(7, -22, 9, Math.PI, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#25223b';
    const eyeOffsetX = p.direction === 'left' ? -3 : p.direction === 'right' ? 3 : 0;
    ctx.beginPath(); ctx.arc(-5 + eyeOffsetX, -14, 1.8, 0, Math.PI * 2); ctx.arc(5 + eyeOffsetX, -14, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b66c5e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -10, 5, 0.25, Math.PI - 0.25); ctx.stroke();

    drawRoundedRect(ctx, -18, 1, 36, 31, 11, '#6d5dfc');
    ctx.fillStyle = '#ffcf66'; ctx.fillRect(-5, 6, 10, 18);
    ctx.fillStyle = '#3b3668';
    const legShift = p.moving ? Math.sin(performance.now() / 80) * 5 : 0;
    drawRoundedRect(ctx, -14 + legShift, 27, 10, 22, 5, '#3b3668');
    drawRoundedRect(ctx, 4 - legShift, 27, 10, 22, 5, '#3b3668');
    ctx.restore();
  }

  function drawInteractionHint() {
    if (!currentNearby) return;
    const target = currentNearby;
    const text = target.id === 'park' && !state.parkUnlocked ? 'Selesaikan kuis dahulu' : `Tekan E untuk ${target.id === 'school' ? 'belajar' : target.id === 'park' ? 'bermain' : 'masuk'}`;
    const x = state.player.x;
    const y = state.player.y - 70;
    ctx.font = '800 16px system-ui';
    const width = ctx.measureText(text).width + 28;
    drawRoundedRect(ctx, x - width / 2, y - 25, width, 38, 13, 'rgba(37,34,59,0.88)');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(text, x, y);
  }

  function playerCollides(x, y) {
    const radius = 20;
    if (x < radius || y < radius || x > WORLD.width - radius || y > WORLD.height - radius) return true;

    return buildings.some(b => {
      const left = b.x - radius;
      const right = b.x + b.w + radius;
      const top = b.y + 55 - radius;
      const bottom = b.y + b.h + radius;
      const doorZone = x > b.doorX - 15 && x < b.doorX + 71 && y > b.doorY - 30;
      return x > left && x < right && y > top && y < bottom && !doorZone;
    });
  }

  function updateWorld(dt) {
    let dx = 0, dy = 0;
    if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
    if (keys.has('arrowright') || keys.has('d')) dx += 1;
    if (keys.has('arrowup') || keys.has('w')) dy -= 1;
    if (keys.has('arrowdown') || keys.has('s')) dy += 1;

    state.player.moving = dx !== 0 || dy !== 0;
    if (state.player.moving) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      if (Math.abs(dx) > Math.abs(dy)) state.player.direction = dx < 0 ? 'left' : 'right';
      else state.player.direction = dy < 0 ? 'up' : 'down';

      const nextX = state.player.x + dx * state.player.speed * dt;
      const nextY = state.player.y + dy * state.player.speed * dt;
      if (!playerCollides(nextX, state.player.y)) state.player.x = nextX;
      if (!playerCollides(state.player.x, nextY)) state.player.y = nextY;
    }

    currentNearby = buildings.find(b => distance(state.player.x, state.player.y, b.doorX + 28, b.doorY + 15) < 95) || null;

    view.x = clamp(state.player.x - view.width / 2, 0, WORLD.width - view.width);
    view.y = clamp(state.player.y - view.height / 2, 0, WORLD.height - view.height);
  }

  function gameLoop(now) {
    const dt = Math.min(0.035, (now - lastTime) / 1000);
    lastTime = now;
    if (!isModalOpen()) updateWorld(dt);
    drawWorld();
    requestAnimationFrame(gameLoop);
  }

  function isModalOpen() {
    return !UI.dialogBackdrop.classList.contains('hidden') ||
      !UI.quizBackdrop.classList.contains('hidden') ||
      !UI.miniGameBackdrop.classList.contains('hidden');
  }

  function interact() {
    if (!currentNearby || isModalOpen()) return;
    if (currentNearby.id === 'school') openQuiz();
    else if (currentNearby.id === 'park') {
      if (state.parkUnlocked) openMiniGame();
      else showDialog('🔒', 'Taman masih terkunci', 'Selesaikan 3 soal di Sekolah Pintar untuk membuka Taman Bintang.', [{ label: 'Mengerti', action: closeDialog }]);
    } else {
      showDialog('🏠', 'Rumah yang nyaman', 'Di versi berikutnya, anak dapat mengganti pakaian, menyimpan koleksi, dan menghias rumahnya di sini.', [{ label: 'Kembali bermain', action: closeDialog }]);
    }
  }

  function showDialog(icon, title, text, actions) {
    UI.dialogIcon.textContent = icon;
    UI.dialogTitle.textContent = title;
    UI.dialogText.textContent = text;
    UI.dialogActions.innerHTML = '';
    actions.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `dialog-button${item.secondary ? ' secondary' : ''}`;
      button.textContent = item.label;
      button.addEventListener('click', item.action);
      UI.dialogActions.appendChild(button);
      if (index === 0) setTimeout(() => button.focus(), 30);
    });
    UI.dialogBackdrop.classList.remove('hidden');
  }

  function closeDialog() { UI.dialogBackdrop.classList.add('hidden'); }

  // Quiz
  let quizQuestions = [];
  let quizIndex = 0;
  let quizLocked = false;

  function generateQuestion(difficulty = 1) {
    const max = 8 + difficulty * 5;
    const op = Math.random() < 0.72 ? '+' : '-';
    let a = 1 + Math.floor(Math.random() * max);
    let b = 1 + Math.floor(Math.random() * max);
    if (op === '-' && b > a) [a, b] = [b, a];
    const answer = op === '+' ? a + b : a - b;
    const options = new Set([answer]);
    while (options.size < 4) {
      const delta = (Math.floor(Math.random() * 7) - 3) || 2;
      options.add(Math.max(0, answer + delta));
    }
    return { text: `${a} ${op} ${b} = ?`, answer, options: [...options].sort(() => Math.random() - 0.5) };
  }

  function openQuiz() {
    quizQuestions = Array.from({ length: 3 }, () => generateQuestion(state.level));
    quizIndex = 0;
    quizLocked = false;
    UI.quizFeedback.textContent = '';
    UI.quizBackdrop.classList.remove('hidden');
    renderQuiz();
  }

  function renderQuiz() {
    const q = quizQuestions[quizIndex];
    UI.questionText.textContent = q.text;
    UI.answerGrid.innerHTML = '';
    UI.quizProgress.innerHTML = '';
    for (let i = 0; i < quizQuestions.length; i++) {
      const dot = document.createElement('span');
      dot.className = `quiz-dot ${i < quizIndex ? 'done' : i === quizIndex ? 'current' : ''}`;
      UI.quizProgress.appendChild(dot);
    }
    q.options.forEach(value => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer-button';
      button.textContent = value;
      button.addEventListener('click', () => answerQuestion(value, button));
      UI.answerGrid.appendChild(button);
    });
  }

  function answerQuestion(value, button) {
    if (quizLocked) return;
    quizLocked = true;
    const q = quizQuestions[quizIndex];
    const buttons = [...UI.answerGrid.querySelectorAll('button')];
    buttons.forEach(b => b.disabled = true);

    if (value === q.answer) {
      button.classList.add('correct');
      UI.quizFeedback.textContent = 'Benar! Hebat sekali! 🎉';
      UI.quizFeedback.style.color = 'var(--success)';
      beep('good');
      state.quizCorrect = Math.min(3, state.quizCorrect + 1);
      state.coins += 5;
      addXP(10);
    } else {
      button.classList.add('wrong');
      const correctButton = buttons.find(b => Number(b.textContent) === q.answer);
      if (correctButton) correctButton.classList.add('correct');
      UI.quizFeedback.textContent = `Belum tepat. Jawabannya ${q.answer}. Tetap semangat!`;
      UI.quizFeedback.style.color = 'var(--danger)';
      beep('bad');
    }
    updateHUD();
    saveState();

    setTimeout(() => {
      quizIndex += 1;
      quizLocked = false;
      UI.quizFeedback.textContent = '';
      if (quizIndex >= quizQuestions.length) finishQuiz();
      else renderQuiz();
    }, 1050);
  }

  function finishQuiz() {
    UI.quizBackdrop.classList.add('hidden');
    if (state.quizCorrect >= 3 && !state.parkUnlocked) {
      state.parkUnlocked = true;
      state.coins += 20;
      addXP(25);
      updateHUD();
      saveState();
      beep('good');
      showDialog('🎡', 'Taman Bintang terbuka!', 'Kamu berhasil belajar dan mendapat bonus 20 koin. Sekarang pergilah ke taman untuk memainkan Tangkap Bintang.', [
        { label: 'Ayo ke taman!', action: closeDialog }
      ]);
    } else if (state.parkUnlocked) {
      showDialog('📚', 'Latihan selesai', 'Kamu mendapat koin dan pengalaman tambahan. Taman Bintang tetap dapat dimainkan kapan saja.', [{ label: 'Kembali', action: closeDialog }]);
    } else {
      showDialog('💪', 'Hampir berhasil!', `Kamu sudah mengumpulkan ${state.quizCorrect} jawaban benar. Masuk ke sekolah lagi untuk melanjutkan.`, [{ label: 'Coba lagi nanti', action: closeDialog }]);
    }
  }

  // Mini game
  const mini = {
    running: false,
    animationId: null,
    startTime: 0,
    duration: 25,
    lastSpawn: 0,
    objects: [],
    score: 0,
    basket: { x: 330, y: 350, w: 100, h: 42, speed: 390 },
    direction: 0,
    lastFrame: 0
  };

  function openMiniGame() {
    UI.miniGameBackdrop.classList.remove('hidden');
    UI.startMiniGameButton.textContent = 'Mulai';
    UI.startMiniGameButton.disabled = false;
    UI.timeValue.textContent = mini.duration;
    UI.scoreValue.textContent = '0';
    resetMiniGameScene();
    drawMiniGame();
  }

  function resetMiniGameScene() {
    mini.running = false;
    mini.objects = [];
    mini.score = 0;
    mini.basket.x = miniCanvas.width / 2 - mini.basket.w / 2;
    mini.direction = 0;
  }

  function startMiniGame() {
    if (mini.running) return;
    initAudio();
    resetMiniGameScene();
    mini.running = true;
    mini.startTime = performance.now();
    mini.lastFrame = mini.startTime;
    mini.lastSpawn = mini.startTime;
    UI.startMiniGameButton.textContent = 'Sedang bermain';
    UI.startMiniGameButton.disabled = true;
    mini.animationId = requestAnimationFrame(miniGameLoop);
  }

  function miniGameLoop(now) {
    if (!mini.running) return;
    const dt = Math.min(0.035, (now - mini.lastFrame) / 1000);
    mini.lastFrame = now;
    const elapsed = (now - mini.startTime) / 1000;
    const remaining = Math.max(0, Math.ceil(mini.duration - elapsed));
    UI.timeValue.textContent = remaining;

    mini.basket.x = clamp(mini.basket.x + mini.direction * mini.basket.speed * dt, 0, miniCanvas.width - mini.basket.w);

    if (now - mini.lastSpawn > Math.max(330, 720 - elapsed * 10)) {
      mini.lastSpawn = now;
      const isRock = Math.random() < 0.24;
      mini.objects.push({
        x: 25 + Math.random() * (miniCanvas.width - 50),
        y: -25,
        r: isRock ? 18 : 16,
        speed: 145 + Math.random() * 115 + elapsed * 2.3,
        type: isRock ? 'rock' : 'star',
        rotation: Math.random() * Math.PI * 2
      });
    }

    mini.objects.forEach(obj => {
      obj.y += obj.speed * dt;
      obj.rotation += dt * 2.2;
    });

    const basketRect = { x: mini.basket.x, y: mini.basket.y, w: mini.basket.w, h: mini.basket.h };
    mini.objects = mini.objects.filter(obj => {
      const hit = obj.x + obj.r > basketRect.x && obj.x - obj.r < basketRect.x + basketRect.w && obj.y + obj.r > basketRect.y && obj.y - obj.r < basketRect.y + basketRect.h;
      if (hit) {
        if (obj.type === 'star') {
          mini.score += 1;
          beep('good');
        } else {
          mini.score = Math.max(0, mini.score - 2);
          beep('bad');
        }
        UI.scoreValue.textContent = mini.score;
        return false;
      }
      return obj.y < miniCanvas.height + 40;
    });

    drawMiniGame();
    if (elapsed >= mini.duration) finishMiniGame();
    else mini.animationId = requestAnimationFrame(miniGameLoop);
  }

  function drawMiniGame() {
    const gradient = miniCtx.createLinearGradient(0, 0, 0, miniCanvas.height);
    gradient.addColorStop(0, '#1c1850');
    gradient.addColorStop(1, '#352b73');
    miniCtx.fillStyle = gradient;
    miniCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);

    for (let i = 0; i < 50; i++) {
      const x = (i * 97) % miniCanvas.width;
      const y = (i * 53) % miniCanvas.height;
      miniCtx.fillStyle = `rgba(255,255,255,${0.25 + (i % 4) * 0.13})`;
      miniCtx.beginPath(); miniCtx.arc(x, y, 1 + (i % 2), 0, Math.PI * 2); miniCtx.fill();
    }

    mini.objects.forEach(obj => {
      miniCtx.save();
      miniCtx.translate(obj.x, obj.y);
      miniCtx.rotate(obj.rotation);
      if (obj.type === 'star') drawStar(miniCtx, 0, 0, 5, obj.r, obj.r * 0.48, '#ffd85c');
      else drawRock(miniCtx, obj.r);
      miniCtx.restore();
    });

    drawBasket(mini.basket.x, mini.basket.y, mini.basket.w, mini.basket.h);

    if (!mini.running) {
      miniCtx.fillStyle = 'rgba(14,11,42,0.52)';
      miniCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);
      miniCtx.fillStyle = '#fff';
      miniCtx.textAlign = 'center';
      miniCtx.font = '900 32px system-ui';
      miniCtx.fillText('Tangkap bintang, hindari batu!', miniCanvas.width / 2, miniCanvas.height / 2 - 14);
      miniCtx.font = '600 18px system-ui';
      miniCtx.fillStyle = 'rgba(255,255,255,0.78)';
      miniCtx.fillText('Tekan Mulai untuk bermain selama 25 detik', miniCanvas.width / 2, miniCanvas.height / 2 + 24);
    }
  }

  function drawStar(context, x, y, points, outer, inner, color) {
    context.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + i * Math.PI / points;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = '#fff1a3'; context.lineWidth = 3; context.stroke();
  }

  function drawRock(context, r) {
    context.beginPath();
    context.moveTo(-r, 5); context.lineTo(-r * .65, -r * .7); context.lineTo(0, -r); context.lineTo(r * .8, -r * .45); context.lineTo(r, r * .55); context.lineTo(r * .2, r); context.lineTo(-r * .7, r * .7); context.closePath();
    context.fillStyle = '#88869a'; context.fill();
    context.strokeStyle = '#b9b6c8'; context.lineWidth = 3; context.stroke();
  }

  function drawBasket(x, y, w, h) {
    miniCtx.fillStyle = 'rgba(0,0,0,0.24)'; miniCtx.beginPath(); miniCtx.ellipse(x + w / 2, y + h + 8, w * .45, 9, 0, 0, Math.PI * 2); miniCtx.fill();
    drawRoundedRect(miniCtx, x, y, w, h, 12, '#ffb84d', '#fff4d5', 4);
    miniCtx.strokeStyle = '#a86c22'; miniCtx.lineWidth = 4;
    for (let i = 1; i < 5; i++) { miniCtx.beginPath(); miniCtx.moveTo(x + i * w / 5, y + 4); miniCtx.lineTo(x + i * w / 5, y + h - 4); miniCtx.stroke(); }
    miniCtx.beginPath(); miniCtx.arc(x + w / 2, y + 5, w * .34, Math.PI, Math.PI * 2); miniCtx.stroke();
  }

  function finishMiniGame() {
    mini.running = false;
    cancelAnimationFrame(mini.animationId);
    const rewardCoins = mini.score * 3;
    const rewardXP = Math.min(50, mini.score * 4);
    state.coins += rewardCoins;
    addXP(rewardXP);
    state.hasPlayedMiniGame = true;
    saveState();
    updateHUD();
    UI.miniGameBackdrop.classList.add('hidden');
    showDialog('🏆', 'Permainan selesai!', `Kamu menangkap ${mini.score} bintang dan mendapat ${rewardCoins} koin serta ${rewardXP} XP.`, [
      { label: 'Main lagi', action: () => { closeDialog(); openMiniGame(); } },
      { label: 'Kembali ke dunia', secondary: true, action: closeDialog }
    ]);
  }

  // Input
  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)) {
      event.preventDefault();
      if (!UI.miniGameBackdrop.classList.contains('hidden')) {
        if (key === 'arrowleft' || key === 'a') mini.direction = -1;
        if (key === 'arrowright' || key === 'd') mini.direction = 1;
      } else keys.add(key);
    }
    if ((key === 'e' || key === 'enter') && !isModalOpen()) interact();
    if (key === 'escape') {
      if (!UI.dialogBackdrop.classList.contains('hidden')) closeDialog();
      if (!UI.quizBackdrop.classList.contains('hidden')) UI.quizBackdrop.classList.add('hidden');
    }
  });

  window.addEventListener('keyup', event => {
    const key = event.key.toLowerCase();
    keys.delete(key);
    if ((key === 'arrowleft' || key === 'a') && mini.direction < 0) mini.direction = 0;
    if ((key === 'arrowright' || key === 'd') && mini.direction > 0) mini.direction = 0;
  });

  document.querySelectorAll('[data-direction]').forEach(button => {
    const dirMap = { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };
    const key = dirMap[button.dataset.direction];
    const start = event => { event.preventDefault(); keys.add(key); button.classList.add('active'); };
    const end = event => { event.preventDefault(); keys.delete(key); button.classList.remove('active'); };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('pointerleave', end);
  });

  document.querySelectorAll('[data-game-direction]').forEach(button => {
    const value = button.dataset.gameDirection === 'left' ? -1 : 1;
    const start = event => { event.preventDefault(); mini.direction = value; };
    const end = event => { event.preventDefault(); if (mini.direction === value) mini.direction = 0; };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('pointerleave', end);
  });

  UI.actionButton.addEventListener('click', interact);
  UI.closeQuizButton.addEventListener('click', () => UI.quizBackdrop.classList.add('hidden'));
  UI.startMiniGameButton.addEventListener('click', startMiniGame);
  UI.closeMiniGameButton.addEventListener('click', () => {
    mini.running = false;
    cancelAnimationFrame(mini.animationId);
    mini.direction = 0;
    UI.miniGameBackdrop.classList.add('hidden');
  });
  UI.soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    UI.soundButton.textContent = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) beep('good');
  });
  UI.resetButton.addEventListener('click', () => {
    showDialog('♻️', 'Reset semua progres?', 'Koin, XP, level, dan akses taman akan kembali seperti awal.', [
      { label: 'Ya, reset', action: () => { localStorage.removeItem(STORAGE_KEY); state = cloneInitialState(); updateHUD(); closeDialog(); } },
      { label: 'Batal', secondary: true, action: closeDialog }
    ]);
  });

  UI.dialogBackdrop.addEventListener('click', event => { if (event.target === UI.dialogBackdrop) closeDialog(); });

  window.addEventListener('beforeunload', saveState);
  setInterval(saveState, 5000);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  updateHUD();
  requestAnimationFrame(gameLoop);

  setTimeout(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      showDialog('👋', 'Selamat datang di KidVerse!', 'Jalankan karakter menuju Sekolah Pintar. Jawab 3 soal untuk membuka mini-game di Taman Bintang.', [
        { label: 'Mulai petualangan', action: closeDialog }
      ]);
    }
  }, 350);
})();
