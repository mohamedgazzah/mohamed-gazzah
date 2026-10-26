import { defineConfig } from 'drizzle-kit'

// Migrations run as the schema owner (MIGRATION_DATABASE_URL), never as the
// runtime roles. `npm run db:generate` only diffs the schema file and needs no
// database connection.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['record', 'record_public'],
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
})
