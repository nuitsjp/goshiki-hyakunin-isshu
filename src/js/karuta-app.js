import { APP_VERSION, colorAccentMap, colorTextMap, STORAGE_KEYS } from './config.js';
import { loadCsv } from './data.js';
import { buildKarutaDeck, buildKarutaReadings, checkKarutaMatch } from './karuta.js';
import { formatDurationMs } from './stats.js';
import { escapeHtml, toRubyHtml } from './text.js';
import { saveKarutaSession } from './storage.js';

// Game state
const karutaState = {
  allPoems: [],
  selectedColor: '',
  deck: [],           // 20 cards (lower poems) in grid
  readings: [],       // 20 readings (upper poems) in order
  currentIndex: 0,
  score: 0,           // Number of correct cards taken
  results: [],        // Array of {kimariji, isCorrect, cardState}
  measureTime: true,
  sessionStartTime: null,
  sessionEndTime: null,
  showHint: false,
};

// DOM elements
const screens = {
  start: document.getElementById('start-screen'),
  game: document.getElementById('game-screen'),
  result: document.getElementById('result-screen'),
};

const elements = {
  colorButtons: document.querySelectorAll('.color-button'),
  cancelGame: document.getElementById('cancel-game'),
  progressText: document.getElementById('progress-text'),
  progressBar: document.getElementById('progress-bar'),
  scoreText: document.getElementById('score-text'),
  elapsedTime: document.getElementById('elapsed-time'),
  measureTimeToggle: document.getElementById('measure-time-toggle'),
  selectedColorLabel: document.getElementById('selected-color-label'),
  kimarijiDisplay: document.getElementById('kimariji-display'),
  readingDisplay: document.getElementById('reading-display'),
  toggleHint: document.getElementById('toggle-hint'),
  karutaGrid: document.getElementById('karuta-grid'),
  nextReading: document.getElementById('next-reading'),
  resultCount: document.getElementById('result-count'),
  resultRate: document.getElementById('result-rate'),
  resultTime: document.getElementById('result-time'),
  resultComment: document.getElementById('result-comment'),
  resultList: document.getElementById('result-list'),
  retrySame: document.getElementById('retry-same'),
  chooseColor: document.getElementById('choose-color'),
  appVersion: document.getElementById('app-version'),
};

let elapsedTimerId = null;
const DEFAULT_RESULT_DELAY_MS = 500;

function getResultDelayMs() {
  const value = Number(window.__KARUTA_RESULT_DELAY_MS__);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_RESULT_DELAY_MS;
}

function readLocalSetting(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (e) {
    console.warn(e);
    return fallback;
  }
}

function writeLocalSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(e);
  }
}

function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen?.classList.add('hidden'));
  screens[screenName]?.classList.remove('hidden');
  if (screenName === 'start') {
    loadStartSettings();
  }
  if (screenName === 'game') {
    setTimeout(updateCardSizing, 0);
  }
}

function setAccentColor(color) {
  const accent = colorAccentMap[color] || 'var(--color-blue)';
  const textColor = colorTextMap[color] || '#fff';
  document.documentElement.style.setProperty('--current-accent', accent);

  if (elements.progressBar) {
    elements.progressBar.style.backgroundColor = accent;
    elements.progressBar.style.color = textColor;
  }

  if (elements.selectedColorLabel) {
    elements.selectedColorLabel.textContent = color;
    elements.selectedColorLabel.style.backgroundColor = accent;
    elements.selectedColorLabel.style.color = textColor;
  }
}

function loadStartSettings() {
  if (elements.measureTimeToggle) {
    const savedMeasure = readLocalSetting(STORAGE_KEYS.MEASURE_TIME, null);
    elements.measureTimeToggle.checked = savedMeasure === null ? true : savedMeasure !== 'false';
  }
}

