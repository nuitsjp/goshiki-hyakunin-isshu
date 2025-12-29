import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildElements = () => {
  document.body.innerHTML = `
    <div id="auth-section">
      <div id="auth-menu" class="hidden">
        <button id="auth-logout" class="hidden">ログアウト</button>
      </div>
      <button id="auth-button"></button>
      <img id="auth-avatar" class="hidden" />
      <span id="auth-avatar-fallback"></span>
      <div id="auth-message"></div>
    </div>
  `;
  return {
    authSection: document.getElementById('auth-section'),
    authButton: document.getElementById('auth-button'),
    authAvatar: document.getElementById('auth-avatar'),
    authAvatarFallback: document.getElementById('auth-avatar-fallback'),
    authMenu: document.getElementById('auth-menu'),
    authLogout: document.getElementById('auth-logout'),
    authMessage: document.getElementById('auth-message'),
  };
};

const createFirebaseMocks = ({ signInReject = false, signOutReject = false } = {}) => {
  let authStateCallback = null;
  const auth = { currentUser: null };
  const authModule = {
    GoogleAuthProvider: function GoogleAuthProvider() {},
    getAuth: () => auth,
    onAuthStateChanged: vi.fn((_, cb) => {
      authStateCallback = cb;
    }),
    signInWithPopup: vi.fn(() => (
      signInReject ? Promise.reject(new Error('sign-in-failed')) : Promise.resolve()
    )),
    signOut: vi.fn(() => (
      signOutReject ? Promise.reject(new Error('sign-out-failed')) : Promise.resolve()
    )),
  };
  const appModule = {
    initializeApp: vi.fn(() => ({})),
  };
  return {
    appModule,
    authModule,
    auth,
    getAuthStateCallback: () => authStateCallback,
  };
};

