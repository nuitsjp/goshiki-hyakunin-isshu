import { COLORS } from './config.js';

const normalizeHistory = (history) => (Array.isArray(history) ? history : []);

export function calculateColorStats(color, history, orderMode = null) {
  const normalized = normalizeHistory(history);
  let colorSessions = normalized.filter(s => s.color === color);

  if (orderMode !== null) {
    colorSessions = colorSessions.filter(s => s.orderMode === orderMode);
  }

  if (colorSessions.length === 0) {
    return {
      color,
      totalQuizzes: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      totalWrong: 0,
      totalPass: 0,
      accuracyRate: 0,
      hintUsageRate: 0,
      lastPlayed: null
    };
  }

  const totalQuizzes = colorSessions.length;
  const totalQuestions = colorSessions.reduce((sum, s) => sum + s.questionCount, 0);
  const totalCorrect = colorSessions.reduce((sum, s) => sum + s.correctCount, 0);
  const totalWrong = colorSessions.reduce((sum, s) => sum + s.wrongCount, 0);
  const totalPass = colorSessions.reduce((sum, s) => sum + s.passCount, 0);
  const accuracyRate = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;

  let totalHintUsed = 0;
  colorSessions.forEach(session => {
    if (session.answers && Array.isArray(session.answers)) {
      totalHintUsed += session.answers.filter(a => a.isCorrect && a.usedKami).length;
    }
  });
  const hintUsageRate = totalCorrect > 0
    ? Math.round((totalHintUsed / totalCorrect) * 100)
    : 0;

  const lastSession = colorSessions.reduce((latest, current) =>
    current.timestamp > latest.timestamp ? current : latest
  );

  return {
    color,
    totalQuizzes,
    totalQuestions,
    totalCorrect,
    totalWrong,
    totalPass,
    accuracyRate,
    hintUsageRate,
    lastPlayed: lastSession.date
  };
}

export function calculateAllColorStats(history, orderMode = null) {
  const normalized = normalizeHistory(history);
  return COLORS.map(color => calculateColorStats(color, normalized, orderMode));
}

export function calculateKimarijiPerformance(color, poems, history) {
  const normalized = normalizeHistory(history);
  const colorSessions = normalized.filter(s => s.color === color);
  const allPoems = Array.isArray(poems) ? poems : [];

  const colorPoems = allPoems.filter(poem => poem.color === color);
  const kimarijiMap = new Map();

  colorPoems.forEach(poem => {
    const kimariji = poem.kimarijiShort || poem.kimarijiLong || '決まり字なし';
    if (kimariji && !kimarijiMap.has(kimariji)) {
      kimarijiMap.set(kimariji, { correct: 0, total: 0 });
    }
  });

  colorSessions.forEach(session => {
    if (session.answers && Array.isArray(session.answers)) {
      session.answers.forEach(answer => {
        if (answer.kimariji && kimarijiMap.has(answer.kimariji)) {
          const stats = kimarijiMap.get(answer.kimariji);
          stats.total++;
          if (answer.isCorrect) {
            stats.correct++;
          }
        }
      });
    }
  });

  const kimarijiStats = Array.from(kimarijiMap.entries()).map(([kimariji, stats]) => ({
    kimariji,
    correct: stats.correct,
    total: stats.total,
    rate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
  }));

  kimarijiStats.sort((a, b) => {
    if (a.total === 0 && b.total === 0) return 0;
    if (a.total === 0) return 1;
    if (b.total === 0) return -1;
    return a.rate - b.rate;
  });

  return kimarijiStats;
}

export function calculateRecentTrend(color, history, sessionCount = 5) {
  const normalized = normalizeHistory(history);
  const colorSessions = normalized.filter(s => s.color === color);

  if (colorSessions.length === 0) {
    return {
      recentAvg: 0,
      overallAvg: 0,
      diff: 0,
      trend: 'no-data',
      recentCount: 0
    };
  }

  const overallStats = calculateColorStats(color, normalized);
  const overallAvg = overallStats.accuracyRate;

  const recentSessions = colorSessions.slice(-sessionCount);
  const recentCount = recentSessions.length;

  if (recentCount === 0) {
    return {
      recentAvg: 0,
      overallAvg,
      diff: 0,
      trend: 'no-data',
      recentCount: 0
    };
  }

  const recentTotal = recentSessions.reduce((sum, s) => sum + s.questionCount, 0);
  const recentCorrect = recentSessions.reduce((sum, s) => sum + s.correctCount, 0);
  const recentAvg = recentTotal > 0 ? Math.round((recentCorrect / recentTotal) * 100) : 0;

  const diff = recentAvg - overallAvg;

  let trend = 'stable';
  if (diff >= 5) {
    trend = 'improving';
  } else if (diff <= -5) {
    trend = 'declining';
  }

  return {
    recentAvg,
    overallAvg,
    diff,
    trend,
    recentCount
  };
}

export function calculateDetailedColorStats(color, poems, history) {
  const normalized = normalizeHistory(history);
  const colorSessions = normalized.filter(s => s.color === color);
  const sessions = [...colorSessions].sort((a, b) => b.timestamp - a.timestamp);
  const kimarijiStats = calculateKimarijiPerformance(color, poems, normalized);
  const trendData = calculateRecentTrend(color, normalized);

  return {
    kimarijiStats,
    trendData,
    sessions
  };
}

export function calculateOverallStats(history, orderMode = null) {
  const normalized = normalizeHistory(history);
  let filtered = normalized;

  if (orderMode !== null) {
    filtered = normalized.filter(s => s.orderMode === orderMode);
  }

  if (filtered.length === 0) {
    return {
      totalQuizzes: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      totalWrong: 0,
      accuracyRate: 0,
      hintUsageRate: 0
    };
  }

  const totalQuizzes = filtered.length;
  const totalQuestions = filtered.reduce((sum, s) => sum + s.questionCount, 0);
  const totalCorrect = filtered.reduce((sum, s) => sum + s.correctCount, 0);
  const totalWrong = filtered.reduce((sum, s) => sum + s.wrongCount, 0);
  const accuracyRate = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;

  let totalHintUsed = 0;
  filtered.forEach(session => {
    if (session.answers && Array.isArray(session.answers)) {
      totalHintUsed += session.answers.filter(a => a.isCorrect && a.usedKami).length;
    }
  });
  const hintUsageRate = totalCorrect > 0
    ? Math.round((totalHintUsed / totalCorrect) * 100)
    : 0;

  return {
    totalQuizzes,
    totalQuestions,
    totalCorrect,
    totalWrong,
    accuracyRate,
    hintUsageRate
  };
}

export function formatDateJapanese(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}
