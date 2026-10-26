import { WORKFLOW_STATUS_META, type WorkflowStatus } from '@/db/enums'

export function StatusPill({ status, live }: { status: WorkflowStatus; live?: number | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="inline-flex items-center rounded-full border border-control px-2 py-0.5 text-sm font-semibold" title={WORKFLOW_STATUS_META[status].description}>
        {WORKFLOW_STATUS_META[status].label}
      </span>
      {live ? <span className="inline-flex items-center rounded-full border border-confirmed px-2 py-0.5 text-sm font-semibold text-confirmed">Live: revision {live}</span> : null}
    </span>
  )
}