const loadAuthModule = async (configOverrides = {}) => {
  vi.resetModules();
  vi.doMock('../docs/js/config.js', () => ({
    ENABLE_FIREBASE_AUTH: true,
    FIREBASE_CONFIG: { projectId: 'test' },
    AUTH_PROVIDER: 'google',
    ...configOverrides,
  }));
  return await import('../docs/js/auth.js');
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when auth section is missing', async () => {
    const { initAuthUI } = await loadAuthModule();
    await expect(initAuthUI({ elements: {} })).resolves.toBeUndefined();
  });

  it('hides auth section when Firebase config is disabled', async () => {
    const { initAuthUI } = await loadAuthModule({
      ENABLE_FIREBASE_AUTH: false,
      FIREBASE_CONFIG: null,
    });
    const elements = buildElements();
    elements.authSection.classList.remove('hidden');

    await initAuthUI({ elements });
    expect(elements.authSection.classList.contains('hidden')).toBe(true);
  });

  it('disables auth button for unsupported provider', async () => {
    const { initAuthUI } = await loadAuthModule({
      AUTH_PROVIDER: 'github',
    });
    const elements = buildElements();
    const mocks = createFirebaseMocks();

    await initAuthUI({
      elements,
      loadModules: async () => mocks,
    });

    expect(elements.authButton.disabled).toBe(true);
    expect(elements.authMessage.textContent).toBe('未対応のログイン方式です。');
  });

  it('hides auth section when Firebase config is not an object', async () => {
    const { initAuthUI } = await loadAuthModule({
      ENABLE_FIREBASE_AUTH: true,
      FIREBASE_CONFIG: 'invalid',
    });
    const elements = buildElements();
    elements.authSection.classList.remove('hidden');

    await initAuthUI({ elements });
    expect(elements.authSection.classList.contains('hidden')).toBe(true);
  });

  it('handles missing authMessage and authMenu safely', async () => {
    const { initAuthUI } = await loadAuthModule({
      AUTH_PROVIDER: 'github',
    });
    const elements = buildElements();
    elements.authMessage = null;
    elements.authMenu = null;
    const mocks = createFirebaseMocks();

    await initAuthUI({
      elements,
      loadModules: async () => mocks,
    });

    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(elements.authButton.disabled).toBe(true);
  });

  it('updates UI on auth state change and handles sign-in success', async () => {
    const { initAuthUI } = await loadAuthModule();
    const elements = buildElements();
    const mocks = createFirebaseMocks();

    await initAuthUI({
      elements,
      loadModules: async () => mocks,
    });

    const callback = mocks.getAuthStateCallback();
    const user = { displayName: 'テスト', photoURL: 'https://example.com/a.png' };
    mocks.auth.currentUser = user;
    callback(user);

    expect(elements.authAvatar.classList.contains('hidden')).toBe(false);
    expect(elements.authAvatarFallback.classList.contains('hidden')).toBe(true);
    expect(elements.authLogout.classList.contains('hidden')).toBe(false);

    mocks.auth.currentUser = null;
    elements.authButton.click();
    await flushPromises();
    expect(mocks.authModule.signInWithPopup).toHaveBeenCalled();
    expect(elements.authButton.disabled).toBe(false);
  });

  it('handles signed-out state change', async () => {
    const { initAuthUI } = await loadAuthModule();
    const elements = buildElements();
    const mocks = createFirebaseMocks();

    await initAuthUI({
      elements,
      loadModules: async () => mocks,
    });

    const callback = mocks.getAuthStateCallback();
    callback(null);

    expect(elements.authLogout.classList.contains('hidden')).toBe(true);
    expect(elements.authMenu.classList.contains('hidden')).toBe(true);
  });

  it('shows fallback avatar and handles sign-in failure', async () => {
    const { initAuthUI } = await loadAuthModule();
    const elements = buildElements();
    const mocks = createFirebaseMocks({ signInReject: true });

    await initAuthUI({
      elements,
      loadModules: async () => mocks,
    });

    const callback = mocks.getAuthStateCallback();
    callback({ displayName: 'テスト', photoURL: '' });

    expect(elements.authAvatar.classList.contains('hidden')).toBe(true);
    expect(elements.authAvatarFallback.classList.contains('hidden')).toBe(false);

    elements.authButton.click();
    await flushPromises();
    expect(elements.authMessage.textContent).toBe('ログインに失敗しました。もう一度お試しください。');
  });

  it('shows error message when module loading fails', async () => {
    const { initAuthUI } = await loadAuthModule();
    const elements = buildElements();

    await initAuthUI({
      elements,
      loadModules: async () => {
        throw new Error('load-failed');
      },
    });

    expect(elements.authMessage.textContent).toBe('認証の初期化に失敗しました。');
    expect(elements.authButton.disabled).toBe(true);
    expect(elements.authLogout.disabled).toBe(true);
  });

  it('toggles menu and closes on outside click or escape', async () => {
    const { initAuthUI } = await loadAuthModule();
    const elements = buildElements();
    const mocks = createFirebaseMocks();

    await initAuthUI({
      elements,
      loadModules: async () => mocks,
    });

    mocks.auth.currentUser = { uid: '1' };
    const callback = mocks.getAuthStateCallback();
    callback({ displayName: 'テスト', photoURL: '' });

    elements.authButton.click();
    expect(elements.authMenu.classList.contains('hidden')).toBe(false);

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(elements.authMenu.classList.contains('hidden')).toBe(true);

    elements.authButton.click();
    expect(elements.authMenu.classList.contains('hidden')).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(elements.authMenu.classList.contains('hidden')).toBe(true);
  });

  it('handles logout failure and success', async () => {
    const { initAuthUI } = await loadAuthModule();
    const elements = buildElements();
    const mocks = createFirebaseMocks({ signOutReject: true });

    await initAuthUI({
      elements,
      loadModules: async () => mocks,
    });

    mocks.auth.currentUser = { uid: '1' };
    const callback = mocks.getAuthStateCallback();
    callback({ displayName: 'テスト', photoURL: '' });

    elements.authButton.click();
    elements.authLogout.click();
    await flushPromises();
    expect(mocks.authModule.signOut).toHaveBeenCalled();
    expect(elements.authMessage.textContent).toBe('ログアウトに失敗しました。');

    const successElements = buildElements();
    const successMocks = createFirebaseMocks();
    await initAuthUI({
      elements: successElements,
      loadModules: async () => successMocks,
    });
    successMocks.auth.currentUser = { uid: '1' };
    successMocks.getAuthStateCallback()({ displayName: 'テスト', photoURL: '' });
    successElements.authButton.click();
    successElements.authLogout.click();
    await flushPromises();
    expect(successMocks.authModule.signOut).toHaveBeenCalled();
  });
});
