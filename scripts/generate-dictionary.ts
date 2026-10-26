/** Writes docs/DATA_DICTIONARY.md from the schema (npm run dictionary). */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dictionaryMarkdown } from '@/lib/dictionary'

mkdirSync('docs', { recursive: true })
writeFileSync('docs/DATA_DICTIONARY.md', dictionaryMarkdown())
console.log('Wrote docs/DATA_DICTIONARY.md')
