import Link from 'next/link'
import { CASE_TYPE_META } from '@/db/enums'
import { formatDate } from '@/lib/format'
import { listCases } from '@/server/admin/cases'
import { requireUser } from '@/server/admin/session'

export const metadata = { title: 'Cases' }

export default async function CasesPage() {
  await requireUser('editor')
  const rows = await listCases()
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Court cases</h1>
        <Link href="/admin/cases/new" className="btn">
          Add a case
        </Link>
      </div>
      <div className="table-scroll card mt-6" role="region" aria-label="Cases" tabIndex={0}>
        <table className="data-table">
          <caption className="sr-only">Court cases, by next scheduled date</caption>
          <thead>
            <tr>
              <th scope="col">Case</th>
              <th scope="col">Court</th>
              <th scope="col">Docket</th>
              <th scope="col">Type</th>
              <th scope="col">Stage</th>
              <th scope="col">Next date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/cases/${c.id}`} className="font-semibold">
                    {c.name}
                  </Link>
                  <span className="block text-sm text-muted tabular">{c.id}</span>
                </td>
                <td>{c.court}</td>
                <td className="tabular">{c.docketNumber}</td>
                <td>{CASE_TYPE_META[c.caseType].label}</td>
                <td>{c.stage}</td>
                <td className="whitespace-nowrap tabular">{c.nextDate ? formatDate(c.nextDate) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
