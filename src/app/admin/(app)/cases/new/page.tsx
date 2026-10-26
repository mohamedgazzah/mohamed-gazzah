import Link from 'next/link'
import { CaseForm } from '@/components/admin/CaseForm'
import { requireUser } from '@/server/admin/session'

export const metadata = { title: 'New case' }

export default async function NewCasePage() {
  await requireUser('editor')
  return (
    <>
      <p className="text-sm">
        <Link href="/admin/cases">Cases</Link>
      </p>
      <h1 className="mb-6 mt-1 text-2xl">Add a court case</h1>
      <CaseForm />
    </>
  )
}
