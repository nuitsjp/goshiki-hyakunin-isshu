import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { quizState } from '../docs/js/state.js';

const loadCsv = vi.fn();
vi.mock('../docs/js/data.js', () => ({
  loadCsv,
}));

const loadQuizHistory = vi.fn(() => []);
const saveQuizSession = vi.fn(() => true);
const clearAllHistory = vi.fn(() => true);
const checkLocalStorageAvailable = vi.fn(() => true);
vi.mock('../docs/js/storage.js', () => ({
  loadQuizHistory,
  saveQuizSession,
  clearAllHistory,
  checkLocalStorageAvailable,
}));

const buildQuestions = vi.fn(() => ([
  {
    kimariji: 'あ',
    correctShimo: '下1',
    correctShimoReading: 'しも1',
    kamiNoKu: '上1',
    kamiReading: 'かみ1',
    hint: 'ひ1',
    options: [
      { text: '下1', textReading: 'しも1', isCorrect: true },
      { text: '下2', textReading: 'しも2', isCorrect: false },
      { text: '下3', textReading: 'しも3', isCorrect: false },
      { text: '下4', textReading: 'しも4', isCorrect: false },
    ],
  },
]));
const buildWeakQuestions = vi.fn(() => buildQuestions());
const canUseWeak5 = vi.fn(() => false);
vi.mock('../docs/js/questions.js', () => ({
  buildQuestions,
  buildWeakQuestions,
  canUseWeak5,
}));

vi.mock('../docs/js/stats.js', async () => {
  const actual = await vi.importActual('../docs/js/stats.js');
  return {
    ...actual,
    calculateKimarijiPerformance: vi.fn(() => []),
  };
});

const setupBaseDom = () => {
  document.body.innerHTML = `
    <div id="start-screen"></div>
    <div id="quiz-screen" class="hidden">
      <div id="progress-text"></div>
      <div id="progress-bar"></div>
      <div id="main-display-label"></div>
      <div id="kimariji"></div>
      <div class="text-muted"></div>
      <div id="options-container">
        <button class="option-button btn btn-outline-secondary"></button>
        <button class="option-button btn btn-outline-secondary"></button>
        <button class="option-button btn btn-outline-secondary"></button>
        <button class="option-button btn btn-outline-secondary"></button>
      </div>
      <div id="feedback"></div>
      <div id="selected-color-label"></div>
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
      <div id="recent-activity"></div>
      <table>
        <tbody id="color-stats-tbody"></tbody>
      </table>
      <div id="color-detail-container"></div>
      <button id="stats-filter-normal"></button>
      <button id="stats-filter-reverse"></button>
    </div>
    <div data-color-stats="青"></div>
  `;
};

const setupLocalStorage = () => {
  const store = new Map();
  Object.defineProperty(window, 'localStorage', {
    value: {
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
    },
    writable: true,
  });
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

let domReadyHandlers = [];
let addEventListenerSpy = null;

describe('app branches', () => {
  beforeEach(() => {
    vi.resetModules();
    setupLocalStorage();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    globalThis.alert = window.alert;
    globalThis.confirm = window.confirm;
    domReadyHandlers = [];
    addEventListenerSpy = vi.spyOn(document, 'addEventListener').mockImplementation(
      (type, handler, options) => {
        if (type === 'DOMContentLoaded') {
          domReadyHandlers.push(handler);
          return;
        }
        return EventTarget.prototype.addEventListener.call(document, type, handler, options);
      }
    );
    loadCsv.mockReset();
    checkLocalStorageAvailable.mockReset().mockReturnValue(true);
    buildQuestions.mockClear();
    buildWeakQuestions.mockClear();
    canUseWeak5.mockClear();
  });

  afterEach(() => {
    if (addEventListenerSpy) {
      addEventListenerSpy.mockRestore();
      addEventListenerSpy = null;
    }
  });

  it('runs with missing optional elements', async () => {
    setupBaseDom();
    loadCsv.mockResolvedValueOnce([]);

    await import('../docs/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    expect(loadCsv).toHaveBeenCalled();
  });

  it('hides stats buttons when localStorage is unavailable and handles CSV failure', async () => {
    setupBaseDom();
    document.body.insertAdjacentHTML('beforeend', `
      <button id="view-stats"></button>
      <button id="view-stats-from-result"></button>
    `);
    checkLocalStorageAvailable.mockReturnValue(false);
    loadCsv.mockRejectedValueOnce(new Error('csv failed'));

    await import('../docs/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    const viewStats = document.getElementById('view-stats');
    const viewStatsFromResult = document.getElementById('view-stats-from-result');
    expect(viewStats.style.display).toBe('none');
    expect(viewStatsFromResult.style.display).toBe('none');
  });

  it('resets weak5 selection when unavailable', async () => {
    setupBaseDom();
    document.body.insertAdjacentHTML('beforeend', `
      <select id="question-count"></select>
      <button class="color-button" data-color="青"></button>
    `);
    loadCsv.mockResolvedValueOnce([
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
    ]);

    await import('../docs/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    const questionCount = document.getElementById('question-count');
    questionCount.value = 'weak5';
    document.querySelector('.color-button')
      .dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(questionCount.value).toBe('20');
    expect(quizState.questionLimit).toBe(20);
    expect(canUseWeak5).toHaveBeenCalled();
  });

  it('alerts when poems are not loaded', async () => {
    setupBaseDom();
    document.body.insertAdjacentHTML('beforeend', `
      <button class="color-button" data-color="青"></button>
    `);
    loadCsv.mockResolvedValueOnce([]);

    await import('../docs/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    document.querySelector('.color-button')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(window.alert).toHaveBeenCalledWith(
      'データがまだ読み込まれていません。少し待ってから再試行してください。'
    );
  });

  it('updates stats filter buttons on click', async () => {
    setupBaseDom();
    loadCsv.mockResolvedValueOnce([]);

    await import('../docs/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    const normal = document.getElementById('stats-filter-normal');
    const reverse = document.getElementById('stats-filter-reverse');
    reverse.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(reverse.classList.contains('active')).toBe(true);
    normal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(normal.classList.contains('active')).toBe(true);
  });

  it('starts weak5 quiz when selected', async () => {
    setupBaseDom();
    document.body.insertAdjacentHTML('beforeend', `
      <select id="question-count"></select>
      <button class="color-button" data-color="青"></button>
    `);
    loadCsv.mockResolvedValueOnce([
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
    ]);

    await import('../docs/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    const questionCount = document.getElementById('question-count');
    questionCount.value = 'weak5';

    document.querySelector('.color-button')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(buildWeakQuestions).toHaveBeenCalled();
  });

  it('shows results when no questions are generated', async () => {
    setupBaseDom();
    document.body.insertAdjacentHTML('beforeend', `
      <select id="question-count"></select>
      <button class="color-button" data-color="青"></button>
    `);
    buildQuestions.mockReturnValueOnce([]);
    loadCsv.mockResolvedValueOnce([
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
    ]);

    await import('../docs/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    document.querySelector('.color-button')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const resultScreen = document.getElementById('result-screen');
    expect(resultScreen.classList.contains('hidden')).toBe(false);
  });
});
