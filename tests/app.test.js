import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { loadCsv } from '../src/js/data.js';

vi.mock('../src/js/data.js', () => ({
  loadCsv: vi.fn(() => Promise.resolve([
    {
      color: '青',
      kimarijiShort: 'あ',
      kimarijiLong: '',
      shimoNoKu: '下1',
      shimoReading: 'しも1',
      kamiNoKu: '上1',
      kamiReading: 'かみ1',
      hint: 'ひ1',
    },
    {
      color: '青',
      kimarijiShort: 'い',
      kimarijiLong: '',
      shimoNoKu: '下2',
      shimoReading: 'しも2',
      kamiNoKu: '上2',
      kamiReading: 'かみ2',
      hint: 'ひ2',
    },
    {
      color: '青',
      kimarijiShort: 'う',
      kimarijiLong: '',
      shimoNoKu: '下3',
      shimoReading: 'しも3',
      kamiNoKu: '上3',
      kamiReading: 'かみ3',
      hint: 'ひ3',
    },
    {
      color: '青',
      kimarijiShort: 'え',
      kimarijiLong: '',
      shimoNoKu: '下4',
      shimoReading: 'しも4',
      kamiNoKu: '上4',
      kamiReading: 'かみ4',
      hint: 'ひ4',
    },
  ])),
}));

