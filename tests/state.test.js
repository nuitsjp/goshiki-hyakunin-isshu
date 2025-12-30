import { describe, expect, it } from 'vitest';
import { quizState, statsState } from '../src/js/state.js';

describe('state', () => {
  it('quizState has defaults', () => {
    expect(quizState.selectedColor).toBe('');
    expect(quizState.currentIndex).toBe(0);
    expect(quizState.questionLimit).toBe(20);
    expect(quizState.hintType).toBe('shoku');
    expect(quizState.displayMode).toBe('kana');
    expect(quizState.orderMode).toBe('normal');
  });

  it('statsState has defaults', () => {
    expect(statsState.selectedColor).toBe(null);
    expect(statsState.filterMode).toBe('normal');
  });
});
