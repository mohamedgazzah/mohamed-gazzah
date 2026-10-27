'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="wrap py-20 md:py-28">
      <p className="kicker">Error</p>
      <h1 className="display mt-2 max-w-[18ch] text-5xl">This page could not load.</h1>
      <p className="lede mt-6 max-w-[56ch]">Something went wrong on our side. Please try again in a moment.</p>
      <button type="button" className="btn mt-8" onClick={() => reset()}>
        Try again
      </button>
    </main>
  )
}
