'use client'

import { useEffect, useState } from 'react'

type Theme = 'system' | 'light' | 'dark'

/** Runs before first paint (in <head>), so a saved theme never flashes. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {}
  }, [])
  const choose = (t: Theme) => {
    setTheme(t)
    try {
      if (t === 'system') localStorage.removeItem('theme')
      else localStorage.setItem('theme', t)
    } catch {}
    if (t === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
  }
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Color theme</legend>
      <span aria-hidden="true" className="text-sm text-muted">
        Theme:
      </span>
      {(['system', 'light', 'dark'] as const).map((t) => (
        <label key={t} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm">
          <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => choose(t)} className="accent-accent" />
          {t === 'system' ? 'System' : t === 'light' ? 'Light' : 'Dark'}
        </label>
      ))}
    </fieldset>
  )
}
