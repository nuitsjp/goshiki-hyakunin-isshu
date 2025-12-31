import { ENABLE_FIRESTORE_SYNC } from './config.js';

let db = null;
let firestoreModule = null;

export async function loadFirestoreModules() {
  const appModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const fsModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
  return { appModule, firestoreModule: fsModule };
}

export async function initializeFirestore(app) {
  if (!ENABLE_FIRESTORE_SYNC) return null;

  try {
    const { firestoreModule: fsModule } = await loadFirestoreModules();
    firestoreModule = fsModule;

    db = fsModule.initializeFirestore(app, {
      localCache: fsModule.persistentLocalCache({
        tabManager: fsModule.persistentMultipleTabManager()
      })
    });

    console.log('Firestore initialized with offline persistence');
    return db;
  } catch (error) {
    console.error('Failed to initialize Firestore:', error);
    return null;
  }
}

export async function saveSessionToFirestore(userId, sessionData) {
  if (!db || !userId || !firestoreModule) return false;

  try {
    const docRef = firestoreModule.doc(db, 'users', userId, 'quizSessions', sessionData.sessionId);
    await firestoreModule.setDoc(docRef, {
      ...sessionData,
      timestamp: firestoreModule.Timestamp.fromMillis(sessionData.timestamp)
    });
    return true;
  } catch (error) {
    console.error('Failed to save session to Firestore:', error);
    return false;
  }
}

export async function saveKarutaSessionToFirestore(userId, sessionData) {
  if (!db || !userId || !firestoreModule) return false;

  try {
    const docRef = firestoreModule.doc(db, 'users', userId, 'karutaSessions', sessionData.sessionId);
    await firestoreModule.setDoc(docRef, {
      ...sessionData,
      timestamp: firestoreModule.Timestamp.fromMillis(sessionData.timestamp)
    });
    return true;
  } catch (error) {
    console.error('Failed to save karuta session to Firestore:', error);
    return false;
  }
}

export async function loadSessionsFromFirestore(userId) {
  if (!db || !userId || !firestoreModule) return [];

  try {
    const colRef = firestoreModule.collection(db, 'users', userId, 'quizSessions');
    const q = firestoreModule.query(colRef, firestoreModule.orderBy('timestamp', 'desc'));
    const snapshot = await firestoreModule.getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        timestamp: data.timestamp.toMillis()
      };
    });
  } catch (error) {
    console.error('Failed to load sessions from Firestore:', error);
    return [];
  }
}

export async function loadKarutaSessionsFromFirestore(userId) {
  if (!db || !userId || !firestoreModule) return [];

  try {
    const colRef = firestoreModule.collection(db, 'users', userId, 'karutaSessions');
    const q = firestoreModule.query(colRef, firestoreModule.orderBy('timestamp', 'desc'));
    const snapshot = await firestoreModule.getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        timestamp: data.timestamp.toMillis()
      };
    });
  } catch (error) {
    console.error('Failed to load karuta sessions from Firestore:', error);
    return [];
  }
}

export async function deleteAllSessionsFromFirestore(userId) {
  if (!db || !userId || !firestoreModule) return false;

  try {
    const colRef = firestoreModule.collection(db, 'users', userId, 'quizSessions');
    const snapshot = await firestoreModule.getDocs(colRef);

    const batch = firestoreModule.writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return true;
  } catch (error) {
    console.error('Failed to delete sessions from Firestore:', error);
    return false;
  }
}

export async function deleteAllKarutaSessionsFromFirestore(userId) {
  if (!db || !userId || !firestoreModule) return false;

  try {
    const colRef = firestoreModule.collection(db, 'users', userId, 'karutaSessions');
    const snapshot = await firestoreModule.getDocs(colRef);

    const batch = firestoreModule.writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return true;
  } catch (error) {
    console.error('Failed to delete karuta sessions from Firestore:', error);
    return false;
  }
}

export async function uploadLocalHistoryToFirestore(userId, localHistory) {
  if (!db || !userId || !localHistory.length || !firestoreModule) return 0;

  try {
    const colRef = firestoreModule.collection(db, 'users', userId, 'quizSessions');
    const snapshot = await firestoreModule.getDocs(colRef);
    const existingIds = new Set(snapshot.docs.map(doc => doc.id));

    const batch = firestoreModule.writeBatch(db);
    let count = 0;

    for (const session of localHistory) {
      if (!existingIds.has(session.sessionId)) {
        const docRef = firestoreModule.doc(colRef, session.sessionId);
        batch.set(docRef, {
          ...session,
          timestamp: firestoreModule.Timestamp.fromMillis(session.timestamp)
        });
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
      console.log(`Uploaded ${count} sessions from localStorage to Firestore`);
    }

    return count;
  } catch (error) {
    console.error('Failed to upload local history to Firestore:', error);
    return 0;
  }
}

export function getFirestoreDb() {
  return db;
}

