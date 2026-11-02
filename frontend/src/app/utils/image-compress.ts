/** Limites alignées sur le ré-encodage serveur (sharp). */
export const IMAGE_PRESETS = {
  logo: { maxWidth: 900, maxHeight: 900 },
  lockup: { maxWidth: 900, maxHeight: 900 },
  hero: { maxWidth: 2000, maxHeight: 1400 },
  product: { maxWidth: 1400, maxHeight: 1400 }
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const SKIP_UNDER_BYTES = 180 * 1024;

export class ImageCompressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageCompressError';
  }
}

/**
 * Réduit l'image dans le navigateur (redimensionnement + WebP) avant l'envoi,
 * pour ne plus bloquer sur un PNG de plusieurs mégaoctets.
 */
export async function compressImageFile(
  file: File,
  preset: ImagePreset | { maxWidth: number; maxHeight: number } = 'product'
): Promise<File> {
  if (!file) throw new ImageCompressError('Aucun fichier sélectionné.');

  const type = (file.type || '').toLowerCase();
  if (type && !type.startsWith('image/')) {
    throw new ImageCompressError('Ce fichier n’est pas une image. Utilisez un PNG, JPEG ou WebP.');
  }
  if (type === 'image/svg+xml') {
    throw new ImageCompressError('Les fichiers SVG ne sont pas acceptés. Exportez le logo en PNG.');
  }

  const bounds = typeof preset === 'string' ? IMAGE_PRESETS[preset] : preset;
  const keepAlpha = typeof preset === 'string' && (preset === 'logo' || preset === 'lockup');

  let bitmap: ImageBitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    throw new ImageCompressError('Impossible de lire cette image. Utilisez un PNG, JPEG ou WebP.');
  }

  try {
    const { width, height } = fitInside(bitmap.width, bitmap.height, bounds.maxWidth, bounds.maxHeight);
    const alreadySmall = file.size <= SKIP_UNDER_BYTES
      && width === bitmap.width
      && height === bitmap.height
      && (type === 'image/webp' || type === 'image/jpeg');
    if (alreadySmall) return file;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageCompressError('Compression impossible dans ce navigateur.');
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.82;
    let blob = await encodeCanvas(canvas, quality, keepAlpha);
    while (blob.size > MAX_OUTPUT_BYTES && quality > 0.5) {
      quality -= 0.1;
      blob = await encodeCanvas(canvas, quality, keepAlpha);
    }
    if (blob.size > MAX_OUTPUT_BYTES) {
      throw new ImageCompressError('L’image reste trop lourde après compression. Choisissez un fichier plus petit.');
    }

    const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

export function imageUploadErrorMessage(err: unknown): string {
  if (err instanceof ImageCompressError) return err.message;
  const e = err as { status?: number; error?: { message?: string } | string; message?: string };
  if (e?.status === 413) {
    return 'L’image est trop lourde pour le serveur. Compressez-la ou choisissez un fichier plus petit (25 Mo max).';
  }
  if (e?.status === 0) {
    return 'Connexion interrompue pendant l’envoi. Vérifiez le réseau et réessayez.';
  }
  const html = typeof e?.error === 'string' ? e.error : '';
  if (/413|Request Entity Too Large|entity too large/i.test(html)) {
    return 'L’image est trop lourde pour le serveur. Compressez-la ou choisissez un fichier plus petit (25 Mo max).';
  }
  const server = typeof e?.error === 'object' && e.error?.message ? e.error.message : '';
  if (server) return server;
  if (e?.message && !/^Http failure/i.test(e.message)) return e.message;
  return 'L’envoi de l’image a échoué. Formats acceptés : PNG, JPEG, WebP.';
}

function fitInside(w: number, h: number, maxW: number, maxH: number) {
  const scale = Math.min(1, maxW / w, maxH / h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale))
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('decode'));
        image.src = url;
      });
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new ImageCompressError('Compression impossible dans ce navigateur.'));
      else resolve(blob);
    }, type, quality);
  });
}

async function encodeCanvas(canvas: HTMLCanvasElement, quality: number, keepAlpha: boolean): Promise<Blob> {
  const webp = await canvasToBlob(canvas, 'image/webp', quality);
  if (webp.size > 0 && webp.type === 'image/webp') return webp;
  if (keepAlpha) return canvasToBlob(canvas, 'image/png');
  return canvasToBlob(canvas, 'image/jpeg', quality);
}
