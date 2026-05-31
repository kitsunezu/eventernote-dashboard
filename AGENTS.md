# AGENTS.md

本檔提供給 Codex 或其他 AI coding agent 使用，適用於整個 repository。請優先遵循既有程式風格與本檔規範，再依實際任務做最小必要變更。

## 專案概述

Eventernote Dashboard 是一個 React + TypeScript 的公開 Eventernote 行程檢視器。

- `/` 是 landing page，讓使用者輸入 Eventernote user ID。
- `/{userId}` 是行程檢視頁，會載入該使用者公開活動列表。
- 前端透過 `/api/eventernote` 代理請求 Eventernote，避免瀏覽器 CORS 問題。
- Eventernote scraper 會讀取使用者活動列表、跟隨分頁、抓取部分活動詳情頁補齊 venue 與 performers。
- 狀態由 Zustand 管理，成功載入的資料會寫入 localStorage snapshot，並以 `CACHE_TTL_MS` 控制短期快取。
- Production container 由 Nginx serve Vite build output，並提供 Eventernote reverse proxy 與 SigNoz OTLP proxy。

目前 app surface 主要是 viewer flow。repo 內仍保留 admin、ICS/JSON import/export、list/filter 等未接入目前主流程的模組；除非任務明確要求，請不要把這些 dormant module 當成 active user-facing 功能描述或重構目標。

## 技術堆疊

- React 19
- TypeScript 6
- Vite 8
- Zustand 5
- dayjs
- ical.js
- zod
- html-to-image
- OpenTelemetry browser tracing
- Vitest
- ESLint flat config
- Docker multi-stage build：Node 22 Alpine build，Nginx Alpine serve
- GitHub Actions：push 到 `main` 時 build/push GHCR image
- Portainer / Docker Compose 部署到個人伺服器

## 專案結構

- `src/App.tsx`：目前主要 route flow，解析 `/{userId}` 並組合 viewer UI。
- `src/main.tsx`：React entry，production 啟用 OpenTelemetry。
- `src/components/`：UI components。active viewer 包含 `LandingPage`、`Header`、`Countdown`、`TimelineView`、`EventCard`、`EventDetailsDrawer`。
- `src/store/useScheduleStore.ts`：Zustand store、selectors、Eventernote loading flow、localStorage persistence。
- `src/adapters/eventernoteSource.ts`：Eventernote HTML fetch/parse/enrich 邏輯。
- `src/lib/`：date formatting/filtering、localization、storage、import/export、OTel utilities。
- `src/types/events.ts`：核心事件、分類、locale、snapshot 型別。
- `admin/index.html`：secondary Vite entry，目前仍載入同一個 main app。
- `Dockerfile`、`nginx.conf`、`00-cache.conf`、`docker-entrypoint.sh`：production container 與 reverse proxy 設定。
- `.github/workflows/docker-publish.yml`：GHCR image build/push workflow。

## 核心指令

請使用 npm，並以 lockfile 為準。

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
npm run test
```

常用情境：

- 初次安裝或 CI-like install：`npm ci`
- 本機開發：`npm run dev`，預設 `http://localhost:5173`
- Production build 驗證：`npm run build`，內含 `tsc -b && vite build`
- 單元測試：`npm run test`
- Lint：`npm run lint`
- 本機 Docker build/run：

```bash
docker build -t eventernote-dashboard .
docker run -p 3003:80 eventernote-dashboard
```

## 程式碼風格與規範

- TypeScript 優先；新增資料結構請先確認 `src/types/events.ts` 是否已有可重用型別。
- 維持現有 import style：ESM、單引號、無分號。
- React component 使用 function component 與 JSX runtime。
- UI state 與 derived state 優先放在 Zustand store/selectors 或 component local state，不要引入新的全域狀態方案。
- 日期與時間處理優先使用既有 `src/lib/date.ts` helper 與 dayjs。
- localization 優先走 `src/lib/localize.ts` 與 `SupportedLocale`，不要在 component 裡散落多語字串。
- Eventernote parsing 請集中在 `src/adapters/eventernoteSource.ts`，避免把 DOM selector 或 scraping fallback 分散到 UI component。
- 不要破壞 existing dormant modules；若任務只涉及 viewer flow，避免順手大改 admin/import/export/list/filter 模組。
- 編輯含中日文字串的檔案時請保持 UTF-8，並小心不要造成 mojibake。
- 註解只在能降低理解成本時加入；避免描述顯而易見的 assignment 或 JSX。

