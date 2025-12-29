import { describe, expect, it, vi } from 'vitest';
import { createStatsUI } from '../docs/js/stats-ui.js';

const buildElements = () => ({
  totalQuizzes: document.getElementById('total-quizzes'),
  totalQuestions: document.getElementById('total-questions'),
  totalCorrect: document.getElementById('total-correct'),
  overallAccuracy: document.getElementById('overall-accuracy'),
  overallHintUsage: document.getElementById('overall-hint-usage'),
  colorStatsBody: document.getElementById('color-stats-tbody'),
  recentActivity: document.getElementById('recent-activity'),
  statsFilterNormal: document.getElementById('stats-filter-normal'),
  statsFilterReverse: document.getElementById('stats-filter-reverse'),
});

const setupDom = () => {
  document.body.innerHTML = `
    <div data-color-stats="青"></div>
    <div data-color-stats="ピンク"></div>
    <div data-color-stats="黄"></div>
    <div data-color-stats="緑"></div>
    <div data-color-stats="オレンジ"></div>
    <div id="color-detail-container"></div>
    <div id="recent-activity"></div>
    <div id="total-quizzes"></div>
    <div id="total-questions"></div>
    <div id="total-correct"></div>
    <div id="overall-accuracy"></div>
    <div id="overall-hint-usage"></div>
    <button id="stats-filter-normal"></button>
    <button id="stats-filter-reverse"></button>
    <table>
      <tbody id="color-stats-tbody"></tbody>
    </table>
  `;
  const container = document.getElementById('color-detail-container');
  container.scrollIntoView = vi.fn();
};