function updateProgress() {
  const total = karutaState.readings.length;
  const current = karutaState.currentIndex + 1;
  const percentage = (current / total) * 100;

  if (elements.progressText) {
    elements.progressText.textContent = `${current} / ${total}`;
  }

  if (elements.progressBar) {
    elements.progressBar.style.width = `${percentage}%`;
  }

  if (elements.scoreText) {
    elements.scoreText.textContent = `正解: ${karutaState.score}枚`;
  }
}

function clearElapsedTimer() {
  if (elapsedTimerId) {
    clearInterval(elapsedTimerId);
    elapsedTimerId = null;
  }
}

function updateElapsedTime() {
  if (!elements.elapsedTime || !karutaState.measureTime) return;
  const elapsedMs = Math.max(0, Math.round(performance.now() - karutaState.sessionStartTime));
  elements.elapsedTime.textContent = formatDurationMs(elapsedMs);
}

function setElapsedVisibility(isVisible) {
  if (!elements.elapsedTime) return;
  elements.elapsedTime.classList.toggle('hidden', !isVisible);
}

function startElapsedTimer() {
  if (!elements.elapsedTime || !karutaState.measureTime) return;
  clearElapsedTimer();
  updateElapsedTime();
  elapsedTimerId = setInterval(() => {
    updateElapsedTime();
  }, 250);
}

function finalizeSessionTiming() {
  if (!karutaState.measureTime) {
    clearElapsedTimer();
    return;
  }
  karutaState.sessionEndTime = performance.now();
  updateElapsedTime();
  clearElapsedTimer();
}

function updateResultTime(durationMs) {
  if (!elements.resultTime) return;
  if (karutaState.measureTime && Number.isFinite(durationMs)) {
    elements.resultTime.textContent = `クリアタイム ${formatDurationMs(durationMs)}`;
    elements.resultTime.classList.remove('hidden');
  } else {
    elements.resultTime.textContent = '';
    elements.resultTime.classList.add('hidden');
  }
}

function buildResultItem(result, idx) {
  const status = result.isCorrect ? 'correct' : 'wrong';
  const icon = status === 'correct' ? '○' : '×';
  const iconClass = status === 'correct' ? 'icon-correct' : 'icon-wrong';
  const kimarijiText = escapeHtml(result.kimariji || '');
  const kamiText = result.kamiReading || result.kamiNoKu || '';
  const shimoText = result.shimoReading || result.shimoNoKu || '';
  const poemLine = `${toRubyHtml(kamiText)} ${toRubyHtml(shimoText)}`;
  const item = document.createElement('div');
  item.className = 'result-item';
  item.innerHTML = `
    <div class="result-header">
      <span class="result-icon ${iconClass}" aria-hidden="true">${icon}</span>
      <div>
        <div class="fw-semibold mb-0">第${idx + 1}問 ${kimarijiText}</div>
        <div class="result-meta">${poemLine}</div>
      </div>
    </div>
  `;
  return item;
}

function displayReading() {
  const reading = karutaState.readings[karutaState.currentIndex];

  if (!reading) return;

  karutaState.showHint = false;
  updateReadingDisplay();
  updateHintButton();
}

function updateReadingDisplay() {
  const reading = karutaState.readings[karutaState.currentIndex];
  if (!reading) return;
  if (elements.kimarijiDisplay) {
    elements.kimarijiDisplay.textContent = karutaState.showHint
      ? (reading.hint || '')
      : reading.kimariji;
  }
  if (elements.readingDisplay) {
    elements.readingDisplay.innerHTML = '';
  }
}

function updateHintButton() {
  if (!elements.toggleHint) return;
  elements.toggleHint.setAttribute('aria-pressed', karutaState.showHint ? 'true' : 'false');
  const label = elements.toggleHint.querySelector('.hint-button-label');
  const labelText = karutaState.showHint ? '決まり字' : 'ヒント';
  if (label) {
    label.textContent = labelText;
  } else {
    elements.toggleHint.textContent = labelText;
  }
}

