# Firestore同期デバッグガイド

統計情報がPCとスマホで同期されない場合、このデバッグツールを使用して原因を調査できます。

## デバッグ手順

### 1. デバッグモードを有効化

アプリを開いた状態で、ブラウザのコンソール（開発者ツール）を開き、以下のコマンドを実行します：

```javascript
window.enableFirestoreDebug()
```

コンソールに「🔍 Firestore同期デバッグモードを有効化しました」と表示されます。

### 2. 操作を実行

以下の操作を実行して、ログを記録します：

#### ケース1: ログイン済みでクイズをプレイ
1. すでにログインしている場合、クイズをプレイする
2. 結果画面まで進む

#### ケース2: 未ログイン→ログイン
1. ログアウトした状態でクイズをプレイ
2. 結果を保存
3. ログインする
4. 統計画面を開く

#### ケース3: 別のデバイスで確認
1. PCでログインしてクイズをプレイ
2. スマホで同じアカウントでログイン
3. 統計画面を開く

### 3. ログを確認

コンソールで以下のコマンドを実行してログを確認します：

```javascript
window.printFirestoreDebugLog()
```

または、詳細なログを取得するには：

```javascript
window.getFirestoreDebugLog()
```

### 4. ログをエクスポート

問題報告のため、ログをファイルとして保存できます：

```javascript
window.exportFirestoreDebugLog()
```

## ログの見方

### カテゴリ別の意味

| カテゴリ | 絵文字 | 意味 |
|---------|--------|------|
| `auth` | 🔐 | 認証関連（ログイン/ログアウト） |
| `save` | 💾 | セッション保存 |
| `load` | 📥 | 履歴読み込み |
| `sync` | 🔄 | データ同期・移行 |
| `error` | ❌ | エラー |

### 正常な同期フロー

#### 初回ログイン時
```
🔐 [auth] ログイン成功 { userId: "xxx", displayName: "Your Name" }
🔄 [sync] ローカル履歴検出 { localSessionCount: 5 }
🔄 [sync] Firestoreへ移行完了 { migratedCount: 5 }
🔄 [sync] localStorage履歴を削除
```

#### クイズプレイ時（ログイン済み）
```
💾 [save] セッション保存開始 { sessionId: "xxx", userId: "xxx", color: "青" }
💾 [save] localStorage保存完了 { historyCount: 6 }
💾 [save] Firestore保存完了 { userId: "xxx", sessionId: "xxx" }
```

#### 統計表示時（ログイン済み）
```
📥 [load] 履歴読み込み開始 { userId: "xxx" }
📥 [load] Firestoreから読み込み完了 { sessionCount: 6 }
```

### 問題のパターン

#### パターン1: Firestore保存がスキップされている
```
💾 [save] Firestore保存スキップ（未ログイン）
```
→ **原因**: ログインしていない、または認証セッションが切れている
→ **対策**: ログイン状態を確認

#### パターン2: Firestore保存が失敗
```
❌ [error] Firestore保存失敗 { error: "permission-denied" }
```
→ **原因**: Firestoreセキュリティルールの問題、またはネットワークエラー
→ **対策**: ネットワーク接続を確認、Firebase Consoleでセキュリティルールを確認

#### パターン3: ローカル履歴が移行されていない
```
🔐 [auth] ログイン成功
🔄 [sync] ローカル履歴なし
```
→ **原因**: すでに移行済み、またはログイン前にデータがない
→ **対策**: 正常な動作

#### パターン4: localStorageから読み込んでいる
```
📥 [load] localStorageから読み込み完了 { sessionCount: 5 }
```
→ **原因**: ログインしていない、またはFirestore読み込みに失敗
→ **対策**: ログイン状態を確認

## よくある問題と解決策

### Q1: PCとスマホで統計が同期されない

**確認項目:**
1. 両方のデバイスで同じアカウントでログインしているか
2. ログが以下の順序で記録されているか：
   - PC: `💾 Firestore保存完了`
   - スマホ: `📥 Firestoreから読み込み完了`

**期待される動作:**
- PCで `Firestore保存完了` が表示される
- スマホで `Firestoreから読み込み完了` が表示され、sessionCountがPCと一致する

### Q2: ログイン後も古いデータが表示される

**確認項目:**
1. ログ内に `🔄 localStorage履歴を削除` があるか
2. `📥 Firestoreから読み込み完了` の sessionCount が正しいか

**対策:**
- ブラウザのキャッシュをクリア
- ページをリロード

### Q3: エラーが発生している

**確認項目:**
1. エラーログの内容を確認
2. ネットワーク接続を確認
3. Firebase Consoleでプロジェクト状態を確認

## デバッグモードを無効化

```javascript
window.disableFirestoreDebug()
```

## ログをクリア

```javascript
window.clearFirestoreDebugLog()
```
