import { setupDatabase } from '../../scripts/lib/database'
import { testUrls } from './test-env'

/** A fresh, fully migrated database for each test run. */
export default async function setup() {
  await setupDatabase({
    superuserUrl: testUrls.superuser,
    migrationUrl: testUrls.migration,
    appUrl: testUrls.app,
    publicUrl: testUrls.public,
    allowDemo: true,
    dropExisting: true,
  })
}
