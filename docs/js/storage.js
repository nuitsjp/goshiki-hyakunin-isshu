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

let getCurrentUserId = null;

export function setAuthModule(authModule) {
  getCurrentUserId = authModule.getCurrentUserId;
}

export async function saveQuizSession(sessionData, storage = window.localStorage) {
  try {
    let history = await loadQuizHistory(storage);
    history.push(sessionData);
    history = cleanOldHistory(history);
    history = enforceHistoryLimit(history);
    storage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    storage.setItem(STORAGE_KEYS.VERSION, STATS_VERSION);

    const userId = getCurrentUserId?.();
    if (userId) {
      try {
        await saveSessionToFirestore(userId, sessionData);
      } catch (e) {
        console.error('Firestore save failed:', e);
      }
    }

    return true;
  } catch (e) {
    console.error('Failed to save quiz session:', e);
    if (e.name === 'QuotaExceededError') {
      try {
        let history = await loadQuizHistory(storage);
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

export async function loadQuizHistory(storage = window.localStorage) {
  const userId = getCurrentUserId?.();
  if (userId) {
    try {
      return await loadSessionsFromFirestore(userId);
    } catch (e) {
      console.error('Firestore load failed, fallback to localStorage:', e);
    }
  }

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

export async function clearAllHistory(storage = window.localStorage, dialog = window) {
  if (dialog.confirm('本当にすべての統計データを削除しますか？この操作は取り消せません。')) {
    try {
      const userId = getCurrentUserId?.();
      if (userId) {
        await deleteAllSessionsFromFirestore(userId);
      }

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
