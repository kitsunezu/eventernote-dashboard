# Eventernote Dashboard

[English](README.md) | [繁體中文](README.zh-TW.md) | 日本語

Eventernote Dashboard は、公開されている Eventernote のスケジュールを閲覧するための React・TypeScript 製ビューアーです。ランディングページで Eventernote のユーザー ID を入力すると、データベースを利用したスケジュール API からデータを読み込み、タイムライン形式のダッシュボードで確認できます。

## 現在の機能

- Eventernote のユーザー ID を入力するランディングページ
- 選択したユーザーの公開イベント一覧を読み込むビューアーページ
- 日付ごとにグループ化したタイムライン表示
- 現在の表示範囲内で次に開催されるイベントのカウントダウンバナー
- すべてのイベント、または今後のイベントのみを表示する期間切り替え
- 日付、時刻、会場、サムネイルプレビュー、Eventernote への直接リンクを備えたイベントカード
- カテゴリー、全開催時間、場所、出演者の概要、メモ、外部リンクを表示するイベント詳細ドロワー

## 仕組み

現在のアプリは Eventernote の閲覧フローを中心に構成されています。

1. ランディングページでユーザー ID を受け取り、`/{userId}` に移動します。
2. ブラウザーは `GET /api/users/{userId}/events` をリクエストし、Eventernote を直接スクレイピングすることはありません。
3. API は最新の PostgreSQL データを即座に返します。データが古い場合は、古いデータを返しながらバックグラウンドで更新を開始します。
4. サーバーはユーザーの Eventernote 参加数カレンダーを読み取り、空でない月ごとに取得して件数を検証し、イベント ID で重複を除外します。カレンダーを取得できない場合はイベント一覧のページ送りにフォールバックします。
5. 未取得または期限切れのイベント詳細ページを同時実行数を制限して取得し、解析結果をイベントの正規データとして保存します。
6. 未取得または期限切れの会場ページは別途取得し、正式な住所と座標を補完します。Eventernote の座標が無効または存在しない場合は、地図リンク、段階的に簡略化した日本の GSI・Nominatim 住所検索、検証済みの会場名 POI 検索の順にフォールバックします。
7. イベントは Eventernote のイベント ID で重複を除去し、時刻順に並べ、日付ごとにまとめて表示します。

イベント詳細を開くか Eventernote のリンクをたどると、対象のイベントと会場が個別に更新され、その後に最新のデータベース値がアプリへ返されます。

スキーマ、API 契約、更新ポリシー、障害時の動作については [docs/data-api.md](docs/data-api.md) を参照してください。

## 現在のルート

| パス | 用途 |
|---|---|
| / | ユーザー ID を入力するランディングページ |
| /{userId} | 対象 Eventernote ユーザーのイベントビューアー |

現在のアプリ画面には、独立して接続された管理 UI はありません。リポジトリには管理関連ファイルが残っており、production の Nginx 設定でも `/admin/` が予約されていますが、`admin/index.html` は現在メインアプリと同じ `src/main.tsx` entry を読み込んでいます。

## 技術スタック

- React 19
- TypeScript 6
- Zustand 5
- Vite 8
- dayjs
- Vitest
- ESLint
- PostgreSQL 17
- Node.js API サービス
- Nginx Web／リバースプロキシサービス

## はじめに

### 前提条件

- Node.js 22+
- npm 10+

### 開発

先に PostgreSQL を起動して `DATABASE_URL` を設定し、その後 Vite と API watcher を同時に起動します。

```bash
npm install
$env:DATABASE_URL = 'postgresql://eventernote:local-password@localhost:5432/eventernote'
npm run dev
```

Web アプリは http://localhost:5173 で動作し、アプリケーション API のリクエストを port 8787 の API サービスへプロキシします。

### スクリプト

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
```

## Docker

ビルド済み image は GitHub Container Registry で公開されています。

```bash
docker pull ghcr.io/kitsunezu/eventernote-dashboard:latest
docker pull ghcr.io/kitsunezu/eventernote-dashboard:api-latest
```

### docker-compose

Portainer の stack environment に `POSTGRES_PASSWORD` を設定してから、リポジトリに含まれる `docker-compose.yml` をデプロイします。この stack は Web、API、PostgreSQL の各サービスと、永続化用の `eventernote-db-data` volume を作成します。

### ローカルでのビルド

```bash
docker build --target web -t eventernote-dashboard:web .
docker build --target api -t eventernote-dashboard:api .
```

Production workflow は両方の target を公開した後、Portainer stack の再デプロイを要求します。

デプロイ環境で Eventernote の hostname 解決が不安定な場合は、image を再ビルドせずに proxy target を上書きできます。

```bash
EVENTERNOTE_UPSTREAM=https://35.75.153.225
EVENTERNOTE_HOST=www.eventernote.com
```

`EVENTERNOTE_UPSTREAM` を IP に固定した場合でも upstream Host header と TLS 名を正しく保つため、`EVENTERNOTE_HOST` は `www.eventernote.com` のままにしてください。

## テスト

現在のテストスイートでは、以下を含む utility と parsing ロジックを検証しています。

- 日付のフォーマットとフィルタリング helper
- Eventernote の parsing 動作
- ICS import の parsing
- JSON import の parsing
- Zustand store selector とフィルタリング動作

テストの実行方法：

```bash
npm run test
```

## リポジトリに残っている未使用モジュール

現在のビューアーフローには接続されていない次の機能コードが、リポジトリ内に残っています。

- `src/components/AdminPage.tsx` の管理編集 UI
- `src/components/Filters.tsx` のカテゴリーフィルター UI
- `src/components/ListView.tsx` のリスト表示 UI
- ICS・JSON ファイル adapter
- ICS export・PNG export utility
- サンプルデータと backend stub adapter

これらのファイルは codebase に残されていますが、現在の build では `src/App.tsx` または `src/main.tsx` に接続されていないため、上記の有効なユーザー向け機能には含めていません。

## プロジェクト構成

```text
src/
├── App.tsx             # ランディングページ／ビューアーフロー
├── adapters/           # Eventernote scraper と未使用のファイル adapter
├── components/         # 有効なビューアー component と一部の未使用 UI module
├── lib/                # 日付、localization、storage、parsing utility
├── store/              # Zustand スケジュール store
└── types/              # 共通 TypeScript type
server/
├── db/schema.sql       # PostgreSQL schema
├── index.ts            # HTTP API entrypoint
├── parser.ts           # Eventernote 一覧／詳細／会場 parsing
├── repository.ts       # データベース読み取りと transaction write
└── sync.ts             # freshness、locking、upstream synchronization
admin/
└── index.html          # 予約済み secondary entry（現在はメインアプリの entry を読み込み）
```
