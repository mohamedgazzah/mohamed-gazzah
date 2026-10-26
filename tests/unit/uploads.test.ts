import { describe, expect, it } from 'vitest'
import { hasImageMetadata, sniffType, stripImageMetadata } from '@/server/shared/uploads'
import { jpegWithGps, pngWithText } from '../fixtures/make-images'

describe('uploaded images', () => {
  it('detects types from bytes, not names', async () => {
    expect(sniffType(await jpegWithGps())).toBe('image/jpeg')
    expect(sniffType(await pngWithText())).toBe('image/png')
    expect(sniffType(Buffer.from('%PDF-1.7 ...'))).toBe('application/pdf')
    expect(sniffType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
  })
  it('removes EXIF, including GPS, from JPEG and PNG', async () => {
    const jpg = await jpegWithGps()
    expect(await hasImageMetadata(jpg)).toBe(true)
    const clean = await stripImageMetadata(jpg, 'image/jpeg')
    expect(await hasImageMetadata(clean)).toBe(false)
    expect(clean.includes(Buffer.from('GPS'))).toBe(false)
    const png = await stripImageMetadata(await pngWithText(), 'image/png')
    expect(await hasImageMetadata(png)).toBe(false)
  })
})
