import { APP_VERSION, colorAccentMap, colorTextMap } from './config.js';
import { loadCsv } from './data.js';
import { buildKarutaDeck, buildKarutaReadings, checkKarutaMatch } from './karuta.js';
import { escapeHtml, toRubyHtml } from './text.js';

// Game state
const karutaState = {
  allPoems: [],
  selectedColor: '',
  deck: [],           // 20 cards (lower poems) in grid
  readings: [],       // 20 readings (upper poems) in order
  currentIndex: 0,
  score: 0,           // Number of correct cards taken
  results: [],        // Array of {kimariji, isCorrect, cardState}
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

  if (elements.readingDisplay) {
    const rubyHtml = toRubyHtml(reading.kamiNoKu);
    elements.readingDisplay.innerHTML = rubyHtml;
  }
}

function renderCards() {
  if (!elements.karutaGrid) return;

  elements.karutaGrid.innerHTML = '';

  karutaState.deck.forEach((card, index) => {
    const cardElement = document.createElement('button');
    cardElement.className = 'karuta-card';
    cardElement.dataset.index = index;

    if (card.state === 'taken') {
      cardElement.classList.add('taken');
      cardElement.disabled = true;
      cardElement.innerHTML = '<span class="card-taken-mark">✓</span>';
    } else if (card.state === 'wrong') {
      cardElement.classList.add('wrong');
      cardElement.disabled = true;
      const rubyHtml = toRubyHtml(card.shimoNoKu);
      cardElement.innerHTML = rubyHtml;
    } else {
      cardElement.classList.add('active');
      const rubyHtml = toRubyHtml(card.shimoNoKu);
      cardElement.innerHTML = rubyHtml;
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

  if (isCorrect) {
    // Correct answer
    card.state = 'taken';
    karutaState.score++;
    karutaState.results.push({
      kimariji: reading.kimariji,
      kamiNoKu: reading.kamiNoKu,
      shimoNoKu: card.shimoNoKu,
      isCorrect: true,
      cardState: 'taken',
    });
  } else {
    // Wrong answer
    card.state = 'wrong';
    karutaState.results.push({
      kimariji: reading.kimariji,
      kamiNoKu: reading.kamiNoKu,
      shimoNoKu: card.shimoNoKu,
      isCorrect: false,
      cardState: 'wrong',
    });
  }

  renderCards();
  updateProgress();

  // Enable next button
  if (elements.nextReading) {
    elements.nextReading.disabled = false;
  }
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
      const shimoHtml = toRubyHtml(result.shimoNoKu);

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
      if (confirm('ゲームを中止してトップに戻りますか？')) {
        showScreen('start');
      }
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
