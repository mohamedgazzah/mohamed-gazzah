/**
 * Vercel's "Ignored Build Step" (vercel.json ignoreCommand): exit 0 skips a
 * deployment, exit 1 builds it. Runs before npm install, so no imports.
 *
 * Production always builds. Preview deployments (any other branch) are skipped
 * unless ENABLE_PREVIEW_DEPLOYMENTS=true is set for the Preview environment,
 * because a preview build runs migrations against whatever database the
 * Preview variables name: point those at a separate database first, never
 * at production.
 */
if (process.env.VERCEL_ENV === 'production') process.exit(1)
if (process.env.ENABLE_PREVIEW_DEPLOYMENTS === 'true') process.exit(1)
console.log('Skipping this preview deployment. See docs/DEPLOY.md, "Preview deployments".')
process.exit(0)