const setupAppDom = () => {
  document.body.innerHTML = `
    <div id="start-screen"></div>
    <div id="quiz-screen" class="hidden">
      <div id="progress-text"></div>
      <div id="progress-bar"></div>
      <div id="elapsed-time">0:00</div>
      <div id="main-display-label"></div>
      <div id="kimariji"></div>
      <div class="text-muted"></div>
      <button id="toggle-kimariji"></button>
      <div id="options-container">
        <button class="option-button btn btn-outline-secondary"></button>
        <button class="option-button btn btn-outline-secondary"></button>
        <button class="option-button btn btn-outline-secondary"></button>
        <button class="option-button btn btn-outline-secondary"></button>
      </div>
      <div id="feedback"></div>
      <div id="auto-advance-progress" class="hidden">
        <div class="auto-advance-bar"></div>
      </div>
      <div id="selected-color-label"></div>
      <button id="give-up-button"></button>
      <button id="cancel-quiz"></button>
      <button id="next-question"></button>
    </div>
    <div id="result-screen" class="hidden">
      <div id="result-count"></div>
      <div id="result-rate"></div>
      <div id="result-comment"></div>
      <div id="result-list"></div>
      <button id="retry-same"></button>
      <button id="retry-incorrect"></button>
      <button id="choose-color"></button>
      <button id="view-stats-from-result"></button>
    </div>
    <div id="stats-screen" class="hidden">
      <button id="close-stats"></button>
      <button id="clear-history"></button>
      <button id="stats-filter-normal"></button>
      <button id="stats-filter-reverse"></button>
      <div id="total-quizzes"></div>
      <div id="total-questions"></div>
      <div id="total-correct"></div>
      <div id="overall-accuracy"></div>
      <div id="overall-hint-usage"></div>
      <div id="recent-activity"></div>
      <table>
        <tbody id="color-stats-tbody"></tbody>
      </table>
      <div id="color-detail-container"></div>
    </div>
    <div id="settings-screen" class="hidden">
      <button id="close-settings"></button>
    </div>
    <button id="menu-button"></button>
    <div id="menu-panel"></div>
    <button id="open-settings"></button>
    <div data-color-stats="青"></div>
    <div id="app-version"></div>
    <button id="question-mode-20" class="btn btn-toggle active"></button>
    <button id="question-mode-weak5" class="btn btn-toggle"></button>
    <select id="hint-type">
      <option value="shoku">初句</option>
      <option value="kami">上の句</option>
    </select>
    <select id="display-mode">
      <option value="kana">よみがな</option>
      <option value="kanji">漢字</option>
    </select>
    <button id="order-normal" class="active"></button>
    <button id="order-reverse"></button>
    <button class="color-button" data-color="青"></button>
    <input type="checkbox" id="measure-time-toggle" checked>
    <button id="view-stats"></button>
  `;
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

describe('app', () => {
  beforeEach(() => {
    vi.resetModules();
    setupAppDom();
    const storage = createMemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      writable: true,
    });
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    globalThis.alert = window.alert;
    globalThis.confirm = window.confirm;
    loadCsv.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows 20 and weak5 buttons', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const mode20 = document.getElementById('question-mode-20');
    const modeWeak5 = document.getElementById('question-mode-weak5');
    expect(mode20).toBeTruthy();
    expect(modeWeak5).toBeTruthy();
    expect(mode20.classList.contains('active')).toBe(true);
    expect(modeWeak5.classList.contains('active')).toBe(false);
  });

  it('starts quiz and auto-advances on correct answer', async () => {
    vi.useFakeTimers();
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // 4問すべてに正解して自動進行
    for (let i = 0; i < 4; i++) {
      const optionButtons = Array.from(document.querySelectorAll('.option-button'));
      const correctButton = optionButtons.find(btn => btn.dataset.correct === 'true');
      expect(correctButton).toBeTruthy();
      correctButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      vi.advanceTimersByTime(750);
      await flushPromises();
    }

    const resultScreen = document.getElementById('result-screen');
    expect(resultScreen.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('result-count').textContent).toMatch(/4/);
  });

  it('updates elapsed time during quiz', async () => {
    vi.useFakeTimers();
    const nowSpy = vi.spyOn(performance, 'now');
    let now = 0;
    nowSpy.mockImplementation(() => now);

    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();


    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const elapsed = document.getElementById('elapsed-time');
    expect(elapsed.textContent).toBe('0:00');

    now = 1000;
    vi.advanceTimersByTime(1000);
    expect(elapsed.textContent).toBe('0:01');

    nowSpy.mockRestore();
  });

  it('stops elapsed time when the last question is answered', async () => {
    vi.useFakeTimers();
    const nowSpy = vi.spyOn(performance, 'now');
    let now = 0;
    nowSpy.mockImplementation(() => now);

    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    now = 2000;
    vi.advanceTimersByTime(250);
    expect(document.getElementById('elapsed-time').textContent).toBe('0:02');

    // 最初の3問は自動進行させる
    for (let i = 0; i < 3; i++) {
      now += 1000;
      const optionButtons = Array.from(document.querySelectorAll('.option-button'));
      const correctButton = optionButtons.find(btn => btn.dataset.correct === 'true');
      correctButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      vi.advanceTimersByTime(750);
      await flushPromises();
    }

    // 最後の問題（4問目）に答える
    now = 5000;
    const optionButtons = Array.from(document.querySelectorAll('.option-button'));
    const correctButton = optionButtons.find(btn => btn.dataset.correct === 'true');
    correctButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('elapsed-time').textContent).toBe('0:05');

    // 経過時間が停止していることを確認
    now = 8000;
    vi.advanceTimersByTime(1000);
    expect(document.getElementById('elapsed-time').textContent).toBe('0:05');

    nowSpy.mockRestore();
  });

  it('does not measure time when measure toggle is off', async () => {
    vi.useFakeTimers();
    const nowSpy = vi.spyOn(performance, 'now');
    let now = 0;
    nowSpy.mockImplementation(() => now);

    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.getElementById('measure-time-toggle').checked = false;

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('elapsed-time').classList.contains('hidden')).toBe(true);

    now = 3000;
    vi.advanceTimersByTime(1000);
    expect(document.getElementById('elapsed-time').textContent).toBe('0:00');

    const optionButtons = Array.from(document.querySelectorAll('.option-button'));
    const correctButton = optionButtons.find(btn => btn.dataset.correct === 'true');
    correctButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const { quizState } = await import('../src/js/state.js');
    expect(quizState.answers[0].answerTimeMs).toBe(null);

    nowSpy.mockRestore();
  });

  it('handles wrong answer and next button', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // 4問すべてに答える（loadCsvモックが4つの歌を返すため）
    for (let i = 0; i < 4; i++) {
      const optionButtons = Array.from(document.querySelectorAll('.option-button'));
      const wrongButton = optionButtons.find(btn => btn.dataset.correct === 'false');
      wrongButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(document.getElementById('feedback').textContent).toMatch(/不正解/);
      const nextButton = document.getElementById('next-question');
      expect(nextButton.disabled).toBe(false);

      nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    }

    const resultScreen = document.getElementById('result-screen');
    expect(resultScreen.classList.contains('hidden')).toBe(false);
  });

  it('supports give up, toggles, and stats navigation', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();


    const displayMode = document.getElementById('display-mode');
    displayMode.value = 'kanji';
    displayMode.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('goshiki_display_mode')).toBe('kanji');

    document.getElementById('order-reverse').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('order-reverse').classList.contains('active')).toBe(true);
    document.getElementById('order-normal').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const toggle = document.getElementById('toggle-kimariji');
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    document.getElementById('give-up-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const nextButton = document.getElementById('next-question');
    nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    document.getElementById('view-stats-from-result').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    const statsScreen = document.getElementById('stats-screen');
    expect(statsScreen.classList.contains('hidden')).toBe(false);

    document.getElementById('clear-history').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('close-stats').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    await flushPromises();
    const startScreen = document.getElementById('start-screen');
    expect(startScreen.classList.contains('hidden')).toBe(false);
  });

  it('handles retrySame when no color is selected', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const startScreen = document.getElementById('start-screen');
    startScreen.classList.add('hidden');
    document.getElementById('retry-same').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    await flushPromises();
    expect(startScreen.classList.contains('hidden')).toBe(false);
  });

  it('handles give up guard branches and display mode fallback', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const displayMode = document.getElementById('display-mode');
    displayMode.value = '';
    displayMode.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('goshiki_display_mode')).toBe('kana');

    const giveUp = document.getElementById('give-up-button');
    giveUp.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    document.getElementById('order-reverse').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    giveUp.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('feedback').textContent).toMatch(/残念/);

    giveUp.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  it('returns to quiz screen when closing settings from quiz', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();


    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('quiz-screen').classList.contains('hidden')).toBe(false);

    document.getElementById('open-settings').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('settings-screen').classList.contains('hidden')).toBe(false);

    document.getElementById('close-settings').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('quiz-screen').classList.contains('hidden')).toBe(false);
  });

  it('refreshes stats summaries after clearing history on stats screen', async () => {
    const session = {
      sessionId: 's1',
      timestamp: 1700000000000,
      date: '2023-11-14',
      color: '青',
      questionCount: 10,
      correctCount: 8,
      wrongCount: 2,
      passCount: 0,
      accuracyRate: 80,
      hintType: 'shoku',
      displayMode: 'kana',
      orderMode: 'normal',
      durationMs: 120000,
      answers: [
        { kimariji: 'あ', isCorrect: true, usedKami: false, answerTimeMs: 1000 },
      ],
    };
    localStorage.setItem('goshiki_quiz_history', JSON.stringify([session]));

    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();
    await flushPromises();

    document.getElementById('view-stats').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    await flushPromises();

    expect(document.getElementById('stats-screen').classList.contains('hidden')).toBe(false);
    const statsLabel = document.querySelector('[data-color-stats="青"]');
    expect(statsLabel.textContent).toMatch(/正答率/);

    document.getElementById('clear-history').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    await flushPromises();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(statsLabel.textContent).toBe('青');
    expect(document.getElementById('stats-screen').classList.contains('hidden')).toBe(false);
  });

  it('returns to start screen when choosing color from results', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();


    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const optionButtons = Array.from(document.querySelectorAll('.option-button'));
    optionButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));

    document.getElementById('choose-color').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    await flushPromises();
    const startScreen = document.getElementById('start-screen');
    expect(startScreen.classList.contains('hidden')).toBe(false);
  });

  it('starts quiz in reverse mode and updates labels', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.getElementById('order-reverse').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const hintType = document.getElementById('hint-type');
    hintType.value = 'kami';
    hintType.dispatchEvent(new Event('change'));


    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.getElementById('main-display-label').textContent).toBe('下の句 (問題)');
    const toggle = document.getElementById('toggle-kimariji');
    expect(toggle.textContent).toMatch(/上の句表示/);
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(toggle.textContent).toMatch(/下の句表示/);
  });

  it('shows kami text when hint type is kami', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const hintType = document.getElementById('hint-type');
    hintType.value = 'kami';


    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('toggle-kimariji').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.getElementById('kimariji').textContent).toMatch(/かみ|上/);
  });

  it('ignores toggle when no question is available', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const kimariji = document.getElementById('kimariji');
    const before = kimariji.textContent;
    document.getElementById('toggle-kimariji').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(kimariji.textContent).toBe(before);
  });

  it('handles wrong answer in reverse mode', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.getElementById('order-reverse').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const optionButtons = Array.from(document.querySelectorAll('.option-button'));
    const wrongButton = optionButtons.find(btn => btn.dataset.correct === 'false');
    wrongButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.getElementById('feedback').textContent).toMatch(/不正解/);
  });

  it('handles display mode storage errors', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    localStorage.setItem = () => { throw new Error('fail'); };
    const displayMode = document.getElementById('display-mode');
    displayMode.value = 'kanji';
    displayMode.dispatchEvent(new Event('change'));
    expect(displayMode.value).toBe('kanji');
  });

  it('handles order mode storage errors', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    localStorage.setItem = () => { throw new Error('fail'); };
    document.getElementById('order-reverse').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('order-reverse').classList.contains('active')).toBe(true);
  });

  it('handles saved mode read errors', async () => {
    localStorage.getItem = () => { throw new Error('fail'); };
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    expect(document.getElementById('display-mode').value).toBe('kana');
    expect(document.getElementById('order-normal').classList.contains('active')).toBe(true);
  });

  it('applies saved order mode from localStorage', async () => {
    localStorage.setItem('goshiki_order_mode', 'reverse');
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const reverseButton = document.getElementById('order-reverse');
    expect(reverseButton.classList.contains('active')).toBe(true);
  });

  it('loads persisted top and settings values', async () => {
    localStorage.setItem('goshiki_question_count', 'weak5');
    localStorage.setItem('goshiki_measure_time', 'false');
    localStorage.setItem('goshiki_hint_type', 'kami');
    localStorage.setItem('goshiki_display_mode', 'kanji');

    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    expect(document.getElementById('question-mode-weak5').classList.contains('active')).toBe(true);
    expect(document.getElementById('measure-time-toggle').checked).toBe(false);

    document.getElementById('open-settings').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('hint-type').value).toBe('kami');
    expect(document.getElementById('display-mode').value).toBe('kanji');
  });

  it('saves settings immediately on change', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    // 苦手5種ボタンをクリックして保存されることを確認
    const modeWeak5 = document.getElementById('question-mode-weak5');
    modeWeak5.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(localStorage.getItem('goshiki_question_count')).toBe('weak5');

    const measureToggle = document.getElementById('measure-time-toggle');
    measureToggle.checked = false;
    measureToggle.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('goshiki_measure_time')).toBe('false');

    const hintType = document.getElementById('hint-type');
    hintType.value = 'kami';
    hintType.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('goshiki_hint_type')).toBe('kami');

    const displayMode = document.getElementById('display-mode');
    displayMode.value = 'kanji';
    displayMode.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('goshiki_display_mode')).toBe('kanji');
  });

  it('shows stats screen from start', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.getElementById('view-stats').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    const statsScreen = document.getElementById('stats-screen');
    expect(statsScreen.classList.contains('hidden')).toBe(false);
  });

  it('retries quiz when color is already selected', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();


    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('retry-same').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const quizScreen = document.getElementById('quiz-screen');
    expect(quizScreen.classList.contains('hidden')).toBe(false);
  });

  it('updates question limit when weak5 is selected', async () => {
    const { quizState } = await import('../src/js/state.js');
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    // デフォルトは20問モード
    expect(quizState.questionLimit).toBe(20);

    // 苦手5種ボタンをクリック
    const modeWeak5 = document.getElementById('question-mode-weak5');
    modeWeak5.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(quizState.questionLimit).toBe(5);
    expect(modeWeak5.classList.contains('active')).toBe(true);
  });

  it('cancels quiz and returns to start screen', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    document.getElementById('cancel-quiz').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    await flushPromises();
    const startScreen = document.getElementById('start-screen');
    expect(startScreen.classList.contains('hidden')).toBe(false);
  });

  it('shows kami text on give up in reverse mode', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.getElementById('order-reverse').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const displayMode = document.getElementById('display-mode');
    displayMode.value = 'kanji';


    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('give-up-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.getElementById('feedback').textContent).toMatch(/上/);
  });

  it('handles startQuiz error when color data is missing', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const { quizState } = await import('../src/js/state.js');
    quizState.allPoems = [
      {
        color: 'ピンク',
        kimarijiShort: 'あ',
        kimarijiLong: '',
        shimoNoKu: '下',
        shimoReading: 'しも',
        kamiNoKu: '上',
        kamiReading: 'かみ',
        hint: 'ひ',
      },
    ];
    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(window.alert).toHaveBeenCalled();
  });

  it('shows retry-incorrect button when there are incorrect answers', async () => {
    vi.useFakeTimers();
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // 1問目は不正解、残りは正解
    for (let i = 0; i < 4; i++) {
      const optionButtons = Array.from(document.querySelectorAll('.option-button'));
      if (i === 0) {
        const wrongButton = optionButtons.find(btn => btn.dataset.correct === 'false');
        wrongButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const nextButton = document.getElementById('next-question');
        nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      } else {
        const correctButton = optionButtons.find(btn => btn.dataset.correct === 'true');
        correctButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        vi.advanceTimersByTime(750);
      }
      await flushPromises();
    }

    const retryIncorrectButton = document.getElementById('retry-incorrect');
    expect(retryIncorrectButton.classList.contains('hidden')).toBe(false);
  });

  it('hides retry-incorrect button when all answers are correct', async () => {
    vi.useFakeTimers();
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // すべて正解
    for (let i = 0; i < 4; i++) {
      const optionButtons = Array.from(document.querySelectorAll('.option-button'));
      const correctButton = optionButtons.find(btn => btn.dataset.correct === 'true');
      correctButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      vi.advanceTimersByTime(750);
      await flushPromises();
    }

    const retryIncorrectButton = document.getElementById('retry-incorrect');
    expect(retryIncorrectButton.classList.contains('hidden')).toBe(true);
  });

  it('starts quiz with incorrect poems when retry-incorrect is clicked', async () => {
    vi.useFakeTimers();
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // 1問目は不正解、残りは正解
    for (let i = 0; i < 4; i++) {
      const optionButtons = Array.from(document.querySelectorAll('.option-button'));
      if (i === 0) {
        const wrongButton = optionButtons.find(btn => btn.dataset.correct === 'false');
        wrongButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const nextButton = document.getElementById('next-question');
        nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      } else {
        const correctButton = optionButtons.find(btn => btn.dataset.correct === 'true');
        correctButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        vi.advanceTimersByTime(750);
      }
      await flushPromises();
    }

    const retryIncorrectButton = document.getElementById('retry-incorrect');
    retryIncorrectButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    const quizScreen = document.getElementById('quiz-screen');
    expect(quizScreen.classList.contains('hidden')).toBe(false);

    const { quizState } = await import('../src/js/state.js');
    expect(quizState.currentQuestions.length).toBe(1);
  });
});
