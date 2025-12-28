(() => {
  const APP_VERSION = 'v0.0.12';
  const CSV_URL = new URL('data/hyakunin_isshu_with_ruby.csv', window.location.href).toString();
  const CSV_FALLBACK_URL = 'https://nuitsjp.github.io/goshiki-hyakunin-isshu/data/hyakunin_isshu_with_ruby.csv';
  const colorAccentMap = {
    '青': 'var(--color-blue)',
    'ピンク': 'var(--color-pink)',
    '黄': 'var(--color-yellow)',
    '緑': 'var(--color-green)',
    'オレンジ': 'var(--color-orange)',
  };

  const screens = {
    start: document.getElementById('start-screen'),
    quiz: document.getElementById('quiz-screen'),
    result: document.getElementById('result-screen'),
  };

  const elements = {
    version: document.getElementById('app-version'),
    questionCount: document.getElementById('question-count'),
    colorButtons: document.querySelectorAll('.color-button'),
    progressText: document.getElementById('progress-text'),
    progressBar: document.getElementById('progress-bar'),
    kimariji: document.getElementById('kimariji'),
    toggleKimariji: document.getElementById('toggle-kimariji'),
    options: document.querySelectorAll('#options-container .option-button'),
    feedback: document.getElementById('feedback'),
    selectedColorLabel: document.getElementById('selected-color-label'),
    resultCount: document.getElementById('result-count'),
    resultRate: document.getElementById('result-rate'),
    resultComment: document.getElementById('result-comment'),
    resultList: document.getElementById('result-list'),
    retrySame: document.getElementById('retry-same'),
    chooseColor: document.getElementById('choose-color'),
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
  };

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
    document.documentElement.style.setProperty('--current-accent', accent);
    elements.progressBar.style.backgroundColor = accent;
    elements.selectedColorLabel.style.backgroundColor = accent;
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
    const options = [
      { text: correctPoem.shimoNoKu, isCorrect: true },
      ...wrong.map(poem => ({ text: poem.shimoNoKu, isCorrect: false })),
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
      kamiNoKu: poem.kamiNoKu,
      options: generateOptions(poem, poemsByColor),
    }));
  }

  function resetOptionButtons() {
    elements.options.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('btn-success', 'btn-danger', 'active');
      btn.classList.add('btn-outline-secondary');
    });
  }

  function updateProgress() {
    const total = quizState.currentQuestions.length || quizState.questionLimit;
    const current = quizState.currentIndex + 1;
    elements.progressText.textContent = `問題 ${current} / ${total}`;
    const ratio = Math.round((current / total) * 100);
    elements.progressBar.style.width = `${ratio}%`;
    elements.progressBar.setAttribute('aria-valuenow', String(ratio));
  }

  function renderKimariji(question) {
    if (!question) return;
    if (quizState.showKami) {
      elements.kimariji.innerHTML = toRubyHtml(question.kamiNoKu || '');
    } else {
      elements.kimariji.textContent = question.kimariji;
    }
    if (elements.toggleKimariji) {
      const showingKami = quizState.showKami;
      elements.toggleKimariji.textContent = showingKami ? '⇆ 決まり字表示' : '⇆ 上の句表示';
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

    quizState.showKami = false;
    renderKimariji(question);
    resetOptionButtons();
    elements.feedback.textContent = '';
    elements.feedback.style.color = 'var(--color-text)';
    question.options.forEach((option, idx) => {
      const btn = elements.options[idx];
      btn.innerHTML = toRubyHtml(option.text);
      btn.setAttribute('aria-label', toAriaLabel(option.text));
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
      shimoNoKu: question.correctShimo,
      usedKami: quizState.showKami,
      isCorrect,
      index: quizState.currentIndex,
    });
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
      elements.feedback.innerHTML = `不正解。正解: ${toRubyHtml(question.correctShimo)}`;
      elements.feedback.style.color = 'var(--color-incorrect)';
    }

    setTimeout(() => {
      quizState.currentIndex += 1;
      if (quizState.currentIndex >= quizState.currentQuestions.length) {
        showResults();
      } else {
        renderQuestion();
      }
    }, 1000);
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
    const metaText = status === 'correct'
      ? '正解'
      : status === 'assist'
        ? '上の句を表示して正解'
        : ans.usedKami
          ? '上の句を表示したが不正解'
          : '不正解';
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-header">
        <span class="result-icon ${iconClass}" aria-hidden="true">${icon}</span>
        <div>
          <div class="fw-semibold mb-0">第${idx + 1}問 ${escapeHtml(ans.kimariji)}</div>
          <div class="result-meta">${metaText}</div>
        </div>
      </div>
      <p class="result-body mb-1">上の句: ${toRubyHtml(ans.kamiNoKu)}</p>
      <p class="result-body mb-0">下の句: ${toRubyHtml(ans.shimoNoKu)}</p>
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

  function startQuiz(color) {
    try {
      quizState.selectedColor = color;
      if (elements.questionCount) {
        const val = parseInt(elements.questionCount.value, 10);
        quizState.questionLimit = Number.isFinite(val) ? val : 20;
      }
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

    elements.options.forEach(btn => {
      btn.addEventListener('click', handleAnswer);
    });

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
    initEventHandlers();
    loadCsv();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
