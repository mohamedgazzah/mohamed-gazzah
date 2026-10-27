'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

type Theme = 'system' | 'light' | 'dark'

/** Runs before first paint (in <head>), so a saved theme never flashes. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`

const OPTIONS = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const

/** Shown once the page has loaded: before that (or without JavaScript) the switch could not change anything. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {}
    setReady(true)
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
    <fieldset hidden={!ready}>
      <legend className="kicker mb-3">Theme</legend>
      <div className="segmented">
        {OPTIONS.map(({ value, label, Icon }) => (
          <label key={value} className="relative cursor-pointer">
            {/* The radio covers its label, so it stays the click and focus target. */}
            <input
              type="radio"
              name="theme"
              value={value}
              checked={theme === value}
              onChange={() => choose(value)}
              className="absolute inset-0 m-0 cursor-pointer opacity-0"
            />
            <Icon aria-hidden="true" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
