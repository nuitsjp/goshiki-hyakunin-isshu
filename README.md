# 五色百人一首 学習Webアプリ 要件定義・設計書

## 1. プロジェクト概要

### 目的
競技かるた用の五色百人一首の決まり字を学習するためのクイズ形式Webアプリケーション

### ターゲット
- 百人一首を学習したい初心者～中級者
- 競技かるたの決まり字を覚えたい学生
- PC・スマートフォン・タブレットから利用

### デプロイ先
GitHub Pages（静的サイトホスティング）

---

## 2. 技術スタック

### フロントエンド
- **HTML5**: セマンティックなマークアップ
- **CSS3**: レスポンシブデザイン
- **JavaScript (Vanilla)**: ES6+構文使用
- **Bootstrap 5.3**: UIフレームワーク（CDN経由）
- **PapaParse**: CSV読み込みライブラリ（CDN経由）

### データ
- **CSV形式**: `hyakunin_isshu_with_ruby.csv`
- フィールド: 色、上の句、下の句、読み、決まり字

### ホスティング
- GitHub Pages
- 静的ファイルのみ（サーバーサイド処理なし）

---

## 3. 機能要件

### 3.1 基本機能

#### F1: 色選択機能
- 5色（青/ピンク/黄/緑/オレンジ）から1色を選択
- 各色には20首の歌が含まれる
- ボタンは選択した色に対応する配色

#### F2: クイズ出題機能
- 選択した色の20首をランダムな順序で出題
- 各問題で「決まり字（競技かるた）」を表示
- 正解の下の句を含む4択を表示
- 誤答3つは同じ色の他の下の句からランダム抽出
- 出題済みの歌は重複しない

#### F3: 回答判定機能
- ユーザーの選択を即座に判定
- 正解時: 緑色で「正解！」を表示
- 不正解時: 赤色で「不正解」を表示し、正解を表示
- 次の問題へ自動遷移（1秒後）

#### F4: 進捗表示機能
- 「問題 X / 20」形式で現在位置を表示
- プログレスバーで視覚的に進捗を表示

#### F5: 結果表示機能
- 全20問終了後、正答率を表示
- 「XX / 20 問正解（正答率 XX%）」
- 評価コメント（例: 90%以上「素晴らしい！」）
- リトライボタンで再挑戦可能
- 別の色を選択するボタン

### 3.2 UI/UX要件

#### R1: レスポンシブデザイン
- スマートフォン（320px～）
- タブレット（768px～）
- デスクトップ（1024px～）

#### R2: アクセシビリティ
- 適切なコントラスト比
- フォントサイズは最低16px
- タップターゲットは最低44x44px（モバイル）

#### R3: パフォーマンス
- 初回読み込み時にCSVを一度だけ読み込み
- ページ遷移なし（SPA的な動作）

---

## 4. 画面設計

### 4.1 画面遷移フロー

```
[スタート画面]
    ↓ 色を選択
[クイズ画面] ← ループ（20回）
    ↓ 20問完了
[結果画面]
    ↓ リトライ or 色選択
[スタート画面] or [クイズ画面]
```

### 4.2 画面詳細

#### 画面1: スタート画面（#start-screen）

**表示要素:**
- タイトル: 「五色百人一首 決まり字クイズ」
- サブタイトル: 「色を選んでください」
- 色選択ボタン x 5個
  - 青（#4A90E2）
  - ピンク（#FF6B9D）
  - 黄（#FFC107）
  - 緑（#4CAF50）
  - オレンジ（#FF9800）

**レイアウト:**
- 中央寄せ
- カード形式
- ボタンは縦並び（モバイル）、横並び（デスクトップ）

---

#### 画面2: クイズ画面（#quiz-screen）

**表示要素:**
- 進捗表示: 「問題 X / 20」
- プログレスバー
- 問題カード:
  - 決まり字（大きく表示）
  - 「どの下の句？」
- 選択肢ボタン x 4個（下の句）
- フィードバック表示エリア（正解/不正解）

**レイアウト:**
- 上部: 進捗情報
- 中央: 決まり字（大きめのフォント）
- 下部: 選択肢ボタン（縦並び）

**インタラクション:**
1. ユーザーがボタンをクリック
2. 全ボタンを無効化
3. 正解ボタンを緑、不正解ボタンを赤に変更
4. フィードバックメッセージ表示
5. 1秒後に次の問題へ遷移

