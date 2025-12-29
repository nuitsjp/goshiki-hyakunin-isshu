import { ENABLE_FIREBASE_AUTH, FIREBASE_CONFIG, AUTH_PROVIDER } from './config.js';

const normalizeAuthConfig = () => {
  if (!ENABLE_FIREBASE_AUTH || !FIREBASE_CONFIG) return null;
  if (typeof FIREBASE_CONFIG !== 'object') return null;
  return FIREBASE_CONFIG;
};

const setAuthStatus = (elements, { statusText, userText, isSignedIn }) => {
  if (elements.authStatus) {
    elements.authStatus.textContent = statusText;
    elements.authStatus.classList.toggle('is-signed-in', Boolean(isSignedIn));
  }
  if (elements.authUser) {
    elements.authUser.textContent = userText;
  }
  if (elements.authSignIn) {
    elements.authSignIn.classList.toggle('hidden', Boolean(isSignedIn));
    elements.authSignIn.disabled = false;
  }
  if (elements.authSignOut) {
    elements.authSignOut.classList.toggle('hidden', !isSignedIn);
    elements.authSignOut.disabled = false;
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

export const initAuthUI = async ({ elements }) => {
  if (!elements || !elements.authSection) return;

  const firebaseConfig = normalizeAuthConfig();
  if (!firebaseConfig) {
    elements.authSection.classList.add('hidden');
    return;
  }

  elements.authSection.classList.remove('hidden');
  setAuthStatus(elements, {
    statusText: '未ログイン',
    userText: 'ゲスト',
    isSignedIn: false,
  });

  try {
    const appModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const authModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');

    const app = appModule.initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const provider = resolveProvider(authModule);

    if (!provider) {
      setAuthMessage(elements, '未対応のログイン方式です。');
      if (elements.authSignIn) elements.authSignIn.disabled = true;
      return;
    }

    authModule.onAuthStateChanged(auth, (user) => {
      if (user) {
        const name = user.displayName || user.email || 'ユーザー';
        setAuthStatus(elements, {
          statusText: 'ログイン中',
          userText: name,
          isSignedIn: true,
        });
        setAuthMessage(elements, '');
        return;
      }
      setAuthStatus(elements, {
        statusText: '未ログイン',
        userText: 'ゲスト',
        isSignedIn: false,
      });
    });

    if (elements.authSignIn) {
      elements.authSignIn.addEventListener('click', async () => {
        elements.authSignIn.disabled = true;
        setAuthMessage(elements, '');
        try {
          await authModule.signInWithPopup(auth, provider);
        } catch (error) {
          console.error(error);
          setAuthMessage(elements, 'ログインに失敗しました。もう一度お試しください。');
          elements.authSignIn.disabled = false;
        }
      });
    }

    if (elements.authSignOut) {
      elements.authSignOut.addEventListener('click', async () => {
        elements.authSignOut.disabled = true;
        setAuthMessage(elements, '');
        try {
          await authModule.signOut(auth);
        } catch (error) {
          console.error(error);
          setAuthMessage(elements, 'ログアウトに失敗しました。');
          elements.authSignOut.disabled = false;
        }
      });
    }
  } catch (error) {
    console.error(error);
    setAuthMessage(elements, '認証の初期化に失敗しました。');
    if (elements.authSignIn) elements.authSignIn.disabled = true;
  }
};
