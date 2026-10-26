import sharp from 'sharp'

/** A small JPEG carrying GPS and camera EXIF, like a phone photo. */
export async function jpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 120, g: 120, b: 120 } } })
    .withExif({
      IFD0: { Make: 'TestPhone', Model: 'Model X', Copyright: 'Owner Name' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '42/1 19/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '83/1 2/1 0/1' },
    })
    .jpeg()
    .toBuffer()
}

export async function pngWithText(): Promise<Buffer> {
  return sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
    .withExif({ IFD0: { Make: 'TestPhone' } })
    .png()
    .toBuffer()
}
