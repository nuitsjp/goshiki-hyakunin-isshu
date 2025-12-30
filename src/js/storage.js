import {
  STORAGE_KEYS,
  STATS_VERSION,
  MAX_HISTORY_ENTRIES,
  HISTORY_RETENTION_DAYS,
} from './config.js';
import {
  saveSessionToFirestore,
  loadSessionsFromFirestore,
  deleteAllSessionsFromFirestore
} from './firestore.js';
import { log } from './debug.js';

let getCurrentUserId = null;
let historyCache = null;
let historyPromise = null;

export function setAuthModule(authModule) {
  getCurrentUserId = authModule.getCurrentUserId;
}

export function getCachedQuizHistory() {
  return historyCache;
}

export function setCachedQuizHistory(history) {
  historyCache = Array.isArray(history) ? history : [];
  historyPromise = null;
}

export function clearCachedQuizHistory() {
  historyCache = null;
  historyPromise = null;
}

const readLocalHistory = (storage) => {
  const data = storage.getItem(STORAGE_KEYS.HISTORY);
  return data ? JSON.parse(data) : [];
};

const fetchQuizHistory = async (storage) => {
  const userId = getCurrentUserId?.();
  log('load', '履歴読み込み開始', { userId: userId || 'not-logged-in' });

  if (userId) {
    try {
      const sessions = await loadSessionsFromFirestore(userId);
      log('load', 'Firestoreから読み込み完了', {
        userId,
        sessionCount: sessions.length,
      });
      return sessions;
    } catch (e) {
      log('error', 'Firestore読み込み失敗、localStorageにフォールバック', {
        userId,
        error: e.message,
      });
      console.error('Firestore load failed, fallback to localStorage:', e);
    }
  }

  try {
    const sessions = readLocalHistory(storage);
    log('load', 'localStorageから読み込み完了', {
      sessionCount: sessions.length,
    });
    return sessions;
  } catch (e) {
    log('error', 'localStorage読み込み失敗', { error: e.message });
    console.error('Failed to load quiz history:', e);
    return [];
  }
};

export async function saveQuizSession(sessionData, storage = window.localStorage) {
  try {
    const userId = getCurrentUserId?.();
    log('save', 'セッション保存開始', {
      sessionId: sessionData.sessionId,
      userId: userId || 'not-logged-in',
      color: sessionData.color,
      questionCount: sessionData.questionCount,
    });

    const cachedHistory = getCachedQuizHistory();
    let history = Array.isArray(cachedHistory) ? [...cachedHistory] : [];
    if (!Array.isArray(cachedHistory)) {
      try {
        history = readLocalHistory(storage);
      } catch (readError) {
        console.error('Failed to load quiz history from localStorage:', readError);
        history = [];
      }
    }
    history.push(sessionData);
    history = cleanOldHistory(history);
    history = enforceHistoryLimit(history);
    storage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    storage.setItem(STORAGE_KEYS.VERSION, STATS_VERSION);
    setCachedQuizHistory(history);
    log('save', 'localStorage保存完了', { historyCount: history.length });

    if (userId) {
      try {
        await saveSessionToFirestore(userId, sessionData);
        log('save', 'Firestore保存完了', { userId, sessionId: sessionData.sessionId });
      } catch (e) {
        log('error', 'Firestore保存失敗', { userId, error: e.message });
        console.error('Firestore save failed:', e);
      }
    } else {
      log('save', 'Firestore保存スキップ（未ログイン）', {});
    }

    return true;
  } catch (e) {
    console.error('Failed to save quiz session:', e);
    if (e.name === 'QuotaExceededError') {
      try {
        const cachedHistory = getCachedQuizHistory();
        let history = Array.isArray(cachedHistory) ? [...cachedHistory] : [];
        if (!Array.isArray(cachedHistory)) {
          try {
            history = readLocalHistory(storage);
          } catch (readError) {
            console.error('Failed to load quiz history from localStorage:', readError);
            history = [];
          }
        }
        history = history.slice(Math.floor(history.length * 0.2));
        storage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
        history.push(sessionData);
        storage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
        setCachedQuizHistory(history);
        return true;
      } catch (retryError) {
        console.error('Failed even after cleanup:', retryError);
        return false;
      }
    }
    return false;
  }
}

export async function loadQuizHistory(storage = window.localStorage) {
  if (historyCache !== null) return historyCache;
  if (historyPromise) return historyPromise;

  historyPromise = fetchQuizHistory(storage)
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
}

export async function refreshQuizHistory(storage = window.localStorage) {
  const history = await fetchQuizHistory(storage);
  historyCache = history;
  historyPromise = null;
  return history;
}

export function cleanOldHistory(history, retentionDays = HISTORY_RETENTION_DAYS) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffTime = cutoffDate.getTime();
  return history.filter(session => session.timestamp >= cutoffTime);
}

export function enforceHistoryLimit(history, maxEntries = MAX_HISTORY_ENTRIES) {
  if (history.length <= maxEntries) return history;
  return history.slice(history.length - maxEntries);
}

export async function clearAllHistory(storage = window.localStorage, dialog = window) {
  if (dialog.confirm('本当にすべての統計データを削除しますか？この操作は取り消せません。')) {
    try {
      const userId = getCurrentUserId?.();
      if (userId) {
        await deleteAllSessionsFromFirestore(userId);
      }

      storage.removeItem(STORAGE_KEYS.HISTORY);
      storage.removeItem(STORAGE_KEYS.VERSION);
      setCachedQuizHistory([]);
      dialog.alert('統計データを削除しました。');
      return true;
    } catch (e) {
      console.error('Failed to clear history:', e);
      dialog.alert('データの削除に失敗しました。');
      return false;
    }
  }
  return false;
}

export function checkLocalStorageAvailable(storage = window.localStorage) {
  try {
    const test = '__localStorage_test__';
    storage.setItem(test, test);
    storage.removeItem(test);
    return true;
  } catch (e) {
    console.warn('LocalStorage not available:', e);
    return false;
  }
}