describe('stats-ui', () => {
  it('renders empty summaries and recent activity when no history', async () => {
    setupDom();
    const quizState = { allPoems: [], orderMode: 'normal' };
    const statsState = { selectedColor: null, filterMode: 'normal' };
    const showScreen = vi.fn();
    const ui = createStatsUI({
      elements: buildElements(),
      statsState,
      quizState,
      showScreen,
      loadHistory: async () => [],
    });

    await ui.renderColorSummaries();
    const summary = document.querySelector('[data-color-stats="青"]');
    expect(summary.textContent).toBe('青');

    await ui.renderStatsScreen();
    const recent = document.getElementById('recent-activity');
    expect(recent.innerHTML).toMatch(/まだプレイ履歴がありません/);
  });

  it('shows stats screen before history resolves', async () => {
    setupDom();
    const deferred = {};
    const historyPromise = new Promise(resolve => {
      deferred.resolve = resolve;
    });
    const quizState = { allPoems: [], orderMode: 'normal' };
    const statsState = { selectedColor: null, filterMode: 'normal' };
    const showScreen = vi.fn();
    const loadHistory = vi.fn(() => historyPromise);
    const ui = createStatsUI({
      elements: buildElements(),
      statsState,
      quizState,
      showScreen,
      loadHistory,
    });

    const renderPromise = ui.renderStatsScreen();
    expect(showScreen).toHaveBeenCalledWith('stats');
    deferred.resolve([]);
    await renderPromise;
  });

  it('renders summaries and stats screen', async () => {
    setupDom();
    const history = [
      {
        sessionId: 's1',
        color: '青',
        questionCount: 10,
        correctCount: 8,
        wrongCount: 1,
        passCount: 1,
        accuracyRate: 80,
        hintType: 'shoku',
        displayMode: 'kana',
        orderMode: 'normal',
        timestamp: 1700000000000,
        date: '2024-01-01',
        answers: [
          { kimariji: 'あ', isCorrect: true, usedKami: true },
          { kimariji: 'う', isCorrect: true, usedKami: false },
          { kimariji: 'い', isCorrect: false, usedKami: false },
        ],
      },
    ];
    const quizState = {
      allPoems: [
        { color: '青', kimarijiShort: 'あ', kimarijiLong: '', shimoNoKu: '下', shimoReading: 'しも', kamiNoKu: '上', kamiReading: 'かみ' },
        { color: '青', kimarijiShort: 'い', kimarijiLong: '', shimoNoKu: '下', shimoReading: 'しも', kamiNoKu: '上', kamiReading: 'かみ' },
      ],
      orderMode: 'normal',
    };
    const statsState = { selectedColor: null, filterMode: 'normal' };
    const showScreen = vi.fn();
    const ui = createStatsUI({
      elements: buildElements(),
      statsState,
      quizState,
      showScreen,
      loadHistory: async () => history,
    });

    await ui.renderColorSummaries();
    const summary = document.querySelector('[data-color-stats="青"]');
    expect(summary.innerHTML).toMatch(/正答率/);

    await ui.renderStatsScreen();
    expect(showScreen).toHaveBeenCalledWith('stats');
    const rows = document.querySelectorAll('#color-stats-tbody tr');
    expect(rows.length).toBe(5);

    const firstRow = document.querySelector('#color-stats-tbody tr[data-color="青"]');
    firstRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    firstRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const detail = document.getElementById('color-detail-container');
    expect(detail.innerHTML).toBe('');
  });

  it('renders detailed stats and session details', async () => {
    setupDom();
    const history = [
      {
        sessionId: 's2',
        color: '青',
        questionCount: 5,
        correctCount: 4,
        wrongCount: 1,
        passCount: 0,
        accuracyRate: 80,
        hintType: 'shoku',
        displayMode: 'kana',
        orderMode: 'normal',
        timestamp: 1700000000000,
        date: '2024-01-02',
        answers: [
          { kimariji: 'あ', isCorrect: true, usedKami: true },
          { kimariji: 'い', isCorrect: false, usedKami: false },
        ],
      },
    ];
    const quizState = {
      allPoems: [
        { color: '青', kimarijiShort: 'あ', kimarijiLong: '', shimoNoKu: '下', shimoReading: 'しも', kamiNoKu: '上', kamiReading: 'かみ' },
        { color: '青', kimarijiShort: 'い', kimarijiLong: '', shimoNoKu: '下', shimoReading: 'しも', kamiNoKu: '上', kamiReading: 'かみ' },
      ],
      orderMode: 'normal',
    };
    const statsState = { selectedColor: null, filterMode: 'normal' };
    const showScreen = vi.fn();
    const ui = createStatsUI({
      elements: buildElements(),
      statsState,
      quizState,
      showScreen,
      loadHistory: async () => history,
    });

    await ui.renderStatsScreen();
    const row = document.querySelector('#color-stats-tbody tr[data-color="青"]');
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(statsState.selectedColor).toBe('青');
    const detail = document.getElementById('color-detail-container');
    expect(detail.innerHTML).toMatch(/詳細統計/);

    const sessionItem = detail.querySelector('.session-item');
    sessionItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sessionItem.classList.contains('expanded')).toBe(true);
    expect(detail.querySelector('.session-answers')).toBeTruthy();
    sessionItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sessionItem.classList.contains('expanded')).toBe(false);

    const closeButton = detail.querySelector('#close-detail-panel');
    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(statsState.selectedColor).toBe(null);
    expect(detail.innerHTML).toBe('');
  });

  it('reuses cached history across stats views', async () => {
    setupDom();
    const history = [
      {
        sessionId: 's1',
        color: '青',
        questionCount: 1,
        correctCount: 1,
        wrongCount: 0,
        passCount: 0,
        accuracyRate: 100,
        hintType: 'shoku',
        displayMode: 'kana',
        orderMode: 'normal',
        timestamp: 1,
        date: '2024-01-01',
        answers: [],
      },
    ];
    const quizState = {
      allPoems: [
        { color: '青', kimarijiShort: 'あ', kimarijiLong: '', shimoNoKu: '下', shimoReading: 'しも', kamiNoKu: '上', kamiReading: 'かみ' },
      ],
      orderMode: 'normal',
    };
    const statsState = { selectedColor: null, filterMode: 'normal' };
    const showScreen = vi.fn();
    const loadHistory = vi.fn(async () => history);
    const ui = createStatsUI({
      elements: buildElements(),
      statsState,
      quizState,
      showScreen,
      loadHistory,
    });

    await ui.renderStatsScreen();
    await ui.renderDetailedColorStats('青');
    expect(loadHistory).toHaveBeenCalledTimes(1);
  });

  it('renders kanji and reverse labels and ignores rows without color', async () => {
    setupDom();
    const history = [
      {
        sessionId: 's3',
        color: '青',
        questionCount: 3,
        correctCount: 2,
        wrongCount: 1,
        passCount: 0,
        accuracyRate: 67,
        hintType: 'kami',
        displayMode: 'kanji',
        orderMode: 'reverse',
        timestamp: 1700000000000,
        date: '2024-02-01',
        answers: [],
      },
    ];
    const quizState = {
      allPoems: [
        { color: '青', kimarijiShort: 'あ', kimarijiLong: '', shimoNoKu: '下', shimoReading: 'しも', kamiNoKu: '上', kamiReading: 'かみ' },
      ],
      orderMode: 'reverse',
    };
    const statsState = { selectedColor: null, filterMode: 'reverse' };
    const showScreen = vi.fn();
    const ui = createStatsUI({
      elements: buildElements(),
      statsState,
      quizState,
      showScreen,
      loadHistory: async () => history,
    });

    await ui.renderDetailedColorStats('青');
    const detail = document.getElementById('color-detail-container');
    expect(detail.innerHTML).toMatch(/漢字/);
    expect(detail.innerHTML).toMatch(/下の句→上の句/);

    await ui.renderStatsScreen();
    const row = document.querySelector('#color-stats-tbody tr');
    row.removeAttribute('data-color');
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(statsState.selectedColor).toBe(null);
  });

  it('renders detail messages when no data exists', async () => {
    setupDom();
    const quizState = { allPoems: [], orderMode: 'normal' };
    const statsState = { selectedColor: null, filterMode: 'normal' };
    const showScreen = vi.fn();
    const ui = createStatsUI({
      elements: buildElements(),
      statsState,
      quizState,
      showScreen,
      loadHistory: async () => [],
    });

    await ui.renderDetailedColorStats('青');
    const detail = document.getElementById('color-detail-container');
    expect(detail.innerHTML).toMatch(/まだデータがありません/);
    expect(detail.innerHTML).toMatch(/まだプレイ履歴がありません/);
  });

  it('shows declining trend label', async () => {
    setupDom();
    const history = [
      { sessionId: 's1', color: '青', questionCount: 10, correctCount: 10, wrongCount: 0, passCount: 0, accuracyRate: 100, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 1, date: '2024-01-01', answers: [] },
      { sessionId: 's2', color: '青', questionCount: 10, correctCount: 0, wrongCount: 10, passCount: 0, accuracyRate: 0, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 2, date: '2024-01-02', answers: [] },
      { sessionId: 's3', color: '青', questionCount: 10, correctCount: 0, wrongCount: 10, passCount: 0, accuracyRate: 0, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 3, date: '2024-01-03', answers: [] },
      { sessionId: 's4', color: '青', questionCount: 10, correctCount: 0, wrongCount: 10, passCount: 0, accuracyRate: 0, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 4, date: '2024-01-04', answers: [] },
      { sessionId: 's5', color: '青', questionCount: 10, correctCount: 0, wrongCount: 10, passCount: 0, accuracyRate: 0, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 5, date: '2024-01-05', answers: [] },
      { sessionId: 's6', color: '青', questionCount: 10, correctCount: 0, wrongCount: 10, passCount: 0, accuracyRate: 0, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 6, date: '2024-01-06', answers: [] },
    ];
    const quizState = {
      allPoems: [
        { color: '青', kimarijiShort: 'あ', kimarijiLong: '', shimoNoKu: '下', shimoReading: 'しも', kamiNoKu: '上', kamiReading: 'かみ' },
      ],
      orderMode: 'normal',
    };
    const statsState = { selectedColor: null, filterMode: 'normal' };
    const showScreen = vi.fn();
    const ui = createStatsUI({
      elements: buildElements(),
      statsState,
      quizState,
      showScreen,
      loadHistory: async () => history,
    });

    await ui.renderDetailedColorStats('青');
    const detail = document.getElementById('color-detail-container');
    expect(detail.innerHTML).toMatch(/下降気味/);
  });

  it('shows improving trend label', async () => {
    setupDom();
    const history = [
      { sessionId: 's1', color: '青', questionCount: 10, correctCount: 1, wrongCount: 9, passCount: 0, accuracyRate: 10, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 1, date: '2024-01-01', answers: [] },
      { sessionId: 's2', color: '青', questionCount: 10, correctCount: 9, wrongCount: 1, passCount: 0, accuracyRate: 90, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 2, date: '2024-01-02', answers: [] },
      { sessionId: 's3', color: '青', questionCount: 10, correctCount: 9, wrongCount: 1, passCount: 0, accuracyRate: 90, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 3, date: '2024-01-03', answers: [] },
      { sessionId: 's4', color: '青', questionCount: 10, correctCount: 9, wrongCount: 1, passCount: 0, accuracyRate: 90, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 4, date: '2024-01-04', answers: [] },
      { sessionId: 's5', color: '青', questionCount: 10, correctCount: 9, wrongCount: 1, passCount: 0, accuracyRate: 90, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 5, date: '2024-01-05', answers: [] },
      { sessionId: 's6', color: '青', questionCount: 10, correctCount: 9, wrongCount: 1, passCount: 0, accuracyRate: 90, hintType: 'shoku', displayMode: 'kana', orderMode: 'normal', timestamp: 6, date: '2024-01-06', answers: [] },
    ];
    const quizState = {
      allPoems: [
        { color: '青', kimarijiShort: 'あ', kimarijiLong: '', shimoNoKu: '下', shimoReading: 'しも', kamiNoKu: '上', kamiReading: 'かみ' },
      ],
      orderMode: 'normal',
    };
    const statsState = { selectedColor: null, filterMode: 'normal' };
    const showScreen = vi.fn();
    const ui = createStatsUI({
      elements: buildElements(),
      statsState,
      quizState,
      showScreen,
      loadHistory: async () => history,
    });

    await ui.renderDetailedColorStats('青');
    const detail = document.getElementById('color-detail-container');
    expect(detail.innerHTML).toMatch(/上昇中/);
  });

  it('renders correct answer mark without hint usage', async () => {
    setupDom();
    const history = [
      {
        sessionId: 's10',
        color: '青',
        questionCount: 1,
        correctCount: 1,
        wrongCount: 0,
        passCount: 0,
        accuracyRate: 100,
        hintType: 'shoku',
        displayMode: 'kana',
        orderMode: 'normal',
        timestamp: 1,
        date: '2024-01-01',
        answers: [
          { kimariji: 'あ', isCorrect: true, usedKami: false },
        ],
      },
    ];
    const quizState = {
      allPoems: [
        { color: '青', kimarijiShort: 'あ', kimarijiLong: '', shimoNoKu: '下', shimoReading: 'しも', kamiNoKu: '上', kamiReading: 'かみ' },
      ],
      orderMode: 'normal',
    };
    const statsState = { selectedColor: null, filterMode: 'normal' };
    const showScreen = vi.fn();
    const ui = createStatsUI({
      elements: buildElements(),
      statsState,
      quizState,
      showScreen,
      loadHistory: async () => history,
    });

    await ui.renderDetailedColorStats('青');
    const sessionItem = document.querySelector('.session-item');
    sessionItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.querySelector('.answer-correct')).toBeTruthy();
  });
});
