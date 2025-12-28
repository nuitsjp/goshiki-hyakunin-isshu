(() => {
  const APP_VERSION = 'v0.0.20';
  const CSV_URL = new URL('data/hyakunin_isshu_with_ruby.csv', window.location.href).toString();
  const CSV_FALLBACK_URL = 'https://nuitsjp.github.io/goshiki-hyakunin-isshu/data/hyakunin_isshu_with_ruby.csv';
  const colorAccentMap = {
    '青': 'var(--color-blue)',
    'ピンク': 'var(--color-pink)',
    '黄': 'var(--color-yellow)',
    '緑': 'var(--color-green)',
    'オレンジ': 'var(--color-orange)',
  };
  const colorTextMap = {
    '黄': '#3b3b00',
  };

  const screens = {
    start: document.getElementById('start-screen'),
    quiz: document.getElementById('quiz-screen'),
    result: document.getElementById('result-screen'),
  };

  const elements = {
    version: document.getElementById('app-version'),
    questionCount: document.getElementById('question-count'),
    hintType: document.getElementById('hint-type'),
    displayMode: document.getElementById('display-mode'),
    orderNormal: document.getElementById('order-normal'),
    orderReverse: document.getElementById('order-reverse'),
    colorButtons: document.querySelectorAll('.color-button'),
    progressText: document.getElementById('progress-text'),
    progressBar: document.getElementById('progress-bar'),
    kimariji: document.getElementById('kimariji'),
    mainDisplayLabel: document.getElementById('main-display-label'),
    toggleKimariji: document.getElementById('toggle-kimariji'),
    options: document.querySelectorAll('#options-container .option-button'),
    feedback: document.getElementById('feedback'),
    selectedColorLabel: document.getElementById('selected-color-label'),
    cancelQuiz: document.getElementById('cancel-quiz'),
    nextQuestion: document.getElementById('next-question'),
    resultCount: document.getElementById('result-count'),
    resultRate: document.getElementById('result-rate'),
    resultComment: document.getElementById('result-comment'),
    resultList: document.getElementById('result-list'),
    retrySame: document.getElementById('retry-same'),
    chooseColor: document.getElementById('choose-color'),
    giveUp: document.getElementById('give-up-button'),
  };

  const quizState = {
    allPoems: [],
    selectedColor: '',
    currentQuestions: [],
    currentIndex: 0,
    correctCount: 0,
    showKami: false,
    answers: [],
    questionLimit: 20,
    isAnswered: false,
    isAnswered: false,
    hintType: 'kimariji',
    hintType: 'kimariji',
    displayMode: 'kana',
    orderMode: 'normal',
  };

  let advanceTimerId = null;

  const escapeHtml = (str = '') =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const toRubyHtml = (text = '') => escapeHtml(text.replace(/\[([^\[\]]+)\]/g, ''));

  const toAriaLabel = (text = '') => text.replace(/\[([^\[\]]+)\]/g, '');

  function showScreen(screen) {
    Object.values(screens).forEach(node => node.classList.add('hidden'));
    if (screens[screen]) {
      screens[screen].classList.remove('hidden');
    }
  }

  function setAccentColor(color) {
    const accent = colorAccentMap[color] || 'var(--color-blue)';
    const textColor = colorTextMap[color] || '#fff';
    document.documentElement.style.setProperty('--current-accent', accent);
    elements.progressBar.style.backgroundColor = accent;
    elements.selectedColorLabel.style.backgroundColor = accent;
    elements.selectedColorLabel.style.color = textColor;
  }

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function generateOptions(correctPoem, pool) {
    const wrong = shuffle(pool.filter(p => p !== correctPoem)).slice(0, 3);
    const isReverse = quizState.orderMode === 'reverse';
    const options = [
      {
        text: isReverse ? correctPoem.kamiNoKu : correctPoem.shimoNoKu,
        textReading: isReverse ? correctPoem.kamiReading : correctPoem.shimoReading,
        isCorrect: true
      },
      ...wrong.map(poem => ({
        text: isReverse ? poem.kamiNoKu : poem.shimoNoKu,
        textReading: isReverse ? poem.kamiReading : poem.shimoReading,
        isCorrect: false
      })),
    ];
    return shuffle(options);
  }

  function buildQuestions(color) {
    const poemsByColor = quizState.allPoems.filter(poem => poem.color === color);
    if (poemsByColor.length === 0) {
      throw new Error(`指定の色データが見つかりません: ${color}`);
    }
    const maxCount = Math.max(1, Math.min(quizState.questionLimit, poemsByColor.length));
    const selected = shuffle(poemsByColor).slice(0, maxCount);
    return selected.map(poem => ({
      kimariji: poem.kimarijiShort || poem.kimarijiLong || '決まり字なし',
      correctShimo: poem.shimoNoKu,
      correctShimoReading: poem.shimoReading,
      kamiNoKu: poem.kamiNoKu,
      kamiReading: poem.kamiReading,
      hint: poem.hint,
      options: generateOptions(poem, poemsByColor),
    }));
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

  function resetQuizView() {
    clearAdvanceTimer();
    quizState.currentQuestions = [];
    quizState.currentIndex = 0;
    quizState.correctCount = 0;
    quizState.answers = [];
    quizState.showKami = false;
    quizState.selectedColor = '';
    elements.feedback.textContent = '';
    elements.feedback.style.color = 'var(--color-text)';
    elements.kimariji.textContent = '---';
    elements.selectedColorLabel.textContent = '';
    elements.selectedColorLabel.style.backgroundColor = '';
    elements.selectedColorLabel.style.color = '';
    elements.progressText.textContent = '問題 0 / 0';
    elements.progressBar.style.width = '0%';
    elements.progressBar.setAttribute('aria-valuenow', '0');
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
      const hintLabel = quizState.hintType === 'shoku' ? '初句' : (quizState.hintType === 'kami' ? '上の句' : '決まり字');
      elements.toggleKimariji.textContent = `⇆ ${hintLabel}表示`;
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
      // Reverse Mode: Question is Shimo-no-ku. Toggle shows Kami-no-ku.
      if (quizState.showKami) {
        // Show Answer (Kami)
        const text = quizState.displayMode === 'kana'
          ? (question.kamiReading || '')
          : (question.kamiNoKu || '');
        elements.kimariji.innerHTML = toRubyHtml(text);
      } else {
        // Show Question (Shimo)
        const text = quizState.displayMode === 'kana'
          ? (question.correctShimoReading || '')
          : (question.correctShimo || '');
        elements.kimariji.innerHTML = toRubyHtml(text);
      }

      if (elements.toggleKimariji) {
        const showingKami = quizState.showKami;
        elements.toggleKimariji.textContent = showingKami ? '⇆ 下の句表示' : '⇆ 上の句表示';
        elements.toggleKimariji.setAttribute('aria-pressed', showingKami ? 'true' : 'false');
        elements.toggleKimariji.disabled = false;
      }
      return;
    }

    // Normal Mode
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
      elements.toggleKimariji.textContent = showingKami ? '⇆ 決まり字表示' : `⇆ ${hintLabel}表示`;
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
    renderKimariji(question);

    // Update "Give option" instruction
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
    quizState.answers.push({
      kimariji: question.kimariji,
      kamiNoKu: question.kamiNoKu,
      kamiReading: question.kamiReading,
      shimoNoKu: question.correctShimo,
      shimoReading: question.correctShimoReading,
      usedKami: quizState.showKami,
      isCorrect,
      index: quizState.currentIndex,
    });
    quizState.isAnswered = true;
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
    }

    quizState.showKami = true;
    renderKimariji(question);
    updateNextButton(true);
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

  function showResults() {
    const total = quizState.currentQuestions.length || quizState.questionLimit;
    const rate = Math.round((quizState.correctCount / total) * 100);
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

  function cancelQuiz() {
    resetQuizView();
    showScreen('start');
  }

  function startQuiz(color) {
    try {
      clearAdvanceTimer();
      quizState.showKami = false;
      quizState.selectedColor = color;
      if (elements.questionCount) {
        const val = parseInt(elements.questionCount.value, 10);
        quizState.questionLimit = Number.isFinite(val) ? val : 20;
      }
      if (elements.hintType) {
        quizState.hintType = elements.hintType.value || 'shoku';
      }
      if (elements.displayMode) {
        quizState.displayMode = elements.displayMode.value || 'kana';
      }
      // orderMode is already set by click handlers
      quizState.currentQuestions = buildQuestions(color);
      quizState.currentIndex = 0;
      quizState.correctCount = 0;
      quizState.answers = [];
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

  function parseCsvText(text) {
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (result.errors && result.errors.length) {
      console.warn('CSV parse errors', result.errors);
    }
    const cleanKey = key => key ? key.replace(/^\uFEFF/, '').trim() : '';
    const pickField = (row, candidates) => {
      for (const name of candidates) {
        const val = row[name] ?? row[cleanKey(name)];
        if (val) return val;
      }
      return '';
    };
    quizState.allPoems = result.data.map(row => ({
      color: pickField(row, ['色', '\uFEFF色']),
      kamiNoKu: pickField(row, ['上の句']),
      shimoNoKu: pickField(row, ['下の句']),
      kamiReading: pickField(row, ['上の句読み']),
      shimoReading: pickField(row, ['下の句読み']),
      kimarijiLong: pickField(row, ['決まり字（競技かるた）']),
      kimarijiShort: pickField(row, ['決まり字（五色百人一首）']),
      hint: pickField(row, ['ヒント']),
    })).filter(p => p.color && p.shimoNoKu && (p.kimarijiLong || p.kimarijiShort));
    if (!quizState.allPoems.length) {
      throw new Error('CSVから有効なデータを読み込めませんでした。');
    }
  }

  function fetchCsv(url) {
    return fetch(url, { cache: 'no-cache' }).then(resp => {
      if (!resp.ok) throw new Error(`CSV取得失敗 (status ${resp.status})`);
      return resp.text();
    });
  }

  function loadCsv() {
    return fetchCsv(CSV_URL)
      .catch(err => {
        console.warn('Primary CSV fetch failed, trying fallback.', err);
        if (window.location.protocol === 'file:' || window.location.hostname === 'localhost') {
          return fetchCsv(CSV_FALLBACK_URL);
        }
        throw err;
      })
      .then(parseCsvText)
      .catch(err => {
        console.error('CSV load error', err);
        alert('CSVの読み込みに失敗しました。HTTPサーバーで開くか、GitHub Pagesを開き直してください。');
      });
  }

  function handleGiveUp() {
    if (quizState.isAnswered) return;
    const question = quizState.currentQuestions[quizState.currentIndex];
    if (!question) return;

    // Treat as incorrect
    quizState.answers.push({
      kimariji: question.kimariji,
      kamiNoKu: question.kamiNoKu,
      kamiReading: question.kamiReading,
      shimoNoKu: question.correctShimo,
      shimoReading: question.correctShimoReading,
      usedKami: quizState.showKami,
      isCorrect: false,
      index: quizState.currentIndex,
    });
    quizState.isAnswered = true;

    // Disable all buttons
    elements.options.forEach(btn => btn.disabled = true);
    if (elements.giveUp) elements.giveUp.disabled = true;

    // Show feedback (Always show correct answer for 'Give Up')
    // Show feedback (Always show correct answer for 'Give Up')
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
    });

    if (elements.questionCount) {
      elements.questionCount.addEventListener('change', () => {
        const val = parseInt(elements.questionCount.value, 10);
        if (Number.isFinite(val) && val >= 1 && val <= 20) {
          quizState.questionLimit = val;
        } else {
          quizState.questionLimit = 20;
          elements.questionCount.value = 20;
        }
      });
    }

    if (elements.displayMode) {
      elements.displayMode.addEventListener('change', () => {
        quizState.displayMode = elements.displayMode.value || 'kana';
        try {
          localStorage.setItem('goshiki_display_mode', quizState.displayMode);
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

      const setOrderMode = (mode) => {
        quizState.orderMode = mode;
        updateOrderButtons(mode);
        try {
          localStorage.setItem('goshiki_order_mode', mode);
        } catch (e) { console.warn(e); }
      };

      elements.orderNormal.addEventListener('click', () => setOrderMode('normal'));
      elements.orderReverse.addEventListener('click', () => setOrderMode('reverse'));

      // Init
      let savedOrder = 'normal';
      try {
        savedOrder = localStorage.getItem('goshiki_order_mode') || 'normal';
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

    elements.retrySame.addEventListener('click', () => {
      if (!quizState.selectedColor) {
        showScreen('start');
        return;
      }
      startQuiz(quizState.selectedColor);
    });

    elements.chooseColor.addEventListener('click', () => {
      resetQuizView();
      showScreen('start');
    });
  }

  function init() {
    if (elements.version) {
      elements.version.textContent = APP_VERSION;
    }
    if (elements.questionCount) {
      elements.questionCount.innerHTML = Array.from({ length: 20 }, (_, idx) => {
        const val = idx + 1;
        return `<option value="${val}" ${val === quizState.questionLimit ? 'selected' : ''}>${val} 問</option>`;
      }).join('');
      elements.questionCount.value = quizState.questionLimit;
    }
    if (elements.displayMode) {
      // Load saved display mode or default to 'kana'
      let savedMode = 'kana';
      try {
        savedMode = localStorage.getItem('goshiki_display_mode') || 'kana';
      } catch (e) { console.warn(e); }
      quizState.displayMode = savedMode;
      elements.displayMode.value = savedMode;
    }
    // Order mode initialized above separately
    initEventHandlers();
    resetQuizView();
    loadCsv();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
