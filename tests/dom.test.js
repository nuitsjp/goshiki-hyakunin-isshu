import { describe, expect, it } from 'vitest';
import { getElements, getScreens } from '../docs/js/dom.js';

describe('dom helpers', () => {
  it('getScreens returns screen elements', () => {
    document.body.innerHTML = `
      <div id="start-screen"></div>
      <div id="quiz-screen"></div>
      <div id="result-screen"></div>
      <div id="stats-screen"></div>
    `;

    const screens = getScreens();
    expect(screens.start.id).toBe('start-screen');
    expect(screens.quiz.id).toBe('quiz-screen');
    expect(screens.result.id).toBe('result-screen');
    expect(screens.stats.id).toBe('stats-screen');
  });

  it('getElements collects key nodes', () => {
    document.body.innerHTML = `
      <div id="app-version"></div>
      <button class="color-button"></button>
      <button class="color-button"></button>
      <div id="progress-text"></div>
      <div id="progress-bar"></div>
      <div id="kimariji"></div>
      <div id="options-container">
        <button class="option-button"></button>
        <button class="option-button"></button>
        <button class="option-button"></button>
        <button class="option-button"></button>
      </div>
    `;

    const elements = getElements();
    expect(elements.version.id).toBe('app-version');
    expect(elements.colorButtons).toHaveLength(2);
    expect(elements.options).toHaveLength(4);
    expect(elements.kimariji.id).toBe('kimariji');
  });
});
