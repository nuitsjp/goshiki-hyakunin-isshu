import { describe, expect, it } from 'vitest';
import {
  calculateColorStats,
  calculateKimarijiPerformance,
  calculateRecentTrend,
  calculateOverallStats,
  formatDurationMs,
  formatDateJapanese,
} from '../src/js/stats.js';

describe('stats', () => {
  it('calculateColorStats returns zeroed stats when no history', () => {
    const stats = calculateColorStats('青', []);
    expect(stats.totalQuizzes).toBe(0);
    expect(stats.totalQuestions).toBe(0);
    expect(stats.totalCorrect).toBe(0);
    expect(stats.accuracyRate).toBe(0);
    expect(stats.hintUsageRate).toBe(0);
    expect(stats.lastPlayed).toBe(null);
    expect(stats.fastestDurationMs).toBe(null);
  });

  it('calculateColorStats aggregates quiz sessions', () => {
    const history = [
      {
        color: '青',
        questionCount: 10,
        correctCount: 7,
        wrongCount: 2,
        passCount: 1,
        durationMs: 120000,
        timestamp: 1000,
        date: '2024-01-01',
        orderMode: 'normal',
        answers: [
          { isCorrect: true, usedKami: true },
          { isCorrect: true, usedKami: false },
        ],
      },
      {
        color: '青',
        questionCount: 5,
        correctCount: 3,
        wrongCount: 1,
        passCount: 1,
        durationMs: 90000,
        timestamp: 2000,
        date: '2024-01-02',
        orderMode: 'normal',
        answers: [
          { isCorrect: true, usedKami: true },
        ],
      },
      {
        color: 'ピンク',
        questionCount: 5,
        correctCount: 5,
        wrongCount: 0,
        passCount: 0,
        timestamp: 1500,
        date: '2024-01-03',
        orderMode: 'normal',
        answers: [],
      },
    ];

    const stats = calculateColorStats('青', history, 'normal');
    expect(stats.totalQuizzes).toBe(2);
    expect(stats.totalQuestions).toBe(15);
    expect(stats.totalCorrect).toBe(10);
    expect(stats.totalWrong).toBe(3);
    expect(stats.totalPass).toBe(2);
    expect(stats.accuracyRate).toBe(67);
    expect(stats.hintUsageRate).toBe(20);
    expect(stats.lastPlayed).toBe('2024-01-02');
    expect(stats.fastestDurationMs).toBe(null);
  });

  it('calculateColorStats respects orderMode filter', () => {
    const history = [
      {
        color: '青',
        questionCount: 5,
        correctCount: 5,
        wrongCount: 0,
        passCount: 0,
        timestamp: 1000,
        date: '2024-01-01',
        orderMode: 'reverse',
        answers: [],
      },
    ];
    const stats = calculateColorStats('青', history, 'normal');
    expect(stats.totalQuizzes).toBe(0);
    expect(stats.accuracyRate).toBe(0);
  });

  it('calculateKimarijiPerformance sorts by lowest rate first', () => {
    const poems = [
      { color: '青', kimarijiShort: '', kimarijiLong: 'あ', shimoNoKu: '', shimoReading: '', kamiNoKu: '', kamiReading: '' },
      { color: '青', kimarijiShort: '', kimarijiLong: 'い', shimoNoKu: '', shimoReading: '', kamiNoKu: '', kamiReading: '' },
    ];
    const history = [
      {
        color: '青',
        answers: [
          { kimariji: 'あ', isCorrect: true, answerTimeMs: 2000 },
          { kimariji: 'あ', isCorrect: false, answerTimeMs: 3000 },
          { kimariji: 'い', isCorrect: false, answerTimeMs: 4000 },
        ],
      },
    ];

    const result = calculateKimarijiPerformance('青', poems, history);
    expect(result).toHaveLength(2);
    expect(result[0].kimariji).toBe('い');
    expect(result[0].rate).toBe(0);
    expect(result[0].avgTimeMs).toBe(4000);
    expect(result[1].kimariji).toBe('あ');
    expect(result[1].rate).toBe(50);
    expect(result[1].avgTimeMs).toBe(2500);
  });

  it('calculateKimarijiPerformance sorts totals with zero last', () => {
    const poems = [
      { color: '青', kimarijiShort: '', kimarijiLong: 'い', shimoNoKu: '', shimoReading: '', kamiNoKu: '', kamiReading: '' },
      { color: '青', kimarijiShort: '', kimarijiLong: 'あ', shimoNoKu: '', shimoReading: '', kamiNoKu: '', kamiReading: '' },
    ];
    const history = [
      { color: '青', answers: [{ kimariji: 'あ', isCorrect: true, answerTimeMs: 1000 }] },
    ];
    const result = calculateKimarijiPerformance('青', poems, history);
    expect(result[0].kimariji).toBe('あ');
    expect(result[0].avgTimeMs).toBe(1000);
    expect(result[1].kimariji).toBe('い');
    expect(result[1].avgTimeMs).toBe(null);
  });

  it('calculateKimarijiPerformance keeps order when totals are zero', () => {
    const poems = [
      { color: '青', kimarijiShort: '', kimarijiLong: 'あ', shimoNoKu: '', shimoReading: '', kamiNoKu: '', kamiReading: '' },
      { color: '青', kimarijiShort: '', kimarijiLong: 'い', shimoNoKu: '', shimoReading: '', kamiNoKu: '', kamiReading: '' },
    ];
    const result = calculateKimarijiPerformance('青', poems, []);
    expect(result[0].kimariji).toBe('あ');
    expect(result[1].kimariji).toBe('い');
    expect(result[0].total).toBe(0);
    expect(result[1].total).toBe(0);
    expect(result[0].avgTimeMs).toBe(null);
    expect(result[1].avgTimeMs).toBe(null);
  });

  it('calculateKimarijiPerformance sorts by avgTimeMs when rate is same', () => {
    const poems = [
      { color: '青', kimarijiShort: '', kimarijiLong: 'あ', shimoNoKu: '', shimoReading: '', kamiNoKu: '', kamiReading: '' },
      { color: '青', kimarijiShort: '', kimarijiLong: 'い', shimoNoKu: '', shimoReading: '', kamiNoKu: '', kamiReading: '' },
      { color: '青', kimarijiShort: '', kimarijiLong: 'う', shimoNoKu: '', shimoReading: '', kamiNoKu: '', kamiReading: '' },
    ];
    const history = [
      {
        color: '青',
        answers: [
          { kimariji: 'あ', isCorrect: true, answerTimeMs: 5000 },
          { kimariji: 'あ', isCorrect: false, answerTimeMs: 6000 },
          { kimariji: 'い', isCorrect: true, answerTimeMs: 2000 },
          { kimariji: 'い', isCorrect: false, answerTimeMs: 3000 },
          { kimariji: 'う', isCorrect: true, answerTimeMs: 8000 },
          { kimariji: 'う', isCorrect: false, answerTimeMs: 9000 },
        ],
      },
    ];

    const result = calculateKimarijiPerformance('青', poems, history);
    expect(result).toHaveLength(3);
    // すべて正答率50%なので、平均回答時間の長い順（降順）にソート
    expect(result[0].kimariji).toBe('う');
    expect(result[0].rate).toBe(50);
    expect(result[0].avgTimeMs).toBe(8500);
    expect(result[1].kimariji).toBe('あ');
    expect(result[1].rate).toBe(50);
    expect(result[1].avgTimeMs).toBe(5500);
    expect(result[2].kimariji).toBe('い');
    expect(result[2].rate).toBe(50);
    expect(result[2].avgTimeMs).toBe(2500);
  });

  it('calculateRecentTrend detects improving trend', () => {
    const history = [
      { color: '青', questionCount: 10, correctCount: 2 },
      { color: '青', questionCount: 10, correctCount: 2 },
      { color: '青', questionCount: 10, correctCount: 9 },
      { color: '青', questionCount: 10, correctCount: 9 },
      { color: '青', questionCount: 10, correctCount: 9 },
      { color: '青', questionCount: 10, correctCount: 9 },
    ];

    const trend = calculateRecentTrend('青', history);
    expect(trend.recentAvg).toBe(76);
    expect(trend.overallAvg).toBe(67);
    expect(trend.diff).toBe(9);
    expect(trend.trend).toBe('improving');
  });

  it('calculateRecentTrend returns no-data when no sessions', () => {
    const trend = calculateRecentTrend('青', []);
    expect(trend.trend).toBe('no-data');
    expect(trend.recentCount).toBe(0);
  });

  it('calculateRecentTrend detects declining trend', () => {
    const history = [
      { color: '青', questionCount: 10, correctCount: 9 },
      { color: '青', questionCount: 10, correctCount: 9 },
      { color: '青', questionCount: 10, correctCount: 2 },
      { color: '青', questionCount: 10, correctCount: 2 },
      { color: '青', questionCount: 10, correctCount: 2 },
    ];
    const trend = calculateRecentTrend('青', history, 3);
    expect(trend.trend).toBe('declining');
  });

  it('calculateRecentTrend returns no-data when sessionCount is negative', () => {
    const history = [
      { color: '青', questionCount: 10, correctCount: 5 },
    ];
    const trend = calculateRecentTrend('青', history, -1);
    expect(trend.trend).toBe('no-data');
    expect(trend.recentCount).toBe(0);
  });

  it('calculateRecentTrend handles zero recent total', () => {
    const history = [
      { color: '青', questionCount: 0, correctCount: 0 },
      { color: '青', questionCount: 0, correctCount: 0 },
    ];
    const trend = calculateRecentTrend('青', history, 1);
    expect(trend.recentAvg).toBe(0);
  });

  it('calculateOverallStats returns zero rates when no correct answers', () => {
    const history = [
      { color: '青', questionCount: 0, correctCount: 0, wrongCount: 0, orderMode: 'normal', answers: [] },
    ];
    const stats = calculateOverallStats(history, 'normal');
    expect(stats.accuracyRate).toBe(0);
    expect(stats.hintUsageRate).toBe(0);
  });

  it('formatDateJapanese formats month/day', () => {
    expect(formatDateJapanese('2024-01-09')).toBe('1/9');
  });

  it('formatDurationMs formats minutes and seconds', () => {
    expect(formatDurationMs(65000)).toBe('1:05');
    expect(formatDurationMs(null)).toBe('-');
  });

  it('calculateColorStats uses fastest time only when all answers are correct', () => {
    const history = [
      {
        color: '青',
        questionCount: 10,
        correctCount: 10,
        wrongCount: 0,
        passCount: 0,
        durationMs: 120000,
        timestamp: 1000,
        date: '2024-01-01',
        orderMode: 'normal',
        answers: [],
      },
      {
        color: '青',
        questionCount: 10,
        correctCount: 9,
        wrongCount: 1,
        passCount: 0,
        durationMs: 90000,
        timestamp: 2000,
        date: '2024-01-02',
        orderMode: 'normal',
        answers: [],
      },
    ];

    const stats = calculateColorStats('青', history, 'normal');
    expect(stats.fastestDurationMs).toBe(120000);
  });
});
