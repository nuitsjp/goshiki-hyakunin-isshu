export const quizState = {
  allPoems: [],
  selectedColor: '',
  currentQuestions: [],
  currentIndex: 0,
  correctCount: 0,
  showKami: false,
  answers: [],
  questionLimit: 20,
  isAnswered: false,
  hintType: 'shoku',
  displayMode: 'kana',
  orderMode: 'normal',
  sessionStartTime: 0,
  questionStartTime: 0,
  sessionEndTime: null,
  measureTime: true,
};

export const statsState = {
  selectedColor: null, // null=全体表示, 色名=その色の詳細表示中
  filterMode: 'normal', // 'normal', 'reverse'
};
