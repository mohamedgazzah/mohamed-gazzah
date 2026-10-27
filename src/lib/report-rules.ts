/** Report form rules the browser checks before sending; the server checks them again (src/server/public/submissions.ts). */
export const WHAT_HAPPENED_MIN = 20

export const WHAT_HAPPENED_MESSAGE = {
  report: 'Tell us a little more. A sentence or two is enough.',
  correction: 'Describe the correction in a sentence or two.',
} as const

export const CITY_MESSAGE = 'Enter the city or town.'
export const RECORD_ID_MESSAGE = 'Enter the record id, for example US-2026-0412.'