---

#### 画面3: 結果画面（#result-screen）

**表示要素:**
- タイトル: 「結果発表」
- 正答数: 「XX / 20 問正解」
- 正答率: 「正答率 XX%」
- 評価コメント:
  - 100%: 「完璧です！🎉」
  - 90%以上: 「素晴らしい！」
  - 70%以上: 「よくできました！」
  - 50%以上: 「もう少しです」
  - 50%未満: 「復習しましょう」
- アクションボタン:
  - 「同じ色で再挑戦」
  - 「別の色を選ぶ」

**レイアウト:**
- 中央寄せ
- カード形式
- 大きな数字で正答率を強調

---

## 5. データ構造

### 5.1 CSVデータ構造

```csv
色,上の句,下の句,上の句読み,下の句読み,決まり字（競技かるた）,決まり字（五色百人一首）
青,朝[あさ]ぼらけ...,吉野[よしの]の里[さと]に...,あさぼらけ...,よしののさとに...,あさぼらけあ,あさ
```

### 5.2 JavaScript内部データ構造

#### 歌データ配列
```javascript
const poems = [
  {
    color: "青",
    kamiNoKu: "朝ぼらけ有明の月と見るまでに",
    shimoNoKu: "吉野の里に降れる白雪",
    kamiReading: "あさぼらけ ありあけのつきと みるまでに",
    shimoReading: "よしののさとに ふれるしらゆき",
    kimariji: "あさぼらけあ",
    kimarijiShort: "あさ"
  },
  // ... 残り99首
];
```

#### クイズ状態管理
```javascript
const quizState = {
  selectedColor: "青",        // 選択された色
  currentQuestions: [],       // シャッフル済み20問
  currentIndex: 0,            // 現在の問題番号（0-19）
  correctCount: 0,            // 正解数
  answers: []                 // 回答履歴
};
```

#### 選択肢データ
```javascript
const questionData = {
  kimariji: "あさぼらけあ",
  correctAnswer: "吉野の里に降れる白雪",
  options: [
    "吉野の里に降れる白雪",  // 正解
    "龍田の川の錦なりけり",
    "暁ばかり憂きものはなし",
    "をとめの姿しばしとどめむ"
  ],
  correctIndex: 0  // optionsの中の正解インデックス
};
```

---

## 6. UI/UXデザイン詳細

### 6.1 カラーパレット

#### 五色テーマカラー
```css
:root {
  --color-blue: #4A90E2;
  --color-pink: #FF6B9D;
  --color-yellow: #FFC107;
  --color-green: #4CAF50;
  --color-orange: #FF9800;
  
  /* フィードバックカラー */
  --color-correct: #28a745;
  --color-incorrect: #dc3545;
  
  /* ベースカラー */
  --color-bg: #f8f9fa;
  --color-text: #212529;
  --color-border: #dee2e6;
}
```

#### 各色の適用例
- ボタン背景色
- プログレスバー
- アクセントカラー

### 6.2 タイポグラフィ

```css
/* タイトル */
h1 { font-size: 2rem; font-weight: 700; }

/* 決まり字 */
.kimariji-display { 
  font-size: 3rem; 
  font-weight: 700;
  letter-spacing: 0.1em;
}

/* 選択肢 */
.option-button { 
  font-size: 1.1rem; 
  line-height: 1.6;
}

/* 本文 */
body { 
  font-size: 16px; 
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

### 6.3 レスポンシブブレークポイント

```css
/* モバイル（デフォルト） */
@media (max-width: 767px) {
  /* ボタン: 縦並び、フルWidth */
}

/* タブレット */
@media (min-width: 768px) {
  /* ボタン: 横並び、適切な幅 */
}

