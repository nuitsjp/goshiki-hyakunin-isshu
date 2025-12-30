import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockConfig = vi.hoisted(() => ({
  APP_VERSION: '9.9.9',
  colorAccentMap: {
    '黄': 'var(--color-yellow)',
    '青': 'var(--color-blue)',
  },
  colorTextMap: {
    '黄': '#333',
  },
}));

let loadCsvMock;
let buildKarutaDeckMock;
let buildKarutaReadingsMock;
let checkKarutaMatchMock;
let escapeHtmlMock;
let toRubyHtmlMock;

vi.mock('../src/js/config.js', () => mockConfig);
vi.mock('../src/js/data.js', () => ({
  loadCsv: (...args) => loadCsvMock(...args),
}));
vi.mock('../src/js/karuta.js', () => ({
  buildKarutaDeck: (...args) => buildKarutaDeckMock(...args),
  buildKarutaReadings: (...args) => buildKarutaReadingsMock(...args),
  checkKarutaMatch: (...args) => checkKarutaMatchMock(...args),
}));
vi.mock('../src/js/text.js', () => ({
  escapeHtml: (...args) => escapeHtmlMock(...args),
  toRubyHtml: (...args) => toRubyHtmlMock(...args),
}));

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const createPoems = (count, color = '黄') => Array.from({ length: count }, (_, i) => ({
  color,
  kimarijiShort: `き${i}`,
  kimarijiLong: `決${i}`,
  shimoNoKu: `下${i}`,
  shimoReading: `しも${i}`,
  kamiNoKu: `上${i}`,
  kamiReading: `かみ${i}`,
  hint: `ひ${i}`,
}));

const createDeck = (count) => Array.from({ length: count }, (_, i) => ({
  kimariji: `き${i}`,
  shimoNoKu: `下${i}`,
  shimoReading: `しも${i}`,
  kamiNoKu: `上${i}`,
  kamiReading: `かみ${i}`,
  state: 'active',
}));

const createReadings = (count) => Array.from({ length: count }, (_, i) => ({
  kimariji: `き${i}`,
  kamiNoKu: `上${i}`,
  kamiReading: `かみ${i}`,
}));

const setupDom = () => {
  document.body.innerHTML = `
    <div id="start-screen" class="hidden"></div>
    <div id="game-screen" class="hidden"></div>
    <div id="result-screen" class="hidden"></div>
    <button class="color-button" data-color="黄"></button>
    <button class="color-button" data-color="青"></button>
    <button id="cancel-game"></button>
    <div id="progress-text"></div>
    <div id="progress-bar"></div>
    <div id="score-text"></div>
    <div id="selected-color-label"></div>
    <div id="kimariji-display"></div>
    <div id="reading-display"></div>
    <div id="karuta-grid"></div>
    <button id="next-reading"></button>
    <div id="result-count"></div>
    <div id="result-rate"></div>
    <div id="result-comment"></div>
    <div id="result-list"></div>
    <button id="retry-same"></button>
    <button id="choose-color"></button>
    <div id="app-version"></div>
  `;
};

const setupMinimalDom = () => {
  document.body.innerHTML = `
    <div id="start-screen" class="hidden"></div>
    <div id="game-screen" class="hidden"></div>
    <div id="result-screen" class="hidden"></div>
  `;
};

