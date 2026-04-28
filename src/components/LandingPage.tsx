import { useState } from 'react'
import type { ThemeMode } from '../types/events'
import { MoonIcon, SunIcon } from './Icons'

interface LandingPageProps {
  theme: ThemeMode
  onThemeToggle: () => void
}

export function LandingPage({ theme, onThemeToggle }: LandingPageProps) {
  const [userId, setUserId] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = userId.trim()
    if (id) {
      window.location.href = `/${id}`
    }
  }

  return (
    <div className="landing-root">
      <button
        type="button"
        className="landing-theme-btn"
        onClick={onThemeToggle}
        aria-label={theme === 'dark' ? 'ライトモード' : 'ダークモード'}
      >
        {theme === 'dark' ? (
          <SunIcon className="ui-icon" />
        ) : (
          <MoonIcon className="ui-icon" />
        )}
      </button>

      <div className="landing-card">
        <p className="landing-eyebrow">Eventernote Dashboard</p>
        <h1 className="landing-title">イベント一覧</h1>
        <p className="landing-desc">
          Eventernote のユーザー ID を入力すると、参加イベントを一覧表示します。
        </p>

        <form onSubmit={handleSubmit} className="landing-form">
          <div className="landing-input-wrap">
            <span className="landing-input-prefix">eventernote.com/users/</span>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="userId"
              className="landing-input"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <button
            type="submit"
            className="landing-btn"
            disabled={!userId.trim()}
          >
            表示する
          </button>
        </form>


      </div>
    </div>
  )
}
