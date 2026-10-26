'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-reading px-4 py-16 sm:px-6">
      <h1 className="text-3xl">This page could not load</h1>
      <p className="mt-3 reading">Something went wrong on our side. Please try again in a moment.</p>
      <button type="button" className="btn mt-6" onClick={() => reset()}>
        Try again
      </button>
    </main>
  )
}
