import { describe, expect, it, vi } from 'vitest';
import {
  checkLocalStorageAvailable,
  cleanOldHistory,
  clearAllHistory,
  enforceHistoryLimit,
  loadQuizHistory,
  saveQuizSession,
} from '../docs/js/storage.js';
import { STORAGE_KEYS, STATS_VERSION } from '../docs/js/config.js';

class MemoryStorage {
  constructor(initial = {}) {
    this.store = { ...initial };
  }

  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key)
      ? this.store[key]
      : null;
  }

  setItem(key, value) {
    this.store[key] = value;
  }

  removeItem(key) {
    delete this.store[key];
  }
}

describe('storage', () => {
  it('saveQuizSession stores history and version', () => {
    const storage = new MemoryStorage();
    const session = { timestamp: Date.now(), questionCount: 1 };
    const ok = saveQuizSession(session, storage);
    expect(ok).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.VERSION)).toBe(STATS_VERSION);
    const history = JSON.parse(storage.getItem(STORAGE_KEYS.HISTORY));
    expect(history).toHaveLength(1);
  });

  it('saveQuizSession handles quota exceeded by trimming', () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: JSON.stringify([
        { timestamp: Date.now() - 1000 },
        { timestamp: Date.now() - 500 },
      ]),
    });
    const originalSetItem = storage.setItem.bind(storage);
    let throwOnce = true;
    storage.setItem = vi.fn((key, value) => {
      if (key === STORAGE_KEYS.HISTORY && throwOnce) {
        throwOnce = false;
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      originalSetItem(key, value);
    });

    const ok = saveQuizSession({ timestamp: Date.now(), questionCount: 1 }, storage);
    expect(ok).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.HISTORY)).toBeTruthy();
  });

  it('saveQuizSession returns false when retry fails', () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: JSON.stringify([{ timestamp: Date.now() - 1000 }]),
    });
    storage.setItem = vi.fn(() => {
      const err = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    });
    const ok = saveQuizSession({ timestamp: Date.now(), questionCount: 1 }, storage);
    expect(ok).toBe(false);
  });

  it('loadQuizHistory returns empty array on invalid JSON', () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: '{bad json}',
    });
    expect(loadQuizHistory(storage)).toEqual([]);
  });

  it('cleanOldHistory filters by retention', () => {
    const now = Date.now();
    const history = [
      { timestamp: now - 1000 * 60 * 60 * 24 * 10 },
      { timestamp: now - 1000 * 60 * 60 * 24 * 2 },
    ];
    const filtered = cleanOldHistory(history, 5);
    expect(filtered).toHaveLength(1);
  });

  it('enforceHistoryLimit trims to max entries', () => {
    const history = Array.from({ length: 5 }, (_, idx) => ({ id: idx }));
    const trimmed = enforceHistoryLimit(history, 3);
    expect(trimmed).toHaveLength(3);
    expect(trimmed[0].id).toBe(2);
  });

  it('clearAllHistory returns true when confirmed', () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: '[]',
      [STORAGE_KEYS.VERSION]: '1',
    });
    const dialog = {
      confirm: () => true,
      alert: vi.fn(),
    };
    const ok = clearAllHistory(storage, dialog);
    expect(ok).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.HISTORY)).toBe(null);
  });

  it('clearAllHistory returns false when remove fails', () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: '[]',
      [STORAGE_KEYS.VERSION]: '1',
    });
    storage.removeItem = vi.fn(() => {
      throw new Error('fail');
    });
    const dialog = {
      confirm: () => true,
      alert: vi.fn(),
    };
    const ok = clearAllHistory(storage, dialog);
    expect(ok).toBe(false);
  });

  it('clearAllHistory returns false when canceled', () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: '[]',
    });
    const dialog = {
      confirm: () => false,
      alert: vi.fn(),
    };
    const ok = clearAllHistory(storage, dialog);
    expect(ok).toBe(false);
  });

  it('checkLocalStorageAvailable returns false on error', () => {
    const storage = {
      setItem: () => { throw new Error('fail'); },
      removeItem: () => {},
    };
    expect(checkLocalStorageAvailable(storage)).toBe(false);
  });
});
