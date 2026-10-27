import { SiteNav } from './SiteNav'

/** The masthead: a floating glass bar that stays at the top while the page scrolls. */
export function SiteHeader() {
  return (
    <header role="banner" className="site-header">
      <div className="wrap">
        <SiteNav />
      </div>
    </header>
  )
}
