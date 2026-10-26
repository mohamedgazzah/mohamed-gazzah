import { RecordEditor } from '@/components/admin/RecordEditor'
import { caseOptions } from '@/server/admin/cases'
import { emptyDraft } from '@/server/admin/incidents'
import { requireUser } from '@/server/admin/session'

export const metadata = { title: 'New record' }

export default async function NewRecordPage() {
  await requireUser('contributor')
  const cases = await caseOptions()
  return (
    <>
      <h1 className="mb-2 text-2xl">Draft a new record</h1>
      <p className="mb-6 hint">Drafts are private. A second editor reviews every record before a senior editor publishes it.</p>
      <RecordEditor initial={emptyDraft()} cases={cases} isNew />
    </>
  )
}
