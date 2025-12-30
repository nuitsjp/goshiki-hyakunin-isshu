import { describe, expect, it } from 'vitest';
import {
  buildQuestions,
  buildWeakQuestions,
  canUseWeak5,
  getIncorrectPoems,
  buildQuestionsFromPoems,
} from '../src/js/questions.js';

const samplePoems = [
  {
    color: '青',
    kimarijiShort: 'あ',
    kimarijiLong: '',
    shimoNoKu: '下1',
    shimoReading: 'しも1',
    kamiNoKu: '上1',
    kamiReading: 'かみ1',
    hint: 'ひ1',
  },
  {
    color: '青',
    kimarijiShort: 'い',
    kimarijiLong: '',
    shimoNoKu: '下2',
    shimoReading: 'しも2',
    kamiNoKu: '上2',
    kamiReading: 'かみ2',
    hint: 'ひ2',
  },
  {
    color: '青',
    kimarijiShort: 'う',
    kimarijiLong: '',
    shimoNoKu: '下3',
    shimoReading: 'しも3',
    kamiNoKu: '上3',
    kamiReading: 'かみ3',
    hint: 'ひ3',
  },
  {
    color: '青',
    kimarijiShort: 'え',
    kimarijiLong: '',
    shimoNoKu: '下4',
    shimoReading: 'しも4',
    kamiNoKu: '上4',
    kamiReading: 'かみ4',
    hint: 'ひ4',
  },
  {
    color: 'ピンク',
    kimarijiShort: 'お',
    kimarijiLong: '',
    shimoNoKu: '下5',
    shimoReading: 'しも5',
    kamiNoKu: '上5',
    kamiReading: 'かみ5',
    hint: 'ひ5',
  },
];

const fixedRandom = () => 0;