function setCardTextLines(cardElement, text) {
  if (!cardElement) return;
  cardElement.innerHTML = '';
  const parts = (text || '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return;
  const lines = parts.length <= 2
    ? parts
    : [
        parts.slice(0, Math.ceil(parts.length / 2)).join(' '),
        parts.slice(Math.ceil(parts.length / 2)).join(' '),
      ];

  lines.forEach((line, idx) => {
    const lineNode = document.createElement('span');
    lineNode.className = 'karuta-card-line';
    lineNode.textContent = line;
    cardElement.appendChild(lineNode);
    if (idx < lines.length - 1) {
      cardElement.appendChild(document.createElement('br'));
    }
  });
}

const WHITE_SILVER_RATIO = 1.4142135623;

function updateCardSizing() {
  const gridArea = elements.karutaGrid?.parentElement;
  const grid = elements.karutaGrid;
  if (!gridArea || !grid) return;

  const { width, height } = gridArea.getBoundingClientRect();
  if (width <= 0 || height <= 0) return;

  const columns = 5;
  const rows = 4;
  const maxWidthPerCard = width / columns;
  const maxHeightPerCard = height / rows;
  const naturalWidth = 116;

  let cardWidth = Math.min(naturalWidth, maxWidthPerCard);
  let cardHeight = cardWidth * WHITE_SILVER_RATIO;

  if (cardHeight > maxHeightPerCard) {
    const scale = maxHeightPerCard / cardHeight;
    cardWidth *= scale;
    cardHeight = maxHeightPerCard;
  }

  cardWidth = Math.max(64, cardWidth);
  cardHeight = Math.max(64, cardHeight);

  grid.style.setProperty('--karuta-card-width-current', `${cardWidth}px`);
  grid.style.setProperty('--karuta-card-height-current', `${cardHeight}px`);
  grid.style.setProperty('--karuta-card-size', `${cardWidth}px`);
}

function renderCards() {
  if (!elements.karutaGrid) return;

  elements.karutaGrid.innerHTML = '';

  karutaState.deck.forEach((card, index) => {
    const cardElement = document.createElement('button');
    cardElement.className = 'karuta-card';
    cardElement.dataset.index = index;

    if (card.state === 'hidden') {
      // 非表示の札（配置は維持）
      cardElement.classList.add('is-taken');
      cardElement.disabled = true;
      setCardTextLines(cardElement, card.shimoReading);
    } else if (card.state === 'showing-result') {
      // 結果表示中（アイコン付き）
      cardElement.classList.add('showing-result');
      cardElement.disabled = true;
      setCardTextLines(cardElement, card.shimoReading);

      // 正解時は○アイコンを表示
      if (card.isCorrect && !card.showAsCorrect) {
        const iconElement = document.createElement('span');
        iconElement.className = 'result-icon';
        iconElement.classList.add('correct');
        iconElement.textContent = '○';
        cardElement.appendChild(iconElement);
      }

      // 不正解時のみ×アイコンを表示
      if (!card.isCorrect) {
        const iconElement = document.createElement('span');
        iconElement.className = 'result-icon';
        iconElement.classList.add('incorrect');
        iconElement.textContent = '✕';
        cardElement.appendChild(iconElement);
      }

      // 正解の札を薄い赤でハイライト表示
      if (card.showAsCorrect) {
        cardElement.style.backgroundColor = '#ffe6e6';
        cardElement.style.color = '#333';
      }
    } else {
      cardElement.classList.add('active');
      setCardTextLines(cardElement, card.shimoReading);
      cardElement.addEventListener('click', () => handleCardClick(index));
    }

    elements.karutaGrid.appendChild(cardElement);
  });

  updateCardSizing();
}

function handleCardClick(cardIndex) {
  const card = karutaState.deck[cardIndex];
  const reading = karutaState.readings[karutaState.currentIndex];

  if (card.state !== 'active') return;

  const isCorrect = checkKarutaMatch(reading, card);

  // 結果をカードに記録
  card.isCorrect = isCorrect;
  card.state = 'showing-result';

  let correctCard = null;

  if (isCorrect) {
    // Correct answer
    karutaState.score++;
    karutaState.results.push({
      kimariji: reading.kimariji,
      kamiNoKu: reading.kamiNoKu,
      kamiReading: reading.kamiReading,
      shimoNoKu: card.shimoNoKu,
      shimoReading: card.shimoReading,
      isCorrect: true,
      cardState: 'hidden',
    });
  } else {
    // Wrong answer - find the correct card
    correctCard = karutaState.deck.find(c =>
      c.state === 'active' && checkKarutaMatch(reading, c)
    );

    if (correctCard) {
      // 正解の札を赤くハイライト表示
      correctCard.state = 'showing-result';
      correctCard.isCorrect = true;
      correctCard.showAsCorrect = true;
    }

    const shimoReading = correctCard?.shimoReading || card.shimoReading;
    const shimoNoKu = correctCard?.shimoNoKu || card.shimoNoKu;
    karutaState.results.push({
      kimariji: reading.kimariji,
      kamiNoKu: reading.kamiNoKu,
      kamiReading: reading.kamiReading,
      shimoNoKu,
      shimoReading,
      isCorrect: false,
      cardState: 'hidden',
    });
  }

  renderCards();
  updateProgress();

  // 0.5秒後に処理
  setTimeout(() => {
    if (isCorrect) {
      // 正解の場合：取った札を非表示にする
      card.state = 'hidden';
    } else {
      // 不正解の場合：正解の札を非表示にし、間違った札の×アイコンを消す
      if (correctCard) {
        correctCard.state = 'hidden';
        delete correctCard.showAsCorrect;
      }
      // 間違った札を通常状態に戻す（×アイコンを消す）
      card.state = 'active';
      delete card.isCorrect;
    }

    renderCards();

    // 次の読み札に自動的に進む
    karutaState.currentIndex++;

    if (karutaState.currentIndex >= karutaState.readings.length) {
      // ゲーム終了
      showResult();
    } else {
      // 次の読み札を表示
      displayReading();
      updateProgress();
    }
  }, getResultDelayMs());
}

function nextReading() {
  karutaState.currentIndex++;

  if (karutaState.currentIndex >= karutaState.readings.length) {
    // Game finished
    showResult();
    return;
  }

  // Disable next button until user selects a card
  if (elements.nextReading) {
    elements.nextReading.disabled = true;
  }

  displayReading();
  updateProgress();
}

function showResult() {
  finalizeSessionTiming();
  const total = karutaState.readings.length;
  const correct = karutaState.score;
  const rate = Math.round((correct / total) * 100);
  const endTime = karutaState.measureTime ? karutaState.sessionEndTime : null;
  const durationMs = karutaState.measureTime && Number.isFinite(endTime)
    ? Math.round(endTime - karutaState.sessionStartTime)
    : null;

  const sessionData = {
    sessionId: `karuta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    date: new Date().toISOString().split('T')[0],
    color: karutaState.selectedColor,
    questionCount: total,
    correctCount: correct,
    wrongCount: total - correct,
    passCount: 0,
    accuracyRate: rate,
    hintType: null,
    displayMode: null,
    orderMode: 'karuta',
    durationMs,
    answers: karutaState.results.map(result => ({
      kimariji: result.kimariji,
      isCorrect: result.isCorrect,
      usedKami: false,
      answerTimeMs: null,
    })),
  };

  saveKarutaSession(sessionData);

  if (elements.resultCount) {
    elements.resultCount.textContent = `${correct} / ${total} 枚獲得`;
  }

  if (elements.resultRate) {
    elements.resultRate.textContent = `正答率 ${rate}%`;
  }

  updateResultTime(durationMs);

  if (elements.resultComment) {
    let comment = '';
    if (rate === 100) {
      comment = '完璧です！すべての札を取りました！';
    } else if (rate >= 90) {
      comment = '素晴らしい！ほぼ完璧です！';
    } else if (rate >= 70) {
      comment = 'よくできました！';
    } else if (rate >= 50) {
      comment = 'もう少し頑張りましょう！';
    } else {
      comment = '練習あるのみ！';
    }
    elements.resultComment.textContent = comment;
  }

  // Display result list
  if (elements.resultList) {
    elements.resultList.innerHTML = '';
    karutaState.results.forEach((result, idx) => {
      elements.resultList.appendChild(buildResultItem(result, idx));
    });
  }

  showScreen('result');
}

async function startGame(color) {
  if (karutaState.allPoems.length === 0) {
    alert('データの読み込みに失敗しました。ページを再読み込みしてください。');
    return;
  }

  karutaState.selectedColor = color;
  karutaState.currentIndex = 0;
  karutaState.score = 0;
  karutaState.results = [];
  karutaState.measureTime = elements.measureTimeToggle ? elements.measureTimeToggle.checked : true;
  karutaState.sessionStartTime = karutaState.measureTime ? performance.now() : 0;
  karutaState.sessionEndTime = null;
  karutaState.showHint = false;

  try {
    // Build deck and readings
    karutaState.deck = buildKarutaDeck({
      poems: karutaState.allPoems,
      color: color,
    });

    karutaState.readings = buildKarutaReadings({
      poems: karutaState.allPoems,
      color: color,
    });

    setAccentColor(color);
    updateProgress();
    displayReading();
    renderCards();
    if (elements.elapsedTime && !karutaState.measureTime) {
      elements.elapsedTime.textContent = formatDurationMs(0);
    }
    setElapsedVisibility(karutaState.measureTime);
    startElapsedTimer();

    // Disable next button initially
    if (elements.nextReading) {
      elements.nextReading.disabled = true;
    }

    showScreen('game');
  } catch (error) {
    console.error('Failed to start game:', error);
    alert(error.message || 'ゲームの開始に失敗しました。');
  }
}

function initEventListeners() {
  // Color selection
  elements.colorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      if (color) startGame(color);
    });
  });

  if (elements.measureTimeToggle) {
    elements.measureTimeToggle.addEventListener('change', () => {
      writeLocalSetting(STORAGE_KEYS.MEASURE_TIME, String(elements.measureTimeToggle.checked));
    });
  }

  // Cancel game
  if (elements.cancelGame) {
    elements.cancelGame.addEventListener('click', () => {
      clearElapsedTimer();
      if (elements.elapsedTime) {
        elements.elapsedTime.textContent = formatDurationMs(0);
      }
      showScreen('start');
    });
  }

  if (elements.toggleHint) {
    elements.toggleHint.addEventListener('click', () => {
      const reading = karutaState.readings[karutaState.currentIndex];
      if (!reading) return;
      karutaState.showHint = !karutaState.showHint;
      updateReadingDisplay();
      updateHintButton();
    });
  }

  // Next reading button
  if (elements.nextReading) {
    elements.nextReading.addEventListener('click', nextReading);
  }

  // Retry same color
  if (elements.retrySame) {
    elements.retrySame.addEventListener('click', () => {
      startGame(karutaState.selectedColor);
    });
  }

  // Choose different color
  if (elements.chooseColor) {
    elements.chooseColor.addEventListener('click', () => {
      showScreen('start');
    });
  }

  window.addEventListener('resize', () => {
    if (!screens.game?.classList.contains('hidden')) {
      updateCardSizing();
    }
  });
}

async function init() {
  // Set version
  if (elements.appVersion) {
    elements.appVersion.textContent = APP_VERSION;
  }
  loadStartSettings();

  // Load CSV data
  try {
    karutaState.allPoems = await loadCsv();
    console.log(`Loaded ${karutaState.allPoems.length} poems`);
  } catch (error) {
    console.error('Failed to load CSV:', error);
    alert('データの読み込みに失敗しました。ページを再読み込みしてください。');
    return;
  }

  initEventListeners();
  showScreen('start');
}

// Start the app
init();
