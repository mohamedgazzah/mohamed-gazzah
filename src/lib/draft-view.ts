import type { IncidentViewData } from '@/components/IncidentView'
import { todayIso } from './format'
import { stateByFips } from './states'
import type { IncidentDraftInput } from './validation'

type Draft = IncidentDraftInput
export type CaseOption = { id: string; name: string }

/** Map the editor draft to what the public page will show. */
export function draftToView(d: Draft, cases: CaseOption[]): IncidentViewData {
  const n = new Map(d.sources.map((s, i) => [s.id, i + 1]))
  return {
    id: d.id ?? '',
    title: d.title,
    summary: d.summary,
    dateStart: d.dateStart || todayIso(),
    dateEnd: d.dateEnd,
    datePrecision: d.datePrecision,
    city: d.city,
    stateCode: stateByFips(d.stateFips)?.code ?? '',
    locationPrecision: d.locationPrecision,
    incidentTypes: d.incidentTypes,
    targetType: d.targetType,
    targetAttributes: d.targetAttributes,
    severity: d.severity as 1 | 2 | 3 | 4 | 5,
    deaths: d.deaths,
    injuries: d.injuries,
    propertyDamage: d.propertyDamage,
    perpetratorType: d.perpetratorType,
    perpetratorCount: d.perpetratorCount,
    perpetratorNames: d.perpetratorNames,
    biasIndicators: d.biasIndicators,
    verificationLevel: d.verificationLevel,
    legalStatus: d.legalStatus,
    hateCrimeCharged: d.hateCrimeCharged,
    agenciesInvolved: d.agenciesInvolved,
    sourceTypes: Array.from(new Set(d.sources.map((s) => s.sourceType))),
    sources: d.sources.map((s, i) => ({
      n: i + 1,
      outlet: s.outlet || 'Outlet',
      title: s.title || 'Title',
      author: s.author,
      url: s.url || '#',
      archived_url: null,
      published_date: s.publishedDate,
      accessed_date: s.accessedDate,
      source_type: s.sourceType,
      claim_attribution: s.claimAttribution,
    })),
    legalEvents: [...d.legalEvents]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({ date: e.date, event_type: e.eventType, description: e.description, case_id: e.caseId, source_n: n.get(e.sourceId) ?? null })),
    statements: d.statements.map((s) => ({
      speaker: s.speaker,
      speaker_role: s.speakerRole,
      organization: s.organization,
      statement_type: s.statementType,
      date: s.date,
      quote: s.quote,
      paraphrase: s.paraphrase,
      source_n: n.get(s.sourceId) ?? null,
    })),
    cases: d.caseIds.map((cid) => ({
      id: cid,
      name: cases.find((c) => c.id === cid)?.name ?? cid,
      court: null,
      jurisdiction: null,
      docket_number: null,
      case_type: 'criminal',
      parties: [],
      stage: null,
      next_date: null,
      courtlistener_url: null,
    })),
    changeLog: [],
    isDemo: d.id?.startsWith('DEMO-') ?? false,
    updatedAt: null,
  }
}
