/**
 * デバッグ用ロギングツール
 *
 * 使用方法:
 * 1. ブラウザのコンソールを開く
 * 2. window.enableFirestoreDebug() を実行
 * 3. クイズをプレイしたり統計を見たりする
 * 4. window.getFirestoreDebugLog() でログを確認
 */

const LOG_KEY = 'firestore_debug_log';
let isEnabled = false;
let logEntries = [];

export function enableDebug() {
  isEnabled = true;
  logEntries = [];
  console.log('🔍 Firestore同期デバッグモードを有効化しました');
  console.log('ログを確認するには window.getFirestoreDebugLog() を実行してください');
}

export function disableDebug() {
  isEnabled = false;
  console.log('🔍 Firestore同期デバッグモードを無効化しました');
}

export function log(category, action, data = {}) {
  if (!isEnabled) return;

  const entry = {
    timestamp: new Date().toISOString(),
    time: new Date().toLocaleTimeString('ja-JP'),
    category,
    action,
    ...data,
  };

  logEntries.push(entry);

  // コンソールにも出力
  const emoji = {
    auth: '🔐',
    save: '💾',
    load: '📥',
    sync: '🔄',
    error: '❌',
  }[category] || '📝';

  console.log(`${emoji} [${category}] ${action}`, data);
}

export function getLog() {
  return logEntries;
}

export function clearLog() {
  logEntries = [];
  console.log('🗑️ デバッグログをクリアしました');
}

export function printLog() {
  console.table(logEntries);
}

export function exportLog() {
  const blob = new Blob([JSON.stringify(logEntries, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `firestore-debug-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.log('📄 ログをファイルにエクスポートしました');
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.enableFirestoreDebug = enableDebug;
  window.disableFirestoreDebug = disableDebug;
  window.getFirestoreDebugLog = getLog;
  window.printFirestoreDebugLog = printLog;
  window.clearFirestoreDebugLog = clearLog;
  window.exportFirestoreDebugLog = exportLog;
}
