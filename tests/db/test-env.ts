/**
 * Connection strings for the integration-test database. Derived from .env by
 * swapping the database name, so tests never touch the development data.
 */
import { loadEnv } from '../../scripts/lib/env'
import { withDatabase } from '../../scripts/lib/database'

loadEnv()

export const TEST_DB = process.env.TEST_DATABASE_NAME ?? 'record_test'

function swap(name: string, fallback: string) {
  return withDatabase(process.env[name] ?? fallback, TEST_DB)
}

export const testUrls = {
  superuser: process.env.POSTGRES_SUPERUSER_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres',
  migration: swap('MIGRATION_DATABASE_URL', 'postgres://record_owner:record_owner_dev@localhost:5432/record_dev'),
  app: swap('DATABASE_URL', 'postgres://record_app:record_app_dev@localhost:5432/record_dev'),
  public: swap('PUBLIC_DATABASE_URL', 'postgres://record_public:record_public_dev@localhost:5432/record_dev'),
}

/** Fixed keys for tests only. */
export const TEST_KEYS = {
  APP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  SUBMISSIONS_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
  RATE_LIMIT_SECRET: Buffer.alloc(32, 3).toString('base64'),
  CRON_SECRET: 'test-cron-secret',
}
