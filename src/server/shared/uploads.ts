/**
 * Uploaded evidence: type sniffing from file bytes (never trusting the
 * browser's MIME type), and metadata stripping. Images are re-encoded with
 * sharp, which drops EXIF, GPS, XMP and IPTC data.
 */
import 'server-only'
import sharp from 'sharp'

export const UPLOAD_LIMITS = { maxFiles: 5, maxFileBytes: 3 * 1024 * 1024, maxTotalBytes: 3.5 * 1024 * 1024 }

export type SniffedType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'

export function sniffType(buf: Buffer): SniffedType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString('ascii'))) return 'image/gif'
  if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf'
  return null
}

/**
 * Remove location and camera metadata. The image is auto-rotated first so
 * dropping the EXIF orientation tag does not turn it sideways.
 */
export async function stripImageMetadata(buf: Buffer, type: SniffedType): Promise<Buffer> {
  const img = sharp(buf, { failOn: 'error', animated: type === 'image/gif' }).rotate()
  switch (type) {
    case 'image/jpeg':
      return img.jpeg({ quality: 90, mozjpeg: true }).toBuffer()
    case 'image/png':
      return img.png({ compressionLevel: 9 }).toBuffer()
    case 'image/webp':
      return img.webp({ quality: 90 }).toBuffer()
    case 'image/gif':
      return img.gif().toBuffer()
    default:
      return buf
  }
}

export async function hasImageMetadata(buf: Buffer): Promise<boolean> {
  const meta = await sharp(buf).metadata()
  return Boolean(meta.exif || meta.xmp || meta.iptc)
}
