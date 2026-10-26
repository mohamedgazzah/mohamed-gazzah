/** Load .env for CLI scripts (Next.js loads it itself for the app). */
export function loadEnv(file = '.env') {
  try {
    process.loadEnvFile(file)
  } catch {
    // No .env file: rely on the process environment.
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`)
    process.exit(1)
  }
  return value
}

export function isProductionEnv(): boolean {
  return process.env.APP_ENV === 'production' || process.env.VERCEL_ENV === 'production'
}
