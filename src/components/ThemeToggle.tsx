'use client'

import { useEffect, useState } from 'react'

const KEY = 'tonite_theme'

// Bouton clair / sombre. Le choix est mémorisé dans le navigateur du visiteur
// (lu avant l'affichage par le script du layout, pour éviter tout flash).
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    setReady(true)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    const root = document.documentElement
    if (next) root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
    try { localStorage.setItem(KEY, next ? 'dark' : 'light') } catch { /* navigation privée */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next ? '#000000' : '#F4BCD8')
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={dark ? 'Mode clair' : 'Mode sombre'}
      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${className}`}
      style={{ border: '1.5px solid var(--c-ink)', color: 'var(--c-ink)', visibility: ready ? 'visible' : 'hidden' }}
    >
      {dark ? (
        // Soleil
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      ) : (
        // Lune
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}
