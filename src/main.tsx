import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupOtel } from './lib/otel'

// OTel must initialise before any fetch calls; prod-only to avoid noise in dev
if (import.meta.env.PROD) {
  setupOtel()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
