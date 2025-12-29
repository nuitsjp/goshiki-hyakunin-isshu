import { APP_VERSION, colorAccentMap, colorTextMap, STORAGE_KEYS } from './config.js';
import { quizState, statsState } from './state.js';
import { getScreens, getElements } from './dom.js';
import {
  saveQuizSession,
  loadQuizHistory,
  refreshQuizHistory,
  getCachedQuizHistory,
  clearAllHistory,
  checkLocalStorageAvailable,
  setAuthModule,
} from './storage.js';
import { calculateKimarijiPerformance, formatDurationMs } from './stats.js';
import { buildQuestions, buildWeakQuestions, canUseWeak5 } from './questions.js';
import { loadCsv } from './data.js';
import { escapeHtml, toRubyHtml, toAriaLabel } from './text.js';
import { createStatsUI } from './stats-ui.js';
import { initAuthUI, getCurrentUserId } from './auth.js';

const screens = getScreens();
const elements = getElements();

let advanceTimerId = null;
let elapsedTimerId = null;
let currentScreen = 'start';
let settingsReturnScreen = 'start';

function showScreen(screen) {
  Object.values(screens).forEach(node => {
    if (!node) return;
    node.classList.add('hidden');
  });
  if (screens[screen]) {
    screens[screen].classList.remove('hidden');
    currentScreen = screen;
  }
  if (screen === 'start') {
    updateWeak5Option(null);
  }
}

const statsUI = createStatsUI({
  elements,
  statsState,
  quizState,
  showScreen,
  loadHistory: loadQuizHistory,
});

async function refreshHistoryCache() {
  await refreshQuizHistory();
  statsUI.clearHistoryCache();
}

async function refreshHistoryForStart() {
  await refreshHistoryCache();
  await statsUI.renderColorSummaries();
}

function closeMenu() {
  if (elements.menuPanel) elements.menuPanel.classList.add('hidden');
  if (elements.menuButton) elements.menuButton.setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
  if (!elements.menuPanel || !elements.menuButton) return;
  const isOpen = !elements.menuPanel.classList.contains('hidden');
  elements.menuPanel.classList.toggle('hidden', isOpen);
  elements.menuButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
}

function setAccentColor(color) {
  const accent = colorAccentMap[color] || 'var(--color-blue)';
  const textColor = colorTextMap[color] || '#fff';
  document.documentElement.style.setProperty('--current-accent', accent);
  elements.progressBar.style.backgroundColor = accent;
  elements.selectedColorLabel.style.backgroundColor = accent;
  elements.selectedColorLabel.style.color = textColor;
}

function updateWeak5Option(color) {
  if (!elements.questionCount) return;

  const weak5Option = elements.questionCount.querySelector('option[value="weak5"]');
  if (!weak5Option) return;

  const history = getCachedQuizHistory();
  if (color && quizState.allPoems.length && Array.isArray(history)) {
    const kimarijiPerf = calculateKimarijiPerformance(color, quizState.allPoems, history);
    weak5Option.disabled = !canUseWeak5(kimarijiPerf);
  } else {
    weak5Option.disabled = true;
  }

  if (weak5Option.disabled && elements.questionCount.value === 'weak5') {
    elements.questionCount.value = '20';
    quizState.questionLimit = 20;
  }
}

function resetOptionButtons() {
  elements.options.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('btn-success', 'btn-danger', 'active');
    btn.classList.add('btn-outline-secondary');
  });
  if (elements.giveUp) {
    elements.giveUp.disabled = false;
  }
}

function clearAdvanceTimer() {
  if (advanceTimerId) {
    clearTimeout(advanceTimerId);
    advanceTimerId = null;
  }
}

function clearElapsedTimer() {
  if (elapsedTimerId) {
    clearInterval(elapsedTimerId);
    elapsedTimerId = null;
  }
}

