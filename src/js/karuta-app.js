import { APP_VERSION, colorAccentMap, colorTextMap, STORAGE_KEYS } from './config.js';
import { loadCsv } from './data.js';
import { buildKarutaDeck, buildKarutaReadings, checkKarutaMatch } from './karuta.js';
import { calculateAllColorStats, calculateOverallStats, formatDurationMs } from './stats.js';
import { escapeHtml, toRubyHtml } from './text.js';
import { saveKarutaSession, loadKarutaHistory, clearAllKarutaHistory } from './storage.js';

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
  flipCards: false,
  hintType: 'kami',  // 'shoku' (初句) or 'kami' (決まり字)
  sessionStartTime: null,
  sessionEndTime: null,
  showHint: false,
  locked: false,
  pendingHideCards: [],
  pendingResetCards: [],
  countdownActive: false,
};

// DOM elements
const screens = {
  start: document.getElementById('start-screen'),
  game: document.getElementById('game-screen'),
  result: document.getElementById('result-screen'),
  stats: document.getElementById('stats-screen'),
};

const elements = {
  colorButtons: document.querySelectorAll('.color-button'),
  cancelGame: document.getElementById('cancel-game'),
  progressText: document.getElementById('progress-text'),
  progressBar: document.getElementById('progress-bar'),
  scoreText: document.getElementById('score-text'),
  elapsedTime: document.getElementById('elapsed-time'),
  measureTimeToggle: document.getElementById('measure-time-toggle'),
  flipCardsToggle: document.getElementById('flip-cards-toggle'),
  hintTypeSelect: document.getElementById('hint-type'),
  selectedColorLabel: document.getElementById('selected-color-label'),
  kimarijiDisplay: document.getElementById('kimariji-display'),
  readingDisplay: document.getElementById('reading-display'),
  toggleHint: document.getElementById('toggle-hint'),
  karutaGrid: document.getElementById('karuta-grid'),
  passReading: document.getElementById('pass-reading'),
  nextReading: document.getElementById('next-reading'),
  resultCount: document.getElementById('result-count'),
  resultRate: document.getElementById('result-rate'),
  resultTime: document.getElementById('result-time'),
  resultComment: document.getElementById('result-comment'),
  resultList: document.getElementById('result-list'),
  retrySame: document.getElementById('retry-same'),
  retryIncorrect: document.getElementById('retry-incorrect'),
  chooseColor: document.getElementById('choose-color'),
  appVersion: document.getElementById('app-version'),
  viewStats: document.getElementById('view-stats'),
  viewStatsFromResult: document.getElementById('view-stats-from-result'),
  closeStats: document.getElementById('close-stats'),
  clearHistory: document.getElementById('clear-history'),
  totalQuizzes: document.getElementById('total-quizzes'),
  totalQuestions: document.getElementById('total-questions'),
  totalCorrect: document.getElementById('total-correct'),
  overallAccuracy: document.getElementById('overall-accuracy'),
  overallHintUsage: document.getElementById('overall-hint-usage'),
  colorStatsBody: document.getElementById('color-stats-tbody'),
  colorDetailContainer: document.getElementById('color-detail-container'),
};

let elapsedTimerId = null;
let countdownTimerId = null;
let countdownRemainingMs = 0;
const DEFAULT_RESULT_DELAY_MS = 500;
const DEFAULT_PREPARE_DELAY_MS = 20000;

function getResultDelayMs() {
  const value = Number(window.__KARUTA_RESULT_DELAY_MS__);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_RESULT_DELAY_MS;
}

function getPrepareDelayMs() {
  const value = Number(window.__KARUTA_PREPARE_MS__);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_PREPARE_DELAY_MS;
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
  document.body.dataset.screen = screenName;
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
    elements.selectedColorLabel.textContent = `${color}の歌`;
    elements.selectedColorLabel.style.backgroundColor = accent;
    elements.selectedColorLabel.style.color = textColor;
  }
}

