import {
  STORAGE_KEYS,
  STATS_VERSION,
  MAX_HISTORY_ENTRIES,
  HISTORY_RETENTION_DAYS,
} from './config.js';

export function saveQuizSession(sessionData, storage = window.localStorage) {
  try {
    let history = loadQuizHistory(storage);
    history.push(sessionData);
    history = cleanOldHistory(history);
    history = enforceHistoryLimit(history);
    storage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    storage.setItem(STORAGE_KEYS.VERSION, STATS_VERSION);
    return true;
  } catch (e) {
    console.error('Failed to save quiz session:', e);
    if (e.name === 'QuotaExceededError') {
      try {
        let history = loadQuizHistory(storage);
        history = history.slice(Math.floor(history.length * 0.2));
        storage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
        history.push(sessionData);
        storage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
        return true;
      } catch (retryError) {
        console.error('Failed even after cleanup:', retryError);
        return false;
      }
    }
    return false;
  }
}

export function loadQuizHistory(storage = window.localStorage) {
  try {
    const data = storage.getItem(STORAGE_KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load quiz history:', e);
    return [];
  }
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

export function clearAllHistory(storage = window.localStorage, dialog = window) {
  if (dialog.confirm('本当にすべての統計データを削除しますか？この操作は取り消せません。')) {
    try {
      storage.removeItem(STORAGE_KEYS.HISTORY);
      storage.removeItem(STORAGE_KEYS.VERSION);
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
