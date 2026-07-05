import { api } from '@/lib/api';

// Resize/compress an image file to a small JPEG data URL so uploaded photos
// (expense receipts, etc.) stay well under the server's upload limit while
// remaining legible. Mirrors the proof-photo compressor used in MyTrips.
export function compressImage(file: File, maxDim = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load the image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function dataURLToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:(.*?)(;base64)?$/.exec(head)?.[1] || 'image/jpeg';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Uploads a compressed image (data URL) directly to object storage via a
// presigned URL minted by the given API endpoint, returning the resulting
// /objects/... entity path to persist on the parent record.
export async function uploadImageToStorage(dataUrl: string, uploadUrlEndpoint: string): Promise<string> {
  const blob = dataURLToBlob(dataUrl);
  const { uploadURL, objectPath } = await api.post<{ uploadURL: string; objectPath: string }>(
    uploadUrlEndpoint,
    { contentType: blob.type },
  );
  const res = await fetch(uploadURL, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': blob.type },
  });
  if (!res.ok) throw new Error('Could not upload the photo. Please try again.');
  return objectPath;
}
