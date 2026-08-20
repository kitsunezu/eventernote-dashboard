# AGENTS.md

本檔提供給 Codex 或其他 AI coding agent 使用，適用於整個 repository。請優先遵循既有程式風格與本檔規範，再依實際任務做最小必要變更。

## 專案概述

Eventernote Dashboard 是一個 React + TypeScript 的公開 Eventernote 行程檢視器。

- `/` 是 landing page，讓使用者輸入 Eventernote user ID。
- `/{userId}` 是行程檢視頁，會載入該使用者公開活動列表。
- 前端只呼叫 `/api/users/{userId}/events`；Eventernote 抓取、解析、更新與去重由 Node.js API service 執行。
- PostgreSQL 是 user index、活動、會場與同步狀態的 canonical data source。
- API 會先回傳資料庫 snapshot，再於必要時背景更新 Eventernote user index、event detail 與 place detail。
- 狀態由 Zustand 管理；同一位 user 的 events、places 與 participation calendar 會一起寫入 localStorage snapshot，並以 `CACHE_TTL_MS` 控制前端短期快取。
- Production 由 Nginx web、Node.js API 與 PostgreSQL 三個服務組成；Nginx 另提供 SigNoz OTLP proxy。

## 技術堆疊

- React 19
- TypeScript 6
- Vite 8
- Zustand 5
- dayjs
- zod
- html-to-image
- OpenTelemetry browser tracing
- Vitest
- ESLint flat config
- Docker multi-stage build：Node 22 Alpine build，Nginx Alpine serve
- PostgreSQL 17
- Node.js API service
- GitHub Actions：push 到 `main` 時 build/push GHCR image
- Portainer / Docker Compose 部署到個人伺服器

## 專案結構

- `src/App.tsx`：目前主要 route flow，解析 `/{userId}` 並組合 viewer UI。
- `src/main.tsx`：React entry，production 啟用 OpenTelemetry。
- `src/components/`：viewer 與 report UI components。
- `src/store/useScheduleStore.ts`：Zustand store、selectors、Eventernote loading flow、localStorage persistence。匯出 `selectCategories`、`selectVisibleEvents`、`selectNextEvent`、`selectSelectedEvent`，component 應透過這些 selector 取得 derived state，不要在 component 內重複 filter/sort 邏輯。
- `src/adapters/eventernoteApiSource.ts`：database-backed API client 與 background polling。
- `src/lib/`：date、localization、storage、report、map、OTel utilities。
- `src/types/events.ts`：核心事件、分類、locale、snapshot 型別。
- `server/parser.ts`：Eventernote HTML parsing。
- `server/repository.ts`：PostgreSQL reads 與 transactional writes。
- `server/sync.ts`：freshness、locking 與 upstream synchronization。
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
- `verbatimModuleSyntax: true`：型別-only import 必須寫 `import type { ... }`，否則 `tsc -b` 會失敗。
- `noUnusedLocals: true` / `noUnusedParameters: true`：新增或修改函式時確認沒有殘留未使用的變數或參數，否則 build 失敗。
- `erasableSyntaxOnly: true`：不要使用 `const enum`、`namespace`、或帶 access modifier 的 class parameter properties。
- 維持現有 import style：ESM、單引號、無分號。
- React component 使用 function component 與 JSX runtime。
- UI state 與 derived state 優先放在 Zustand store/selectors 或 component local state，不要引入新的全域狀態方案。
- 日期與時間處理優先使用既有 `src/lib/date.ts` helper 與 dayjs。
- localization 優先走 `src/lib/localize.ts` 與 `SupportedLocale`，不要在 component 裡散落多語字串。
- Eventernote parsing 請集中在 `server/parser.ts`，避免把 DOM selector 或 scraping fallback 分散到 UI component。
- Canonical place data 由 PostgreSQL 管理；前端 places 必須與同一 user 的 event snapshot 一起更新，不要另建獨立靜態 cache。
- 編輯含中日文字串的檔案時請保持 UTF-8，並小心不要造成 mojibake。
- 註解只在能降低理解成本時加入；避免描述顯而易見的 assignment 或 JSX。

