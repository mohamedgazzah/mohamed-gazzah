import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CaseForm } from '@/components/admin/CaseForm'
import { getCase } from '@/server/admin/cases'
import { requireUser } from '@/server/admin/session'

export const metadata = { title: 'Case' }

export default async function CasePage(props: PageProps<'/admin/cases/[id]'>) {
  await requireUser('editor')
  const { id } = await props.params
  const sp = await props.searchParams
  const c = await getCase(id)
  if (!c) notFound()
  return (
    <>
      <p className="text-sm">
        <Link href="/admin/cases">Cases</Link>
      </p>
      <h1 className="mt-1 text-2xl">{c.name}</h1>
      <p className="mb-6 text-sm text-muted tabular">{c.id}</p>
      {sp.saved ? (
        <p role="status" className="mb-4 font-semibold text-confirmed">
          Saved.
        </p>
      ) : null}
      <CaseForm value={c} />
    </>
  )
}
