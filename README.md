# 五色百人一首 決まり字クイズ

[![test](https://github.com/nuitsjp/goshiki-hyakunin-isshu/actions/workflows/test.yml/badge.svg)](https://github.com/nuitsjp/goshiki-hyakunin-isshu/actions/workflows/test.yml)

公開URL: https://goshiki-hyakunin-isshu.web.app

五色百人一首（青・ピンク・黄・緑・オレンジ）の決まり字を覚えるための学習Webアプリケーションです。

## 概要

このアプリは、五色百人一首の各色（20首ずつ）の問題を4択クイズ形式で出題します。とくに「決まり字」を効率よく覚えることに重点を置いており、ヒント機能や統計情報を活用して学習の進捗を管理できます。

## 開発・テスト

テストの実行にはNode.jsとnpmが必要です。

```bash
npm install
npm test
```

静的解析（JS/HTML/CSS）は以下で実行できます。

```bash
npm run lint
```

カバレッジを取得する場合は以下を実行してください。

```bash
npm run test:coverage
```

HTMLレポートは `coverage/index.html` に出力されます。

## Firebase Hosting

### よく使う Firebase CLI

```bash
# ログイン
firebase login

# プロジェクトの紐づけ
firebase use --add

# Hosting のみデプロイ
firebase deploy --only hosting
```

## 技術スタック

- **Frontend**: HTML5, CSS3 (Modern Japanese Design), JavaScript (Vanilla ES6+)
- **CSS Framework**: Bootstrap 5.3
- **Fonts**: Google Fonts (Zen Old Mincho, Zen Kaku Gothic New)
- **Data**: CSV file (converted from spreadsheet)
- **Hosting**: Firebase Hosting

## ライセンス

MIT License
