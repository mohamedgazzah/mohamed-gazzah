/**
 * Report form rules. The browser checks them before sending, so a mistake
 * never costs the person their attachments; the server checks them again
 * (src/server/public/submissions.ts).
 */
import { formatNumber } from './format'

export const WHAT_HAPPENED_MIN = 20

export const WHAT_HAPPENED_MESSAGE = {
  report: 'Tell us a little more. A sentence or two is enough.',
  correction: 'Describe the correction in a sentence or two.',
} as const

export const CITY_MESSAGE = 'Enter the city or town.'
export const RECORD_ID_MESSAGE = 'Enter the record id, for example US-2026-0412.'
export const EMAIL_MESSAGE = 'Check the email address: it should look like name@example.com.'
export const LINKS_MESSAGE = 'Check the links: put one web address on each line, for example https://www.freep.com/story.'
export const MAX_LINKS = 10

/** Longest accepted text per field (the inputs carry the same limits as maxLength where cutting text is harmless). */
export const MAX_LENGTH = {
  whatHappened: 5000,
  city: 100,
  address: 300,
  contactName: 200,
  contactEmail: 254,
  contactPhone: 40,
  recordId: 40,
} as const

export const tooLong = (length: number, max: number) =>
  `That’s ${formatNumber(length)} characters; the limit is ${formatNumber(max)}. Shorten it, or send the rest by email.`

/** A pasted "www.freep.com/…" or "freep.com/…" is a web address too. */
export function normalizeLink(raw: string): string {
  const s = raw.trim()
  if (/^https?:\/\//i.test(s)) return s
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return `https://${s}`
  return s
}

export const splitLinks = (text: string) =>
  text
    .split(/\s+/)
    .map(normalizeLink)
    .filter(Boolean)

export const isLink = (u: string) => /^https?:\/\/[^\s]+\.[^\s]+$/i.test(u) && u.length <= 2000

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

/** The first problem with the links box, if any. */
export function linksProblem(text: string): string | null {
  const links = splitLinks(text)
  if (links.length > MAX_LINKS) return `Add at most ${MAX_LINKS} links.`
  return links.every(isLink) ? null : LINKS_MESSAGE
}
