import { beforeEach, describe, expect, it, vi } from 'vitest';

let authStateHandler = null;
const initAuthUI = vi.fn(({ onAuthStateChanged }) => {
  authStateHandler = onAuthStateChanged;
});

const renderColorSummaries = vi.fn();
const renderStatsScreen = vi.fn();
const clearHistoryCache = vi.fn();
const clearDetailedView = vi.fn();

const refreshQuizHistory = vi.fn(async () => []);
const loadQuizHistory = vi.fn(async () => []);
const saveQuizSession = vi.fn(async () => true);
const getCachedQuizHistory = vi.fn(() => []);
const clearAllHistory = vi.fn(async () => true);
const checkLocalStorageAvailable = vi.fn(() => true);
const setAuthModule = vi.fn();

vi.mock('../src/js/auth.js', () => ({
  initAuthUI,
  getCurrentUserId: vi.fn(() => null),
}));

vi.mock('../src/js/stats-ui.js', () => ({
  createStatsUI: vi.fn(({ showScreen }) => {
    renderStatsScreen.mockImplementation(() => showScreen('stats'));
    return {
      renderColorSummaries,
      renderStatsScreen,
      clearHistoryCache,
      clearDetailedView,
    };
  }),
}));

vi.mock('../src/js/storage.js', () => ({
  saveQuizSession,
  loadQuizHistory,
  refreshQuizHistory,
  getCachedQuizHistory,
  clearAllHistory,
  checkLocalStorageAvailable,
  setAuthModule,
}));

vi.mock('../src/js/data.js', () => ({
  loadCsv: vi.fn(() => Promise.resolve([])),
}));

const setupDom = () => {
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
        <button class="option-button"></button>
        <button class="option-button"></button>
        <button class="option-button"></button>
        <button class="option-button"></button>
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
    <div id="settings-screen" class="hidden">
      <button id="close-settings"></button>
      <select id="hint-type">
        <option value="shoku">初句</option>
        <option value="kami">上の句</option>
      </select>
      <select id="display-mode">
        <option value="kana">よみがな</option>
        <option value="kanji">漢字</option>
      </select>
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
    <button id="question-mode-20" class="btn btn-toggle active"></button>
    <button id="question-mode-weak5" class="btn btn-toggle"></button>
    <button id="order-normal" class="active"></button>
    <button id="order-reverse"></button>
    <button class="color-button" data-color="青"></button>
    <input type="checkbox" id="measure-time-toggle" checked>
    <button id="view-stats"></button>
    <button id="menu-button"></button>
    <div id="menu-panel"></div>
    <button id="open-settings"></button>
    <img id="auth-avatar" />
    <span id="auth-avatar-fallback"></span>
    <button id="auth-login"></button>
    <button id="auth-logout"></button>
    <div id="auth-message"></div>
  `;
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
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

describe('app auth refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authStateHandler = null;
    setupDom();
    const storage = createMemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      writable: true,
    });
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    globalThis.alert = window.alert;
    globalThis.confirm = window.confirm;
  });

  it('refreshes summaries when auth state becomes ready', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    expect(refreshQuizHistory).toHaveBeenCalledTimes(1);
    expect(renderColorSummaries).toHaveBeenCalledTimes(1);
    expect(typeof authStateHandler).toBe('function');

    await authStateHandler({ user: { uid: 'u1' }, isSignedIn: true });
    await flushPromises();

    expect(refreshQuizHistory).toHaveBeenCalledTimes(2);
    expect(renderColorSummaries).toHaveBeenCalledTimes(2);
  });

  it('re-renders stats when auth state changes on stats screen', async () => {
    await import('../src/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    renderStatsScreen();

    expect(document.getElementById('stats-screen').classList.contains('hidden')).toBe(false);
    expect(renderStatsScreen).toHaveBeenCalledTimes(1);

    await authStateHandler({ user: { uid: 'u1' }, isSignedIn: true });
    await flushPromises();

    expect(renderStatsScreen).toHaveBeenCalledTimes(2);
  });
});
