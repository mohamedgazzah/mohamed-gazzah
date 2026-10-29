import { WORKFLOW_STATUS_META, type WorkflowStatus } from '@/db/enums'

export function StatusPill({ status, live }: { status: WorkflowStatus; live?: number | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="badge badge-box" title={WORKFLOW_STATUS_META[status].description}>
        {WORKFLOW_STATUS_META[status].label}
      </span>
      {live ? <span className="badge badge-box border-confirmed text-confirmed">Live: revision {live}</span> : null}
    </span>
  )
}
