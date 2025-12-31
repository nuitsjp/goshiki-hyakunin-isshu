import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { JSDOM } from 'jsdom';

const loadIndexHtml = () => fs.readFileSync('src/index.html', 'utf-8');
const loadKarutaHtml = () => fs.readFileSync('src/karuta.html', 'utf-8');

describe('start screen layout', () => {
  it('クイズ画面のトップから指定の文言が削除されている', () => {
    const dom = new JSDOM(loadIndexHtml());
    const document = dom.window.document;
    const startScreen = document.querySelector('#start-screen');

    expect(startScreen).not.toBeNull();
    expect(startScreen?.textContent).not.toContain('色を選んでください');

    const labelTexts = [...(startScreen?.querySelectorAll('label') ?? [])]
      .map((label) => label.textContent?.trim())
      .filter(Boolean);

    expect(labelTexts).not.toContain('読み札');
    expect(labelTexts).not.toContain('出題');
  });

  it('かるた画面のトップから指定の文言が削除されている', () => {
    const dom = new JSDOM(loadKarutaHtml());
    const document = dom.window.document;
    const startScreen = document.querySelector('#start-screen');

    expect(startScreen).not.toBeNull();
    expect(startScreen?.textContent).not.toContain('色を選んでください');
    expect(startScreen?.textContent).not.toMatch(/選んだ色の20枚すべての札で/);
  });

  it('かるた画面の統計ボタンは色選択の下にある', () => {
    const dom = new JSDOM(loadKarutaHtml());
    const document = dom.window.document;
    const startScreen = document.querySelector('#start-screen');
    const statsButton = document.querySelector('#view-stats');

    expect(startScreen).not.toBeNull();
    expect(statsButton).not.toBeNull();

    const colorButtons = startScreen?.querySelectorAll('.color-button');
    const lastColorButton = colorButtons?.[colorButtons.length - 1];

    expect(lastColorButton).not.toBeUndefined();
    const position = lastColorButton?.compareDocumentPosition(statsButton);

    expect(position & dom.window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
