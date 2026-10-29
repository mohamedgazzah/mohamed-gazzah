/** A numbered reference to one of a record's sources: a small pill that fills on hover. */
export function SourceRef({ n, href, label }: { n: number; href: string; label?: string }) {
  return (
    <a href={href} className="src-ref" aria-label={label ?? `Source ${n}`}>
      {n}
    </a>
  )
}
