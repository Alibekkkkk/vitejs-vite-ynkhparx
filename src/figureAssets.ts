import type { GenerativeContentBlob } from 'firebase/ai';

export type FigureAsset = {
  storagePath: string;
  downloadUrl: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  alt: string;
  caption: string;
  assetVersion: number;
  uploadedAt: string;
  uploadedBy: string;
};

export type FigureFileMetadata = {
  name: string;
  type: string;
  size: number;
};

export const MAX_FIGURE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
]);

export function normalizeFigureUrl(input: string): string {
  const value = input.trim();
  const bbCodeMatch = value.match(/\[img\](.*?)\[\/img\]/i);
  const htmlMatch = value.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  const candidate = (bbCodeMatch?.[1] || htmlMatch?.[1] || value).trim();
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function validateFigureFile(file: FigureFileMetadata): string | null {
  const expectedExtension = ALLOWED_IMAGE_TYPES.get(file.type);
  if (!expectedExtension) return 'Choose a PNG, JPEG, or WebP image. SVG and other file types are not accepted.';
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  const extensionMatches = file.type === 'image/jpeg'
    ? extension === '.jpg' || extension === '.jpeg'
    : extension === expectedExtension;
  if (!extensionMatches) return 'The file extension does not match its image type.';
  if (file.size <= 0 || file.size > MAX_FIGURE_BYTES) return 'The image must be smaller than 5 MB.';
  return null;
}

export function validateFigureDimensions(width: number, height: number): string | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 200 || height < 120) {
    return 'The image must be at least 200 × 120 pixels.';
  }
  if (width > 6000 || height > 6000) return 'The image dimensions must not exceed 6,000 pixels.';
  const ratio = width / height;
  if (ratio < 0.2 || ratio > 5) return 'The image aspect ratio must be between 1:5 and 5:1.';
  return null;
}

export function readFigureDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The selected file could not be decoded as an image.'));
    };
    image.src = objectUrl;
  });
}

export function verifyFigureUrl(url: string): Promise<void> {
  const normalized = normalizeFigureUrl(url);
  if (!normalized) return Promise.reject(new Error('Enter a valid HTTPS image URL.'));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('The URL did not return an image that this browser can display.'));
    image.src = normalized;
  });
}

export function getFigureSource(question: Record<string, any> | null | undefined): string {
  const assetUrl = question?.imageAsset?.downloadUrl;
  const legacyUrl = question?.imageUrl;
  return normalizeFigureUrl(typeof assetUrl === 'string' ? assetUrl : '')
    || normalizeFigureUrl(typeof legacyUrl === 'string' ? legacyUrl : '');
}

export async function fetchFigureForAI(source: string): Promise<GenerativeContentBlob> {
  const url = normalizeFigureUrl(source);
  if (!url) throw new Error('This prompt figure does not have a valid HTTPS image URL.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error(`The prompt figure could not be loaded (HTTP ${response.status}).`);
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > MAX_FIGURE_BYTES) throw new Error('The prompt figure is larger than the 5 MB AI upload limit.');

    const mimeType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error('AI figure suggestions support PNG, JPEG, or WebP images only.');

    if (!response.body) throw new Error('This browser could not read the prompt figure for AI.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > MAX_FIGURE_BYTES) {
        await reader.cancel();
        throw new Error('The prompt figure is larger than the 5 MB AI upload limit.');
      }
      chunks.push(value);
    }
    if (totalSize === 0) throw new Error('The prompt figure downloaded empty.');
    const bytes = new Uint8Array(totalSize);
    let byteOffset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, byteOffset);
      byteOffset += chunk.byteLength;
    }
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
    }
    return { mimeType, data: btoa(binary) };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Loading the prompt figure for AI timed out. Check the image URL and try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('The prompt figure could not be read from this website. Check its image URL and cross-origin access, then try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function requiresTaskFigure(question: Record<string, any> | null | undefined): boolean {
  if (Number(question?.writingTaskType) !== 1 || question?.figureMode === 'text-only') return false;
  return /chart|graph|table|map|process|visual/i.test(String(question?.writingFormat || ''));
}