function loadStartSettings() {
  if (elements.measureTimeToggle) {
    const savedMeasure = readLocalSetting(STORAGE_KEYS.MEASURE_TIME, null);
    elements.measureTimeToggle.checked = savedMeasure === null ? true : savedMeasure !== 'false';
  }
  if (elements.flipCardsToggle) {
    const savedFlip = readLocalSetting(STORAGE_KEYS.KARUTA_FLIP, null);
    elements.flipCardsToggle.checked = savedFlip === null ? false : savedFlip === 'true';
  }
  if (elements.hintTypeSelect) {
    const savedHint = readLocalSetting(STORAGE_KEYS.HINT_TYPE, null);
    const hintValue = savedHint === 'shoku' ? 'shoku' : 'kami';
    karutaState.hintType = hintValue;
    elements.hintTypeSelect.value = hintValue;
  }
}

function updateProgress() {
  const total = karutaState.readings.length;
  const current = karutaState.currentIndex + 1;
  const percentage = (current / total) * 100;

  if (elements.progressText) {
    elements.progressText.textContent = `問題 ${current} / ${total}`;
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

function updateCountdownDisplay() {
  if (!elements.elapsedTime) return;
  elements.elapsedTime.textContent = formatDurationMs(countdownRemainingMs);
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

function clearCountdownTimer() {
  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }
}

function startSessionClock() {
  if (!karutaState.measureTime) {
    clearElapsedTimer();
    setElapsedVisibility(false);
    return;
  }
  karutaState.sessionStartTime = performance.now();
  karutaState.sessionEndTime = null;
  setElapsedVisibility(true);
  startElapsedTimer();
}

function finishCountdown() {
  if (!karutaState.countdownActive) return;
  clearCountdownTimer();
  karutaState.countdownActive = false;
  karutaState.locked = false;
  renderCards();
  if (elements.toggleHint) {
    elements.toggleHint.disabled = false;
  }
  displayReading();
  startSessionClock();
}

function startCountdown(durationMs) {
  clearCountdownTimer();
  karutaState.countdownActive = true;
  karutaState.locked = true;
  renderCards();
  countdownRemainingMs = durationMs;
  updateCountdownDisplay();
  if (elements.kimarijiDisplay) {
    elements.kimarijiDisplay.textContent = '';
  }
  if (elements.readingDisplay) {
    elements.readingDisplay.innerHTML = '';
  }
  if (elements.toggleHint) {
    elements.toggleHint.disabled = true;
  }
  if (elements.nextReading) {
    elements.nextReading.disabled = true;
  }
  if (elements.passReading) {
    elements.passReading.disabled = false;
  }
  setElapsedVisibility(karutaState.measureTime);
  countdownTimerId = setInterval(() => {
    countdownRemainingMs -= 1000;
    if (countdownRemainingMs <= 0) {
      countdownRemainingMs = 0;
      updateCountdownDisplay();
      finishCountdown();
      return;
    }
    updateCountdownDisplay();
  }, 1000);
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

async function renderStatsScreen() {
  if (!screens.stats) return;
  const history = await loadKarutaHistory();
  const overall = calculateOverallStats(history, 'karuta');
  const colorStats = calculateAllColorStats(history, 'karuta');

  if (elements.totalQuizzes) elements.totalQuizzes.textContent = overall.totalQuizzes;
  if (elements.totalQuestions) elements.totalQuestions.textContent = overall.totalQuestions;
  if (elements.totalCorrect) elements.totalCorrect.textContent = overall.totalCorrect;
  if (elements.overallAccuracy) elements.overallAccuracy.textContent = `${overall.accuracyRate}%`;
  if (elements.overallHintUsage) elements.overallHintUsage.textContent = `${overall.hintUsageRate}%`;

  if (elements.colorStatsBody) {
    elements.colorStatsBody.innerHTML = colorStats.map(stats => {
      const rowClass = {
        '青': 'row-blue',
        'ピンク': 'row-pink',
        '黄': 'row-yellow',
        '緑': 'row-green',
        'オレンジ': 'row-orange',
      }[stats.color] || '';
      return `
        <tr class="stats-row ${rowClass}">
          <td class="stats-cell">${stats.totalQuizzes}</td>
          <td class="stats-cell">${stats.totalQuestions}</td>
          <td class="stats-cell">${stats.totalCorrect}</td>
          <td class="stats-cell">${stats.accuracyRate}%</td>
          <td class="stats-cell">${stats.hintUsageRate}%</td>
          <td class="stats-cell">${formatDurationMs(stats.fastestDurationMs)}</td>
          <td class="stats-cell">${stats.lastPlayed || '-'}</td>
        </tr>
      `;
    }).join('');
  }

  if (elements.colorDetailContainer) {
    elements.colorDetailContainer.innerHTML = '';
  }

  showScreen('stats');
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

  // Set showHint based on hintType setting
  // 'shoku' (初句) -> showHint = true (show hint)
  // 'kami' (決まり字) -> showHint = false (show kimariji)
  karutaState.showHint = karutaState.hintType === 'shoku';
  updateReadingDisplay();
  updateHintButton();
  if (elements.nextReading) {
    elements.nextReading.disabled = true;
  }
  if (elements.passReading) {
    elements.passReading.disabled = false;
  }
}

function updateReadingDisplay() {
  const reading = karutaState.readings[karutaState.currentIndex];
  if (!reading) return;
  if (karutaState.countdownActive) {
    if (elements.kimarijiDisplay) {
      elements.kimarijiDisplay.textContent = '';
    }
    if (elements.readingDisplay) {
      elements.readingDisplay.innerHTML = '';
    }
    return;
  }
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
const KARUTA_GRID_ROWS = 4;

function isUpperHalfCard(index) {
  return index % KARUTA_GRID_ROWS < KARUTA_GRID_ROWS / 2;
}

function updateCardSizing() {
  const gridArea = elements.karutaGrid?.parentElement;
  const grid = elements.karutaGrid;
  if (!gridArea || !grid) return;

  const { width, height } = gridArea.getBoundingClientRect();
  if (width <= 0 || height <= 0) return;

  const columns = 5;
  const rows = KARUTA_GRID_ROWS;
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

  const root = document.documentElement;
  root.style.setProperty('--karuta-card-width-current', `${cardWidth}px`);
  root.style.setProperty('--karuta-card-height-current', `${cardHeight}px`);
  root.style.setProperty('--karuta-card-size', `${cardWidth}px`);
}

function renderCards() {
  if (!elements.karutaGrid) return;

  elements.karutaGrid.innerHTML = '';

  karutaState.deck.forEach((card, index) => {
    const cardElement = document.createElement('button');
    cardElement.className = 'karuta-card';
    cardElement.dataset.index = index;
    const contentElement = document.createElement('div');
    contentElement.className = 'karuta-card-content';

    if (karutaState.flipCards && isUpperHalfCard(index)) {
      cardElement.classList.add('is-upside-down');
    }

    if (card.state === 'hidden') {
      // 非表示の札（配置は維持）
      cardElement.classList.add('is-taken');
      cardElement.disabled = true;
      setCardTextLines(contentElement, card.shimoReading);
      cardElement.appendChild(contentElement);
    } else if (card.state === 'showing-result') {
      // 結果表示中（アイコン付き）
      cardElement.classList.add('showing-result');
      cardElement.disabled = true;
      setCardTextLines(contentElement, card.shimoReading);
      cardElement.appendChild(contentElement);

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
      setCardTextLines(contentElement, card.shimoReading);
      cardElement.appendChild(contentElement);
      if (karutaState.locked) {
        cardElement.disabled = true;
      } else {
        cardElement.addEventListener('click', () => handleCardClick(index));
      }
    }

    elements.karutaGrid.appendChild(cardElement);
  });

  updateCardSizing();
}

function handleCardClick(cardIndex) {
  const card = karutaState.deck[cardIndex];
  const reading = karutaState.readings[karutaState.currentIndex];

  if (card.state !== 'active' || karutaState.locked) return;
  if (elements.passReading) {
    elements.passReading.disabled = true;
  }

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

  if (elements.kimarijiDisplay) {
    elements.kimarijiDisplay.textContent = reading.kamiReading || reading.kamiNoKu || reading.kimariji;
  }

  renderCards();
  updateProgress();

  // 0.5秒後に処理
  setTimeout(() => {
    if (isCorrect) {
      // 正解の場合：取った札を非表示にする
      card.state = 'hidden';
    }

    if (isCorrect) {
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
    return;
  }

    karutaState.locked = true;
    karutaState.pendingHideCards = [correctCard].filter(Boolean);
    karutaState.pendingResetCards = [card].filter(Boolean);
    renderCards();
    if (elements.nextReading) {
      elements.nextReading.disabled = false;
    }
    if (elements.passReading) {
      elements.passReading.disabled = true;
    }
    updateReadingDisplay();
  }, getResultDelayMs());
}

function handlePass() {
  if (karutaState.countdownActive) {
    finishCountdown();
    return;
  }
  if (karutaState.locked) return;
  const reading = karutaState.readings[karutaState.currentIndex];
  if (!reading) return;

  if (elements.kimarijiDisplay) {
    elements.kimarijiDisplay.textContent = reading.kamiReading || reading.kamiNoKu || '';
  }

  const correctCard = karutaState.deck.find(card =>
    card.state === 'active' && checkKarutaMatch(reading, card)
  );

  if (correctCard) {
    correctCard.state = 'showing-result';
    correctCard.isCorrect = true;
    correctCard.showAsCorrect = true;
  }

  karutaState.results.push({
    kimariji: reading.kimariji,
    kamiNoKu: reading.kamiNoKu,
    kamiReading: reading.kamiReading,
    shimoNoKu: correctCard?.shimoNoKu || '',
    shimoReading: correctCard?.shimoReading || '',
    isCorrect: false,
    cardState: 'hidden',
  });

  karutaState.locked = true;
  karutaState.pendingHideCards = [correctCard].filter(Boolean);
  renderCards();
  updateProgress();

  if (elements.nextReading) {
    elements.nextReading.disabled = false;
  }
  if (elements.passReading) {
    elements.passReading.disabled = true;
  }
}

function nextReading() {
  if (karutaState.locked) {
    karutaState.pendingHideCards.forEach(target => {
      if (!target) return;
      target.state = 'hidden';
      delete target.showAsCorrect;
      delete target.isCorrect;
    });
    karutaState.pendingResetCards.forEach(target => {
      if (!target) return;
      target.state = 'active';
      delete target.showAsCorrect;
      delete target.isCorrect;
    });
    karutaState.pendingHideCards = [];
    karutaState.pendingResetCards = [];
    karutaState.locked = false;
    renderCards();
  }

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
  if (elements.passReading) {
    elements.passReading.disabled = false;
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

  // Show or hide "retry incorrect" button when there are wrong answers
  {
    const retryBtn = document.getElementById('retry-incorrect');
    if (retryBtn) {
      let hasIncorrect = karutaState.results.some(r => !r.isCorrect);
      // Fallback: if state doesn't reflect correctly, inspect rendered result list
      if (!hasIncorrect && elements.resultList) {
        hasIncorrect = !!elements.resultList.querySelector('.icon-wrong');
      }
      retryBtn.classList.toggle('hidden', !hasIncorrect);
    }
  }

  showScreen('result');
}

async function startGame(color, options = {}) {
  if (karutaState.allPoems.length === 0) {
    alert('データの読み込みに失敗しました。ページを再読み込みしてください。');
    return;
  }

  karutaState.selectedColor = color;
  karutaState.currentIndex = 0;
  karutaState.score = 0;
  karutaState.results = [];
  karutaState.measureTime = elements.measureTimeToggle ? elements.measureTimeToggle.checked : true;
  karutaState.flipCards = elements.flipCardsToggle ? elements.flipCardsToggle.checked : false;
  karutaState.hintType = elements.hintTypeSelect ? elements.hintTypeSelect.value : 'kami';
  karutaState.sessionStartTime = null;
  karutaState.sessionEndTime = null;
  karutaState.showHint = false;
  karutaState.locked = false;
  karutaState.countdownActive = false;
  clearElapsedTimer();
  clearCountdownTimer();

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
    renderCards();
    if (elements.elapsedTime && karutaState.measureTime) {
      elements.elapsedTime.textContent = formatDurationMs(0);
    }

    // Disable next button initially
    if (elements.nextReading) {
      elements.nextReading.disabled = true;
    }
    if (elements.passReading) {
      elements.passReading.disabled = false;
    }

    showScreen('game');
    const prepareMs = Number.isFinite(options.prepareMs)
      ? Math.max(0, options.prepareMs)
      : getPrepareDelayMs();
    if (prepareMs > 0) {
      startCountdown(prepareMs);
    } else {
      displayReading();
      startSessionClock();
    }
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
  if (elements.flipCardsToggle) {
    elements.flipCardsToggle.addEventListener('change', () => {
      writeLocalSetting(STORAGE_KEYS.KARUTA_FLIP, String(elements.flipCardsToggle.checked));
    });
  }
  if (elements.hintTypeSelect) {
    elements.hintTypeSelect.addEventListener('change', () => {
      const hintValue = elements.hintTypeSelect.value;
      karutaState.hintType = hintValue;
      writeLocalSetting(STORAGE_KEYS.HINT_TYPE, hintValue);
    });
  }

  // Cancel game
  if (elements.cancelGame) {
    elements.cancelGame.addEventListener('click', () => {
      clearElapsedTimer();
      clearCountdownTimer();
      karutaState.countdownActive = false;
      karutaState.locked = false;
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

  if (elements.passReading) {
    elements.passReading.addEventListener('click', handlePass);
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

  // Retry only incorrect cards
  if (elements.retryIncorrect) {
    elements.retryIncorrect.addEventListener('click', async () => {
      // Collect incorrect poems by matching `shimoNoKu`
      const incorrectKeys = new Set(karutaState.results.filter(r => !r.isCorrect).map(r => r.shimoNoKu));
      const incorrectPoems = karutaState.allPoems.filter(p => incorrectKeys.has(p.shimoNoKu));
      if (!incorrectPoems.length) return;

      // Start a new game using only the incorrect poems
      karutaState.selectedColor = karutaState.selectedColor || '';
      karutaState.currentIndex = 0;
      karutaState.score = 0;
      karutaState.results = [];
      karutaState.measureTime = elements.measureTimeToggle ? elements.measureTimeToggle.checked : true;
      karutaState.flipCards = elements.flipCardsToggle ? elements.flipCardsToggle.checked : false;
      karutaState.hintType = elements.hintTypeSelect ? elements.hintTypeSelect.value : 'kami';
      karutaState.sessionStartTime = null;
      karutaState.sessionEndTime = null;
      karutaState.showHint = false;
      karutaState.locked = false;
      karutaState.countdownActive = false;

      // Build deck/readings from incorrect subset.
      // If there are fewer than 20 incorrect poems, create a smaller deck/readings directly.
      if (incorrectPoems.length >= 20) {
        karutaState.deck = buildKarutaDeck({ poems: incorrectPoems, color: karutaState.selectedColor });
        karutaState.readings = buildKarutaReadings({ poems: incorrectPoems, color: karutaState.selectedColor });
      } else {
        const shuffled = incorrectPoems.slice().sort(() => Math.random() - 0.5);
        karutaState.deck = shuffled.map(poem => ({
          kimariji: poem.kimarijiLong || poem.kimarijiShort || '決まり字なし',
          shimoNoKu: poem.shimoNoKu,
          shimoReading: poem.shimoReading,
          kamiNoKu: poem.kamiNoKu,
          kamiReading: poem.kamiReading,
          state: 'active',
        }));
        karutaState.readings = shuffled.map(poem => ({
          kimariji: poem.kimarijiLong || poem.kimarijiShort || '決まり字なし',
          kamiNoKu: poem.kamiNoKu,
          kamiReading: poem.kamiReading,
          hint: poem.hint,
        }));
      }

      setAccentColor(karutaState.selectedColor);
      updateProgress();
      renderCards();
      if (elements.elapsedTime && karutaState.measureTime) {
        elements.elapsedTime.textContent = formatDurationMs(0);
      }

      showScreen('game');
      const prepareMs = getPrepareDelayMs();
      if (prepareMs > 0) {
        startCountdown(prepareMs);
      } else {
        displayReading();
        startSessionClock();
      }
    });
  }

  // Choose different color
  if (elements.chooseColor) {
    elements.chooseColor.addEventListener('click', () => {
      showScreen('start');
    });
  }

  if (elements.viewStats) {
    elements.viewStats.addEventListener('click', async () => {
      await renderStatsScreen();
    });
  }

  if (elements.viewStatsFromResult) {
    elements.viewStatsFromResult.addEventListener('click', async () => {
      await renderStatsScreen();
    });
  }

  if (elements.closeStats) {
    elements.closeStats.addEventListener('click', () => {
      showScreen('start');
    });
  }

  if (elements.clearHistory) {
    elements.clearHistory.addEventListener('click', async () => {
      if (await clearAllKarutaHistory()) {
        await renderStatsScreen();
      }
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