## 行為準則

- 以目前 active viewer flow 為第一優先：landing page、`/{userId}` viewer、Eventernote fetch、timeline display、details drawer。
- 對 Eventernote upstream 的請求必須經過 `/api/eventernote` proxy；不要在 browser frontend 直接打 `https://www.eventernote.com`。
- Eventernote upstream 可能 403/429 或 DNS 解析不穩。Nginx 已提供 browser-like headers、cache stale fallback，以及 `EVENTERNOTE_UPSTREAM` / `EVENTERNOTE_HOST` override；修改 proxy 行為時要保留這些部署需求。
- Production OTel trace 走 `/api/otel/v1/traces`，由 Nginx 代理到 `OTEL_BACKEND`。不要在前端硬編外部 collector URL。
- 修改 cache、loading 或 user switching 行為時，要確認不同 user ID 之間不會短暫顯示錯誤使用者的舊資料。
- 變更 route 時要同時考慮 SPA fallback、Nginx `/admin/` fallback、Vite multi-entry build。
- 保持 deploy artifact 靜態化：目前沒有自有 backend service，production runtime 是 Nginx + static files + reverse proxy。

## 測試準則

- 對 parsing、date filtering/sorting、store selector、import/export 行為新增或修改邏輯時，請補 Vitest。
- 優先測純函式與 adapter behavior；UI 視覺變更若影響主要流程，至少跑 build/lint，必要時用瀏覽器確認。
- 修改 Eventernote scraper 時，請測：
  - 分頁 parse / dedupe
  - detail page enrichment
  - venue/performer fallback
  - upstream failure warning
  - upcoming/past event handling
- 修改 store loading/cache 時，請測：
  - fresh cache skip
  - switching user clears stale events
  - selector output order
  - selected event reset
- 完成程式碼變更前至少執行與風險相符的檢查。一般建議：

```bash
npm run lint
npm run test
npm run build
```

若只改文件，可不跑測試，但 final response 要明確說明未執行測試的原因。

## CI/CD 與部署

- GitHub Actions workflow：`.github/workflows/docker-publish.yml`
- Trigger：push 到 `main` 或 manual `workflow_dispatch`
- Registry：GitHub Container Registry
- Image：`ghcr.io/kitsunezu/eventernote-dashboard`
- Tags：default branch 會推 `latest`，另外會推 `sha-*`
- Portainer 以 `docker-compose.yml` 部署，服務對外 port 預設 `3003:80`。
- Compose 目前接到 external Docker network `signoz-net`，並設定：
  - `OTEL_BACKEND=http://signoz-otel-collector:4318`
  - `EVENTERNOTE_UPSTREAM=https://www.eventernote.com`
  - `EVENTERNOTE_HOST=www.eventernote.com`

修改部署相關檔案時，請確認 Portainer stack 可繼續使用同一份 compose，且 Nginx placeholder 仍會由 `docker-entrypoint.sh` 正確替換。

## Agent 工作流程建議

1. 先讀 `README.md`、`package.json`，再看與任務相關的 `src/` 模組。
2. 變更前檢查 `git status --short`，不要覆蓋使用者未提交的變更。
3. 優先做小範圍修改；不要為了單一 bug 做跨模組重構。
4. 修改後執行最小必要驗證，並在回覆中列出有跑與沒跑的檢查。
5. 若任務涉及部署、CI、Portainer、GHCR 或 Cloudflare/反代設定，請同時檢查 Docker、Nginx、GitHub Actions 與 compose 的互相影響。