/* デスクトップ */
@media (min-width: 1024px) {
  /* 最大幅を制限、中央寄せ */
}
```

---

## 7. ファイル構成

```
goshiki-hyakunin-isshu/
├── app/                   # Webアプリ本体
│   ├── index.html         # メインHTMLファイル
│   ├── css/
│   │   └── style.css      # カスタムCSS
│   ├── js/
│   │   └── app.js         # メインJavaScript
│   └── data/
│       └── hyakunin_isshu_with_ruby.csv  # 歌データ
├── AGENTS.md              # AIエージェント用ドキュメント
├── LICENSE                # ライセンスファイル
└── README.md              # プロジェクト説明
```

---

## 8. 主要処理フロー

### 8.1 初期化処理

```
1. DOMContentLoaded
2. CSVファイル読み込み（PapaParse）
3. データをJavaScript配列に変換
4. スタート画面表示
```

### 8.2 クイズ開始処理

```
1. 色ボタンクリック
2. 選択色の20首を抽出
3. Fisher-Yatesアルゴリズムでシャッフル
4. クイズ状態初期化
5. クイズ画面表示
6. 最初の問題表示
```

### 8.3 問題表示処理

```
1. 現在の問題データ取得
2. 決まり字表示
3. 選択肢生成:
   - 正解の下の句を1つ
   - 同じ色の他の下の句から3つランダム抽出
   - 4つをシャッフル
4. ボタンに選択肢を設定
5. 進捗情報更新
```

### 8.4 回答処理

```
1. ユーザーがボタンクリック
2. 全ボタンを無効化
3. 正誤判定
4. フィードバック表示:
   - 正解: ボタンを緑、「正解！」メッセージ
   - 不正解: 選択ボタンを赤、正解ボタンを緑
5. 正解数カウント更新
6. 1秒待機
7. 次の問題 or 結果画面へ遷移
```

### 8.5 結果表示処理

```
1. 正答率計算
2. 評価コメント決定
3. 結果画面表示
4. アクションボタン設定
```

---

## 9. アルゴリズム詳細

### 9.1 配列シャッフル（Fisher-Yates）

```javascript
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

### 9.2 誤答選択肢生成

```javascript
function generateOptions(correctPoem, allPoemsOfColor) {
  // 正解以外の歌を抽出
  const wrongPoems = allPoemsOfColor.filter(p => p !== correctPoem);
  
  // ランダムに3つ選択
  const shuffled = shuffleArray(wrongPoems);
  const wrongOptions = shuffled.slice(0, 3);
  
  // 正解と誤答を結合してシャッフル
  const allOptions = [correctPoem, ...wrongOptions];
  return shuffleArray(allOptions);
}
```

---

## 10. デプロイ手順

### 10.1 GitHub Pagesへのデプロイ

```bash
# 1. GitHubリポジトリ作成
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/hyakunin-isshu-quiz.git
git push -u origin main

# 2. GitHub Pages設定
# Settings > Pages > Source: main branch
```

### 10.2 公開URL
```
https://nuitsjp.github.io/goshiki-hyakunin-isshu/app/
```

---

## 11. テストケース

### 11.1 機能テスト

| テスト項目 | 手順 | 期待結果 |
|-----------|------|---------|
| CSV読み込み | ページ読み込み | 100首すべて読み込まれる |
| 色選択 | 青ボタンクリック | 青の20首が表示される |
| ランダム出題 | 複数回実行 | 毎回順序が異なる |
| 重複なし | 20問プレイ | 同じ歌が出ない |
| 正解判定 | 正解選択 | 緑色、正解数+1 |
| 不正解判定 | 誤答選択 | 赤色、正解表示 |
| 進捗表示 | 各問題 | 「X/20」正しく表示 |
| 結果表示 | 20問完了 | 正答率正しく計算 |

### 11.2 レスポンシブテスト

| デバイス | 解像度 | 確認項目 |
|---------|-------|---------|
| iPhone SE | 375x667 | ボタンが縦並び、タップ可能 |
| iPad | 768x1024 | レイアウト適切 |
| Desktop | 1920x1080 | 最大幅制限、中央寄せ |

---

## 12. 将来の拡張案

### 優先度: 中
- [ ] 上の句も表示するモード
- [ ] タイマー機能（制限時間）
- [ ] ランキング（LocalStorage）
- [ ] 音声読み上げ

### 優先度: 低
- [ ] 間違えた歌のみ復習
- [ ] 全色ランダムモード
- [ ] ダークモード切り替え
- [ ] アニメーション強化

---

## 13. 参考資料

### 技術ドキュメント
- Bootstrap 5: https://getbootstrap.com/docs/5.3/
- PapaParse: https://www.papaparse.com/
- GitHub Pages: https://pages.github.com/

### デザイン参考
- カラーパレット: Coolors.co
- Material Design: https://m3.material.io/

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-12-28 | 1.0 | 初版作成 |

---

**文書作成者**: Claude  
**承認者**: Atsushi  
**最終更新**: 2025-12-28