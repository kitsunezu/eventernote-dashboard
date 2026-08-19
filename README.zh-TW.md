# Eventernote Dashboard

[English](README.md) | 繁體中文 | [日本語](README.ja.md)

Eventernote Dashboard 是以 React 與 TypeScript 開發的公開 Eventernote 行程檢視器。在首頁輸入 Eventernote 使用者 ID，即可透過資料庫支援的行程 API 載入資料，並在時間軸式儀表板中瀏覽結果。

## 目前功能

- 輸入 Eventernote 使用者 ID 的首頁
- 載入所選使用者公開活動列表的檢視頁
- 依日期分組的時間軸檢視
- 顯示目前範圍內下一個即將開始活動的倒數橫幅
- 可切換顯示全部活動或僅顯示未來活動的行程範圍
- 顯示日期、時間、場地、縮圖預覽及 Eventernote 直接連結的活動卡片
- 顯示分類、完整時間範圍、地點、出演者摘要、備註及外部連結的活動詳情抽屜

## 運作方式

目前的應用程式以 Eventernote 檢視流程為核心。

1. 首頁取得使用者 ID，並導向 `/{userId}`。
2. 瀏覽器請求 `GET /api/users/{userId}/events`，不會直接抓取 Eventernote。
3. API 會立即回傳最新的 PostgreSQL 資料；若資料已過期，則先回傳舊資料並在背景開始更新。
4. 伺服器會讀取使用者的 Eventernote 參加活動日曆，逐月抓取非空月份、驗證列數並依活動 ID 去重；日曆無法取得時才 fallback 到活動列表分頁。
5. 伺服器以有限並行數抓取尚未取得或已過期的活動詳情頁，解析後將結果儲存為活動的權威資料。
6. 尚未取得或已過期的場地頁會另外抓取，以取得標準地址與座標。若 Eventernote 座標無效或不存在，系統會依序嘗試地圖連結、逐步簡化的日本 GSI 與 Nominatim 地址搜尋，最後再使用經過驗證的場地名稱 POI 搜尋。
7. 活動會依 Eventernote 活動 ID 去除重複、依時間排序，並按日期分組顯示。

開啟活動詳情或前往其 Eventernote 連結時，系統會先針對該活動與場地執行更新，再將更新後的資料庫內容回傳給應用程式。

資料庫結構、API 契約、更新政策與失敗處理方式記錄於 [docs/data-api.md](docs/data-api.md)。

## 目前路由

| 路徑 | 用途 |
|---|---|
| / | 輸入使用者 ID 的首頁 |
| /{userId} | 該 Eventernote 使用者的活動檢視頁 |

目前應用程式介面沒有獨立且已接線的管理介面。Repository 中仍保留管理相關檔案，production Nginx 設定也保留 `/admin/`，但 `admin/index.html` 目前載入的仍是與主應用程式相同的 `src/main.tsx` entry。

## 技術堆疊

- React 19
- TypeScript 6
- Zustand 5
- Vite 8
- dayjs
- Vitest
- ESLint
- PostgreSQL 17
- Node.js API 服務
- Nginx web／反向代理服務

## 開始使用

### 前置需求

- Node.js 22+
- npm 10+

### 開發環境

先啟動 PostgreSQL 並提供 `DATABASE_URL`，再同時執行 Vite 與 API watcher：

```bash
npm install
$env:DATABASE_URL = 'postgresql://eventernote:local-password@localhost:5432/eventernote'
npm run dev
```

Web app 會在 http://localhost:5173 執行，並將應用程式 API 請求代理至 port 8787 的 API 服務。

### 指令

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
```

## Docker

GitHub Container Registry 已提供預先建置的 image：

```bash
docker pull ghcr.io/kitsunezu/eventernote-dashboard:latest
docker pull ghcr.io/kitsunezu/eventernote-dashboard:api-latest
```

### docker-compose

在 Portainer 的 stack environment 中設定 `POSTGRES_PASSWORD`，再部署 repository 內的 `docker-compose.yml`。此 stack 會建立 web、API 與 PostgreSQL 服務，以及持久化的 `eventernote-db-data` volume。

### 本機建置

```bash
docker build --target web -t eventernote-dashboard:web .
docker build --target api -t eventernote-dashboard:api .
```

Production workflow 會先發布兩個 target，再要求 Portainer stack 重新部署。

如果 Eventernote hostname 在部署環境中偶爾無法穩定解析，可在不重新建置 image 的情況下覆寫 proxy target：

```bash
EVENTERNOTE_UPSTREAM=https://35.75.153.225
EVENTERNOTE_HOST=www.eventernote.com
```

請保持 `EVENTERNOTE_HOST` 為 `www.eventernote.com`，如此即使 `EVENTERNOTE_UPSTREAM` 固定為 IP，上游 Host header 與 TLS 名稱仍會正確。

## 測試

目前的測試套件涵蓋 utility 與 parsing 邏輯，包括：

- 日期格式化與篩選 helper
- Eventernote parsing 行為
- ICS 匯入解析
- JSON 匯入解析
- Zustand store selector 與篩選行為

執行測試：

```bash
npm run test
```

## Repository 中仍保留的非啟用模組

Repository 中仍包含未接入目前檢視流程的功能程式碼：

- `src/components/AdminPage.tsx` 的管理編輯介面
- `src/components/Filters.tsx` 的分類篩選介面
- `src/components/ListView.tsx` 的列表檢視介面
- ICS 與 JSON 檔案 adapter
- ICS 匯出與 PNG 匯出 utility
- 範例資料與 backend stub adapter

這些檔案仍保留於 codebase，但未連接至目前 build 的 `src/App.tsx` 或 `src/main.tsx`，因此上方沒有將它們列為已啟用的使用者功能。

## 專案結構

```text
src/
├── App.tsx             # 首頁／檢視流程
├── adapters/           # Eventernote scraper 與未啟用的檔案 adapter
├── components/         # 已啟用的檢視元件及部分未啟用 UI 模組
├── lib/                # 日期、localization、storage 與 parsing utility
├── store/              # Zustand 行程 store
└── types/              # 共用 TypeScript 型別
server/
├── db/schema.sql       # PostgreSQL schema
├── index.ts            # HTTP API entrypoint
├── parser.ts           # Eventernote 列表／詳情／場地 parsing
├── repository.ts       # 資料庫讀取與 transaction write
└── sync.ts             # freshness、locking 與 upstream synchronization
admin/
└── index.html          # 保留的 secondary entry，目前載入主應用程式 entry
```
