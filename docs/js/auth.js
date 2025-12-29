import { ENABLE_FIREBASE_AUTH, FIREBASE_CONFIG, AUTH_PROVIDER } from './config.js';

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
  if (elements.authButton) {
    elements.authButton.setAttribute(
      'aria-label',
      isSignedIn ? 'アカウントメニューを開く' : 'Googleでログイン'
    );
    elements.authButton.disabled = false;
    elements.authButton.setAttribute('aria-expanded', 'false');
  }
  if (elements.authLogout) {
    elements.authLogout.classList.toggle('hidden', !isSignedIn);
    elements.authLogout.disabled = false;
  }
  if (elements.authMenu && !isSignedIn) {
    elements.authMenu.classList.add('hidden');
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

export const initAuthUI = async ({ elements, loadModules = loadFirebaseModules } = {}) => {
  if (!elements || !elements.authSection) return;

  const firebaseConfig = normalizeAuthConfig();
  if (!firebaseConfig) {
    elements.authSection.classList.add('hidden');
    return;
  }

  elements.authSection.classList.remove('hidden');
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
    const closeMenu = () => {
      if (elements.authMenu) elements.authMenu.classList.add('hidden');
      if (elements.authButton) elements.authButton.setAttribute('aria-expanded', 'false');
    };
    const toggleMenu = () => {
      if (!elements.authMenu) return;
      const isOpen = !elements.authMenu.classList.contains('hidden');
      elements.authMenu.classList.toggle('hidden', isOpen);
      if (elements.authButton) {
        elements.authButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      }
    };

    if (!provider) {
      setAuthMessage(elements, '未対応のログイン方式です。');
      if (elements.authButton) elements.authButton.disabled = true;
      return;
    }

    authModule.onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthStatus(elements, {
          isSignedIn: true,
          photoUrl: user.photoURL || '',
          userText: user.displayName || user.email || 'ユーザー',
        });
        closeMenu();
        setAuthMessage(elements, '');
        return;
      }
      setAuthStatus(elements, {
        isSignedIn: false,
        photoUrl: '',
        userText: 'ゲスト',
      });
      closeMenu();
    });

    if (elements.authButton) {
      elements.authButton.addEventListener('click', async () => {
        if (!auth.currentUser) {
          elements.authButton.disabled = true;
          setAuthMessage(elements, '');
          try {
            await authModule.signInWithPopup(auth, provider);
          } catch (error) {
            console.error(error);
            setAuthMessage(elements, 'ログインに失敗しました。もう一度お試しください。');
          } finally {
            elements.authButton.disabled = false;
          }
          return;
        }
        toggleMenu();
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

    document.addEventListener('click', (event) => {
      if (!elements.authMenu || !elements.authButton) return;
      const target = event.target;
      if (!target) return;
      const isInside = elements.authMenu.contains(target) || elements.authButton.contains(target);
      if (!isInside) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    });
  } catch (error) {
    console.error(error);
    setAuthMessage(elements, '認証の初期化に失敗しました。');
    if (elements.authButton) elements.authButton.disabled = true;
    if (elements.authLogout) elements.authLogout.disabled = true;
  }
};