function updateElapsedTime() {
  if (!elements.elapsedTime) return;
  const elapsedMs = Math.max(0, Math.round(performance.now() - quizState.sessionStartTime));
  elements.elapsedTime.textContent = formatDurationMs(elapsedMs);
}

function startElapsedTimer() {
  if (!elements.elapsedTime) return;
  clearElapsedTimer();
  updateElapsedTime();
  elapsedTimerId = setInterval(() => {
    updateElapsedTime();
  }, 250);
}

function finalizeSessionTiming() {
  quizState.sessionEndTime = performance.now();
  updateElapsedTime();
  clearElapsedTimer();
}

function hideAutoAdvanceProgress() {
  if (elements.autoAdvanceProgress) {
    elements.autoAdvanceProgress.classList.add('hidden');
  }
  if (elements.autoAdvanceBar) {
    elements.autoAdvanceBar.classList.remove('animating');
    elements.autoAdvanceBar.style.width = '0%';
  }
}

function showAutoAdvanceProgress() {
  if (elements.autoAdvanceProgress) {
    elements.autoAdvanceProgress.classList.remove('hidden');
  }
  if (elements.autoAdvanceBar) {
    elements.autoAdvanceBar.classList.remove('animating');
    void elements.autoAdvanceBar.offsetWidth;
    elements.autoAdvanceBar.classList.add('animating');
  }
}

function resetQuizView() {
  clearAdvanceTimer();
  clearElapsedTimer();
  hideAutoAdvanceProgress();
  quizState.currentQuestions = [];
  quizState.currentIndex = 0;
  quizState.correctCount = 0;
  quizState.answers = [];
  quizState.showKami = false;
  quizState.selectedColor = '';
  quizState.sessionEndTime = null;
  elements.feedback.textContent = '';
  elements.feedback.style.color = 'var(--color-text)';
  elements.kimariji.textContent = '---';
  elements.selectedColorLabel.textContent = '';
  elements.selectedColorLabel.style.backgroundColor = '';
  elements.selectedColorLabel.style.color = '';
  elements.progressText.textContent = '問題 0 / 0';
  elements.progressBar.style.width = '0%';
  elements.progressBar.setAttribute('aria-valuenow', '0');
  if (elements.elapsedTime) {
    elements.elapsedTime.textContent = formatDurationMs(0);
  }
  if (elements.nextQuestion) {
    elements.nextQuestion.disabled = true;
    elements.nextQuestion.textContent = '次へ';
  }
  resetOptionButtons();
  elements.options.forEach(btn => {
    btn.innerHTML = '';
    btn.removeAttribute('data-correct');
    btn.removeAttribute('data-option-index');
  });
  if (elements.toggleKimariji) {
    const hintLabel = quizState.hintType === 'kami' ? '上の句' : '初句';
    elements.toggleKimariji.textContent = `? ${hintLabel}表示`;
    elements.toggleKimariji.setAttribute('aria-pressed', 'false');
    elements.toggleKimariji.disabled = true;
  }
}

function updateProgress() {
  const total = quizState.currentQuestions.length || quizState.questionLimit;
  const current = quizState.currentIndex + 1;
  elements.progressText.textContent = `問題 ${current} / ${total}`;
  const ratio = Math.round((current / total) * 100);
  elements.progressBar.style.width = `${ratio}%`;
  elements.progressBar.setAttribute('aria-valuenow', String(ratio));
}

function updateNextButton(ready = false) {
  if (!elements.nextQuestion) return;
  const isLast = quizState.currentIndex + 1 >= (quizState.currentQuestions.length || 0);
  elements.nextQuestion.disabled = !ready;
  elements.nextQuestion.textContent = ready
    ? (isLast ? '結果を見る' : '次の問題へ')
    : '次へ';
}