describe('questions', () => {
  it('buildQuestions throws when no poems for color', () => {
    expect(() => buildQuestions({
      poems: samplePoems,
      color: '紫',
      questionLimit: 5,
      orderMode: 'normal',
      random: fixedRandom,
    })).toThrow(/指定の色データが見つかりません/);
  });

  it('buildQuestions throws when poems is not an array', () => {
    expect(() => buildQuestions({
      poems: null,
      color: '青',
      questionLimit: 5,
      orderMode: 'normal',
      random: fixedRandom,
    })).toThrow(/指定の色データが見つかりません/);
  });

  it('buildQuestions returns limited questions with 4 options', () => {
    const questions = buildQuestions({
      poems: samplePoems,
      color: '青',
      questionLimit: 3,
      orderMode: 'normal',
      random: fixedRandom,
    });

    expect(questions).toHaveLength(3);
    questions.forEach(question => {
      const correctOption = question.options.find(option => option.isCorrect);
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options.map(option => option.text)).size).toBe(4);
      expect(correctOption).toBeTruthy();
      expect(correctOption.text).toBe(question.correctShimo);
    });
  });

  it('buildQuestions uses kami options in reverse mode', () => {
    const questions = buildQuestions({
      poems: samplePoems,
      color: '青',
      questionLimit: 1,
      orderMode: 'reverse',
      random: fixedRandom,
    });
    const question = questions[0];
    const correctOption = question.options.find(option => option.isCorrect);
    expect(correctOption.text).toBe(question.kamiNoKu);
  });

  it('buildQuestions falls back to long kimariji or default', () => {
    const poems = [
      {
        color: '青',
        kimarijiShort: '',
        kimarijiLong: 'ながい',
        shimoNoKu: '下1',
        shimoReading: 'しも1',
        kamiNoKu: '上1',
        kamiReading: 'かみ1',
        hint: 'ひ1',
      },
      {
        color: '青',
        kimarijiShort: '',
        kimarijiLong: '',
        shimoNoKu: '下2',
        shimoReading: 'しも2',
        kamiNoKu: '上2',
        kamiReading: 'かみ2',
        hint: 'ひ2',
      },
      {
        color: '青',
        kimarijiShort: 'あ',
        kimarijiLong: '',
        shimoNoKu: '下3',
        shimoReading: 'しも3',
        kamiNoKu: '上3',
        kamiReading: 'かみ3',
        hint: 'ひ3',
      },
      {
        color: '青',
        kimarijiShort: 'い',
        kimarijiLong: '',
        shimoNoKu: '下4',
        shimoReading: 'しも4',
        kamiNoKu: '上4',
        kamiReading: 'かみ4',
        hint: 'ひ4',
      },
    ];
    const questions = buildQuestions({
      poems,
      color: '青',
      questionLimit: 4,
      orderMode: 'normal',
      random: fixedRandom,
    });
    const kimarijis = questions.map(question => question.kimariji);
    expect(kimarijis).toContain('ながい');
    expect(kimarijis).toContain('決まり字なし');
  });

  it('buildWeakQuestions throws when weak stats are missing', () => {
    expect(() => buildWeakQuestions({
      poems: samplePoems,
      color: '青',
      orderMode: 'normal',
      kimarijiStats: [],
      random: fixedRandom,
    })).toThrow(/苦手な決まり字のデータがありません/);
  });

  it('buildWeakQuestions throws when stats is not an array', () => {
    expect(() => buildWeakQuestions({
      poems: samplePoems,
      color: '青',
      orderMode: 'normal',
      kimarijiStats: null,
      random: fixedRandom,
    })).toThrow(/苦手な決まり字のデータがありません/);
  });

  it('buildWeakQuestions throws when poems is not an array', () => {
    expect(() => buildWeakQuestions({
      poems: null,
      color: '青',
      orderMode: 'normal',
      kimarijiStats: [
        { kimariji: 'あ', total: 2 },
      ],
      random: fixedRandom,
    })).toThrow(/対応する歌が見つかりません/);
  });

  it('buildWeakQuestions returns matching weak poems', () => {
    const questions = buildWeakQuestions({
      poems: samplePoems,
      color: '青',
      orderMode: 'normal',
      kimarijiStats: [
        { kimariji: 'い', total: 3 },
        { kimariji: 'う', total: 2 },
      ],
      random: fixedRandom,
    });

    expect(questions).toHaveLength(2);
    const kimarijis = questions.map(question => question.kimariji);
    expect(kimarijis).toEqual(['い', 'う']);
  });

  it('buildWeakQuestions throws when kimariji not found in poems', () => {
    expect(() => buildWeakQuestions({
      poems: samplePoems,
      color: '青',
      orderMode: 'normal',
      kimarijiStats: [
        { kimariji: 'か', total: 2 },
      ],
      random: fixedRandom,
    })).toThrow(/対応する歌が見つかりません/);
  });

  it('canUseWeak5 checks total count', () => {
    const usable = canUseWeak5([
      { total: 1 },
      { total: 2 },
      { total: 3 },
      { total: 4 },
      { total: 5 },
    ]);
    const notUsable = canUseWeak5([
      { total: 1 },
      { total: 2 },
      { total: 0 },
      { total: 4 },
    ]);
    expect(usable).toBe(true);
    expect(notUsable).toBe(false);
  });

  it('canUseWeak5 returns false for non-array input', () => {
    expect(canUseWeak5(null)).toBe(false);
  });

  it('getIncorrectPoems returns poems from incorrect answers', () => {
    const answers = [
      {
        kimariji: 'あ',
        kamiNoKu: '上1',
        shimoNoKu: '下1',
        isCorrect: true,
      },
      {
        kimariji: 'い',
        kamiNoKu: '上2',
        shimoNoKu: '下2',
        isCorrect: false,
      },
      {
        kimariji: 'う',
        kamiNoKu: '上3',
        shimoNoKu: '下3',
        isCorrect: false,
      },
    ];

    const incorrectPoems = getIncorrectPoems(answers, samplePoems);

    expect(incorrectPoems).toHaveLength(2);
    expect(incorrectPoems[0].kimarijiShort).toBe('い');
    expect(incorrectPoems[1].kimarijiShort).toBe('う');
  });

  it('getIncorrectPoems returns empty array when all correct', () => {
    const answers = [
      {
        kimariji: 'あ',
        kamiNoKu: '上1',
        shimoNoKu: '下1',
        isCorrect: true,
      },
      {
        kimariji: 'い',
        kamiNoKu: '上2',
        shimoNoKu: '下2',
        isCorrect: true,
      },
    ];

    const incorrectPoems = getIncorrectPoems(answers, samplePoems);

    expect(incorrectPoems).toHaveLength(0);
  });

  it('getIncorrectPoems handles missing poems gracefully', () => {
    const answers = [
      {
        kimariji: 'notfound',
        kamiNoKu: 'unknown',
        shimoNoKu: 'unknown',
        isCorrect: false,
      },
    ];

    const incorrectPoems = getIncorrectPoems(answers, samplePoems);

    expect(incorrectPoems).toHaveLength(0);
  });

  it('getIncorrectPoems returns empty array for empty answers', () => {
    const incorrectPoems = getIncorrectPoems([], samplePoems);

    expect(incorrectPoems).toHaveLength(0);
  });

  it('buildQuestionsFromPoems builds questions from specific poems', () => {
    const specificPoems = [
      samplePoems[1], // い
      samplePoems[2], // う
    ];

    const questions = buildQuestionsFromPoems({
      poems: specificPoems,
      allPoems: samplePoems,
      color: '青',
      orderMode: 'normal',
      random: fixedRandom,
    });

    expect(questions).toHaveLength(2);
    expect(questions[0].kimariji).toBe('い');
    expect(questions[1].kimariji).toBe('う');
    questions.forEach(question => {
      expect(question.options).toHaveLength(4);
      const correctOption = question.options.find(option => option.isCorrect);
      expect(correctOption).toBeTruthy();
    });
  });

  it('buildQuestionsFromPoems throws when poems is empty', () => {
    expect(() => buildQuestionsFromPoems({
      poems: [],
      allPoems: samplePoems,
      color: '青',
      orderMode: 'normal',
      random: fixedRandom,
    })).toThrow(/指定された歌のデータがありません/);
  });

  it('buildQuestionsFromPoems uses allPoems for options pool', () => {
    const specificPoems = [samplePoems[0]];

    const questions = buildQuestionsFromPoems({
      poems: specificPoems,
      allPoems: samplePoems,
      color: '青',
      orderMode: 'normal',
      random: fixedRandom,
    });

    expect(questions).toHaveLength(1);
    const question = questions[0];
    expect(question.options).toHaveLength(4);
    // 選択肢は allPoems の中の同じ色の歌から生成される
    const allOptionTexts = question.options.map(opt => opt.text);
    expect(new Set(allOptionTexts).size).toBe(4);
  });
});
