(() => {
  const APP_VERSION = 'v0.0.21';
  const CSV_URL = new URL('data/hyakunin_isshu_with_ruby.csv', window.location.href).toString();
  const CSV_FALLBACK_URL = 'https://nuitsjp.github.io/goshiki-hyakunin-isshu/data/hyakunin_isshu_with_ruby.csv';
  const colorAccentMap = {
    '青': 'var(--color-blue)',
    'ピンク': 'var(--color-pink)',
    '黄': 'var(--color-yellow)',
    '緑': 'var(--color-green)',
    'オレンジ': 'var(--color-orange)',
  };
  const colorTextMap = {
    '黄': '#3b3b00',
  };
  const STORAGE_KEYS = {
    HISTORY: 'goshiki_quiz_history',
    VERSION: 'goshiki_stats_version',
    DISPLAY_MODE: 'goshiki_display_mode',
    ORDER_MODE: 'goshiki_order_mode'
  };
  const STATS_VERSION = '1.0.0';
  const MAX_HISTORY_ENTRIES = 1000;
  const HISTORY_RETENTION_DAYS = 365;

  const screens = {
    start: document.getElementById('start-screen'),
    quiz: document.getElementById('quiz-screen'),
    result: document.getElementById('result-screen'),
    stats: document.getElementById('stats-screen'),
  };

  const elements = {
    version: document.getElementById('app-version'),
    questionCount: document.getElementById('question-count'),
    hintType: document.getElementById('hint-type'),
    displayMode: document.getElementById('display-mode'),
    orderNormal: document.getElementById('order-normal'),
    orderReverse: document.getElementById('order-reverse'),
    colorButtons: document.querySelectorAll('.color-button'),
    progressText: document.getElementById('progress-text'),
    progressBar: document.getElementById('progress-bar'),
    kimariji: document.getElementById('kimariji'),
    mainDisplayLabel: document.getElementById('main-display-label'),
    toggleKimariji: document.getElementById('toggle-kimariji'),
    options: document.querySelectorAll('#options-container .option-button'),
    feedback: document.getElementById('feedback'),
    autoAdvanceProgress: document.getElementById('auto-advance-progress'),
    autoAdvanceBar: document.querySelector('.auto-advance-bar'),
    selectedColorLabel: document.getElementById('selected-color-label'),
    cancelQuiz: document.getElementById('cancel-quiz'),
    nextQuestion: document.getElementById('next-question'),
    resultCount: document.getElementById('result-count'),
    resultRate: document.getElementById('result-rate'),
    resultComment: document.getElementById('result-comment'),
    resultList: document.getElementById('result-list'),
    retrySame: document.getElementById('retry-same'),
    chooseColor: document.getElementById('choose-color'),
    giveUp: document.getElementById('give-up-button'),
    viewStats: document.getElementById('view-stats'),
    viewStatsFromResult: document.getElementById('view-stats-from-result'),
    closeStats: document.getElementById('close-stats'),
    clearHistory: document.getElementById('clear-history'),
    totalQuizzes: document.getElementById('total-quizzes'),
    totalQuestions: document.getElementById('total-questions'),
    totalCorrect: document.getElementById('total-correct'),
    overallAccuracy: document.getElementById('overall-accuracy'),
    overallHintUsage: document.getElementById('overall-hint-usage'),
    colorStatsBody: document.getElementById('color-stats-tbody'),
    recentActivity: document.getElementById('recent-activity'),
  };

  const quizState = {
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
  };

  const statsState = {
    selectedColor: null, // null=全体表示, 色名=その色の詳細表示中
  };

  let advanceTimerId = null;

  // ==================== Storage Management Functions ====================

  function saveQuizSession(sessionData) {
    try {
      let history = loadQuizHistory();
      history.push(sessionData);
      history = cleanOldHistory(history);
      history = enforceHistoryLimit(history);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
      localStorage.setItem(STORAGE_KEYS.VERSION, STATS_VERSION);
      return true;
    } catch (e) {
      console.error('Failed to save quiz session:', e);
      if (e.name === 'QuotaExceededError') {
        try {
          let history = loadQuizHistory();
          history = history.slice(Math.floor(history.length * 0.2));
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
          history.push(sessionData);
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
          return true;
        } catch (retryError) {
          console.error('Failed even after cleanup:', retryError);
          return false;
        }
      }
      return false;
    }
  }

  function loadQuizHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load quiz history:', e);
      return [];
    }
  }

  function cleanOldHistory(history) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - HISTORY_RETENTION_DAYS);
    const cutoffTime = cutoffDate.getTime();
    return history.filter(session => session.timestamp >= cutoffTime);
  }

  function enforceHistoryLimit(history) {
    if (history.length <= MAX_HISTORY_ENTRIES) return history;
    return history.slice(history.length - MAX_HISTORY_ENTRIES);
  }

  function clearAllHistory() {
    if (confirm('本当にすべての統計データを削除しますか？この操作は取り消せません。')) {
      try {
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
        localStorage.removeItem(STORAGE_KEYS.VERSION);
        alert('統計データを削除しました。');
        return true;
      } catch (e) {
        console.error('Failed to clear history:', e);
        alert('データの削除に失敗しました。');
        return false;
      }
    }
    return false;
  }

  function checkLocalStorageAvailable() {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('LocalStorage not available:', e);
      return false;
    }
  }

  // ==================== Statistics Calculation Functions ====================

  function calculateColorStats(color) {
    const history = loadQuizHistory();
    const colorSessions = history.filter(s => s.color === color);

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

  function calculateAllColorStats() {
    const colors = ['青', 'ピンク', '黄', '緑', 'オレンジ'];
    return colors.map(color => calculateColorStats(color));
  }

  // ==================== Detailed Color Stats Functions ====================

  function calculateKimarijiPerformance(color) {
    const history = loadQuizHistory();
    const colorSessions = history.filter(s => s.color === color);

    // Get all kimariji for this color from allPoems
    const colorPoems = quizState.allPoems.filter(poem => poem.color === color);
    const kimarijiMap = new Map();

    // Initialize kimariji map
    colorPoems.forEach(poem => {
      const kimariji = poem.kimarijiShort || poem.kimarijiLong || '決まり字なし';
      if (kimariji && !kimarijiMap.has(kimariji)) {
        kimarijiMap.set(kimariji, { correct: 0, total: 0 });
      }
    });

    // Aggregate performance data from all sessions
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

    // Convert map to array and calculate rates
    const kimarijiStats = Array.from(kimarijiMap.entries()).map(([kimariji, stats]) => ({
      kimariji,
      correct: stats.correct,
      total: stats.total,
      rate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    }));

    // Sort by rate (ascending - weak ones first)
    kimarijiStats.sort((a, b) => {
      if (a.total === 0 && b.total === 0) return 0;
      if (a.total === 0) return 1; // Push never-attempted to end
      if (b.total === 0) return -1;
      return a.rate - b.rate; // Lower rate first
    });

    return kimarijiStats;
  }

  function calculateRecentTrend(color, sessionCount = 5) {
    const history = loadQuizHistory();
    const colorSessions = history.filter(s => s.color === color);

    if (colorSessions.length === 0) {
      return {
        recentAvg: 0,
        overallAvg: 0,
        diff: 0,
        trend: 'no-data',
        recentCount: 0
      };
    }

    // Calculate overall average for this color
    const overallStats = calculateColorStats(color);
    const overallAvg = overallStats.accuracyRate;

    // Get recent sessions
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

    // Calculate recent average
    const recentTotal = recentSessions.reduce((sum, s) => sum + s.questionCount, 0);
    const recentCorrect = recentSessions.reduce((sum, s) => sum + s.correctCount, 0);
    const recentAvg = recentTotal > 0 ? Math.round((recentCorrect / recentTotal) * 100) : 0;

    const diff = recentAvg - overallAvg;

    // Determine trend
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

  function calculateDetailedColorStats(color) {
    const history = loadQuizHistory();
    const colorSessions = history.filter(s => s.color === color);

    // Sort sessions by timestamp (newest first)
    const sessions = colorSessions.sort((a, b) => b.timestamp - a.timestamp);

    const kimarijiStats = calculateKimarijiPerformance(color);
    const trendData = calculateRecentTrend(color);

    return {
      kimarijiStats,
      trendData,
      sessions
    };
  }

  function calculateOverallStats() {
    const history = loadQuizHistory();

    if (history.length === 0) {
      return {
        totalQuizzes: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        totalWrong: 0,
        accuracyRate: 0,
        hintUsageRate: 0
      };
    }

    const totalQuizzes = history.length;
    const totalQuestions = history.reduce((sum, s) => sum + s.questionCount, 0);
    const totalCorrect = history.reduce((sum, s) => sum + s.correctCount, 0);
    const totalWrong = history.reduce((sum, s) => sum + s.wrongCount, 0);
    const accuracyRate = totalQuestions > 0
      ? Math.round((totalCorrect / totalQuestions) * 100)
      : 0;

    let totalHintUsed = 0;
    history.forEach(session => {
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

  function formatDateJapanese(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  }

  // ==================== UI Rendering Functions ====================

  function renderColorSummaries() {
    const allStats = calculateAllColorStats();

    allStats.forEach(stats => {
      const statsElement = document.querySelector(`[data-color-stats="${stats.color}"]`);
      if (!statsElement) return;

      if (stats.totalQuizzes === 0) {
        statsElement.textContent = stats.color;
      } else {
        statsElement.innerHTML = `${stats.color}<span class="color-btn-stats">（${stats.totalQuizzes}回／正答率${stats.accuracyRate}%）</span>`;
      }
    });
  }

  function renderStatsScreen() {
    const overall = calculateOverallStats();
    const colorStats = calculateAllColorStats();
    const history = loadQuizHistory();

    if (elements.totalQuizzes) elements.totalQuizzes.textContent = overall.totalQuizzes;
    if (elements.totalQuestions) elements.totalQuestions.textContent = overall.totalQuestions;
    if (elements.totalCorrect) elements.totalCorrect.textContent = overall.totalCorrect;
    if (elements.overallAccuracy) elements.overallAccuracy.textContent = `${overall.accuracyRate}%`;
    if (elements.overallHintUsage) elements.overallHintUsage.textContent = `${overall.hintUsageRate}%`;

    const tbody = elements.colorStatsBody;
    if (tbody) {
      tbody.innerHTML = colorStats.map(stats => {
        const colorClass = {
          '青': 'color-blue',
          'ピンク': 'color-pink',
          '黄': 'color-yellow',
          '緑': 'color-green',
          'オレンジ': 'color-orange'
        }[stats.color] || '';

        return `
          <tr data-color="${stats.color}" class="${statsState.selectedColor === stats.color ? 'selected' : ''}">
            <td>
              <span class="color-badge-mini ${colorClass}"></span>
              ${stats.color}
            </td>
            <td>${stats.totalQuizzes}</td>
            <td>${stats.totalQuestions}</td>
            <td>${stats.totalCorrect}</td>
            <td>${stats.accuracyRate}%</td>
            <td>${stats.hintUsageRate}%</td>
            <td>${formatDateJapanese(stats.lastPlayed)}</td>
          </tr>
        `;
      }).join('');

      // Add click event listeners to table rows
      tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', () => {
          const color = row.getAttribute('data-color');
          if (!color) return;

          // Toggle selection
          if (statsState.selectedColor === color) {
            // Deselect
            clearDetailedView();
          } else {
            // Select new color
            statsState.selectedColor = color;

            // Update selected class
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');

            // Render detailed stats
            renderDetailedColorStats(color);
          }
        });
      });
    }

    const recentActivity = elements.recentActivity;
    if (recentActivity) {
      const recent = history.slice(-10).reverse();

      if (recent.length === 0) {
        recentActivity.innerHTML = '<p class="text-muted text-center">まだプレイ履歴がありません</p>';
      } else {
        recentActivity.innerHTML = recent.map(session => `
          <div class="activity-item">
            <div class="activity-info">
              <div class="fw-semibold">${session.color}の歌</div>
              <div class="activity-date">${formatDateJapanese(session.date)}</div>
            </div>
            <div class="activity-result">
              ${session.correctCount}/${session.questionCount} (${session.accuracyRate}%)
            </div>
          </div>
        `).join('');
      }
    }

    showScreen('stats');
  }

  // ==================== Detailed Color Stats Rendering Functions ====================

  function clearDetailedView() {
    statsState.selectedColor = null;
    const container = document.getElementById('color-detail-container');
    if (container) {
      container.innerHTML = '';
    }
    // Remove selected class from all table rows
    const tbody = elements.colorStatsBody;
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected'));
    }
  }

  function renderSessionDetail(sessionId) {
    const session = loadQuizHistory().find(s => s.sessionId === sessionId);
    if (!session || !session.answers) return;

    const sessionElement = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!sessionElement) return;

    const isExpanded = sessionElement.classList.contains('expanded');

    if (isExpanded) {
      // Collapse
      sessionElement.classList.remove('expanded');
      const answersDiv = sessionElement.querySelector('.session-answers');
      if (answersDiv) {
        answersDiv.style.display = 'none';
      }
    } else {
      // Expand
      sessionElement.classList.add('expanded');
      let answersDiv = sessionElement.querySelector('.session-answers');

      if (!answersDiv) {
        // Create answers div if it doesn't exist
        answersDiv = document.createElement('div');
        answersDiv.className = 'session-answers';

        const answersHtml = session.answers.map(answer => {
          let answerClass = 'answer-wrong';
          let symbol = '×';
          if (answer.isCorrect) {
            if (answer.usedKami) {
              answerClass = 'answer-assist';
              symbol = '△';
            } else {
              answerClass = 'answer-correct';
              symbol = '○';
            }
          }
          return `<span class="answer-item ${answerClass}">${answer.kimariji} ${symbol}</span>`;
        }).join('');

        answersDiv.innerHTML = answersHtml;
        sessionElement.appendChild(answersDiv);
      }

      answersDiv.style.display = 'block';
    }
  }

  function renderDetailedColorStats(color) {
    const detailedStats = calculateDetailedColorStats(color);
    const container = document.getElementById('color-detail-container');

    if (!container) return;

    // Build HTML
    const colorClass = {
      '青': 'color-blue',
      'ピンク': 'color-pink',
      '黄': 'color-yellow',
      '緑': 'color-green',
      'オレンジ': 'color-orange'
    }[color] || '';

    let html = `
      <div class="color-detail-panel">
        <div class="detail-header">
          <h4><span class="color-badge-mini ${colorClass}"></span> 【${color}】の詳細統計</h4>
          <button class="btn btn-outline-secondary btn-sm" id="close-detail-panel">閉じる</button>
        </div>
    `;

    // Kimariji Performance Section
    html += `
      <div class="detail-section">
        <h5>苦手な決まり字</h5>
    `;

    if (detailedStats.kimarijiStats.length === 0) {
      html += `<p class="text-muted">まだプレイ履歴がありません</p>`;
    } else {
      // Show only kimariji with attempts
      const attemptedKimariji = detailedStats.kimarijiStats.filter(k => k.total > 0);

      if (attemptedKimariji.length === 0) {
        html += `<p class="text-muted">まだ出題されていない決まり字です</p>`;
      } else {
        html += `<div class="kimariji-performance-list">`;
        attemptedKimariji.slice(0, 10).forEach(k => {
          const isWeak = k.rate < 60;
          html += `
            <div class="kimariji-item ${isWeak ? 'weak' : ''}">
              <div class="kimariji-name">${k.kimariji}</div>
              <div class="kimariji-stats">${k.correct}/${k.total}</div>
              <div class="kimariji-rate">${k.rate}%</div>
            </div>
          `;
        });
        html += `</div>`;
      }
    }

    html += `</div>`;

    // Recent Trend Section
    html += `
      <div class="detail-section">
        <h5>最近の傾向</h5>
    `;

    if (detailedStats.trendData.recentCount === 0) {
      html += `<p class="text-muted">最近のプレイ履歴がありません</p>`;
    } else {
      const trendText = {
        'improving': '改善傾向',
        'stable': '安定',
        'declining': '要注意',
        'no-data': 'データ不足'
      }[detailedStats.trendData.trend] || '不明';

      const diffText = detailedStats.trendData.diff >= 0
        ? `+${detailedStats.trendData.diff}%`
        : `${detailedStats.trendData.diff}%`;

      html += `
        <div class="trend-info">
          <p>最近${detailedStats.trendData.recentCount}回の平均正答率: <strong>${detailedStats.trendData.recentAvg}%</strong></p>
          <p>全体平均: ${detailedStats.trendData.overallAvg}% （${diffText}）</p>
          <p>傾向: <strong>${trendText}</strong></p>
        </div>
      `;
    }

    html += `</div>`;

    // Session History Section
    html += `
      <div class="detail-section">
        <h5>セッション履歴</h5>
    `;

    if (detailedStats.sessions.length === 0) {
      html += `<p class="text-muted">まだプレイ履歴がありません</p>`;
    } else {
      html += `<div class="session-history-list">`;

      detailedStats.sessions.forEach(session => {
        const hintTypeText = session.hintType === 'shoku' ? '初句' : '上の句';
        const displayModeText = session.displayMode === 'kana' ? 'よみがな' : '漢字';
        const orderModeText = session.orderMode === 'normal' ? '上の句→下の句' : '下の句→上の句';

        html += `
          <div class="session-item" data-session-id="${session.sessionId}">
            <div class="session-header">
              <div>
                <div class="fw-semibold">${formatDateJapanese(session.date)} ${new Date(session.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
                <div class="session-meta">${hintTypeText} / ${displayModeText} / ${orderModeText}</div>
              </div>
              <div class="session-result">
                ${session.correctCount}/${session.questionCount} (${session.accuracyRate}%)
              </div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    html += `</div>`;

    html += `</div>`; // Close color-detail-panel

    container.innerHTML = html;

    // Add event listeners
    const closeButton = document.getElementById('close-detail-panel');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        clearDetailedView();
      });
    }

    // Add click listeners to session items
    const sessionItems = container.querySelectorAll('.session-item');
    sessionItems.forEach(item => {
      item.addEventListener('click', () => {
        const sessionId = item.getAttribute('data-session-id');
        if (sessionId) {
          renderSessionDetail(sessionId);
        }
      });
    });

    // Scroll to detail panel
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const escapeHtml = (str = '') =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const toRubyHtml = (text = '') => escapeHtml(text.replace(/\[([^\[\]]+)\]/g, ''));

  const toAriaLabel = (text = '') => text.replace(/\[([^\[\]]+)\]/g, '');

  function showScreen(screen) {
    Object.values(screens).forEach(node => node.classList.add('hidden'));
    if (screens[screen]) {
      screens[screen].classList.remove('hidden');
    }
    if (screen === 'start') {
      updateWeak5Option(null);
    }
  }

  function setAccentColor(color) {
    const accent = colorAccentMap[color] || 'var(--color-blue)';
    const textColor = colorTextMap[color] || '#fff';
    document.documentElement.style.setProperty('--current-accent', accent);
    elements.progressBar.style.backgroundColor = accent;
    elements.selectedColorLabel.style.backgroundColor = accent;
    elements.selectedColorLabel.style.color = textColor;
  }

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function generateOptions(correctPoem, pool) {
    const wrong = shuffle(pool.filter(p => p !== correctPoem)).slice(0, 3);
    const isReverse = quizState.orderMode === 'reverse';
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
    return shuffle(options);
  }

  function buildQuestions(color) {
    const poemsByColor = quizState.allPoems.filter(poem => poem.color === color);
    if (poemsByColor.length === 0) {
      throw new Error(`指定の色データが見つかりません: ${color}`);
    }
    const maxCount = Math.max(1, Math.min(quizState.questionLimit, poemsByColor.length));
    const selected = shuffle(poemsByColor).slice(0, maxCount);
    return selected.map(poem => ({
      kimariji: poem.kimarijiShort || poem.kimarijiLong || '決まり字なし',
      correctShimo: poem.shimoNoKu,
      correctShimoReading: poem.shimoReading,
      kamiNoKu: poem.kamiNoKu,
      kamiReading: poem.kamiReading,
      hint: poem.hint,
      options: generateOptions(poem, poemsByColor),
    }));
  }

  function buildWeakQuestions(color) {
    const kimarijiPerf = calculateKimarijiPerformance(color);
    const weakKimarijis = kimarijiPerf.filter(k => k.total > 0).slice(0, 5);

    if (weakKimarijis.length === 0) {
      throw new Error('苦手な決まり字のデータがありません。');
    }

    const poemsByColor = quizState.allPoems.filter(poem => poem.color === color);
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
      options: generateOptions(poem, poemsByColor),
    }));
  }

  function canUseWeak5(color) {
    const kimarijiPerf = calculateKimarijiPerformance(color);
    return kimarijiPerf.filter(k => k.total > 0).length >= 5;
  }

  function updateWeak5Option(color) {
    if (!elements.questionCount) return;

    const weak5Option = elements.questionCount.querySelector('option[value="weak5"]');
    if (!weak5Option) return;

    if (color && canUseWeak5(color)) {
      weak5Option.disabled = false;
    } else {
      weak5Option.disabled = true;
      if (elements.questionCount.value === 'weak5') {
        elements.questionCount.value = '20';
        quizState.questionLimit = 20;
      }
    }
  }

  function resetOptionButtons() {
    elements.options.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('btn-success', 'btn-danger', 'active');
      btn.classList.add('btn-outline-secondary');
    });
    if (elements.giveUp) {
      elements.giveUp.disabled = false;
    }
  }

  function clearAdvanceTimer() {
    if (advanceTimerId) {
      clearTimeout(advanceTimerId);
      advanceTimerId = null;
    }
  }

  function hideAutoAdvanceProgress() {
    if (elements.autoAdvanceProgress) {
      elements.autoAdvanceProgress.classList.add('hidden');
    }
    if (elements.autoAdvanceBar) {
      elements.autoAdvanceBar.classList.remove('animating');
      elements.autoAdvanceBar.style.width = '0%';
    }
  }

  function showAutoAdvanceProgress() {
    if (elements.autoAdvanceProgress) {
      elements.autoAdvanceProgress.classList.remove('hidden');
    }
    if (elements.autoAdvanceBar) {
      // Force reflow to restart animation
      elements.autoAdvanceBar.classList.remove('animating');
      void elements.autoAdvanceBar.offsetWidth;
      elements.autoAdvanceBar.classList.add('animating');
    }
  }

  function resetQuizView() {
    clearAdvanceTimer();
    hideAutoAdvanceProgress();
    quizState.currentQuestions = [];
    quizState.currentIndex = 0;
    quizState.correctCount = 0;
    quizState.answers = [];
    quizState.showKami = false;
    quizState.selectedColor = '';
    elements.feedback.textContent = '';
    elements.feedback.style.color = 'var(--color-text)';
    elements.kimariji.textContent = '---';
    elements.selectedColorLabel.textContent = '';
    elements.selectedColorLabel.style.backgroundColor = '';
    elements.selectedColorLabel.style.color = '';
    elements.progressText.textContent = '問題 0 / 0';
    elements.progressBar.style.width = '0%';
    elements.progressBar.setAttribute('aria-valuenow', '0');
    if (elements.nextQuestion) {
      elements.nextQuestion.disabled = true;
      elements.nextQuestion.textContent = '次へ';
    }
    resetOptionButtons();
    elements.options.forEach(btn => {
      btn.innerHTML = '';
      btn.removeAttribute('data-correct');
      btn.removeAttribute('data-option-index');
    });
    if (elements.toggleKimariji) {
      const hintLabel = quizState.hintType === 'kami' ? '上の句' : '初句';
      elements.toggleKimariji.textContent = `⇆ ${hintLabel}表示`;
      elements.toggleKimariji.setAttribute('aria-pressed', 'false');
      elements.toggleKimariji.disabled = true;
    }
  }

  function updateProgress() {
    const total = quizState.currentQuestions.length || quizState.questionLimit;
    const current = quizState.currentIndex + 1;
    elements.progressText.textContent = `問題 ${current} / ${total}`;
    const ratio = Math.round((current / total) * 100);
    elements.progressBar.style.width = `${ratio}%`;
    elements.progressBar.setAttribute('aria-valuenow', String(ratio));
  }

  function updateNextButton(ready = false) {
    if (!elements.nextQuestion) return;
    const isLast = quizState.currentIndex + 1 >= (quizState.currentQuestions.length || 0);
    elements.nextQuestion.disabled = !ready;
    elements.nextQuestion.textContent = ready
      ? (isLast ? '結果を見る' : '次の問題へ')
      : '次へ';
  }

  function renderKimariji(question) {
    if (!question) return;
    const isReverse = quizState.orderMode === 'reverse';
    const hintLabel = quizState.hintType === 'shoku' ? '初句' : '上の句';

    if (elements.mainDisplayLabel) {
      elements.mainDisplayLabel.textContent = isReverse ? '下の句 (問題)' : '決まり字';
    }

    if (isReverse) {
      // Reverse Mode: Question is Shimo-no-ku. Toggle shows Kami-no-ku.
      if (quizState.showKami) {
        // Show Answer (Kami)
        const text = quizState.displayMode === 'kana'
          ? (question.kamiReading || '')
          : (question.kamiNoKu || '');
        elements.kimariji.innerHTML = toRubyHtml(text);
      } else {
        // Show Question (Shimo)
        const text = quizState.displayMode === 'kana'
          ? (question.correctShimoReading || '')
          : (question.correctShimo || '');
        elements.kimariji.innerHTML = toRubyHtml(text);
      }

      if (elements.toggleKimariji) {
        const showingKami = quizState.showKami;
        elements.toggleKimariji.textContent = showingKami ? '⇆ 下の句表示' : '⇆ 上の句表示';
        elements.toggleKimariji.setAttribute('aria-pressed', showingKami ? 'true' : 'false');
        elements.toggleKimariji.disabled = false;
      }
      return;
    }

    // Normal Mode
    if (quizState.showKami) {
      if (quizState.hintType === 'shoku') {
        elements.kimariji.textContent = question.hint || '';
      } else {
        const text = quizState.displayMode === 'kana'
          ? (question.kamiReading || '')
          : (question.kamiNoKu || '');
        elements.kimariji.innerHTML = toRubyHtml(text);
      }
    } else {
      elements.kimariji.textContent = question.kimariji;
    }
    if (elements.toggleKimariji) {
      const showingKami = quizState.showKami;
      elements.toggleKimariji.textContent = showingKami ? '⇆ 決まり字表示' : `⇆ ${hintLabel}表示`;
      elements.toggleKimariji.setAttribute('aria-pressed', showingKami ? 'true' : 'false');
      elements.toggleKimariji.disabled = false;
    }
  }

  function renderQuestion() {
    const question = quizState.currentQuestions[quizState.currentIndex];
    if (!question) {
      showResults();
      return;
    }

    quizState.isAnswered = false;
    quizState.showKami = false;
    hideAutoAdvanceProgress();
    renderKimariji(question);

    // Update "Give option" instruction
    const instructionDiv = elements.kimariji.nextElementSibling;
    if (instructionDiv && instructionDiv.classList.contains('text-muted')) {
      instructionDiv.textContent = quizState.orderMode === 'reverse'
        ? '上の句を選んでください'
        : '下の句を選んでください';
    }

    resetOptionButtons();
    updateNextButton(false);
    elements.feedback.textContent = '';
    elements.feedback.style.color = 'var(--color-text)';
    question.options.forEach((option, idx) => {
      const btn = elements.options[idx];
      const textToShow = quizState.displayMode === 'kana' ? option.textReading : option.text;
      btn.innerHTML = toRubyHtml(textToShow);
      btn.setAttribute('aria-label', toAriaLabel(textToShow));
      btn.dataset.correct = option.isCorrect ? 'true' : 'false';
      btn.dataset.optionIndex = String(idx);
    });

    updateProgress();
  }

  function handleAnswer(event) {
    const btn = event.currentTarget;
    if (btn.disabled) return;

    const question = quizState.currentQuestions[quizState.currentIndex];
    if (!question) return;

    const isCorrect = btn.dataset.correct === 'true';
    quizState.answers.push({
      kimariji: question.kimariji,
      kamiNoKu: question.kamiNoKu,
      kamiReading: question.kamiReading,
      shimoNoKu: question.correctShimo,
      shimoReading: question.correctShimoReading,
      usedKami: quizState.showKami,
      isCorrect,
      index: quizState.currentIndex,
    });
    quizState.isAnswered = true;
    if (elements.giveUp) elements.giveUp.disabled = true;
    elements.options.forEach(optionBtn => {
      optionBtn.disabled = true;
      const correct = optionBtn.dataset.correct === 'true';
      optionBtn.classList.remove('btn-outline-secondary');
      if (correct) {
        optionBtn.classList.add('btn-success');
      }
    });

    if (isCorrect) {
      quizState.correctCount += 1;
      btn.classList.add('btn-success');
      elements.feedback.textContent = '正解！';
      elements.feedback.style.color = 'var(--color-correct)';

      // 正答時は1秒後に自動遷移
      quizState.showKami = true;
      renderKimariji(question);
      showAutoAdvanceProgress();
      advanceTimerId = setTimeout(() => {
        goToNext();
      }, 1000);
    } else {
      btn.classList.add('btn-danger');
      let correctText = '';
      if (quizState.orderMode === 'reverse') {
        correctText = quizState.displayMode === 'kana' ? question.kamiReading : question.kamiNoKu;
      } else {
        correctText = quizState.displayMode === 'kana' ? question.correctShimoReading : question.correctShimo;
      }
      elements.feedback.innerHTML = `不正解。正解: ${toRubyHtml(correctText)}`;
      elements.feedback.style.color = 'var(--color-incorrect)';

      // 誤答時は「次へ」ボタンを表示
      quizState.showKami = true;
      renderKimariji(question);
      updateNextButton(true);
    }
  }

  function getResultComment(rate) {
    if (rate === 100) return '完璧です！';
    if (rate >= 90) return '素晴らしい！';
    if (rate >= 70) return 'よくできました！';
    if (rate >= 50) return 'もう少しです';
    return '復習しましょう';
  }

  function buildResultItem(ans, idx) {
    const status = ans.isCorrect ? (ans.usedKami ? 'assist' : 'correct') : 'wrong';
    const icon = status === 'correct' ? '○' : status === 'assist' ? '△' : '×';
    const iconClass = status === 'correct'
      ? 'icon-correct'
      : status === 'assist'
        ? 'icon-assist'
        : 'icon-wrong';
    const kamiText = quizState.displayMode === 'kana' ? ans.kamiReading : ans.kamiNoKu;
    const shimoText = quizState.displayMode === 'kana' ? ans.shimoReading : ans.shimoNoKu;
    const poemLine = `${toRubyHtml(kamiText)} ${toRubyHtml(shimoText)}`;
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-header">
        <span class="result-icon ${iconClass}" aria-hidden="true">${icon}</span>
        <div>
          <div class="fw-semibold mb-0">第${idx + 1}問 ${escapeHtml(ans.kimariji)}</div>
          <div class="result-meta">${poemLine}</div>
        </div>
      </div>
    `;
    return item;
  }

  function renderResultList() {
    if (!elements.resultList) return;
    elements.resultList.innerHTML = '';
    if (!quizState.answers.length) return;
    quizState.answers.forEach((ans, idx) => {
      elements.resultList.appendChild(buildResultItem(ans, idx));
    });
  }

  function showResults() {
    const total = quizState.currentQuestions.length || quizState.questionLimit;
    const rate = Math.round((quizState.correctCount / total) * 100);

    const wrongCount = total - quizState.correctCount;
    const passCount = quizState.answers.filter(a => !a.isCorrect && !a.usedKami).length;

    const sessionData = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      color: quizState.selectedColor,
      questionCount: total,
      correctCount: quizState.correctCount,
      wrongCount: wrongCount,
      passCount: passCount,
      accuracyRate: rate,
      hintType: quizState.hintType,
      displayMode: quizState.displayMode,
      orderMode: quizState.orderMode,
      answers: quizState.answers.map(a => ({
        kimariji: a.kimariji,
        isCorrect: a.isCorrect,
        usedKami: a.usedKami
      }))
    };

    saveQuizSession(sessionData);

    elements.resultCount.textContent = `${quizState.correctCount} / ${total} 問正解`;
    elements.resultRate.textContent = `正答率 ${rate}%`;
    elements.resultComment.textContent = getResultComment(rate);
    renderResultList();
    showScreen('result');
  }

  function goToNext() {
    if (!quizState.isAnswered) return;
    quizState.currentIndex += 1;
    if (quizState.currentIndex >= quizState.currentQuestions.length) {
      showResults();
    } else {
      renderQuestion();
    }
  }

  function cancelQuiz() {
    resetQuizView();
    showScreen('start');
  }

  function startQuiz(color) {
    try {
      clearAdvanceTimer();
      quizState.showKami = false;
      quizState.selectedColor = color;

      let isWeak5Mode = false;
      if (elements.questionCount) {
        const selectedValue = elements.questionCount.value;
        if (selectedValue === 'weak5') {
          isWeak5Mode = true;
          quizState.questionLimit = 5;
        } else {
          const val = parseInt(selectedValue, 10);
          quizState.questionLimit = Number.isFinite(val) ? val : 20;
        }
      }

      if (elements.hintType) {
        quizState.hintType = elements.hintType.value || 'shoku';
      }
      if (elements.displayMode) {
        quizState.displayMode = elements.displayMode.value || 'kana';
      }
      // orderMode is already set by click handlers

      if (isWeak5Mode) {
        quizState.currentQuestions = buildWeakQuestions(color);
      } else {
        quizState.currentQuestions = buildQuestions(color);
      }

      quizState.currentIndex = 0;
      quizState.correctCount = 0;
      quizState.answers = [];
      elements.selectedColorLabel.textContent = `${color}の歌`;
      setAccentColor(color);
      showScreen('quiz');
      renderQuestion();
    } catch (error) {
      console.error(error);
      alert(error.message || 'データの読み込みに失敗しました。');
    }
  }

  function handleChooseColor(color) {
    if (!quizState.allPoems.length) {
      alert('データがまだ読み込まれていません。少し待ってから再試行してください。');
      return;
    }
    startQuiz(color);
  }

  function parseCsvText(text) {
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (result.errors && result.errors.length) {
      console.warn('CSV parse errors', result.errors);
    }
    const cleanKey = key => key ? key.replace(/^\uFEFF/, '').trim() : '';
    const pickField = (row, candidates) => {
      for (const name of candidates) {
        const val = row[name] ?? row[cleanKey(name)];
        if (val) return val;
      }
      return '';
    };
    quizState.allPoems = result.data.map(row => ({
      color: pickField(row, ['色', '\uFEFF色']),
      kamiNoKu: pickField(row, ['上の句']),
      shimoNoKu: pickField(row, ['下の句']),
      kamiReading: pickField(row, ['上の句読み']),
      shimoReading: pickField(row, ['下の句読み']),
      kimarijiLong: pickField(row, ['決まり字（競技かるた）']),
      kimarijiShort: pickField(row, ['決まり字（五色百人一首）']),
      hint: pickField(row, ['ヒント']),
    })).filter(p => p.color && p.shimoNoKu && (p.kimarijiLong || p.kimarijiShort));
    if (!quizState.allPoems.length) {
      throw new Error('CSVから有効なデータを読み込めませんでした。');
    }
  }

  function fetchCsv(url) {
    return fetch(url, { cache: 'no-cache' }).then(resp => {
      if (!resp.ok) throw new Error(`CSV取得失敗 (status ${resp.status})`);
      return resp.text();
    });
  }

  function loadCsv() {
    return fetchCsv(CSV_URL)
      .catch(err => {
        console.warn('Primary CSV fetch failed, trying fallback.', err);
        if (window.location.protocol === 'file:' || window.location.hostname === 'localhost') {
          return fetchCsv(CSV_FALLBACK_URL);
        }
        throw err;
      })
      .then(parseCsvText)
      .catch(err => {
        console.error('CSV load error', err);
        alert('CSVの読み込みに失敗しました。HTTPサーバーで開くか、GitHub Pagesを開き直してください。');
      });
  }

  function handleGiveUp() {
    if (quizState.isAnswered) return;
    const question = quizState.currentQuestions[quizState.currentIndex];
    if (!question) return;

    // Treat as incorrect
    quizState.answers.push({
      kimariji: question.kimariji,
      kamiNoKu: question.kamiNoKu,
      kamiReading: question.kamiReading,
      shimoNoKu: question.correctShimo,
      shimoReading: question.correctShimoReading,
      usedKami: quizState.showKami,
      isCorrect: false,
      index: quizState.currentIndex,
    });
    quizState.isAnswered = true;

    // Disable all buttons
    elements.options.forEach(btn => btn.disabled = true);
    if (elements.giveUp) elements.giveUp.disabled = true;

    // Show feedback (Always show correct answer for 'Give Up')
    // Show feedback (Always show correct answer for 'Give Up')
    let correctText = '';
    if (quizState.orderMode === 'reverse') {
      correctText = quizState.displayMode === 'kana' ? question.kamiReading : question.kamiNoKu;
    } else {
      correctText = quizState.displayMode === 'kana' ? question.correctShimoReading : question.correctShimo;
    }
    elements.feedback.innerHTML = `残念。正解: ${toRubyHtml(correctText)}`;
    elements.feedback.style.color = 'var(--color-incorrect)';

    quizState.showKami = true;
    renderKimariji(question);
    updateNextButton(true);
  }

  function initEventHandlers() {
    elements.colorButtons.forEach(btn => {
      btn.addEventListener('click', () => handleChooseColor(btn.dataset.color));
      btn.addEventListener('mouseenter', () => updateWeak5Option(btn.dataset.color));
      btn.addEventListener('focus', () => updateWeak5Option(btn.dataset.color));
    });

    if (elements.questionCount) {
      elements.questionCount.addEventListener('change', () => {
        const selectedValue = elements.questionCount.value;
        if (selectedValue === 'weak5') {
          quizState.questionLimit = 5;
        } else {
          const val = parseInt(selectedValue, 10);
          if (Number.isFinite(val) && val >= 1 && val <= 20) {
            quizState.questionLimit = val;
          } else {
            quizState.questionLimit = 20;
            elements.questionCount.value = 20;
          }
        }
      });
    }

    if (elements.displayMode) {
      elements.displayMode.addEventListener('change', () => {
        quizState.displayMode = elements.displayMode.value || 'kana';
        try {
          localStorage.setItem('goshiki_display_mode', quizState.displayMode);
        } catch (e) { console.warn(e); }
      });
    }

    if (elements.orderNormal && elements.orderReverse) {
      const updateOrderButtons = (mode) => {
        if (mode === 'normal') {
          elements.orderNormal.classList.add('active');
          elements.orderReverse.classList.remove('active');
        } else {
          elements.orderNormal.classList.remove('active');
          elements.orderReverse.classList.add('active');
        }
      };

      const setOrderMode = (mode) => {
        quizState.orderMode = mode;
        updateOrderButtons(mode);
        try {
          localStorage.setItem('goshiki_order_mode', mode);
        } catch (e) { console.warn(e); }
      };

      elements.orderNormal.addEventListener('click', () => setOrderMode('normal'));
      elements.orderReverse.addEventListener('click', () => setOrderMode('reverse'));

      // Init
      let savedOrder = 'normal';
      try {
        savedOrder = localStorage.getItem('goshiki_order_mode') || 'normal';
      } catch (e) { console.warn(e); }
      quizState.orderMode = savedOrder;
      updateOrderButtons(savedOrder);
    }

    elements.options.forEach(btn => {
      btn.addEventListener('click', handleAnswer);
    });

    if (elements.giveUp) {
      elements.giveUp.addEventListener('click', handleGiveUp);
    }

    if (elements.cancelQuiz) {
      elements.cancelQuiz.addEventListener('click', cancelQuiz);
    }

    if (elements.nextQuestion) {
      elements.nextQuestion.addEventListener('click', goToNext);
    }

    if (elements.toggleKimariji) {
      elements.toggleKimariji.addEventListener('click', () => {
        const question = quizState.currentQuestions[quizState.currentIndex];
        if (!question) return;
        quizState.showKami = !quizState.showKami;
        renderKimariji(question);
      });
    }

    elements.retrySame.addEventListener('click', () => {
      if (!quizState.selectedColor) {
        showScreen('start');
        return;
      }
      startQuiz(quizState.selectedColor);
    });

    elements.chooseColor.addEventListener('click', () => {
      resetQuizView();
      showScreen('start');
    });

    if (elements.viewStats) {
      elements.viewStats.addEventListener('click', () => {
        renderStatsScreen();
      });
    }

    if (elements.viewStatsFromResult) {
      elements.viewStatsFromResult.addEventListener('click', () => {
        renderStatsScreen();
      });
    }

    if (elements.closeStats) {
      elements.closeStats.addEventListener('click', () => {
        showScreen('start');
      });
    }

    if (elements.clearHistory) {
      elements.clearHistory.addEventListener('click', () => {
        if (clearAllHistory()) {
          renderStatsScreen();
          renderColorSummaries();
        }
      });
    }
  }

  function init() {
    if (elements.version) {
      elements.version.textContent = APP_VERSION;
    }
    if (elements.questionCount) {
      const normalOptions = Array.from({ length: 20 }, (_, idx) => {
        const val = idx + 1;
        return `<option value="${val}" ${val === quizState.questionLimit ? 'selected' : ''}>${val} 問</option>`;
      }).join('');
      const weak5Option = '<option value="weak5" disabled>苦手5種</option>';
      elements.questionCount.innerHTML = normalOptions + weak5Option;
      elements.questionCount.value = quizState.questionLimit;
    }
    if (elements.displayMode) {
      // Load saved display mode or default to 'kana'
      let savedMode = 'kana';
      try {
        savedMode = localStorage.getItem('goshiki_display_mode') || 'kana';
      } catch (e) { console.warn(e); }
      quizState.displayMode = savedMode;
      elements.displayMode.value = savedMode;
    }
    // Order mode initialized above separately

    if (!checkLocalStorageAvailable()) {
      console.warn('Statistics disabled: localStorage not available');
      if (elements.viewStats) elements.viewStats.style.display = 'none';
      if (elements.viewStatsFromResult) elements.viewStatsFromResult.style.display = 'none';
    }

    initEventHandlers();
    resetQuizView();
    renderColorSummaries();
    loadCsv();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
