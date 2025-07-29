# 家計簿アプリ (Kakeibo App)

楽天カードのCSVデータをアップロードするだけで、支出をカテゴリ別に自動分析できるWebアプリケーションです。

## 🌟 デモ

<!-- TODO: Vercelのデプロイ後にリンクを挿入 -->
[こちらから使えます](vercel-link-to-be-inserted)

## ✨ 主な機能

- **簡単CSV分析**: 楽天カードのCSVファイルをドラッグ&ドロップするだけ
- **自動カテゴリ分け**: 支出を「コンビニ」「通信費」「サブスク」「交通費」「少額決済」に自動分類
- **詳細表示**: 各カテゴリの内訳を利用日・店名・金額で確認可能
- **プライバシー重視**: 全ての処理はブラウザ内で完結（データはサーバーに送信されません）
- **レスポンシブ対応**: PC・タブレット・スマートフォンに対応

## 🚀 使い方

1. [楽天e-NAVI](https://login.account.rakuten.com/sso/authorize?client_id=rakuten_card_enavi_web&redirect_uri=https://www.rakuten-card.co.jp/e-navi/auth/login.xhtml&scope=openid%20profile&response_type=code&prompt=login#/sign_in)にアクセスし、利用明細をCSV形式でダウンロード
2. アプリページでCSVファイルをドラッグ&ドロップ
3. 自動分析結果を確認
4. 各カテゴリをクリックして詳細を表示

## 📊 カテゴリ分類ルール

| カテゴリ | 判定条件 |
|---------|---------|
| **コンビニ** | 利用店名に主要コンビニチェーン名が含まれる |
| **通信費 (povo)** | 利用店名に「povo」が含まれる |
| **交通費 (Suica)** | 利用店名に「suica」が含まれる |
| **サブスク** | 利用店名に主要サブスクリプションサービス名が含まれる |
| **少額決済** | 上記に該当せず、1,200円以下のJCB利用 |

## 🛠 技術仕様

### アーキテクチャ
- **フロントエンド**: Next.js (App Router) + React
- **UI**: shadcn/ui + Tailwind CSS
- **状態管理**: Zustand
- **CSV解析**: PapaParse
- **デプロイ**: Vercel

### 主要コンポーネント
- `AppHeader`: タイトル・説明・楽天e-NAVIリンク
- `CsvUploader`: ファイルアップロード機能
- `ResultsDisplay`: カテゴリ別結果表示（アコーディオン形式）
- `AppFooter`: コピーライト・GitHubリンク

### データ処理
- Shift_JISエンコーディング対応
- ルールベースによる自動カテゴリ分類
- ブラウザ内完結処理（プライバシー保護）

## 🎨 デザインコンセプト

- **親しみやすさ**: 家庭的で温かみのあるカラーパレット
- **使いやすさ**: 直感的なインターフェース設計
- **モダン**: 洗練されたUI/UXパターン
- **アクセシビリティ**: 読みやすいフォント・クリックしやすいボタン

## 🔧 開発者向け

### セットアップ
```bash
npm install
npm run dev
```

### ビルド
```bash
npm run build
```

## 📄 ライセンス

© Tsukichan 2025