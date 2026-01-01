import {
  calculateAllColorStats,
  calculateDetailedColorStats,
  calculateOverallStats,
  formatDateJapanese,
  formatDurationMs,
} from './stats.js';

export function highlightKimariji(text, kimariji) {
  if (!text || !kimariji) return text;
  const index = text.indexOf(kimariji);
  if (index === -1) return text;

  const before = text.substring(0, index);
  const highlighted = text.substring(index, index + kimariji.length);
  const after = text.substring(index + kimariji.length);

  return `${before}<span class="kimariji-highlight">${highlighted}</span>${after}`;
}

export function createStatsUI({
  elements,
  statsState,
  quizState,
  showScreen,
  loadHistory,
}) {
  let historyCache = null;
  let historyPromise = null;

  const getHistory = async () => {
    if (historyCache) return historyCache;
    if (historyPromise) return historyPromise;
    historyPromise = loadHistory()
      .then(history => {
        historyCache = history;
        historyPromise = null;
        return historyCache;
      })
      .catch(error => {
        historyPromise = null;
        throw error;
      });
    return historyPromise;
  };
  const getPoems = () => (Array.isArray(quizState.allPoems) ? quizState.allPoems : []);

  async function renderColorSummaries() {
    const history = await getHistory();
    const allStats = calculateAllColorStats(history, quizState.orderMode);

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

  function clearDetailedView() {
    statsState.selectedColor = null;
    const container = document.getElementById('color-detail-container');
    if (container) {
      container.innerHTML = '';
    }
    const tbody = elements.colorStatsBody;
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected'));
    }
  }

  async function renderSessionDetail(sessionId) {
    const history = await getHistory();
    const session = history.find(s => s.sessionId === sessionId);
    if (!session || !session.answers) return;

    const sessionElement = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!sessionElement) return;

    const isExpanded = sessionElement.classList.contains('expanded');

    if (isExpanded) {
      sessionElement.classList.remove('expanded');
      const answersDiv = sessionElement.querySelector('.session-answers');
      if (answersDiv) {
        answersDiv.style.display = 'none';
      }
    } else {
      sessionElement.classList.add('expanded');
      let answersDiv = sessionElement.querySelector('.session-answers');

      if (!answersDiv) {
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

  async function renderDetailedColorStats(color) {
    const history = await getHistory();
    const detailedStats = calculateDetailedColorStats(color, getPoems(), history);
    const container = document.getElementById('color-detail-container');

    if (!container) return;

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
          <button id="close-detail-panel" class="btn btn-sm btn-outline-secondary">閉じる</button>
        </div>
    `;

    html += `
      <div class="detail-section">
        <h5>最近の成績</h5>
        <div class="trend-summary">
    `;

    const trend = detailedStats.trendData;
    let trendText = '安定';
    let trendClass = 'trend-stable';
    if (trend.trend === 'improving') {
      trendText = '上昇中';
      trendClass = 'trend-up';
    } else if (trend.trend === 'declining') {
      trendText = '下降気味';
      trendClass = 'trend-down';
    }

    html += `
      <div class="trend-item">
        <div class="trend-label">直近${trend.recentCount}回の平均正答率</div>
        <div class="trend-value">${trend.recentAvg}%</div>
      </div>
      <div class="trend-item">
        <div class="trend-label">全期間の平均正答率</div>
        <div class="trend-value">${trend.overallAvg}%</div>
      </div>
      <div class="trend-item ${trendClass}">
        <div class="trend-label">傾向</div>
        <div class="trend-value">${trendText} (${trend.diff >= 0 ? '+' : ''}${trend.diff}%)</div>
      </div>
    `;

    html += `</div></div>`;

    html += `
      <div class="detail-section">
        <h5>苦手な決まり字</h5>
        <div class="kimariji-stats">
    `;

    const kimarijiList = detailedStats.kimarijiStats.filter(k => k.total > 0);
    if (kimarijiList.length === 0) {
      html += `<p class="text-muted">まだデータがありません</p>`;
    } else {
      kimarijiList.forEach(k => {
        const avgTimeText = k.avgTimeMs !== null ? ` / 平均${formatDurationMs(k.avgTimeMs)}` : '';
        const kamiReadingWithHighlight = highlightKimariji(k.kamiReading, k.kimariji);
        html += `
          <div class="kimariji-item">
            <div class="kimariji-text">
              <div class="kimariji-reading">${kamiReadingWithHighlight}</div>
              <div class="kimariji-reading">${k.shimoReading}</div>
            </div>
            <div class="kimariji-rate">${k.rate}% (${k.correct}/${k.total})${avgTimeText}</div>
          </div>
        `;
      });
    }

    html += `</div></div>`;

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
    html += `</div>`;

    container.innerHTML = html;

    const closeButton = document.getElementById('close-detail-panel');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        clearDetailedView();
      });
    }

    const sessionItems = container.querySelectorAll('.session-item');
    sessionItems.forEach(item => {
      item.addEventListener('click', () => {
        const sessionId = item.getAttribute('data-session-id');
        if (sessionId) {
          renderSessionDetail(sessionId);
        }
      });
    });

    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function renderStatsScreen(syncWithQuizState = false) {
    if (syncWithQuizState) {
      statsState.filterMode = quizState.orderMode;
    }

    if (elements.statsFilterNormal && elements.statsFilterReverse) {
      elements.statsFilterNormal.classList.toggle('active', statsState.filterMode === 'normal');
      elements.statsFilterReverse.classList.toggle('active', statsState.filterMode === 'reverse');
    }

    showScreen('stats');

    const orderModeFilter = statsState.filterMode;
    const history = await getHistory();
    const overall = calculateOverallStats(history, orderModeFilter);
    const colorStats = calculateAllColorStats(history, orderModeFilter);

    if (elements.totalQuizzes) elements.totalQuizzes.textContent = overall.totalQuizzes;
    if (elements.totalQuestions) elements.totalQuestions.textContent = overall.totalQuestions;
    if (elements.totalCorrect) elements.totalCorrect.textContent = overall.totalCorrect;
    if (elements.overallAccuracy) elements.overallAccuracy.textContent = `${overall.accuracyRate}%`;
    if (elements.overallHintUsage) elements.overallHintUsage.textContent = `${overall.hintUsageRate}%`;

    const tbody = elements.colorStatsBody;
    if (tbody) {
      tbody.innerHTML = colorStats.map(stats => {
        const rowClass = {
          '青': 'row-blue',
          'ピンク': 'row-pink',
          '黄': 'row-yellow',
          '緑': 'row-green',
          'オレンジ': 'row-orange'
        }[stats.color] || '';

        return `
          <tr data-color="${stats.color}" class="stats-row ${rowClass} ${statsState.selectedColor === stats.color ? 'selected' : ''}">
            <td class="stats-cell">${stats.totalQuizzes}</td>
            <td class="stats-cell">${stats.totalQuestions}</td>
            <td class="stats-cell">${stats.totalCorrect}</td>
            <td class="stats-cell">${stats.accuracyRate}%</td>
            <td class="stats-cell">${stats.hintUsageRate}%</td>
            <td class="stats-cell">${formatDurationMs(stats.fastestDurationMs)}</td>
            <td class="stats-cell">${formatDateJapanese(stats.lastPlayed)}</td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', () => {
          const color = row.getAttribute('data-color');
          if (!color) return;

          if (statsState.selectedColor === color) {
            clearDetailedView();
          } else {
            statsState.selectedColor = color;

            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');

            renderDetailedColorStats(color);
          }
        });
      });
    }

    const recentActivity = elements.recentActivity;
    if (recentActivity) {
      let filteredHistory = history;
      if (orderModeFilter !== null) {
        filteredHistory = history.filter(s => s.orderMode === orderModeFilter);
      }

      const recent = filteredHistory.slice(-10).reverse();

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
              ${formatDurationMs(session.durationMs)} - ${session.correctCount}/${session.questionCount} (${session.accuracyRate}%)
            </div>
          </div>
        `).join('');
      }
    }

  }

  return {
    renderColorSummaries,
    renderStatsScreen,
    clearDetailedView,
    renderDetailedColorStats,
    renderSessionDetail,
    clearHistoryCache: () => {
      historyCache = null;
      historyPromise = null;
    },
  };
}
