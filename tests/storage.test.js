import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkLocalStorageAvailable,
  cleanOldHistory,
  clearAllHistory,
  clearCachedQuizHistory,
  enforceHistoryLimit,
  getCachedQuizHistory,
  loadKarutaHistory,
  loadQuizHistory,
  refreshKarutaHistory,
  refreshQuizHistory,
  saveKarutaSession,
  saveQuizSession,
  setCachedQuizHistory,
  setCachedKarutaHistory,
  setAuthModule,
} from '../src/js/storage.js';
import { STORAGE_KEYS, STATS_VERSION } from '../src/js/config.js';
import * as firestore from '../src/js/firestore.js';

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
  beforeEach(() => {
    clearCachedQuizHistory();
    setCachedKarutaHistory(null);
    setAuthModule({ getCurrentUserId: () => null });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saveQuizSession stores history and version', async () => {
    const storage = new MemoryStorage();
    const session = { timestamp: Date.now(), questionCount: 1 };
    const ok = await saveQuizSession(session, storage);
    expect(ok).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.VERSION)).toBe(STATS_VERSION);
    const history = JSON.parse(storage.getItem(STORAGE_KEYS.HISTORY));
    expect(history).toHaveLength(1);
  });

  it('saveKarutaSession stores history and version separately', async () => {
    const storage = new MemoryStorage();
    const session = { timestamp: Date.now(), questionCount: 1 };
    const ok = await saveKarutaSession(session, storage);
    expect(ok).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.KARUTA_VERSION)).toBe(STATS_VERSION);
    const history = JSON.parse(storage.getItem(STORAGE_KEYS.KARUTA_HISTORY));
    expect(history).toHaveLength(1);
  });

  it('saveKarutaSession handles quota exceeded by trimming', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.KARUTA_HISTORY]: JSON.stringify([
        { timestamp: Date.now() - 1000 },
        { timestamp: Date.now() - 500 },
      ]),
    });
    const originalSetItem = storage.setItem.bind(storage);
    let throwOnce = true;
    storage.setItem = vi.fn((key, value) => {
      if (key === STORAGE_KEYS.KARUTA_HISTORY && throwOnce) {
        throwOnce = false;
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      originalSetItem(key, value);
    });

    const ok = await saveKarutaSession({ timestamp: Date.now(), questionCount: 1 }, storage);
    expect(ok).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.KARUTA_HISTORY)).toBeTruthy();
  });

  it('saveKarutaSession returns false when retry fails', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.KARUTA_HISTORY]: JSON.stringify([{ timestamp: Date.now() - 1000 }]),
    });
    storage.setItem = vi.fn(() => {
      const err = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    });
    const ok = await saveKarutaSession({ timestamp: Date.now(), questionCount: 1 }, storage);
    expect(ok).toBe(false);
  });

  it('saveQuizSession handles quota exceeded by trimming', async () => {
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

    const ok = await saveQuizSession({ timestamp: Date.now(), questionCount: 1 }, storage);
    expect(ok).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.HISTORY)).toBeTruthy();
  });

  it('saveQuizSession returns false when retry fails', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: JSON.stringify([{ timestamp: Date.now() - 1000 }]),
    });
    storage.setItem = vi.fn(() => {
      const err = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    });
    const ok = await saveQuizSession({ timestamp: Date.now(), questionCount: 1 }, storage);
    expect(ok).toBe(false);
  });

  it('loadQuizHistory returns empty array on invalid JSON', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: '{bad json}',
    });
    expect(await loadQuizHistory(storage)).toEqual([]);
  });

  it('loadKarutaHistory returns empty array on invalid JSON', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.KARUTA_HISTORY]: '{bad json}',
    });
    expect(await loadKarutaHistory(storage)).toEqual([]);
  });

  it('loadQuizHistory prefers Firestore when signed in', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: JSON.stringify([{ timestamp: 1 }]),
    });
    setAuthModule({ getCurrentUserId: () => 'user1' });
    const firestoreSpy = vi.spyOn(firestore, 'loadSessionsFromFirestore').mockResolvedValue([
      { timestamp: 2 },
    ]);

    const history = await loadQuizHistory(storage);

    expect(history).toHaveLength(1);
    expect(firestoreSpy).toHaveBeenCalledWith('user1');
  });

  it('loadKarutaHistory prefers Firestore when signed in', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.KARUTA_HISTORY]: JSON.stringify([{ timestamp: 1 }]),
    });
    setAuthModule({ getCurrentUserId: () => 'user1' });
    const firestoreSpy = vi.spyOn(firestore, 'loadKarutaSessionsFromFirestore').mockResolvedValue([
      { timestamp: 2 },
    ]);

    const history = await loadKarutaHistory(storage);

    expect(history).toHaveLength(1);
    expect(firestoreSpy).toHaveBeenCalledWith('user1');
  });

  it('loadQuizHistory falls back to localStorage when Firestore fails', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: JSON.stringify([{ timestamp: 3 }]),
    });
    setAuthModule({ getCurrentUserId: () => 'user1' });
    vi.spyOn(firestore, 'loadSessionsFromFirestore').mockRejectedValue(new Error('fail'));

    const history = await loadQuizHistory(storage);

    expect(history).toHaveLength(1);
    expect(history[0].timestamp).toBe(3);
  });

  it('loadKarutaHistory falls back to localStorage when Firestore fails', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.KARUTA_HISTORY]: JSON.stringify([{ timestamp: 3 }]),
    });
    setAuthModule({ getCurrentUserId: () => 'user1' });
    vi.spyOn(firestore, 'loadKarutaSessionsFromFirestore').mockRejectedValue(new Error('fail'));

    const history = await loadKarutaHistory(storage);

    expect(history).toHaveLength(1);
    expect(history[0].timestamp).toBe(3);
  });

  it('loadQuizHistory caches results', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: JSON.stringify([{ timestamp: Date.now() }]),
    });
    const getItemSpy = vi.spyOn(storage, 'getItem');

    await loadQuizHistory(storage);
    await loadQuizHistory(storage);

    expect(getItemSpy).toHaveBeenCalledTimes(1);
  });

  it('loadKarutaHistory caches results', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.KARUTA_HISTORY]: JSON.stringify([{ timestamp: Date.now() }]),
    });
    const getItemSpy = vi.spyOn(storage, 'getItem');

    await loadKarutaHistory(storage);
    await loadKarutaHistory(storage);

    expect(getItemSpy).toHaveBeenCalledTimes(1);
  });

  it('refreshQuizHistory reloads and updates cache', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: JSON.stringify([{ timestamp: 1 }]),
    });

    await refreshQuizHistory(storage);
    expect(getCachedQuizHistory()).toHaveLength(1);

    storage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([{ timestamp: 1 }, { timestamp: 2 }]));
    await refreshQuizHistory(storage);
    expect(getCachedQuizHistory()).toHaveLength(2);
  });

  it('refreshKarutaHistory reloads and updates cache', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.KARUTA_HISTORY]: JSON.stringify([{ timestamp: 1 }]),
    });

    await refreshKarutaHistory(storage);
    expect(await loadKarutaHistory(storage)).toHaveLength(1);

    storage.setItem(STORAGE_KEYS.KARUTA_HISTORY, JSON.stringify([{ timestamp: 1 }, { timestamp: 2 }]));
    await refreshKarutaHistory(storage);
    expect(await loadKarutaHistory(storage)).toHaveLength(2);
  });

  it('saveQuizSession updates cached history when present', async () => {
    const storage = new MemoryStorage();
    const now = Date.now();
    setCachedQuizHistory([{ timestamp: now, questionCount: 1 }]);

    const ok = await saveQuizSession({ timestamp: now + 1, questionCount: 1 }, storage);
    expect(ok).toBe(true);
    expect(getCachedQuizHistory()).toHaveLength(2);
  });

  it('saveQuizSession syncs to Firestore when signed in', async () => {
    const storage = new MemoryStorage();
    setAuthModule({ getCurrentUserId: () => 'user1' });
    const firestoreSpy = vi.spyOn(firestore, 'saveSessionToFirestore').mockResolvedValue(true);

    const ok = await saveQuizSession({ timestamp: Date.now(), questionCount: 1 }, storage);

    expect(ok).toBe(true);
    expect(firestoreSpy).toHaveBeenCalled();
  });

  it('saveKarutaSession syncs to Firestore when signed in', async () => {
    const storage = new MemoryStorage();
    setAuthModule({ getCurrentUserId: () => 'user1' });
    const firestoreSpy = vi.spyOn(firestore, 'saveKarutaSessionToFirestore').mockResolvedValue(true);

    const ok = await saveKarutaSession({ timestamp: Date.now(), questionCount: 1 }, storage);

    expect(ok).toBe(true);
    expect(firestoreSpy).toHaveBeenCalled();
  });

  it('saveQuizSession continues when Firestore sync fails', async () => {
    const storage = new MemoryStorage();
    setAuthModule({ getCurrentUserId: () => 'user1' });
    vi.spyOn(firestore, 'saveSessionToFirestore').mockRejectedValue(new Error('fail'));

    const ok = await saveQuizSession({ timestamp: Date.now(), questionCount: 1 }, storage);

    expect(ok).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.HISTORY)).toBeTruthy();
  });

  it('saveKarutaSession continues when Firestore sync fails', async () => {
    const storage = new MemoryStorage();
    setAuthModule({ getCurrentUserId: () => 'user1' });
    vi.spyOn(firestore, 'saveKarutaSessionToFirestore').mockRejectedValue(new Error('fail'));

    const ok = await saveKarutaSession({ timestamp: Date.now(), questionCount: 1 }, storage);

    expect(ok).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.KARUTA_HISTORY)).toBeTruthy();
  });

  it('clearAllHistory clears cache when confirmed', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: '[]',
      [STORAGE_KEYS.VERSION]: '1',
    });
    const dialog = {
      confirm: () => true,
      alert: vi.fn(),
    };
    setCachedQuizHistory([{ timestamp: 1 }]);

    const ok = await clearAllHistory(storage, dialog);
    expect(ok).toBe(true);
    expect(getCachedQuizHistory()).toEqual([]);
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

  it('clearAllHistory returns true when confirmed', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: '[]',
      [STORAGE_KEYS.VERSION]: '1',
    });
    const dialog = {
      confirm: () => true,
      alert: vi.fn(),
    };
    const ok = await clearAllHistory(storage, dialog);
    expect(ok).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.HISTORY)).toBe(null);
  });

  it('clearAllHistory returns false when remove fails', async () => {
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
    const ok = await clearAllHistory(storage, dialog);
    expect(ok).toBe(false);
  });

  it('clearAllHistory returns false when canceled', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: '[]',
    });
    const dialog = {
      confirm: () => false,
      alert: vi.fn(),
    };
    const ok = await clearAllHistory(storage, dialog);
    expect(ok).toBe(false);
  });

  it('checkLocalStorageAvailable returns false on error', () => {
    const storage = {
      setItem: () => { throw new Error('fail'); },
      removeItem: () => {},
    };
    expect(checkLocalStorageAvailable(storage)).toBe(false);
  });

  it('clearAllHistory deletes Firestore history when signed in', async () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.HISTORY]: '[]',
      [STORAGE_KEYS.VERSION]: '1',
    });
    const dialog = {
      confirm: () => true,
      alert: vi.fn(),
    };
    setAuthModule({ getCurrentUserId: () => 'user1' });
    const deleteSpy = vi.spyOn(firestore, 'deleteAllSessionsFromFirestore').mockResolvedValue(true);

    const ok = await clearAllHistory(storage, dialog);

    expect(ok).toBe(true);
    expect(deleteSpy).toHaveBeenCalledWith('user1');
  });

  it('loadKarutaHistory resets promise when fetch rejects', async () => {
    const storage = new MemoryStorage();
    setAuthModule({
      getCurrentUserId: () => {
        throw new Error('boom');
      },
    });

    await expect(loadKarutaHistory(storage)).rejects.toThrow('boom');
  });

  it('checkLocalStorageAvailable returns true on success', () => {
    const storage = new MemoryStorage();
    expect(checkLocalStorageAvailable(storage)).toBe(true);
  });

  it('loadQuizHistory resets promise when fetch rejects', async () => {
    const storage = new MemoryStorage();
    setAuthModule({
      getCurrentUserId: () => {
        throw new Error('boom');
      },
    });

    await expect(loadQuizHistory(storage)).rejects.toThrow('boom');
  });

  it('saveKarutaSession returns false on unexpected error', async () => {
    const storage = new MemoryStorage();
    storage.setItem = vi.fn(() => {
      throw new Error('boom');
    });

    const ok = await saveKarutaSession({ timestamp: Date.now(), questionCount: 1 }, storage);

    expect(ok).toBe(false);
  });
});