function renderKimariji(question) {
  if (!question) return;
  const isReverse = quizState.orderMode === 'reverse';
  const hintLabel = quizState.hintType === 'shoku' ? '初句' : '上の句';

  if (elements.mainDisplayLabel) {
    elements.mainDisplayLabel.textContent = isReverse ? '下の句 (問題)' : '決まり字';
  }

  if (isReverse) {
    if (quizState.showKami) {
      const text = quizState.displayMode === 'kana'
        ? (question.kamiReading || '')
        : (question.kamiNoKu || '');
      elements.kimariji.innerHTML = toRubyHtml(text);
    } else {
      const text = quizState.displayMode === 'kana'
        ? (question.correctShimoReading || '')
        : (question.correctShimo || '');
      elements.kimariji.innerHTML = toRubyHtml(text);
    }

    if (elements.toggleKimariji) {
      const showingKami = quizState.showKami;
      elements.toggleKimariji.textContent = showingKami ? '? 下の句表示' : '? 上の句表示';
      elements.toggleKimariji.setAttribute('aria-pressed', showingKami ? 'true' : 'false');
      elements.toggleKimariji.disabled = false;
    }
    return;
  }

  if (quizState.showKami) {
    if (quizState.hintType === 'shoku') {
      elements.kimariji.textContent = question.hint || '';
    } else {
      const text = quizState.displayMode === 'kana'
        ? (question.kamiReading || '')
        : (question.kamiNoKu || '');
      elements.kimariji.innerHTML = toRubyHtml(text);
    }
  } else {
    elements.kimariji.textContent = question.kimariji;
  }
  if (elements.toggleKimariji) {
    const showingKami = quizState.showKami;
    elements.toggleKimariji.textContent = showingKami ? '? 決まり字表示' : `? ${hintLabel}表示`;
    elements.toggleKimariji.setAttribute('aria-pressed', showingKami ? 'true' : 'false');
    elements.toggleKimariji.disabled = false;
  }
}

function renderQuestion() {
  const question = quizState.currentQuestions[quizState.currentIndex];
  if (!question) {
    showResults();
    return;
  }

  quizState.isAnswered = false;
  quizState.showKami = false;
  quizState.questionStartTime = performance.now();
  hideAutoAdvanceProgress();
  renderKimariji(question);

  const instructionDiv = elements.kimariji.nextElementSibling;
  if (instructionDiv && instructionDiv.classList.contains('text-muted')) {
    instructionDiv.textContent = quizState.orderMode === 'reverse'
      ? '上の句を選んでください'
      : '下の句を選んでください';
  }

  resetOptionButtons();
  updateNextButton(false);
  elements.feedback.textContent = '';
  elements.feedback.style.color = 'var(--color-text)';
  question.options.forEach((option, idx) => {
    const btn = elements.options[idx];
    const textToShow = quizState.displayMode === 'kana' ? option.textReading : option.text;
    btn.innerHTML = toRubyHtml(textToShow);
    btn.setAttribute('aria-label', toAriaLabel(textToShow));
    btn.dataset.correct = option.isCorrect ? 'true' : 'false';
    btn.dataset.optionIndex = String(idx);
  });

  updateProgress();
}

