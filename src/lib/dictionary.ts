/**
 * The public data dictionary, generated from the public view declared in
 * src/db/schema.ts (the same schema file that generates migrations).
 */
import { getViewSelectedFields } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { PUBLIC_FIELD_DOCS, publicIncidents, type FieldDoc, type PublicIncident } from '@/db/schema'

export type DictionaryField = FieldDoc & { key: keyof PublicIncident; column: string }

export const DICTIONARY: DictionaryField[] = Object.entries(getViewSelectedFields(publicIncidents)).map(([key, col]) => ({
  key: key as keyof PublicIncident,
  column: (col as PgColumn).name,
  ...PUBLIC_FIELD_DOCS[key as keyof PublicIncident],
}))

/** Fields in downloads and the API, in a stable order. */
export const EXPORT_FIELDS = DICTIONARY.filter((f) => f.exported)

export function dictionaryMarkdown(): string {
  const lines = [
    '# Data dictionary',
    '',
    'Generated from `src/db/schema.ts` by `npm run dictionary`. Do not edit by hand.',
    '',
    '| Column | Type | Allowed values | Description |',
    '| --- | --- | --- | --- |',
  ]
  const codes = (values: readonly (string | number)[]) => values.map((a) => `\`${a}\``).join(', ')
  for (const f of EXPORT_FIELDS) {
    // A JSON array lists its entries' keys after the description, and the values of its coded keys.
    const keyValues = Object.entries(f.keyValues ?? {}).map(([key, values]) => `\`${key}\`: ${codes(values)}`)
    const allowed = f.allowed ? codes(f.allowed) : keyValues.join('; ')
    const description = f.keys ? `${f.description} Keys: ${codes(f.keys)}.` : f.description
    lines.push(`| \`${f.column}\` | ${f.type}${f.nullable ? ' (nullable)' : ''} | ${allowed} | ${description.replace(/\|/g, '\\|')} |`)
  }
  return `${lines.join('\n')}\n`
}
