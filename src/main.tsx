import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupOtel } from './lib/otel'
import { loadServerSeedCache } from './lib/placeCache'

// OTel must initialise before any fetch calls; prod-only to avoid noise in dev
if (import.meta.env.PROD) {
  setupOtel()
}

// Pre-populate place cache from server seed (fire-and-forget; best-effort)
void loadServerSeedCache()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
