import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { quizState } from '../src/js/state.js';

const loadCsv = vi.fn();
vi.mock('../src/js/data.js', () => ({
  loadCsv,
}));

const loadQuizHistory = vi.fn(async () => []);
const saveQuizSession = vi.fn(async () => true);
const clearAllHistory = vi.fn(async () => true);
const checkLocalStorageAvailable = vi.fn(() => true);
const setAuthModule = vi.fn();
const refreshQuizHistory = vi.fn(async () => []);
const getCachedQuizHistory = vi.fn(() => []);
vi.mock('../src/js/storage.js', () => ({
  loadQuizHistory,
  saveQuizSession,
  clearAllHistory,
  checkLocalStorageAvailable,
  setAuthModule,
  refreshQuizHistory,
  getCachedQuizHistory,
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
vi.mock('../src/js/questions.js', () => ({
  buildQuestions,
  buildWeakQuestions,
  canUseWeak5,
}));

vi.mock('../src/js/stats.js', async () => {
  const actual = await vi.importActual('../src/js/stats.js');
  return {
    ...actual,
    calculateKimarijiPerformance: vi.fn(() => []),
  };
});

vi.mock('../src/js/auth.js', () => ({
  initAuthUI: vi.fn(),
  getCurrentUserId: vi.fn(() => null),
}));

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

    await import('../src/js/app.js');
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

    await import('../src/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    const viewStats = document.getElementById('view-stats');
    const viewStatsFromResult = document.getElementById('view-stats-from-result');
    expect(viewStats.style.display).toBe('none');
    expect(viewStatsFromResult.style.display).toBe('none');
  });

  it('disables color buttons when weak5 mode and no quiz history', async () => {
    setupBaseDom();
    document.body.insertAdjacentHTML('beforeend', `
      <button id="question-mode-20" class="btn btn-toggle active"></button>
      <button id="question-mode-weak5" class="btn btn-toggle"></button>
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
    getCachedQuizHistory.mockReturnValue([]);

    await import('../src/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    // 苦手5種モードに切り替え
    const modeWeak5 = document.getElementById('question-mode-weak5');
    modeWeak5.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    // 色ボタンがdisabledになることを確認
    const colorButton = document.querySelector('.color-button');
    expect(colorButton.disabled).toBe(true);
    expect(canUseWeak5).toHaveBeenCalled();
  });

  it('alerts when poems are not loaded', async () => {
    setupBaseDom();
    document.body.insertAdjacentHTML('beforeend', `
      <button class="color-button" data-color="青"></button>
    `);
    loadCsv.mockResolvedValueOnce([]);

    await import('../src/js/app.js');
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

    await import('../src/js/app.js');
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
      <button id="question-mode-20" class="btn btn-toggle active"></button>
      <button id="question-mode-weak5" class="btn btn-toggle"></button>
      <button class="color-button" data-color="青"></button>
      <input type="checkbox" id="measure-time-toggle" checked>
      <select id="hint-type"><option value="shoku">初句</option></select>
      <select id="display-mode"><option value="kana">よみがな</option></select>
      <button id="order-normal" class="active"></button>
      <button id="order-reverse"></button>
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
    canUseWeak5.mockReturnValue(true);
    getCachedQuizHistory.mockReturnValue([{ color: '青', answers: [] }]);

    await import('../src/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    // 苦手5種モードに切り替え
    const modeWeak5 = document.getElementById('question-mode-weak5');
    modeWeak5.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    document.querySelector('.color-button')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    expect(buildWeakQuestions).toHaveBeenCalled();
  });

  it('shows results when no questions are generated', async () => {
    setupBaseDom();
    document.body.insertAdjacentHTML('beforeend', `
      <button id="question-mode-20" class="btn btn-toggle active"></button>
      <button id="question-mode-weak5" class="btn btn-toggle"></button>
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

    await import('../src/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    document.querySelector('.color-button')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    const resultScreen = document.getElementById('result-screen');
    expect(resultScreen.classList.contains('hidden')).toBe(false);
  });

  it('opens menu, navigates to settings, and closes menu interactions', async () => {
    setupBaseDom();
    document.body.insertAdjacentHTML('beforeend', `
      <button id="menu-button"></button>
      <div id="menu-panel" class="hidden"></div>
      <button id="open-settings"></button>
      <div id="settings-screen" class="hidden"></div>
      <button id="close-settings"></button>
    `);
    loadCsv.mockResolvedValueOnce([]);

    await import('../src/js/app.js');
    domReadyHandlers.forEach(handler => handler(new Event('DOMContentLoaded')));
    await flushPromises();

    const menuButton = document.getElementById('menu-button');
    const menuPanel = document.getElementById('menu-panel');
    const settingsScreen = document.getElementById('settings-screen');

    menuButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menuPanel.classList.contains('hidden')).toBe(false);

    document.getElementById('open-settings')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(settingsScreen.classList.contains('hidden')).toBe(false);
    expect(menuPanel.classList.contains('hidden')).toBe(true);

    document.getElementById('close-settings')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    await flushPromises();
    await flushPromises();
    const startScreen = document.getElementById('start-screen');
    expect(startScreen.classList.contains('hidden')).toBe(false);

    menuButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menuPanel.classList.contains('hidden')).toBe(true);

    menuButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menuPanel.classList.contains('hidden')).toBe(true);
  });
});
