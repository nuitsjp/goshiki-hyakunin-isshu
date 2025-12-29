import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { loadCsv } from '../docs/js/data.js';

vi.mock('../docs/js/data.js', () => ({
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
    <div data-color-stats="青"></div>
    <div id="app-version"></div>
    <select id="question-count"></select>
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

  it('starts quiz and auto-advances on correct answer', async () => {
    vi.useFakeTimers();
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const questionCount = document.getElementById('question-count');
    questionCount.value = '1';
    questionCount.dispatchEvent(new Event('change'));

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const optionButtons = Array.from(document.querySelectorAll('.option-button'));
    const correctButton = optionButtons.find(btn => btn.dataset.correct === 'true');
    expect(correctButton).toBeTruthy();
    correctButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    vi.runAllTimers();
    const resultScreen = document.getElementById('result-screen');
    expect(resultScreen.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('result-count').textContent).toMatch(/1/);
  });

  it('handles wrong answer and next button', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const questionCount = document.getElementById('question-count');
    questionCount.value = '1';
    questionCount.dispatchEvent(new Event('change'));

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const optionButtons = Array.from(document.querySelectorAll('.option-button'));
    const wrongButton = optionButtons.find(btn => btn.dataset.correct === 'false');
    wrongButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.getElementById('feedback').textContent).toMatch(/不正解/);
    const nextButton = document.getElementById('next-question');
    expect(nextButton.disabled).toBe(false);
    nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const resultScreen = document.getElementById('result-screen');
    expect(resultScreen.classList.contains('hidden')).toBe(false);
  });

  it('supports give up, toggles, and stats navigation', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const questionCount = document.getElementById('question-count');
    questionCount.value = '200';
    questionCount.dispatchEvent(new Event('change'));
    expect(questionCount.value).toBe('20');

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
    const statsScreen = document.getElementById('stats-screen');
    expect(statsScreen.classList.contains('hidden')).toBe(false);

    document.getElementById('clear-history').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('close-stats').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const startScreen = document.getElementById('start-screen');
    expect(startScreen.classList.contains('hidden')).toBe(false);
  });

  it('handles retrySame when no color is selected', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const startScreen = document.getElementById('start-screen');
    startScreen.classList.add('hidden');
    document.getElementById('retry-same').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(startScreen.classList.contains('hidden')).toBe(false);
  });

  it('handles give up guard branches and display mode fallback', async () => {
    await import('../docs/js/app.js');
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

  it('returns to start screen when choosing color from results', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const questionCount = document.getElementById('question-count');
    questionCount.value = '1';
    questionCount.dispatchEvent(new Event('change'));

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const optionButtons = Array.from(document.querySelectorAll('.option-button'));
    optionButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));

    document.getElementById('choose-color').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const startScreen = document.getElementById('start-screen');
    expect(startScreen.classList.contains('hidden')).toBe(false);
  });

  it('starts quiz in reverse mode and updates labels', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.getElementById('order-reverse').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const hintType = document.getElementById('hint-type');
    hintType.value = 'kami';
    hintType.dispatchEvent(new Event('change'));

    const questionCount = document.getElementById('question-count');
    questionCount.value = '1';
    questionCount.dispatchEvent(new Event('change'));

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.getElementById('main-display-label').textContent).toBe('下の句 (問題)');
    const toggle = document.getElementById('toggle-kimariji');
    expect(toggle.textContent).toMatch(/上の句表示/);
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(toggle.textContent).toMatch(/下の句表示/);
  });

  it('shows kami text when hint type is kami', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const hintType = document.getElementById('hint-type');
    hintType.value = 'kami';

    const questionCount = document.getElementById('question-count');
    questionCount.value = '1';
    questionCount.dispatchEvent(new Event('change'));

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('toggle-kimariji').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.getElementById('kimariji').textContent).toMatch(/かみ|上/);
  });

  it('ignores toggle when no question is available', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const kimariji = document.getElementById('kimariji');
    const before = kimariji.textContent;
    document.getElementById('toggle-kimariji').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(kimariji.textContent).toBe(before);
  });

  it('handles wrong answer in reverse mode', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.getElementById('order-reverse').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const questionCount = document.getElementById('question-count');
    questionCount.value = '1';
    questionCount.dispatchEvent(new Event('change'));

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const optionButtons = Array.from(document.querySelectorAll('.option-button'));
    const wrongButton = optionButtons.find(btn => btn.dataset.correct === 'false');
    wrongButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.getElementById('feedback').textContent).toMatch(/不正解/);
  });

  it('handles display mode storage errors', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    localStorage.setItem = () => { throw new Error('fail'); };
    const displayMode = document.getElementById('display-mode');
    displayMode.value = 'kanji';
    displayMode.dispatchEvent(new Event('change'));
    expect(displayMode.value).toBe('kanji');
  });

  it('handles order mode storage errors', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    localStorage.setItem = () => { throw new Error('fail'); };
    document.getElementById('order-reverse').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('order-reverse').classList.contains('active')).toBe(true);
  });

  it('handles saved mode read errors', async () => {
    localStorage.getItem = () => { throw new Error('fail'); };
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    expect(document.getElementById('display-mode').value).toBe('kana');
    expect(document.getElementById('order-normal').classList.contains('active')).toBe(true);
  });

  it('applies saved order mode from localStorage', async () => {
    localStorage.setItem('goshiki_order_mode', 'reverse');
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const reverseButton = document.getElementById('order-reverse');
    expect(reverseButton.classList.contains('active')).toBe(true);
  });

  it('shows stats screen from start', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.getElementById('view-stats').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const statsScreen = document.getElementById('stats-screen');
    expect(statsScreen.classList.contains('hidden')).toBe(false);
  });

  it('retries quiz when color is already selected', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const questionCount = document.getElementById('question-count');
    questionCount.value = '1';
    questionCount.dispatchEvent(new Event('change'));

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('retry-same').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const quizScreen = document.getElementById('quiz-screen');
    expect(quizScreen.classList.contains('hidden')).toBe(false);
  });

  it('updates question limit when weak5 is selected', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const questionCount = document.getElementById('question-count');
    questionCount.value = 'weak5';
    questionCount.dispatchEvent(new Event('change'));
    expect(questionCount.value).toBe('weak5');
  });

  it('cancels quiz and returns to start screen', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const questionCount = document.getElementById('question-count');
    questionCount.value = '1';
    questionCount.dispatchEvent(new Event('change'));
    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    document.getElementById('cancel-quiz').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const startScreen = document.getElementById('start-screen');
    expect(startScreen.classList.contains('hidden')).toBe(false);
  });

  it('shows kami text on give up in reverse mode', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    document.getElementById('order-reverse').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const displayMode = document.getElementById('display-mode');
    displayMode.value = 'kanji';

    const questionCount = document.getElementById('question-count');
    questionCount.value = '1';
    questionCount.dispatchEvent(new Event('change'));

    document.querySelector('.color-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('give-up-button').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.getElementById('feedback').textContent).toMatch(/上/);
  });

  it('handles startQuiz error when color data is missing', async () => {
    await import('../docs/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    const { quizState } = await import('../docs/js/state.js');
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
});
