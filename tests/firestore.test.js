import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFirestoreModule = {
  initializeFirestore: vi.fn(),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  doc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: {
    fromMillis: vi.fn((ms) => ({ toMillis: () => ms })),
  },
};

const mockAppModule = {
  initializeApp: vi.fn(() => ({})),
};

describe('firestore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock('../docs/js/config.js', () => ({
      ENABLE_FIRESTORE_SYNC: true,
      FIREBASE_CONFIG: { projectId: 'test' },
    }));
  });

  it('loads Firestore modules successfully', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    const { loadFirestoreModules } = await import('../docs/js/firestore.js');
    const modules = await loadFirestoreModules();

    expect(modules).toHaveProperty('appModule');
    expect(modules).toHaveProperty('firestoreModule');
  });

  it('initializes Firestore with offline persistence', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    const { initializeFirestore, loadFirestoreModules } = await import('../docs/js/firestore.js');

    await loadFirestoreModules();
    const app = mockAppModule.initializeApp();
    await initializeFirestore(app);

    expect(mockFirestoreModule.initializeFirestore).toHaveBeenCalled();
    expect(mockFirestoreModule.persistentLocalCache).toHaveBeenCalled();
    expect(mockFirestoreModule.persistentMultipleTabManager).toHaveBeenCalled();
  });

  it('returns null when Firestore sync is disabled', async () => {
    vi.doMock('../docs/js/config.js', () => ({
      ENABLE_FIRESTORE_SYNC: false,
      FIREBASE_CONFIG: null,
    }));

    const { initializeFirestore } = await import('../docs/js/firestore.js');
    const result = await initializeFirestore({});

    expect(result).toBeNull();
  });

  it('saves session to Firestore', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    mockFirestoreModule.initializeFirestore.mockReturnValue({});

    const { initializeFirestore, saveSessionToFirestore, loadFirestoreModules } = await import('../docs/js/firestore.js');

    await loadFirestoreModules();
    const app = mockAppModule.initializeApp();
    await initializeFirestore(app);

    const sessionData = {
      sessionId: 's1',
      timestamp: 1700000000000,
      color: '青',
      questionCount: 10,
    };

    const result = await saveSessionToFirestore('user123', sessionData);

    expect(result).toBe(true);
    expect(mockFirestoreModule.doc).toHaveBeenCalled();
    expect(mockFirestoreModule.setDoc).toHaveBeenCalled();
  });

  it('returns false when saving without db', async () => {
    vi.doMock('../docs/js/config.js', () => ({
      ENABLE_FIRESTORE_SYNC: false,
      FIREBASE_CONFIG: null,
    }));

    const { saveSessionToFirestore } = await import('../docs/js/firestore.js');
    const result = await saveSessionToFirestore('user123', { sessionId: 's1' });

    expect(result).toBe(false);
  });

  it('loads sessions from Firestore', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    mockFirestoreModule.initializeFirestore.mockReturnValue({});
    mockFirestoreModule.getDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            sessionId: 's1',
            timestamp: { toMillis: () => 1700000000000 },
            color: '青',
          }),
        },
      ],
    });

    const { initializeFirestore, loadSessionsFromFirestore, loadFirestoreModules } = await import('../docs/js/firestore.js');

    await loadFirestoreModules();
    const app = mockAppModule.initializeApp();
    await initializeFirestore(app);

    const sessions = await loadSessionsFromFirestore('user123');

    expect(Array.isArray(sessions)).toBe(true);
    expect(mockFirestoreModule.collection).toHaveBeenCalled();
    expect(mockFirestoreModule.query).toHaveBeenCalled();
  });

  it('returns empty array when loading without db', async () => {
    vi.doMock('../docs/js/config.js', () => ({
      ENABLE_FIRESTORE_SYNC: false,
      FIREBASE_CONFIG: null,
    }));

    const { loadSessionsFromFirestore } = await import('../docs/js/firestore.js');
    const result = await loadSessionsFromFirestore('user123');

    expect(result).toEqual([]);
  });

  it('deletes all sessions from Firestore', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn(),
    };

    mockFirestoreModule.initializeFirestore.mockReturnValue({});
    mockFirestoreModule.writeBatch.mockReturnValue(mockBatch);
    mockFirestoreModule.getDocs.mockResolvedValue({
      docs: [{ ref: 'ref1' }, { ref: 'ref2' }],
    });

    const { initializeFirestore, deleteAllSessionsFromFirestore, loadFirestoreModules } = await import('../docs/js/firestore.js');

    await loadFirestoreModules();
    const app = mockAppModule.initializeApp();
    await initializeFirestore(app);

    const result = await deleteAllSessionsFromFirestore('user123');

    expect(result).toBe(true);
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('returns false when deleting without db', async () => {
    vi.doMock('../docs/js/config.js', () => ({
      ENABLE_FIRESTORE_SYNC: false,
      FIREBASE_CONFIG: null,
    }));

    const { deleteAllSessionsFromFirestore } = await import('../docs/js/firestore.js');
    const result = await deleteAllSessionsFromFirestore('user123');

    expect(result).toBe(false);
  });

  it('uploads local history to Firestore', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    const mockBatch = {
      set: vi.fn(),
      commit: vi.fn(),
    };

    mockFirestoreModule.initializeFirestore.mockReturnValue({});
    mockFirestoreModule.writeBatch.mockReturnValue(mockBatch);
    mockFirestoreModule.getDocs.mockResolvedValue({
      docs: [{ id: 's1' }],
    });

    const { initializeFirestore, uploadLocalHistoryToFirestore, loadFirestoreModules } = await import('../docs/js/firestore.js');

    await loadFirestoreModules();
    const app = mockAppModule.initializeApp();
    await initializeFirestore(app);

    const localHistory = [
      { sessionId: 's1', timestamp: 1700000000000 },
      { sessionId: 's2', timestamp: 1700000001000 },
    ];

    const count = await uploadLocalHistoryToFirestore('user123', localHistory);

    expect(count).toBe(1);
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('returns 0 when uploading empty history', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    mockFirestoreModule.initializeFirestore.mockReturnValue({});

    const { initializeFirestore, uploadLocalHistoryToFirestore, loadFirestoreModules } = await import('../docs/js/firestore.js');

    await loadFirestoreModules();
    const app = mockAppModule.initializeApp();
    await initializeFirestore(app);

    const count = await uploadLocalHistoryToFirestore('user123', []);

    expect(count).toBe(0);
  });

  it('returns db instance from getFirestoreDb', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    const mockDb = {};
    mockFirestoreModule.initializeFirestore.mockReturnValue(mockDb);

    const { initializeFirestore, getFirestoreDb, loadFirestoreModules } = await import('../docs/js/firestore.js');

    await loadFirestoreModules();
    const app = mockAppModule.initializeApp();
    await initializeFirestore(app);

    const db = getFirestoreDb();
    expect(db).toBe(mockDb);
  });

  it('returns null when Firestore initialization throws', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => {
      throw new Error('load failed');
    });

    const { initializeFirestore } = await import('../docs/js/firestore.js');
    const result = await initializeFirestore({});

    expect(result).toBeNull();
  });

  it('returns false when Firestore save fails', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    mockFirestoreModule.initializeFirestore.mockReturnValue({});
    mockFirestoreModule.setDoc.mockRejectedValue(new Error('fail'));

    const { initializeFirestore, saveSessionToFirestore, loadFirestoreModules } = await import('../docs/js/firestore.js');

    await loadFirestoreModules();
    const app = mockAppModule.initializeApp();
    await initializeFirestore(app);

    const result = await saveSessionToFirestore('user123', { sessionId: 's1', timestamp: 1 });

    expect(result).toBe(false);
  });

  it('returns empty array when Firestore load fails', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    mockFirestoreModule.initializeFirestore.mockReturnValue({});
    mockFirestoreModule.getDocs.mockRejectedValue(new Error('fail'));

    const { initializeFirestore, loadSessionsFromFirestore, loadFirestoreModules } = await import('../docs/js/firestore.js');

    await loadFirestoreModules();
    const app = mockAppModule.initializeApp();
    await initializeFirestore(app);

    const result = await loadSessionsFromFirestore('user123');

    expect(result).toEqual([]);
  });

  it('returns false when Firestore delete fails', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn(() => {
        throw new Error('fail');
      }),
    };

    mockFirestoreModule.initializeFirestore.mockReturnValue({});
    mockFirestoreModule.writeBatch.mockReturnValue(mockBatch);
    mockFirestoreModule.getDocs.mockResolvedValue({
      docs: [{ ref: 'ref1' }],
    });

    const { initializeFirestore, deleteAllSessionsFromFirestore, loadFirestoreModules } = await import('../docs/js/firestore.js');

    await loadFirestoreModules();
    const app = mockAppModule.initializeApp();
    await initializeFirestore(app);

    const result = await deleteAllSessionsFromFirestore('user123');

    expect(result).toBe(false);
  });

  it('returns 0 when Firestore upload fails', async () => {
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => mockAppModule);
    vi.doMock('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', () => mockFirestoreModule);

    mockFirestoreModule.initializeFirestore.mockReturnValue({});
    mockFirestoreModule.getDocs.mockRejectedValue(new Error('fail'));

    const { initializeFirestore, uploadLocalHistoryToFirestore, loadFirestoreModules } = await import('../docs/js/firestore.js');

    await loadFirestoreModules();
    const app = mockAppModule.initializeApp();
    await initializeFirestore(app);

    const result = await uploadLocalHistoryToFirestore('user123', [{ sessionId: 's1', timestamp: 1 }]);

    expect(result).toBe(0);
  });
});
