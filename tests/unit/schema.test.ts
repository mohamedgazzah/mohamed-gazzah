import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { getViewSelectedFields } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import * as E from '@/db/enums'
import { PUBLIC_FIELD_DOCS, publicIncidents } from '@/db/schema'
import { DICTIONARY, EXPORT_FIELDS, dictionaryMarkdown } from '@/lib/dictionary'
import { incidentDraftInput } from '@/lib/validation'
import { emptyDraftForTest } from './fixtures'

describe('data dictionary', () => {
  it('documents every column of the public view, generated from the schema', () => {
    const columns = Object.keys(getViewSelectedFields(publicIncidents))
    expect(DICTIONARY.map((d) => d.key)).toEqual(columns)
    expect(Object.keys(PUBLIC_FIELD_DOCS).sort()).toEqual([...columns].sort())
    for (const f of DICTIONARY) expect(f.description.length, f.column).toBeGreaterThan(10)
  })
  it('lists allowed values straight from the enums', () => {
    const by = Object.fromEntries(DICTIONARY.map((d) => [d.column, d]))
    expect(by.incident_types?.allowed).toEqual(E.INCIDENT_TYPES)
    expect(by.legal_status?.allowed).toEqual(E.LEGAL_STATUSES)
    expect(by.verification_level?.allowed).toEqual(E.PUBLIC_VERIFICATION_LEVELS)
  })
  it('never exports internal search columns', () => {
    expect(EXPORT_FIELDS.map((f) => f.column)).not.toContain('search_document')
    expect(EXPORT_FIELDS.map((f) => f.column)).not.toContain('search_text')
  })
  it('docs/DATA_DICTIONARY.md is up to date (npm run dictionary)', () => {
    expect(readFileSync('docs/DATA_DICTIONARY.md', 'utf8')).toBe(dictionaryMarkdown())
  })
})

describe('editor validation', () => {
  const base = emptyDraftForTest()
  it('requires one or more incident types and a state', () => {
    const r = incidentDraftInput.safeParse({ ...base, incidentTypes: [], stateFips: '' })
    expect(r.success).toBe(false)
  })
  it('refuses names before a charge', () => {
    const r = incidentDraftInput.safeParse({ ...base, perpetratorNames: ['Someone'], legalStatus: 'arrested' })
    expect(r.success).toBe(false)
    expect(incidentDraftInput.safeParse({ ...base, perpetratorNames: ['Someone'], legalStatus: 'charged' }).success).toBe(true)
  })
  it('refuses an exact location for a private home', () => {
    expect(incidentDraftInput.safeParse({ ...base, targetType: 'home', locationPrecision: 'exact_public_place' }).success).toBe(false)
  })
  it('limits quotes to 25 words', () => {
    const src = base.sources[0]!
    const long = Array.from({ length: 26 }, () => 'word').join(' ')
    const st = { id: crypto.randomUUID(), speaker: 'X', speakerRole: null, organization: null, statementType: 'official', date: null, quote: long, paraphrase: null, sourceId: src.id }
    expect(incidentDraftInput.safeParse({ ...base, statements: [st] }).success).toBe(false)
  })
  it('requires legal events to cite one of the record’s sources', () => {
    const ev = { id: crypto.randomUUID(), date: '2026-01-01', eventType: 'reported', description: '', sourceId: crypto.randomUUID(), caseId: null }
    expect(incidentDraftInput.safeParse({ ...base, legalEvents: [ev] }).success).toBe(false)
  })
})

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

describe('public code reads only through the public role', () => {
  it('public pages never import the admin database client', () => {
    const offenders = files('src/app/(public)')
      .filter((f) => /\.tsx?$/.test(f) && !f.includes(`${path.sep}report${path.sep}`))
      .filter((f) => /from '@\/db\/admin'|from '@\/server\/admin/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
  it('the public data layer uses the admin client only to store submissions', () => {
    const offenders = files('src/server/public')
      .filter((f) => !f.endsWith('submissions.ts'))
      .filter((f) => /from '@\/db\/admin'/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
  it('server actions files export only actions (no helpers that would become public endpoints)', () => {
    for (const f of files('src/app').filter((x) => /\.ts$/.test(x))) {
      const src = readFileSync(f, 'utf8')
      if (!src.startsWith("'use server'")) continue
      const exported = Array.from(src.matchAll(/^export (?:async )?(\w+) (\w+)/gm)).map((m) => [m[1], m[2]] as const)
      for (const [kind, name] of exported) {
        if (kind === 'type') continue
        expect(kind, `${f}: ${name}`).toBe('function')
        expect(src, `${f}: ${name} must be async`).toMatch(new RegExp(`export async function ${name}\\(`))
      }
    }
  })
})