function handleAnswer(event) {
  const btn = event.currentTarget;
  if (btn.disabled) return;

  const question = quizState.currentQuestions[quizState.currentIndex];
  if (!question) return;

  const isCorrect = btn.dataset.correct === 'true';
  const answerTimeMs = Math.round(performance.now() - quizState.questionStartTime);
  quizState.answers.push({
    kimariji: question.kimariji,
    kamiNoKu: question.kamiNoKu,
    kamiReading: question.kamiReading,
    shimoNoKu: question.correctShimo,
    shimoReading: question.correctShimoReading,
    usedKami: quizState.showKami,
    isCorrect,
    index: quizState.currentIndex,
    answerTimeMs,
  });
  quizState.isAnswered = true;
  if (quizState.currentIndex + 1 >= quizState.currentQuestions.length) {
    finalizeSessionTiming();
  }
  if (elements.giveUp) elements.giveUp.disabled = true;
  elements.options.forEach(optionBtn => {
    optionBtn.disabled = true;
    const correct = optionBtn.dataset.correct === 'true';
    optionBtn.classList.remove('btn-outline-secondary');
    if (correct) {
      optionBtn.classList.add('btn-success');
    }
  });

  if (isCorrect) {
    quizState.correctCount += 1;
    btn.classList.add('btn-success');
    elements.feedback.textContent = '正解！';
    elements.feedback.style.color = 'var(--color-correct)';

    quizState.showKami = true;
    renderKimariji(question);
    showAutoAdvanceProgress();
    advanceTimerId = setTimeout(() => {
      goToNext();
    }, 750);
  } else {
    btn.classList.add('btn-danger');
    let correctText = '';
    if (quizState.orderMode === 'reverse') {
      correctText = quizState.displayMode === 'kana' ? question.kamiReading : question.kamiNoKu;
    } else {
      correctText = quizState.displayMode === 'kana' ? question.correctShimoReading : question.correctShimo;
    }
    elements.feedback.innerHTML = `不正解。正解: ${toRubyHtml(correctText)}`;
    elements.feedback.style.color = 'var(--color-incorrect)';

    quizState.showKami = true;
    renderKimariji(question);
    updateNextButton(true);
  }
}

function getResultComment(rate) {
  if (rate === 100) return '完璧です！';
  if (rate >= 90) return '素晴らしい！';
  if (rate >= 70) return 'よくできました！';
  if (rate >= 50) return 'もう少しです';
  return '復習しましょう';
}

function buildResultItem(ans, idx) {
  const status = ans.isCorrect ? (ans.usedKami ? 'assist' : 'correct') : 'wrong';
  const icon = status === 'correct' ? '○' : status === 'assist' ? '△' : '×';
  const iconClass = status === 'correct'
    ? 'icon-correct'
    : status === 'assist'
      ? 'icon-assist'
      : 'icon-wrong';
  const kamiText = quizState.displayMode === 'kana' ? ans.kamiReading : ans.kamiNoKu;
  const shimoText = quizState.displayMode === 'kana' ? ans.shimoReading : ans.shimoNoKu;
  const poemLine = `${toRubyHtml(kamiText)} ${toRubyHtml(shimoText)}`;
  const item = document.createElement('div');
  item.className = 'result-item';
  item.innerHTML = `
    <div class="result-header">
      <span class="result-icon ${iconClass}" aria-hidden="true">${icon}</span>
      <div>
        <div class="fw-semibold mb-0">第${idx + 1}問 ${escapeHtml(ans.kimariji)}</div>
        <div class="result-meta">${poemLine}</div>
      </div>
    </div>
  `;
  return item;
}

function renderResultList() {
  if (!elements.resultList) return;
  elements.resultList.innerHTML = '';
  if (!quizState.answers.length) return;
  quizState.answers.forEach((ans, idx) => {
    elements.resultList.appendChild(buildResultItem(ans, idx));
  });
}

async function showResults() {
  clearElapsedTimer();
  const total = quizState.currentQuestions.length || quizState.questionLimit;
  const rate = Math.round((quizState.correctCount / total) * 100);

  const wrongCount = total - quizState.correctCount;
  const passCount = quizState.answers.filter(a => !a.isCorrect && !a.usedKami).length;
  const endTime = Number.isFinite(quizState.sessionEndTime)
    ? quizState.sessionEndTime
    : performance.now();
  const durationMs = Math.round(endTime - quizState.sessionStartTime);

  const sessionData = {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    date: new Date().toISOString().split('T')[0],
    color: quizState.selectedColor,
    questionCount: total,
    correctCount: quizState.correctCount,
    wrongCount: wrongCount,
    passCount: passCount,
    accuracyRate: rate,
    hintType: quizState.hintType,
    displayMode: quizState.displayMode,
    orderMode: quizState.orderMode,
    durationMs: durationMs,
    answers: quizState.answers.map(a => ({
      kimariji: a.kimariji,
      isCorrect: a.isCorrect,
      usedKami: a.usedKami,
      answerTimeMs: a.answerTimeMs
    }))
  };

  await saveQuizSession(sessionData);
  statsUI.clearHistoryCache();

  elements.resultCount.textContent = `${quizState.correctCount} / ${total} 問正解`;
  elements.resultRate.textContent = `正答率 ${rate}%`;
  elements.resultComment.textContent = getResultComment(rate);
  renderResultList();
  showScreen('result');
}

