/**
 * US states, DC and territories with FIPS codes (ANSI INCITS 38).
 * Mirrored in the database as record.us_states (drizzle/0002_rules.sql);
 * tests/db/rules.test.ts checks both lists match.
 */
export type UsState = { fips: string; code: string; name: string; territory?: boolean }

export const US_STATES: readonly UsState[] = [
  { fips: '01', code: 'AL', name: 'Alabama' },
  { fips: '02', code: 'AK', name: 'Alaska' },
  { fips: '04', code: 'AZ', name: 'Arizona' },
  { fips: '05', code: 'AR', name: 'Arkansas' },
  { fips: '06', code: 'CA', name: 'California' },
  { fips: '08', code: 'CO', name: 'Colorado' },
  { fips: '09', code: 'CT', name: 'Connecticut' },
  { fips: '10', code: 'DE', name: 'Delaware' },
  { fips: '11', code: 'DC', name: 'District of Columbia' },
  { fips: '12', code: 'FL', name: 'Florida' },
  { fips: '13', code: 'GA', name: 'Georgia' },
  { fips: '15', code: 'HI', name: 'Hawaii' },
  { fips: '16', code: 'ID', name: 'Idaho' },
  { fips: '17', code: 'IL', name: 'Illinois' },
  { fips: '18', code: 'IN', name: 'Indiana' },
  { fips: '19', code: 'IA', name: 'Iowa' },
  { fips: '20', code: 'KS', name: 'Kansas' },
  { fips: '21', code: 'KY', name: 'Kentucky' },
  { fips: '22', code: 'LA', name: 'Louisiana' },
  { fips: '23', code: 'ME', name: 'Maine' },
  { fips: '24', code: 'MD', name: 'Maryland' },
  { fips: '25', code: 'MA', name: 'Massachusetts' },
  { fips: '26', code: 'MI', name: 'Michigan' },
  { fips: '27', code: 'MN', name: 'Minnesota' },
  { fips: '28', code: 'MS', name: 'Mississippi' },
  { fips: '29', code: 'MO', name: 'Missouri' },
  { fips: '30', code: 'MT', name: 'Montana' },
  { fips: '31', code: 'NE', name: 'Nebraska' },
  { fips: '32', code: 'NV', name: 'Nevada' },
  { fips: '33', code: 'NH', name: 'New Hampshire' },
  { fips: '34', code: 'NJ', name: 'New Jersey' },
  { fips: '35', code: 'NM', name: 'New Mexico' },
  { fips: '36', code: 'NY', name: 'New York' },
  { fips: '37', code: 'NC', name: 'North Carolina' },
  { fips: '38', code: 'ND', name: 'North Dakota' },
  { fips: '39', code: 'OH', name: 'Ohio' },
  { fips: '40', code: 'OK', name: 'Oklahoma' },
  { fips: '41', code: 'OR', name: 'Oregon' },
  { fips: '42', code: 'PA', name: 'Pennsylvania' },
  { fips: '44', code: 'RI', name: 'Rhode Island' },
  { fips: '45', code: 'SC', name: 'South Carolina' },
  { fips: '46', code: 'SD', name: 'South Dakota' },
  { fips: '47', code: 'TN', name: 'Tennessee' },
  { fips: '48', code: 'TX', name: 'Texas' },
  { fips: '49', code: 'UT', name: 'Utah' },
  { fips: '50', code: 'VT', name: 'Vermont' },
  { fips: '51', code: 'VA', name: 'Virginia' },
  { fips: '53', code: 'WA', name: 'Washington' },
  { fips: '54', code: 'WV', name: 'West Virginia' },
  { fips: '55', code: 'WI', name: 'Wisconsin' },
  { fips: '56', code: 'WY', name: 'Wyoming' },
  { fips: '60', code: 'AS', name: 'American Samoa', territory: true },
  { fips: '66', code: 'GU', name: 'Guam', territory: true },
  { fips: '69', code: 'MP', name: 'Northern Mariana Islands', territory: true },
  { fips: '72', code: 'PR', name: 'Puerto Rico', territory: true },
  { fips: '74', code: 'UM', name: 'U.S. Minor Outlying Islands', territory: true },
  { fips: '78', code: 'VI', name: 'U.S. Virgin Islands', territory: true },
]

const byCode = new Map(US_STATES.map((s) => [s.code, s]))
const byFips = new Map(US_STATES.map((s) => [s.fips, s]))

export function stateByCode(code: string | null | undefined): UsState | undefined {
  return code ? byCode.get(code.toUpperCase()) : undefined
}

export function stateByFips(fips: string | null | undefined): UsState | undefined {
  return fips ? byFips.get(fips) : undefined
}

export function stateName(codeOrFips: string | null | undefined): string {
  if (!codeOrFips) return ''
  return (stateByCode(codeOrFips) ?? stateByFips(codeOrFips))?.name ?? codeOrFips
}
