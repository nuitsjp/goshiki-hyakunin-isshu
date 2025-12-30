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
  STORAGE_KEYS: {
    MEASURE_TIME: 'goshiki_measure_time',
  },
}));

let loadCsvMock;
let buildKarutaDeckMock;
let buildKarutaReadingsMock;
let checkKarutaMatchMock;
let escapeHtmlMock;
let toRubyHtmlMock;
let saveKarutaSessionMock;

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
vi.mock('../src/js/storage.js', () => ({
  saveKarutaSession: (...args) => saveKarutaSessionMock(...args),
}));

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
  hint: `ひ${i}`,
}));

const setupDom = () => {
  document.body.innerHTML = `
    <div id="start-screen" class="hidden"></div>
    <div id="game-screen" class="hidden"></div>
    <div id="result-screen" class="hidden"></div>
    <button class="color-button" data-color="黄"></button>
    <button class="color-button" data-color="青"></button>
    <button class="color-button" data-color="緑"></button>
    <button id="cancel-game"></button>
    <div id="progress-text"></div>
    <div id="progress-bar"></div>
    <div id="score-text"></div>
    <div id="selected-color-label"></div>
    <div id="kimariji-display"></div>
    <div id="reading-display"></div>
    <button id="toggle-hint" type="button"><span class="hint-button-label"></span></button>
    <div id="karuta-grid"></div>
    <button id="next-reading"></button>
    <div id="elapsed-time"></div>
    <input id="measure-time-toggle" type="checkbox" checked>
    <div id="result-count"></div>
    <div id="result-rate"></div>
    <div id="result-time" class="hidden"></div>
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
  window.__KARUTA_RESULT_DELAY_MS__ = 0;
  const alertMock = vi.fn();
  const confirmMock = vi.fn(() => true);
  vi.stubGlobal('alert', alertMock);
  vi.stubGlobal('confirm', confirmMock);
  const storageMock = (() => {
    let store = {};
    return {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
      setItem: (key, value) => {
        store[key] = String(value);
      },
      removeItem: (key) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();
  vi.stubGlobal('localStorage', storageMock);
  window.alert = alertMock;
  window.confirm = confirmMock;
  localStorage.clear();
  loadCsvMock = vi.fn();
  buildKarutaDeckMock = vi.fn();
  buildKarutaReadingsMock = vi.fn();
  checkKarutaMatchMock = vi.fn();
  escapeHtmlMock = vi.fn(text => text);
  toRubyHtmlMock = vi.fn(text => `<span>${text}</span>`);
  saveKarutaSessionMock = vi.fn().mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.__KARUTA_RESULT_DELAY_MS__;
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

  it('取り札はスペース区切りを2列に分けて改行表示される', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue([{
      kimariji: 'き0',
      shimoNoKu: '下0',
      shimoReading: 'よしの の さと',
      kamiNoKu: '上0',
      kamiReading: 'かみ0',
      state: 'active',
    }]);
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();

    const card = document.querySelector('.karuta-card');
    const lines = Array.from(card.querySelectorAll('.karuta-card-line')).map(node => node.textContent);

    expect(card.innerHTML).toContain('<br');
    expect(lines).toEqual(['よしの の', 'さと']);
  });

  it('計測オフならタイマーを非表示にする', async () => {
    setupDom();
    localStorage.setItem('goshiki_measure_time', 'false');
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();

    expect(document.getElementById('measure-time-toggle').checked).toBe(false);
    expect(document.getElementById('elapsed-time').classList.contains('hidden')).toBe(true);
  });

  it('計測オンならタイマーを表示する', async () => {
    setupDom();
    localStorage.setItem('goshiki_measure_time', 'true');
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();

    expect(document.getElementById('measure-time-toggle').checked).toBe(true);
    expect(document.getElementById('elapsed-time').classList.contains('hidden')).toBe(false);
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
    expect(card.classList.contains('showing-result')).toBe(true);
    expect(card.disabled).toBe(true);
    const icon = card.querySelector('.result-icon.correct');
    expect(icon).toBeTruthy();
    expect(icon.textContent).toBe('○');
    expect(document.getElementById('score-text').textContent).toBe('正解: 1枚');
  });

  it('ヒントボタンで読み札の上の句を表示する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    expect(document.querySelector('#toggle-hint .hint-button-label').textContent).toBe('ヒント');
    document.getElementById('toggle-hint').click();

    expect(document.getElementById('kimariji-display').textContent).toBe('ひ0');
    expect(document.getElementById('toggle-hint').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('#toggle-hint .hint-button-label').textContent).toBe('決まり字');

    document.getElementById('toggle-hint').click();

    expect(document.getElementById('kimariji-display').textContent).toBe('き0');
    expect(document.getElementById('toggle-hint').getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('#toggle-hint .hint-button-label').textContent).toBe('ヒント');
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
    expect(card.classList.contains('showing-result')).toBe(true);
    expect(card.disabled).toBe(true);
    expect(card.querySelector('.result-icon.incorrect')).toBeTruthy();
    expect(document.getElementById('score-text').textContent).toBe('正解: 0枚');
  });

  it('取得済みの札は非表示でも配置を維持する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(2));
    buildKarutaDeckMock.mockReturnValue(createDeck(2));
    buildKarutaReadingsMock.mockReturnValue(createReadings(2));
    checkKarutaMatchMock.mockReturnValue(true);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.querySelectorAll('.karuta-card')[0].click();

    // 自動遷移を待つ
    await wait(0);

    expect(document.querySelectorAll('.karuta-card')).toHaveLength(2);
    expect(document.querySelector('.karuta-card.is-taken')).toBeTruthy();
    expect(document.querySelector('.karuta-card.hidden')).toBeNull();
    expect(document.querySelector('.karuta-card.is-taken').disabled).toBe(true);
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

    // 自動遷移を待つ
    await wait(0);

    expect(document.getElementById('result-screen').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('result-count').textContent).toBe('1 / 1 枚獲得');
    expect(document.getElementById('result-rate').textContent).toBe('正答率 100%');
    expect(document.getElementById('result-time').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('result-time').textContent).toMatch(/クリアタイム/);
    expect(document.getElementById('result-comment').textContent).toBe('完璧です！すべての札を取りました！');
    expect(document.getElementById('result-list').innerHTML).toContain('result-item');
    expect(document.getElementById('result-list').innerHTML).toContain('icon-correct');
    expect(document.getElementById('result-list').innerHTML).toContain('○');
    expect(escapeHtmlMock).toHaveBeenCalledWith('き0');
  });

  it('結果表示時にかるた統計を保存する', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    checkKarutaMatchMock.mockReturnValue(true);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.querySelector('.karuta-card').click();

    // 自動遷移を待つ
    await wait(0);

    expect(saveKarutaSessionMock).toHaveBeenCalledTimes(1);
    const sessionData = saveKarutaSessionMock.mock.calls[0][0];
    expect(sessionData).toMatchObject({
      color: '黄',
      questionCount: 1,
      correctCount: 1,
      wrongCount: 0,
      passCount: 0,
      accuracyRate: 100,
    });
    expect(sessionData.answers).toHaveLength(1);
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

    // 自動遷移を待つ
    await wait(0);

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

    // 自動遷移を待つ
    await wait(0);

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

    // 自動遷移を待つ
    await wait(0);

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

    // 自動遷移を待つ
    await wait(0);

    expect(document.getElementById('result-list').innerHTML).toContain('icon-wrong');
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
      // 自動遷移を待つ
      await wait(0);
    }

    expect(document.getElementById('result-comment').textContent).toBe('素晴らしい！ほぼ完璧です！');
  }, 10000);

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
      // 自動遷移を待つ
      await wait(0);
    }

    expect(document.getElementById('result-comment').textContent).toBe('よくできました！');
  }, 10000);

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
      // 自動遷移を待つ
      await wait(0);
    }

    expect(document.getElementById('result-comment').textContent).toBe('もう少し頑張りましょう！');
  }, 10000);

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
      // 自動遷移を待つ
      await wait(0);
    }

    expect(document.getElementById('result-comment').textContent).toBe('練習あるのみ！');
  }, 10000);

  it('未定義の色はデフォルトのアクセントを使う', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1, '緑'));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    await importApp();

    document.querySelector('.color-button[data-color="緑"]').click();

    expect(document.documentElement.style.getPropertyValue('--current-accent')).toBe('var(--color-blue)');
    expect(document.getElementById('progress-bar').style.color).toBe('rgb(255, 255, 255)');
  });

  it('計測なしの結果は時間表示を隠す', async () => {
    setupDom();
    localStorage.setItem('goshiki_measure_time', 'false');
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    checkKarutaMatchMock.mockReturnValue(true);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.querySelector('.karuta-card').click();

    await wait(0);

    expect(document.getElementById('result-time').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('result-time').textContent).toBe('');
  });

  it('不正解時に正解札をハイライトする', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(2));
    buildKarutaDeckMock.mockReturnValue(createDeck(2));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    checkKarutaMatchMock.mockImplementation((reading, card) => reading.kimariji === card.kimariji);
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.querySelectorAll('.karuta-card')[1].click();

    const cards = document.querySelectorAll('.karuta-card');
    expect(cards[0].classList.contains('showing-result')).toBe(true);
    expect(cards[0].style.backgroundColor).toBe('rgb(255, 230, 230)');
    expect(cards[1].querySelector('.result-icon.incorrect')).toBeTruthy();
  });

  it('計測設定の保存エラーを握りつぶす', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    await importApp();

    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      throw new Error('fail');
    });

    expect(() => {
      document.getElementById('measure-time-toggle')
        .dispatchEvent(new Event('change'));
    }).not.toThrow();

    localStorage.setItem = originalSetItem;
  });

  it('遅延指定がある場合はその値を使う', async () => {
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    checkKarutaMatchMock.mockReturnValue(true);
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.querySelector('.karuta-card').click();

    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 0);
    setTimeoutSpy.mockRestore();
  });

  it('遅延指定がない場合はデフォルトの待機時間を使う', async () => {
    delete window.__KARUTA_RESULT_DELAY_MS__;
    setupDom();
    loadCsvMock.mockResolvedValue(createPoems(1));
    buildKarutaDeckMock.mockReturnValue(createDeck(1));
    buildKarutaReadingsMock.mockReturnValue(createReadings(1));
    checkKarutaMatchMock.mockReturnValue(true);
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    await importApp();

    document.querySelector('.color-button[data-color="黄"]').click();
    document.querySelector('.karuta-card').click();

    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 500);
    setTimeoutSpy.mockRestore();
  });
});