## 行為準則

- 以目前 active viewer flow 為第一優先：landing page、`/{userId}` viewer、Eventernote fetch、timeline display、details drawer。
- Browser frontend 不得直接請求 Eventernote；應呼叫 Node.js API。Eventernote upstream request 集中在 `server/upstream.ts`。
- Eventernote upstream 可能 403/429 或 DNS 解析不穩。Nginx 已提供 browser-like headers、request-time DNS resolve、短 timeout、cache stale fallback，以及 `EVENTERNOTE_UPSTREAM` / `EVENTERNOTE_HOST` override；修改 proxy 行為時要保留這些部署需求。
- Production OTel trace 走 `/api/otel/v1/traces`，由 Nginx 代理到 `OTEL_BACKEND`。不要在前端硬編外部 collector URL。
- 修改 cache、loading 或 user switching 行為時，要確認不同 user ID 之間不會短暫顯示錯誤使用者的舊資料。
- 變更 route 時要同時考慮 SPA fallback 與 Nginx 設定。
- 保持 web、API 與 PostgreSQL compose service 的部署相容性。

## 測試準則

- 對 parsing、date filtering/sorting、store selector 與 API behavior 新增或修改邏輯時，請補 Vitest。
- 優先測純函式與 adapter behavior；UI 視覺變更若影響主要流程，至少跑 build/lint，必要時用瀏覽器確認。
- 修改 Eventernote scraper 時，請測：
  - 分頁 parse / dedupe
  - detail page enrichment
  - venue/performer fallback
  - upstream failure warning
  - upcoming/past event handling
  - place page 地址與座標解析
  - PostgreSQL freshness 命中時跳過 upstream fetch
  - 過去活動正確套用 canonical place region
- 修改 store loading/cache 時，請測：
  - fresh cache skip
  - switching user clears stale events and places
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
- Quality gates：`npm ci` 後依序執行 `npm run lint`、`npm run test`，通過才 build/push images。
- Registry：GitHub Container Registry
- Image：`ghcr.io/kitsunezu/eventernote-dashboard`
- Tags：default branch 會推 `latest`，另外會推 `sha-*`
- Portainer 以 `docker-compose.yml` 部署，服務對外 port 預設 `3003:80`。
- Compose 目前接到 external Docker network `signoz-net`，並設定：
  - `OTEL_BACKEND=http://signoz-otel-collector:4318`
  - `EVENTERNOTE_UPSTREAM=https://www.eventernote.com`
  - `EVENTERNOTE_HOST=www.eventernote.com`

修改部署相關檔案時，請確認 Portainer stack 可繼續使用同一份 compose，且 Nginx placeholder 仍會由 `docker-entrypoint.sh` 正確替換。

## Kitsunet auto deploy

- Pushes to `main` build and push `ghcr.io/kitsunezu/eventernote-dashboard` through `.github/workflows/docker-publish.yml`.
- After the image is pushed, GitHub Actions calls Portainer's Git stack redeploy API for stack `42` on endpoint `3` with `RepullImageAndRedeploy=true`.
- Required GitHub Actions secrets:
  - `PORTAINER_API_KEY`
  - `CF_ACCESS_CLIENT_ID`
  - `CF_ACCESS_CLIENT_SECRET`
- Do not commit Portainer API keys, Cloudflare Access service token values, cookies, or webhook URLs. Only secret and variable names belong in git.

## Agent 工作流程建議

1. 先讀 `README.md`、`package.json`，再看與任務相關的 `src/` 模組。
2. 變更前檢查 `git status --short`，不要覆蓋使用者未提交的變更。
3. 優先做小範圍修改；不要為了單一 bug 做跨模組重構。
4. 修改後執行最小必要驗證，並在回覆中列出有跑與沒跑的檢查。
5. 若任務涉及部署、CI、Portainer、GHCR 或 Cloudflare/反代設定，請同時檢查 Docker、Nginx、GitHub Actions 與 compose 的互相影響。
