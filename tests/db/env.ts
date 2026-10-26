import { TEST_KEYS, testUrls } from './test-env'

// Runs in each test worker before any test module loads the app's database clients.
process.env.MIGRATION_DATABASE_URL = testUrls.migration
process.env.DATABASE_URL = testUrls.app
process.env.PUBLIC_DATABASE_URL = testUrls.public
process.env.APP_ENV = 'test'
process.env.STORAGE_DRIVER = 'local'
process.env.STORAGE_LOCAL_DIR = '.data/test-uploads'
Object.assign(process.env, TEST_KEYS)