function goToNext() {
  if (!quizState.isAnswered) return;
  quizState.currentIndex += 1;
  if (quizState.currentIndex >= quizState.currentQuestions.length) {
    showResults();
  } else {
    renderQuestion();
  }
}

async function cancelQuiz() {
  resetQuizView();
  showScreen('start');
  refreshHistoryForStart();
}

async function startQuiz(color) {
  try {
    clearAdvanceTimer();
    quizState.showKami = false;
    quizState.selectedColor = color;

    let isWeak5Mode = false;
    if (elements.questionCount) {
      const selectedValue = elements.questionCount.value;
      if (selectedValue === 'weak5') {
        isWeak5Mode = true;
        quizState.questionLimit = 5;
      } else {
        const val = parseInt(selectedValue, 10);
        quizState.questionLimit = Number.isFinite(val) ? val : 20;
      }
    }

    if (elements.hintType) {
      quizState.hintType = elements.hintType.value || 'shoku';
    }
    if (elements.displayMode) {
      quizState.displayMode = elements.displayMode.value || 'kana';
    }

    if (isWeak5Mode) {
      const history = getCachedQuizHistory() || [];
      const kimarijiPerf = calculateKimarijiPerformance(color, quizState.allPoems, history);
      quizState.currentQuestions = buildWeakQuestions({
        poems: quizState.allPoems,
        color,
        orderMode: quizState.orderMode,
        kimarijiStats: kimarijiPerf,
      });
    } else {
      quizState.currentQuestions = buildQuestions({
        poems: quizState.allPoems,
        color,
        questionLimit: quizState.questionLimit,
        orderMode: quizState.orderMode,
      });
    }

    quizState.currentIndex = 0;
    quizState.correctCount = 0;
    quizState.answers = [];
    quizState.sessionStartTime = performance.now();
    quizState.sessionEndTime = null;
    startElapsedTimer();
    elements.selectedColorLabel.textContent = `${color}の歌`;
    setAccentColor(color);
    showScreen('quiz');
    renderQuestion();
  } catch (error) {
    console.error(error);
    alert(error.message || 'データの読み込みに失敗しました。');
  }
}

function handleChooseColor(color) {
  if (!quizState.allPoems.length) {
    alert('データがまだ読み込まれていません。少し待ってから再試行してください。');
    return;
  }
  startQuiz(color);
}

function handleGiveUp() {
  if (quizState.isAnswered) return;
  const question = quizState.currentQuestions[quizState.currentIndex];
  if (!question) return;

  const answerTimeMs = Math.round(performance.now() - quizState.questionStartTime);
  quizState.answers.push({
    kimariji: question.kimariji,
    kamiNoKu: question.kamiNoKu,
    kamiReading: question.kamiReading,
    shimoNoKu: question.correctShimo,
    shimoReading: question.correctShimoReading,
    usedKami: quizState.showKami,
    isCorrect: false,
    index: quizState.currentIndex,
    answerTimeMs,
  });
  quizState.isAnswered = true;
  if (quizState.currentIndex + 1 >= quizState.currentQuestions.length) {
    finalizeSessionTiming();
  }

  elements.options.forEach(btn => btn.disabled = true);
  if (elements.giveUp) elements.giveUp.disabled = true;

  let correctText = '';
  if (quizState.orderMode === 'reverse') {
    correctText = quizState.displayMode === 'kana' ? question.kamiReading : question.kamiNoKu;
  } else {
    correctText = quizState.displayMode === 'kana' ? question.correctShimoReading : question.correctShimo;
  }
  elements.feedback.innerHTML = `残念。正解: ${toRubyHtml(correctText)}`;
  elements.feedback.style.color = 'var(--color-incorrect)';

  quizState.showKami = true;
  renderKimariji(question);
  updateNextButton(true);
}

