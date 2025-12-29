import { ENABLE_FIREBASE_AUTH, FIREBASE_CONFIG, AUTH_PROVIDER, STORAGE_KEYS } from './config.js';
import { uploadLocalHistoryToFirestore, initializeFirestore } from './firestore.js';

let currentUser = null;

export function getCurrentUserId() {
  return currentUser?.uid || null;
}

const normalizeAuthConfig = () => {
  if (!ENABLE_FIREBASE_AUTH || !FIREBASE_CONFIG) return null;
  if (typeof FIREBASE_CONFIG !== 'object') return null;
  return FIREBASE_CONFIG;
};

const setAuthStatus = (elements, { isSignedIn, photoUrl, userText }) => {
  if (elements.authAvatar && elements.authAvatarFallback) {
    if (photoUrl) {
      elements.authAvatar.src = photoUrl;
      elements.authAvatar.alt = 'ログイン中のアカウント';
      elements.authAvatar.classList.remove('hidden');
      elements.authAvatarFallback.classList.add('hidden');
    } else {
      elements.authAvatar.src = '';
      elements.authAvatar.alt = '';
      elements.authAvatar.classList.add('hidden');
      elements.authAvatarFallback.classList.remove('hidden');
    }
  }
  if (elements.menuButton) {
    elements.menuButton.setAttribute(
      'aria-label',
      isSignedIn ? 'アカウントと設定メニューを開く' : '設定メニューを開く'
    );
    elements.menuButton.disabled = false;
    elements.menuButton.setAttribute('aria-expanded', 'false');
  }
  if (elements.authLogin) {
    elements.authLogin.classList.toggle('hidden', isSignedIn);
    elements.authLogin.disabled = false;
  }
  if (elements.authLogout) {
    elements.authLogout.classList.toggle('hidden', !isSignedIn);
    elements.authLogout.disabled = false;
  }
};

const setAuthMessage = (elements, message = '') => {
  if (!elements.authMessage) return;
  elements.authMessage.textContent = message;
};

const resolveProvider = (authModule) => {
  if (AUTH_PROVIDER === 'google') {
    return new authModule.GoogleAuthProvider();
  }
  return null;
};

const loadFirebaseModules = async () => {
  const appModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const authModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
  return { appModule, authModule };
};

export const initAuthUI = async ({
  elements,
  loadModules = loadFirebaseModules,
  closeMenu = () => {},
} = {}) => {
  if (!elements) return;
  if (!elements.menuButton && !elements.authLogin && !elements.authLogout) return;

  const firebaseConfig = normalizeAuthConfig();
  if (!firebaseConfig) {
    if (elements.authLogin) elements.authLogin.classList.add('hidden');
    if (elements.authLogout) elements.authLogout.classList.add('hidden');
    return;
  }
  setAuthStatus(elements, {
    isSignedIn: false,
    photoUrl: '',
    userText: 'ゲスト',
  });

  try {
    const { appModule, authModule } = await loadModules();

    const app = appModule.initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const provider = resolveProvider(authModule);

    await initializeFirestore(app);

    if (!provider) {
      setAuthMessage(elements, '未対応のログイン方式です。');
      if (elements.authLogin) elements.authLogin.disabled = true;
      if (elements.authLogout) elements.authLogout.disabled = true;
      return;
    }

    authModule.onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      if (user) {
        setAuthStatus(elements, {
          isSignedIn: true,
          photoUrl: user.photoURL || '',
          userText: user.displayName || user.email || 'ユーザー',
        });
        closeMenu();
        setAuthMessage(elements, '');

        try {
          const localDataStr = localStorage.getItem(STORAGE_KEYS.HISTORY);
          if (localDataStr) {
            const localHistory = JSON.parse(localDataStr);
            if (localHistory.length > 0) {
              const count = await uploadLocalHistoryToFirestore(user.uid, localHistory);
              if (count > 0) {
                localStorage.removeItem(STORAGE_KEYS.HISTORY);
                console.log(`Migrated ${count} sessions to Firestore`);
              }
            }
          }
        } catch (error) {
          console.error('Failed to migrate local history:', error);
        }

        return;
      }
      setAuthStatus(elements, {
        isSignedIn: false,
        photoUrl: '',
        userText: 'ゲスト',
      });
      closeMenu();
    });

    if (elements.authLogin) {
      elements.authLogin.addEventListener('click', async () => {
        elements.authLogin.disabled = true;
        setAuthMessage(elements, '');
        closeMenu();
        try {
          await authModule.signInWithPopup(auth, provider);
        } catch (error) {
          console.error(error);
          setAuthMessage(elements, 'ログインに失敗しました。もう一度お試しください。');
          elements.authLogin.disabled = false;
        }
      });
    }
    if (elements.authLogout) {
      elements.authLogout.addEventListener('click', async () => {
        elements.authLogout.disabled = true;
        setAuthMessage(elements, '');
        closeMenu();
        try {
          await authModule.signOut(auth);
        } catch (error) {
          console.error(error);
          setAuthMessage(elements, 'ログアウトに失敗しました。');
          elements.authLogout.disabled = false;
        }
      });
    }

  } catch (error) {
    console.error(error);
    setAuthMessage(elements, '認証の初期化に失敗しました。');
    if (elements.authLogin) elements.authLogin.disabled = true;
    if (elements.authLogout) elements.authLogout.disabled = true;
  }
};
