import { withDatabase } from './database'
import { loadEnv } from './env'

loadEnv()

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3200)
export const E2E_DB = process.env.E2E_DATABASE_NAME ?? 'record_e2e'

const swap = (name: string) => withDatabase(process.env[name]!, E2E_DB)

/** Environment for the app under end-to-end test. */
export function e2eEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'production',
    APP_ENV: 'test',
    MIGRATION_DATABASE_URL: swap('MIGRATION_DATABASE_URL'),
    DATABASE_URL: swap('DATABASE_URL'),
    PUBLIC_DATABASE_URL: swap('PUBLIC_DATABASE_URL'),
    NEXT_DIST_DIR: '.next-e2e',
    NEXT_PUBLIC_SITE_URL: `http://localhost:${E2E_PORT}`,
    // Test the launched site: robots, sitemap and Lighthouse SEO.
    SITE_INDEXING: 'on',
    TURNSTILE_DISABLED: 'true',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: '.data/e2e-uploads',
    // Nothing listens here: archiving fails fast instead of calling the real archive.
    WAYBACK_BASE_URL: 'http://127.0.0.1:9',
    REPORT_RATE_LIMIT: '1000',
    CRON_SECRET: 'e2e-cron-secret',
    // Never call the real model from tests, whatever the developer's shell has set.
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_AUTH_TOKEN: '',
    NEXT_TELEMETRY_DISABLED: '1',
  }
}
