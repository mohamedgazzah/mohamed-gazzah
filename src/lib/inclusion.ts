/**
 * The inclusion criteria (Methodology, "What is included") as text. The
 * methodology page renders them from here and the morning news scan gives
 * them to the model word for word, so the scan screens articles against
 * exactly the published rules. Changing them is a methodology change.
 */
export const INCLUSION_UNIT =
  'The unit of this record is one incident: a single event, at one time and place, that targets a person, a group or a property because the victim is, or is perceived to be, Muslim. One incident can have many sources, legal events and statements. Several incidents can belong to one court case or one perpetrator.'

export const INCLUSION_CRITERIA = [
  'It happened in the United States or its territories, on or after January 1, 2020. Earlier records may be added only as a separate, labelled backfill.',
  'At least one public source describes an anti-Muslim element: a slur, a stated motive, a target that is a Muslim institution, a hate-crime charge, or an official statement calling it bias-motivated.',
  'It is either a crime (assault, threat, vandalism, arson, homicide and others) or a non-criminal act that is concrete and targeted, such as harassment of named people, threats to a mosque, or slurs by a public official acting in office.',
] as const

export const INCLUSION_EXCLUSIONS = [
  'General online speech not aimed at a specific target.',
  'Opinion pieces.',
  'Policy disputes.',
  'Incidents where the investigating agency clearly ruled out an anti-Muslim element. These are kept internally as “excluded”, with the reason.',
] as const

export const INCLUSION_POLICY_NOTE =
  'Government actions such as detentions, designations of organizations and travel restrictions are tracked separately as policy and litigation, not counted as incidents. This keeps incident counts comparable from year to year.'
