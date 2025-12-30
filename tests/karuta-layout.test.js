import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { JSDOM } from 'jsdom';

const loadKarutaHtml = () => fs.readFileSync('src/karuta.html', 'utf-8');
const loadStyleCss = () => fs.readFileSync('src/css/style.css', 'utf-8');

describe('karuta layout', () => {
  it('かるた画面は上下と取り札領域の3分割になっている', () => {
    const dom = new JSDOM(loadKarutaHtml());
    const document = dom.window.document;
    const layout = document.querySelector('.karuta-layout');

    expect(layout).not.toBeNull();
    expect(layout?.querySelector('.karuta-board-top')).not.toBeNull();
    expect(layout?.querySelector('.karuta-grid-area')).not.toBeNull();
    expect(layout?.querySelector('.karuta-board-bottom')).not.toBeNull();
  });

  it('取り札グリッドは4行構成になっている', () => {
    const css = loadStyleCss();

    expect(css).toMatch(/karuta-grid[\s\S]*grid-template-rows:\s*repeat\(4,/);
  });
});
