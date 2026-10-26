import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  INCIDENT_TYPES,
  INCIDENT_TYPE_META,
  LEGAL_STATUSES,
  LEGAL_STATUS_META,
  PERPETRATOR_TYPES,
  PERPETRATOR_TYPE_META,
  SEVERITIES,
  SEVERITY_META,
  SOURCE_TYPES,
  SOURCE_TYPE_META,
  TARGET_TYPES,
  TARGET_TYPE_META,
  YES_NO_UNKNOWN,
  YES_NO_UNKNOWN_META,
} from '@/db/enums'
import type { Filters, ViewState } from '@/lib/filters'
import { US_STATES, stateByCode } from '@/lib/states'

function Group({ legend, open, children }: { legend: string; open: boolean; children: ReactNode }) {
  return (
    <details open={open} className="border-b border-rule py-1">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{legend}</summary>
      <fieldset className="pb-3">
        <legend className="sr-only">{legend}</legend>
        {children}
      </fieldset>
    </details>
  )
}

function Checks<T extends string | number>({ name, values, checked, label }: { name: string; values: readonly T[]; checked: readonly T[]; label: (v: T) => string }) {
  return (
    <ul className="space-y-0.5">
      {values.map((v) => {
        const id = `f-${name}-${v}`
        return (
          <li key={String(v)}>
            <label htmlFor={id} className="flex min-h-9 cursor-pointer items-start gap-2 py-1 text-base">
              <input id={id} type="checkbox" name={name} value={String(v)} defaultChecked={checked.includes(v)} className="mt-1 h-4 w-4 shrink-0 accent-accent" />
              <span>{label(v)}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The Explore filter rail: a plain GET form, so it works without JavaScript
 * and every result is reachable by URL.
 */
export function FilterRail({ filters, view }: { filters: Filters; view: ViewState }) {
  const extraStates = filters.state.slice(1)
  return (
    <form method="get" action="/incidents" aria-label="Filter incidents" className="space-y-1">
      {view.sort !== 'newest' ? <input type="hidden" name="sort" value={view.sort} /> : null}
      {view.view !== 'table' ? <input type="hidden" name="view" value={view.view} /> : null}

      <div className="pb-3">
        <label htmlFor="f-q" className="label">
          Search
        </label>
        <input id="f-q" name="q" type="search" defaultValue={filters.q ?? ''} className="control" placeholder="Places, case names, words" />
        <p className="hint mt-1">Searches titles, summaries, places and case names. Small typos are tolerated.</p>
      </div>

      <Group legend="Date range" open={!!(filters.from || filters.to)}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="f-from" className="label">
              From
            </label>
            <input id="f-from" name="from" type="date" min="2020-01-01" defaultValue={filters.from ?? ''} className="control" />
          </div>
          <div>
            <label htmlFor="f-to" className="label">
              To
            </label>
            <input id="f-to" name="to" type="date" min="2020-01-01" defaultValue={filters.to ?? ''} className="control" />
          </div>
        </div>
      </Group>

      <Group legend="State and city" open={!!(filters.state.length || filters.city)}>
        <label htmlFor="f-state" className="label">
          State or territory
        </label>
        <select id="f-state" name="state" defaultValue={filters.state[0] ?? ''} className="control">
          <option value="">All states and territories</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        {extraStates.length ? (
          <div className="mt-2">
            <p className="hint">Also included:</p>
            <Checks name="state" values={extraStates} checked={extraStates} label={(c) => stateByCode(c)?.name ?? c} />
          </div>
        ) : null}
        <label htmlFor="f-city" className="label mt-3">
          City
        </label>
        <input id="f-city" name="city" type="text" defaultValue={filters.city ?? ''} className="control" autoComplete="address-level2" />
      </Group>

      <Group legend="Incident type" open={filters.type.length > 0}>
        <Checks name="type" values={INCIDENT_TYPES} checked={filters.type} label={(t) => INCIDENT_TYPE_META[t].label} />
      </Group>

      <Group legend="Target" open={filters.target.length > 0}>
        <Checks name="target" values={TARGET_TYPES} checked={filters.target} label={(t) => TARGET_TYPE_META[t].label} />
      </Group>

      <Group legend="Severity" open={filters.severity.length > 0}>
        <Checks name="sev" values={SEVERITIES} checked={filters.severity} label={(s) => `${s} — ${SEVERITY_META[s].label}`} />
      </Group>

      <Group legend="Verification level" open={true}>
        <p className="hint mb-1">
          Counts include V3 and V2 by default.{' '}
          <Link href="/methodology#verification">How records are verified</Link>
        </p>
        <Checks
          name="v"
          values={['3', '2', '1'] as const}
          checked={filters.v.map((v) => v.slice(1) as '1' | '2' | '3')}
          label={(v) =>
            v === '3' ? 'V3 — Confirmed by authorities' : v === '2' ? 'V2 — Independently reported' : 'Include V1 — single-source reports'
          }
        />
      </Group>

      <Group legend="Legal status" open={filters.status.length > 0 || filters.hc.length > 0}>
        <Checks name="status" values={LEGAL_STATUSES} checked={filters.status} label={(s) => LEGAL_STATUS_META[s].label} />
        <p className="label mt-3">Hate-crime charge filed</p>
        <Checks name="hc" values={YES_NO_UNKNOWN} checked={filters.hc} label={(h) => YES_NO_UNKNOWN_META[h].label} />
      </Group>

      <Group legend="Perpetrator type" open={filters.perp.length > 0}>
        <Checks name="perp" values={PERPETRATOR_TYPES} checked={filters.perp} label={(p) => PERPETRATOR_TYPE_META[p].label} />
      </Group>

      <Group legend="Source type" open={filters.source.length > 0}>
        <Checks name="src" values={SOURCE_TYPES} checked={filters.source} label={(s) => SOURCE_TYPE_META[s].label} />
      </Group>

      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-rule bg-bg py-3">
        <button type="submit" className="btn">
          Apply filters
        </button>
        <Link href="/incidents" className="btn btn-secondary">
          Clear all
        </Link>
      </div>
    </form>
  )
}
