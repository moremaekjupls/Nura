/**
 * Downscale a photo before upload: a 12 MP phone shot (5–8 MB as base64) becomes
 * a ~1024 px JPEG of ~100–200 KB — much faster on mobile data and cheaper for
 * the model. Drawing through a canvas also normalises HEIC and EXIF rotation
 * in browsers that can decode them.
 */
export async function photoToBase64(file: File, maxSide = 1024, quality = 0.82): Promise<{ data: string; mediaType: 'image/jpeg' }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(async () => {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  const w = 'width' in bitmap ? bitmap.width : 0;
  const hgt = 'height' in bitmap ? bitmap.height : 0;
  const scale = Math.min(1, maxSide / Math.max(w, hgt));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(hgt * scale);
  canvas.getContext('2d')!.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' };
}