const importApp = async () => {
  await import('../src/js/karuta-app.js');
  await flushPromises();
};

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
  document.documentElement.style.cssText = '';
  const alertMock = vi.fn();
  const confirmMock = vi.fn(() => true);
  vi.stubGlobal('alert', alertMock);
  vi.stubGlobal('confirm', confirmMock);
  window.alert = alertMock;
  window.confirm = confirmMock;
  loadCsvMock = vi.fn();
  buildKarutaDeckMock = vi.fn();
  buildKarutaReadingsMock = vi.fn();
  checkKarutaMatchMock = vi.fn();
  escapeHtmlMock = vi.fn(text => text);
  toRubyHtmlMock = vi.fn(text => `<span>${text}</span>`);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('karuta-app', () => {
  it('初期化時に開始画面を表示する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    await importApp();

    expect(document.getElementById('app-version').textContent).toBe(mockConfig.APP_VERSION);
    expect(document.getElementById('start-screen').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('game-screen').classList.contains('hidden')).toBe(true);
  });

  it('要素が不足していても初期化できる', async () => {
    setupMinimalDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    await importApp();

    expect(document.getElementById('start-screen').classList.contains('hidden')).toBe(false);
  });

  it('色選択でゲーム開始しアクセントと進捗を更新する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();

    expect(buildKarutaDeckMock).toHaveBeenCalled();
    expect(buildKarutaReadingsMock).toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue('--current-accent')).toBe('var(--color-yellow)');
    expect(document.getElementById('selected-color-label').textContent).toBe('黄');
    expect(document.getElementById('progress-text').textContent).toBe('1 / 1');
    expect(document.getElementById('score-text').textContent).toBe('正解: 0枚');
    expect(document.getElementById('next-reading').disabled).toBe(true);
    expect(document.getElementById('game-screen').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('reading-display').innerHTML).toBe('');
    expect(document.getElementById('kimariji-display').textContent).toBe('き0');
  });

  it('正解時に札を取得状態にして次へ進める', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    checkKarutaMatchMock.mockReturnValue(true);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.querySelector('.karuta-card').click();

    const card = document.querySelector('.karuta-card');
    expect(card.classList.contains('taken')).toBe(true);
    expect(card.disabled).toBe(true);
    expect(document.getElementById('score-text').textContent).toBe('正解: 1枚');
    expect(document.getElementById('next-reading').disabled).toBe(false);
  });

  it('不正解時に札を間違い状態にする', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    checkKarutaMatchMock.mockReturnValue(false);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.querySelector('.karuta-card').click();

    const card = document.querySelector('.karuta-card');
    expect(card.classList.contains('wrong')).toBe(true);
    expect(card.disabled).toBe(true);
    expect(document.getElementById('score-text').textContent).toBe('正解: 0枚');
  });

  it('最後の読み札で結果画面を表示する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    checkKarutaMatchMock.mockReturnValue(true);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.querySelector('.karuta-card').click();
    document.getElementById('next-reading').click();

    expect(document.getElementById('result-screen').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('result-count').textContent).toBe('1 / 1 枚獲得');
    expect(document.getElementById('result-rate').textContent).toBe('正答率 100%');
    expect(document.getElementById('result-comment').textContent).toBe('完璧です！すべての札を取りました！');
    expect(document.getElementById('result-list').innerHTML).toContain('result-item-correct');
    expect(document.getElementById('result-list').innerHTML).toContain('○');
    expect(escapeHtmlMock).toHaveBeenCalledWith('き0');
  });

  it('途中の読み札では次の読み札へ進む', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(2));
    buildKarutaDeckMock.mockReturnValue(createDeck(2));
    buildKarutaReadingsMock.mockReturnValue(createReadings(2));
    checkKarutaMatchMock.mockReturnValue(true);
    await importApp();

    document.querySelector('.color-button[data-color="青"]').click();
    document.querySelectorAll('.karuta-card')[0].click();
    document.getElementById('next-reading').click();

    expect(document.getElementById('next-reading').disabled).toBe(true);
    expect(document.getElementById('kimariji-display').textContent).toBe('き1');
    expect(document.getElementById('progress-text').textContent).toBe('2 / 2');
  });

  it('読み札の表示を次の読み札でリセットする', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(2));
    buildKarutaDeckMock.mockReturnValue(createDeck(2));
    buildKarutaReadingsMock.mockReturnValue(createReadings(2));
    checkKarutaMatchMock.mockReturnValue(true);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.querySelector('.karuta-card').click();
    document.getElementById('reading-display').innerHTML = '<p>dummy</p>';
    document.getElementById('next-reading').click();

    expect(document.getElementById('reading-display').innerHTML).toBe('');
  });

  it('進捗バーの幅を更新する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(2));
    buildKarutaDeckMock.mockReturnValue(createDeck(2));
    buildKarutaReadingsMock.mockReturnValue(createReadings(2));
    checkKarutaMatchMock.mockReturnValue(true);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    expect(document.getElementById('progress-bar').style.width).toBe('50%');

    document.querySelector('.karuta-card').click();
    document.getElementById('next-reading').click();
    expect(document.getElementById('progress-bar').style.width).toBe('100%');
  });

  it('不正解の結果は×と表示する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    checkKarutaMatchMock.mockReturnValue(false);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.querySelector('.karuta-card').click();
    document.getElementById('next-reading').click();

    expect(document.getElementById('result-list').innerHTML).toContain('result-item-incorrect');
    expect(document.getElementById('result-list').innerHTML).toContain('×');
  });

  it('中止ボタンで開始画面へ戻る', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.getElementById('cancel-game').click();

    expect(document.getElementById('start-screen').classList.contains('hidden')).toBe(false);
  });

  it('同じ色で再挑戦する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.getElementById('retry-same').click();

    expect(buildKarutaDeckMock).toHaveBeenCalledTimes(2);
  });

  it('別の色を選ぶと開始画面へ戻る', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.getElementById('choose-color').click();

    expect(document.getElementById('start-screen').classList.contains('hidden')).toBe(false);
  });

  it('読み込み失敗時にアラートを表示する', async () => {
    setupDom();
    loadCsvMock.mockRejectedValue(new Error('fail'));
    await importApp();

    expect(window.alert).toHaveBeenCalled();
  });

  it('詩データが空ならゲーム開始を中止する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue([]);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();

    expect(window.alert).toHaveBeenCalled();
    expect(buildKarutaDeckMock).not.toHaveBeenCalled();
  });

  it('ゲーム開始エラー時にメッセージを表示する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockImplementation(() => {
      throw new Error('boom');
    });
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();

    expect(window.alert).toHaveBeenCalledWith('boom');
    expect(document.getElementById('game-screen').classList.contains('hidden')).toBe(true);
  });

  it('正答率90%台の結果コメントを表示する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(10));
    buildKarutaDeckMock.mockReturnValue(createDeck(10));
    buildKarutaReadingsMock.mockReturnValue(createReadings(10));
    checkKarutaMatchMock
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    for (let i = 0; i < 10; i += 1) {
      document.querySelector('.karuta-card.active').click();
      document.getElementById('next-reading').click();
    }

    expect(document.getElementById('result-comment').textContent).toBe('素晴らしい！ほぼ完璧です！');
  });

  it('正答率70%台の結果コメントを表示する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(10));
    buildKarutaDeckMock.mockReturnValue(createDeck(10));
    buildKarutaReadingsMock.mockReturnValue(createReadings(10));
    checkKarutaMatchMock
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    for (let i = 0; i < 10; i += 1) {
      document.querySelector('.karuta-card.active').click();
      document.getElementById('next-reading').click();
    }

    expect(document.getElementById('result-comment').textContent).toBe('よくできました！');
  });

  it('正答率50%台の結果コメントを表示する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(10));
    buildKarutaDeckMock.mockReturnValue(createDeck(10));
    buildKarutaReadingsMock.mockReturnValue(createReadings(10));
    checkKarutaMatchMock
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    for (let i = 0; i < 10; i += 1) {
      document.querySelector('.karuta-card.active').click();
      document.getElementById('next-reading').click();
    }

    expect(document.getElementById('result-comment').textContent).toBe('もう少し頑張りましょう！');
  });

  it('正答率50%未満の結果コメントを表示する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(10));
    buildKarutaDeckMock.mockReturnValue(createDeck(10));
    buildKarutaReadingsMock.mockReturnValue(createReadings(10));
    checkKarutaMatchMock
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    for (let i = 0; i < 10; i += 1) {
      document.querySelector('.karuta-card.active').click();
      document.getElementById('next-reading').click();
    }

    expect(document.getElementById('result-comment').textContent).toBe('練習あるのみ！');
  });
});
