import { APP_VERSION, colorAccentMap, colorTextMap } from './config.js';
import { loadCsv } from './data.js';
import { buildKarutaDeck, buildKarutaReadings, checkKarutaMatch } from './karuta.js';
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
  sessionStartTime: null,
  sessionEndTime: null,
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
  selectedColorLabel: document.getElementById('selected-color-label'),
  kimarijiDisplay: document.getElementById('kimariji-display'),
  readingDisplay: document.getElementById('reading-display'),
  karutaGrid: document.getElementById('karuta-grid'),
  nextReading: document.getElementById('next-reading'),
  resultCount: document.getElementById('result-count'),
  resultRate: document.getElementById('result-rate'),
  resultComment: document.getElementById('result-comment'),
  resultList: document.getElementById('result-list'),
  retrySame: document.getElementById('retry-same'),
  chooseColor: document.getElementById('choose-color'),
  appVersion: document.getElementById('app-version'),
};

function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen?.classList.add('hidden'));
  screens[screenName]?.classList.remove('hidden');
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

function displayReading() {
  const reading = karutaState.readings[karutaState.currentIndex];

  if (elements.kimarijiDisplay) {
    elements.kimarijiDisplay.textContent = reading.kimariji;
  }

  // 初期は決まり字のみ表示（上の句は表示しない）
  if (elements.readingDisplay) {
    elements.readingDisplay.innerHTML = '';
  }
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
      cardElement.classList.add('hidden');
      cardElement.disabled = true;
      cardElement.textContent = card.shimoReading.replace(/\s/g, '');
    } else if (card.state === 'showing-result') {
      // 結果表示中（アイコン付き）
      cardElement.classList.add('showing-result');
      cardElement.disabled = true;
      cardElement.textContent = card.shimoReading.replace(/\s/g, '');

      const iconElement = document.createElement('span');
      iconElement.className = 'result-icon';
      if (card.isCorrect) {
        iconElement.classList.add('correct');
        iconElement.textContent = '●';
      } else {
        iconElement.classList.add('incorrect');
        iconElement.textContent = '✕';
      }
      cardElement.appendChild(iconElement);
    } else {
      cardElement.classList.add('active');
      cardElement.textContent = card.shimoReading.replace(/\s/g, '');
      cardElement.addEventListener('click', () => handleCardClick(index));
    }

    elements.karutaGrid.appendChild(cardElement);
  });
}

function handleCardClick(cardIndex) {
  const card = karutaState.deck[cardIndex];
  const reading = karutaState.readings[karutaState.currentIndex];

  if (card.state !== 'active') return;

  const isCorrect = checkKarutaMatch(reading, card);

  // 結果をカードに記録
  card.isCorrect = isCorrect;
  card.state = 'showing-result';

  if (isCorrect) {
    // Correct answer
    karutaState.score++;
    karutaState.results.push({
      kimariji: reading.kimariji,
      kamiNoKu: reading.kamiNoKu,
      shimoReading: card.shimoReading,
      isCorrect: true,
      cardState: 'hidden',
    });
  } else {
    // Wrong answer
    karutaState.results.push({
      kimariji: reading.kimariji,
      kamiNoKu: reading.kamiNoKu,
      shimoReading: card.shimoReading,
      isCorrect: false,
      cardState: 'hidden',
    });
  }

  renderCards();
  updateProgress();

  // 0.5秒後にカードを非表示にして次の読み札に進む
  setTimeout(() => {
    card.state = 'hidden';
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
  }, 500);
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
  const total = karutaState.readings.length;
  const correct = karutaState.score;
  const rate = Math.round((correct / total) * 100);
  const endTime = typeof performance !== 'undefined' ? performance.now() : null;
  karutaState.sessionEndTime = endTime;
  const durationMs = Number.isFinite(karutaState.sessionStartTime) && Number.isFinite(endTime)
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
    const html = karutaState.results.map((result, i) => {
      const icon = result.isCorrect ? '○' : '×';
      const className = result.isCorrect ? 'result-item-correct' : 'result-item-incorrect';
      const kimarijiHtml = escapeHtml(result.kimariji);
      const kamiHtml = toRubyHtml(result.kamiNoKu);
      const shimoHtml = escapeHtml(result.shimoReading.replace(/\s/g, ''));

      return `
        <div class="result-item ${className}">
          <span class="result-icon">${icon}</span>
          <div class="result-content">
            <div class="result-kimariji">${kimarijiHtml}</div>
            <div class="result-kami">${kamiHtml}</div>
            <div class="result-shimo">${shimoHtml}</div>
          </div>
        </div>
      `;
    }).join('');
    elements.resultList.innerHTML = html;
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
  karutaState.sessionStartTime = typeof performance !== 'undefined' ? performance.now() : null;
  karutaState.sessionEndTime = null;

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

  // Cancel game
  if (elements.cancelGame) {
    elements.cancelGame.addEventListener('click', () => {
      showScreen('start');
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
}

async function init() {
  // Set version
  if (elements.appVersion) {
    elements.appVersion.textContent = APP_VERSION;
  }

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
