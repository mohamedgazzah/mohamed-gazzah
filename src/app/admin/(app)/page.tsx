import Link from 'next/link'
import { and, count, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { correctionTickets, incidents, sources } from '@/db/schema'
import { todayIso } from '@/lib/format'
import { leadCounts } from '@/server/admin/leads'
import { requireUser } from '@/server/admin/session'

async function n(q: Promise<{ n: number }[]>) {
  return (await q)[0]?.n ?? 0
}

export default async function Dashboard(props: PageProps<'/admin'>) {
  const me = await requireUser()
  const sp = await props.searchParams
  const db = adminDb()
  const today = todayIso()
  const [myDrafts, inReview, approved, reviewsDue, openCorrections, overdueCorrections, archiveFailures, leadsByStatus] = await Promise.all([
    n(db.select({ n: count() }).from(incidents).where(and(eq(incidents.createdBy, me.id), inArray(incidents.workflowStatus, ['draft', 'returned'])))),
    n(db.select({ n: count() }).from(incidents).where(eq(incidents.workflowStatus, 'in_review'))),
    n(db.select({ n: count() }).from(incidents).where(eq(incidents.workflowStatus, 'approved'))),
    n(db.select({ n: count() }).from(incidents).where(and(isNotNull(incidents.nextReviewDue), lte(incidents.nextReviewDue, today)))),
    n(db.select({ n: count() }).from(correctionTickets).where(inArray(correctionTickets.status, ['open', 'responded']))),
    n(
      db
        .select({ n: count() })
        .from(correctionTickets)
        .where(sql`${correctionTickets.status} IN ('open','responded') AND ((${correctionTickets.firstResponseAt} IS NULL AND ${correctionTickets.responseDueAt} < now()) OR ${correctionTickets.fixDueAt} < now())`),
    ),
    n(db.select({ n: count() }).from(sources).where(eq(sources.archiveStatus, 'failed'))),
    leadCounts(),
  ])
  const tiles = [
    { label: 'My drafts', value: myDrafts, href: `/admin/incidents?mine=1` },
    { label: 'Waiting for review', value: inReview, href: '/admin/review' },
    { label: 'Approved, not yet published', value: approved, href: '/admin/incidents?status=approved' },
    { label: 'Untriaged leads', value: leadsByStatus.new ?? 0, href: '/admin/leads' },
    { label: 'Open correction requests', value: openCorrections, href: '/admin/corrections', alert: overdueCorrections ? `${overdueCorrections} overdue` : null },
    { label: '30-day reviews due', value: reviewsDue, href: '/admin/incidents?due=1' },
    { label: 'Sources not archived', value: archiveFailures, href: '/admin/incidents?archive=failed' },
  ]
  return (
    <>
      <h1 className="text-2xl">Dashboard</h1>
      {sp.denied ? (
        <p role="alert" className="field-error mt-2">
          Your role does not allow that page.
        </p>
      ) : null}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className="card block p-4 text-text no-underline hover:border-accent">
              <span className="block font-serif text-3xl tabular">{t.value}</span>
              <span className="block font-semibold">{t.label}</span>
              {t.alert ? <span className="block text-sm font-semibold text-severe">{t.alert}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href="/admin/incidents/new" className="btn">
          Draft a new record
        </Link>
      </p>
    </>
  )
}
