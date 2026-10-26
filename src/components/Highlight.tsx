import { highlight } from '@/lib/highlight'

/** Renders text with matched search words in <mark>. No HTML injection: plain React text. */
export function Highlight({ text, query }: { text: string; query?: string | null }) {
  if (!query) return <>{text}</>
  return (
    <>
      {highlight(text, query).map((p, i) => (p.match ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  )
}
