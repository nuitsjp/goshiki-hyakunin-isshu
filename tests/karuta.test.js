import { describe, expect, it } from 'vitest';
import {
  buildKarutaDeck,
  buildKarutaReadings,
  checkKarutaMatch,
} from '../src/js/karuta.js';

const samplePoems = [
  {
    color: '青',
    kimarijiShort: 'あ',
    kimarijiLong: 'あき',
    shimoNoKu: '下1',
    shimoReading: 'しも1',
    kamiNoKu: '上1',
    kamiReading: 'かみ1',
    hint: 'ひ1',
  },
  {
    color: '青',
    kimarijiShort: 'い',
    kimarijiLong: 'いの',
    shimoNoKu: '下2',
    shimoReading: 'しも2',
    kamiNoKu: '上2',
    kamiReading: 'かみ2',
    hint: 'ひ2',
  },
  {
    color: '青',
    kimarijiShort: 'う',
    kimarijiLong: 'うか',
    shimoNoKu: '下3',
    shimoReading: 'しも3',
    kamiNoKu: '上3',
    kamiReading: 'かみ3',
    hint: 'ひ3',
  },
  {
    color: '青',
    kimarijiShort: 'え',
    kimarijiLong: 'えん',
    shimoNoKu: '下4',
    shimoReading: 'しも4',
    kamiNoKu: '上4',
    kamiReading: 'かみ4',
    hint: 'ひ4',
  },
  {
    color: 'ピンク',
    kimarijiShort: 'お',
    kimarijiLong: 'おと',
    shimoNoKu: '下5',
    shimoReading: 'しも5',
    kamiNoKu: '上5',
    kamiReading: 'かみ5',
    hint: 'ひ5',
  },
];

const fixedRandom = () => 0;

describe('karuta', () => {
  it('buildKarutaDeck returns 20 cards for specified color', () => {
    const poems = Array(20).fill(null).map((_, i) => ({
      color: '青',
      kimarijiShort: `k${i}`,
      kimarijiLong: `kl${i}`,
      shimoNoKu: `下${i}`,
      shimoReading: `しも${i}`,
      kamiNoKu: `上${i}`,
      kamiReading: `かみ${i}`,
      hint: `ひ${i}`,
    }));

    const deck = buildKarutaDeck({
      poems,
      color: '青',
      random: fixedRandom,
    });

    expect(deck).toHaveLength(20);
    deck.forEach(card => {
      expect(card).toHaveProperty('kimariji');
      expect(card).toHaveProperty('shimoNoKu');
      expect(card).toHaveProperty('shimoReading');
      expect(card).toHaveProperty('kamiNoKu');
      expect(card).toHaveProperty('kamiReading');
      expect(card).toHaveProperty('state', 'active');
    });
  });

  it('buildKarutaDeck prefers kimarijiLong over kimarijiShort', () => {
    const poems = Array(20).fill(null).map((_, i) => ({
      color: '青',
      kimarijiShort: `short${i}`,
      kimarijiLong: `long${i}`,
      shimoNoKu: `下${i}`,
      shimoReading: `しも${i}`,
      kamiNoKu: `上${i}`,
      kamiReading: `かみ${i}`,
      hint: `ひ${i}`,
    }));

    const deck = buildKarutaDeck({
      poems,
      color: '青',
      random: Math.random,
    });

    // kimarijiLongが優先されることを確認
    deck.forEach(card => {
      expect(card.kimariji).toMatch(/^long\d+$/);
    });
  });

  it('buildKarutaDeck throws when no poems for color', () => {
    expect(() => buildKarutaDeck({
      poems: samplePoems,
      color: '紫',
      random: fixedRandom,
    })).toThrow(/指定の色に20枚の歌が見つかりません/);
  });

  it('buildKarutaDeck throws when poems is not an array', () => {
    expect(() => buildKarutaDeck({
      poems: null,
      color: '青',
      random: fixedRandom,
    })).toThrow(/指定の色に20枚の歌が見つかりません/);
  });

  it('buildKarutaDeck throws when color has less than 20 poems', () => {
    expect(() => buildKarutaDeck({
      poems: samplePoems,
      color: '青',
      random: fixedRandom,
    })).toThrow(/指定の色に20枚の歌が見つかりません/);
  });

  it('buildKarutaReadings returns 20 readings in shuffled order', () => {
    const poems = Array(20).fill(null).map((_, i) => ({
      color: '青',
      kimarijiShort: `k${i}`,
      kimarijiLong: `kl${i}`,
      shimoNoKu: `下${i}`,
      shimoReading: `しも${i}`,
      kamiNoKu: `上${i}`,
      kamiReading: `かみ${i}`,
      hint: `ひ${i}`,
    }));

    const readings = buildKarutaReadings({
      poems,
      color: '青',
      random: fixedRandom,
    });

    expect(readings).toHaveLength(20);
    readings.forEach(reading => {
      expect(reading).toHaveProperty('kimariji');
      expect(reading).toHaveProperty('kamiNoKu');
      expect(reading).toHaveProperty('kamiReading');
      expect(reading).toHaveProperty('hint');
    });
  });

  it('buildKarutaReadings prefers kimarijiLong over kimarijiShort', () => {
    const poems = Array(20).fill(null).map((_, i) => ({
      color: '青',
      kimarijiShort: `short${i}`,
      kimarijiLong: `long${i}`,
      shimoNoKu: `下${i}`,
      shimoReading: `しも${i}`,
      kamiNoKu: `上${i}`,
      kamiReading: `かみ${i}`,
      hint: `ひ${i}`,
    }));

    const readings = buildKarutaReadings({
      poems,
      color: '青',
      random: Math.random,
    });

    // kimarijiLongが優先されることを確認
    readings.forEach(reading => {
      expect(reading.kimariji).toMatch(/^long\d+$/);
    });
  });

  it('buildKarutaReadings throws when no poems for color', () => {
    expect(() => buildKarutaReadings({
      poems: samplePoems,
      color: '紫',
      random: fixedRandom,
    })).toThrow(/指定の色に20枚の歌が見つかりません/);
  });

  it('checkKarutaMatch returns true for correct match', () => {
    const reading = {
      kimariji: 'あき',
      kamiNoKu: '上1',
      kamiReading: 'かみ1',
    };

    const card = {
      kimariji: 'あき',
      shimoNoKu: '下1',
      shimoReading: 'しも1',
      kamiNoKu: '上1',
      kamiReading: 'かみ1',
      state: 'active',
    };

    expect(checkKarutaMatch(reading, card)).toBe(true);
  });

  it('checkKarutaMatch returns false for incorrect match', () => {
    const reading = {
      kimariji: 'あき',
      kamiNoKu: '上1',
      kamiReading: 'かみ1',
    };

    const card = {
      kimariji: 'いの',
      shimoNoKu: '下2',
      shimoReading: 'しも2',
      kamiNoKu: '上2',
      kamiReading: 'かみ2',
      state: 'active',
    };

    expect(checkKarutaMatch(reading, card)).toBe(false);
  });

  it('checkKarutaMatch uses kimariji for matching', () => {
    const reading = {
      kimariji: 'あき',
      kamiNoKu: '上1',
      kamiReading: 'かみ1',
    };

    const card = {
      kimariji: 'あき',
      shimoNoKu: '下1',
      shimoReading: 'しも1',
      kamiNoKu: '上1',
      kamiReading: 'かみ1',
      state: 'active',
    };

    expect(checkKarutaMatch(reading, card)).toBe(true);
  });
});
