import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
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
    <details open={open} className="filter-group border-t border-rule">
      <summary>{legend}</summary>
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
            <label htmlFor={id} className="flex min-h-9 cursor-pointer items-start gap-2.5 py-1 text-base hover:text-accent">
              <input id={id} type="checkbox" name={name} value={String(v)} defaultChecked={checked.includes(v)} className="mt-[3px] h-4 w-4 shrink-0" />
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
    <form method="get" action="/incidents" aria-label="Filter incidents" className="filter-card card flex flex-col md:max-h-[calc(100dvh-7rem)]">
      {view.sort !== 'newest' ? <input type="hidden" name="sort" value={view.sort} /> : null}
      {view.view !== 'table' ? <input type="hidden" name="view" value={view.view} /> : null}
      {/* Dates and types are set in the bar above the map; keep them when applying these. */}
      {filters.from ? <input type="hidden" name="from" value={filters.from} /> : null}
      {filters.to ? <input type="hidden" name="to" value={filters.to} /> : null}
      {filters.type.length ? <input type="hidden" name="type" value={filters.type.join(',')} /> : null}
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}

      <p className="px-4 pt-4 text-base font-semibold md:px-5">More filters</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 md:px-5">

      <Group legend="State and city" open={!!(filters.state.length || filters.city)}>
        <label htmlFor="f-state" className="label">
          State or territory
        </label>
        <div className="relative">
          <select id="f-state" name="state" defaultValue={filters.state[0] ?? ''} className="control">
            <option value="">All states and territories</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-muted" />
        </div>
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

      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 rounded-b-[var(--radius-md)] border-t border-rule bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-5">
        <button type="submit" className="btn btn-sm">
          Apply filters
        </button>
        <Link href="/incidents" className="btn btn-secondary btn-sm">
          Clear all
        </Link>
      </div>
    </form>
  )
}
