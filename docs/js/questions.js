const shuffle = (array, random = Math.random) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const generateOptions = (correctPoem, pool, orderMode, random = Math.random) => {
  const wrong = shuffle(pool.filter(p => p !== correctPoem), random).slice(0, 3);
  const isReverse = orderMode === 'reverse';
  const options = [
    {
      text: isReverse ? correctPoem.kamiNoKu : correctPoem.shimoNoKu,
      textReading: isReverse ? correctPoem.kamiReading : correctPoem.shimoReading,
      isCorrect: true
    },
    ...wrong.map(poem => ({
      text: isReverse ? poem.kamiNoKu : poem.shimoNoKu,
      textReading: isReverse ? poem.kamiReading : poem.shimoReading,
      isCorrect: false
    })),
  ];
  return shuffle(options, random);
};

export function buildQuestions({
  poems,
  color,
  questionLimit,
  orderMode,
  random = Math.random
}) {
  const allPoems = Array.isArray(poems) ? poems : [];
  const poemsByColor = allPoems.filter(poem => poem.color === color);
  if (poemsByColor.length === 0) {
    throw new Error(`指定の色データが見つかりません: ${color}`);
  }
  const maxCount = Math.max(1, Math.min(questionLimit, poemsByColor.length));
  const selected = shuffle(poemsByColor, random).slice(0, maxCount);
  return selected.map(poem => ({
    kimariji: poem.kimarijiShort || poem.kimarijiLong || '決まり字なし',
    correctShimo: poem.shimoNoKu,
    correctShimoReading: poem.shimoReading,
    kamiNoKu: poem.kamiNoKu,
    kamiReading: poem.kamiReading,
    hint: poem.hint,
    options: generateOptions(poem, poemsByColor, orderMode, random),
  }));
}

export function buildWeakQuestions({
  poems,
  color,
  orderMode,
  kimarijiStats,
  random = Math.random
}) {
  const stats = Array.isArray(kimarijiStats) ? kimarijiStats : [];
  const weakKimarijis = stats.filter(k => k.total > 0).slice(0, 5);

  if (weakKimarijis.length === 0) {
    throw new Error('苦手な決まり字のデータがありません。');
  }

  const allPoems = Array.isArray(poems) ? poems : [];
  const poemsByColor = allPoems.filter(poem => poem.color === color);
  const selectedPoems = [];

  weakKimarijis.forEach(kimarijiStat => {
    const poem = poemsByColor.find(p => {
      const poemKimariji = p.kimarijiShort || p.kimarijiLong || '決まり字なし';
      return poemKimariji === kimarijiStat.kimariji;
    });
    if (poem) {
      selectedPoems.push(poem);
    }
  });

  if (selectedPoems.length === 0) {
    throw new Error('対応する歌が見つかりませんでした。');
  }

  return selectedPoems.map(poem => ({
    kimariji: poem.kimarijiShort || poem.kimarijiLong || '決まり字なし',
    correctShimo: poem.shimoNoKu,
    correctShimoReading: poem.shimoReading,
    kamiNoKu: poem.kamiNoKu,
    kamiReading: poem.kamiReading,
    hint: poem.hint,
    options: generateOptions(poem, poemsByColor, orderMode, random),
  }));
}

export function canUseWeak5(kimarijiStats) {
  const stats = Array.isArray(kimarijiStats) ? kimarijiStats : [];
  return stats.filter(k => k.total > 0).length >= 5;
}

export function getIncorrectPoems(answers, poems) {
  if (!Array.isArray(answers) || answers.length === 0) {
    return [];
  }

  const allPoems = Array.isArray(poems) ? poems : [];
  const incorrectAnswers = answers.filter(answer => answer.isCorrect === false);

  const incorrectPoems = incorrectAnswers
    .map(answer => {
      return allPoems.find(poem => {
        const poemKimariji = poem.kimarijiShort || poem.kimarijiLong || '決まり字なし';
        return poemKimariji === answer.kimariji &&
               poem.kamiNoKu === answer.kamiNoKu &&
               poem.shimoNoKu === answer.shimoNoKu;
      });
    })
    .filter(poem => poem !== undefined);

  return incorrectPoems;
}

export function buildQuestionsFromPoems({
  poems,
  allPoems,
  color,
  orderMode,
  random = Math.random
}) {
  const selectedPoems = Array.isArray(poems) ? poems : [];
  if (selectedPoems.length === 0) {
    throw new Error('指定された歌のデータがありません。');
  }

  const allPoemsArray = Array.isArray(allPoems) ? allPoems : [];
  const poemsByColor = allPoemsArray.filter(poem => poem.color === color);

  return selectedPoems.map(poem => ({
    kimariji: poem.kimarijiShort || poem.kimarijiLong || '決まり字なし',
    correctShimo: poem.shimoNoKu,
    correctShimoReading: poem.shimoReading,
    kamiNoKu: poem.kamiNoKu,
    kamiReading: poem.kamiReading,
    hint: poem.hint,
    options: generateOptions(poem, poemsByColor, orderMode, random),
  }));
}
