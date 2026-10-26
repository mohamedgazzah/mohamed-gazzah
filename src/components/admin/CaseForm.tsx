import { CASE_TYPES, CASE_TYPE_META } from '@/db/enums'
import type { Case } from '@/db/schema'
import { caseAction } from '@/app/admin/_actions/manage'
import { ActionForm } from './ActionForm'

export function CaseForm({ value }: { value?: Case }) {
  return (
    <ActionForm action={caseAction} submitLabel={value ? 'Save case' : 'Create case'} className="max-w-2xl space-y-3">
      {value ? <input type="hidden" name="id" value={value.id} /> : null}
      <div>
        <label htmlFor="name" className="label">
          Case name
        </label>
        <input id="name" name="name" required defaultValue={value?.name} className="control" placeholder="United States v. …" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="court" className="label">
            Court
          </label>
          <input id="court" name="court" defaultValue={value?.court ?? ''} className="control" />
        </div>
        <div>
          <label htmlFor="jurisdiction" className="label">
            Jurisdiction
          </label>
          <input id="jurisdiction" name="jurisdiction" defaultValue={value?.jurisdiction ?? ''} className="control" />
        </div>
        <div>
          <label htmlFor="docketNumber" className="label">
            Docket number
          </label>
          <input id="docketNumber" name="docketNumber" defaultValue={value?.docketNumber ?? ''} className="control tabular" />
        </div>
        <div>
          <label htmlFor="caseType" className="label">
            Case type
          </label>
          <select id="caseType" name="caseType" defaultValue={value?.caseType ?? 'criminal'} className="control">
            {CASE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CASE_TYPE_META[t].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="stage" className="label">
            Current stage
          </label>
          <input id="stage" name="stage" defaultValue={value?.stage ?? ''} className="control" />
        </div>
        <div>
          <label htmlFor="nextDate" className="label">
            Next scheduled date
          </label>
          <input id="nextDate" name="nextDate" type="date" defaultValue={value?.nextDate ?? ''} className="control" />
        </div>
      </div>
      <div>
        <label htmlFor="parties" className="label">
          Parties (one per line; only those named in public court records)
        </label>
        <textarea id="parties" name="parties" rows={3} defaultValue={value?.parties.join('\n')} className="control" />
      </div>
      <div>
        <label htmlFor="courtlistenerUrl" className="label">
          CourtListener link
        </label>
        <input id="courtlistenerUrl" name="courtlistenerUrl" type="url" defaultValue={value?.courtlistenerUrl ?? ''} className="control" />
      </div>
      <p className="hint">Case details reach public pages when a linked record is next published.</p>
    </ActionForm>
  )
}