function initEventHandlers() {
  elements.colorButtons.forEach(btn => {
    btn.addEventListener('click', () => handleChooseColor(btn.dataset.color));
    btn.addEventListener('mouseenter', () => updateWeak5Option(btn.dataset.color));
    btn.addEventListener('focus', () => updateWeak5Option(btn.dataset.color));
  });

  if (elements.questionCount) {
    elements.questionCount.addEventListener('change', () => {
      const selectedValue = elements.questionCount.value;
      if (selectedValue === 'weak5') {
        quizState.questionLimit = 5;
      } else {
        const val = parseInt(selectedValue, 10);
        if (Number.isFinite(val) && val >= 1 && val <= 20) {
          quizState.questionLimit = val;
        } else {
          quizState.questionLimit = 20;
          elements.questionCount.value = 20;
        }
      }
    });
  }

  if (elements.displayMode) {
    elements.displayMode.addEventListener('change', () => {
      quizState.displayMode = elements.displayMode.value || 'kana';
      try {
        localStorage.setItem(STORAGE_KEYS.DISPLAY_MODE, quizState.displayMode);
      } catch (e) { console.warn(e); }
    });
  }

  if (elements.orderNormal && elements.orderReverse) {
    const updateOrderButtons = (mode) => {
      if (mode === 'normal') {
        elements.orderNormal.classList.add('active');
        elements.orderReverse.classList.remove('active');
      } else {
        elements.orderNormal.classList.remove('active');
        elements.orderReverse.classList.add('active');
      }
    };

    const setOrderMode = async (mode) => {
      quizState.orderMode = mode;
      updateOrderButtons(mode);
      try {
        localStorage.setItem(STORAGE_KEYS.ORDER_MODE, mode);
      } catch (e) { console.warn(e); }
      statsUI.clearHistoryCache();
      await statsUI.renderColorSummaries();
    };

    elements.orderNormal.addEventListener('click', () => setOrderMode('normal'));
    elements.orderReverse.addEventListener('click', () => setOrderMode('reverse'));

    let savedOrder = 'normal';
    try {
      savedOrder = localStorage.getItem(STORAGE_KEYS.ORDER_MODE) || 'normal';
    } catch (e) { console.warn(e); }
    quizState.orderMode = savedOrder;
    updateOrderButtons(savedOrder);
  }

  elements.options.forEach(btn => {
    btn.addEventListener('click', handleAnswer);
  });

  if (elements.giveUp) {
    elements.giveUp.addEventListener('click', handleGiveUp);
  }

  if (elements.cancelQuiz) {
    elements.cancelQuiz.addEventListener('click', cancelQuiz);
  }

  if (elements.nextQuestion) {
    elements.nextQuestion.addEventListener('click', goToNext);
  }

  if (elements.toggleKimariji) {
    elements.toggleKimariji.addEventListener('click', () => {
      const question = quizState.currentQuestions[quizState.currentIndex];
      if (!question) return;
      quizState.showKami = !quizState.showKami;
      renderKimariji(question);
    });
  }

  elements.retrySame.addEventListener('click', async () => {
    if (!quizState.selectedColor) {
      showScreen('start');
      refreshHistoryForStart();
      return;
    }
    startQuiz(quizState.selectedColor);
  });

  elements.chooseColor.addEventListener('click', async () => {
    resetQuizView();
    showScreen('start');
    refreshHistoryForStart();
  });

  if (elements.viewStats) {
    elements.viewStats.addEventListener('click', async () => {
      await refreshHistoryCache();
      await statsUI.renderStatsScreen(true);
    });
  }

  if (elements.viewStatsFromResult) {
    elements.viewStatsFromResult.addEventListener('click', async () => {
      await refreshHistoryCache();
      await statsUI.renderStatsScreen(true);
    });
  }

  if (elements.closeStats) {
    elements.closeStats.addEventListener('click', async () => {
      showScreen('start');
      refreshHistoryForStart();
    });
  }

  if (elements.clearHistory) {
    elements.clearHistory.addEventListener('click', async () => {
      if (await clearAllHistory()) {
        statsUI.clearHistoryCache();
        if (currentScreen === 'stats') {
          await statsUI.renderStatsScreen(false);
          await statsUI.renderColorSummaries();
        }
      }
    });
  }

  if (elements.statsFilterNormal && elements.statsFilterReverse) {
    const updateStatsFilterButtons = (mode) => {
      elements.statsFilterNormal.classList.toggle('active', mode === 'normal');
      elements.statsFilterReverse.classList.toggle('active', mode === 'reverse');
    };

    const setStatsFilterMode = (mode) => {
      statsState.filterMode = mode;
      updateStatsFilterButtons(mode);
      statsUI.clearDetailedView();
      statsUI.renderStatsScreen();
    };

    elements.statsFilterNormal.addEventListener('click', () => setStatsFilterMode('normal'));
    elements.statsFilterReverse.addEventListener('click', () => setStatsFilterMode('reverse'));
  }

  if (elements.menuButton) {
    elements.menuButton.addEventListener('click', () => {
      toggleMenu();
    });
  }

  if (elements.menuSettings) {
    elements.menuSettings.addEventListener('click', () => {
      settingsReturnScreen = currentScreen;
      closeMenu();
      showScreen('settings');
    });
  }

  if (elements.closeSettings) {
    elements.closeSettings.addEventListener('click', async () => {
      const returnTo = settingsReturnScreen || 'start';
      if (returnTo === 'start') {
        showScreen(returnTo);
        refreshHistoryForStart();
        return;
      }
      showScreen(returnTo);
    });
  }

  document.addEventListener('click', (event) => {
    if (!elements.menuPanel || !elements.menuButton) return;
    const target = event.target;
    if (!target) return;
    const isInside = elements.menuPanel.contains(target) || elements.menuButton.contains(target);
    if (!isInside) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
}

function init() {
  setAuthModule({ getCurrentUserId });

  if (elements.version) {
    elements.version.textContent = APP_VERSION;
  }
  if (elements.questionCount) {
    const normalOptions = Array.from({ length: 20 }, (_, idx) => {
      const val = idx + 1;
      return `<option value="${val}" ${val === quizState.questionLimit ? 'selected' : ''}>${val} 問</option>`;
    }).join('');
    const weak5Option = '<option value="weak5" disabled>苦手5種</option>';
    elements.questionCount.innerHTML = normalOptions + weak5Option;
    elements.questionCount.value = quizState.questionLimit;
  }
  if (elements.displayMode) {
    let savedMode = 'kana';
    try {
      savedMode = localStorage.getItem(STORAGE_KEYS.DISPLAY_MODE) || 'kana';
    } catch (e) { console.warn(e); }
    quizState.displayMode = savedMode;
    elements.displayMode.value = savedMode;
  }

  if (!checkLocalStorageAvailable()) {
    console.warn('Statistics disabled: localStorage not available');
    if (elements.viewStats) elements.viewStats.style.display = 'none';
    if (elements.viewStatsFromResult) elements.viewStatsFromResult.style.display = 'none';
  }

  initEventHandlers();
  initAuthUI({ elements, closeMenu });
  resetQuizView();
  refreshHistoryForStart();
  loadCsv()
    .then(poems => {
      quizState.allPoems = poems;
    })
    .catch(err => {
      console.error('CSV load error', err);
      alert('CSVの読み込みに失敗しました。HTTPサーバーで開くか、GitHub Pagesを開き直してください。');
    });
}

document.addEventListener('DOMContentLoaded', init);
