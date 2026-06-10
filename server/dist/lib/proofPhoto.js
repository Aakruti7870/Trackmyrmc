import { ObjectStorageService } from '../replit_integrations/object_storage/index.js';
// Matches a base64 image data URL and captures its MIME type + payload.
const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s;
/** True for values stored as object-storage entity paths (the new format). */
export function isObjectStoragePath(value) {
    return value.startsWith('/objects/');
}
/**
 * Proof-of-delivery photo storage. Photos are uploaded to object storage and
 * the challans row keeps only the returned entity path (/objects/...). Reads
 * resolve that path to a short-lived signed URL the browser can load directly.
 *
 * Exported as a single mutable object so tests can stub `store`/`resolve` in
 * place with `mock.method` without standing up the object-storage sidecar.
 */
export const proofPhotoStore = {
    /**
     * Decodes a base64 image data URL and uploads it to object storage.
     * Returns the entity path to persist on the challan.
     */
    async store(dataUrl) {
        const match = DATA_URL_RE.exec(dataUrl);
        if (!match) {
            throw new Error('Proof photo must be a base64 image data URL');
        }
        const contentType = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const service = new ObjectStorageService();
        return service.uploadBuffer(buffer, contentType);
    },
    /**
     * Turns a stored proof-photo value into something the browser can render:
     * - object paths (/objects/...) become short-lived signed download URLs
     * - legacy base64 data URLs are returned unchanged (transition support)
     * - null/empty is passed through
     */
    async resolve(stored) {
        if (!stored)
            return null;
        if (!isObjectStoragePath(stored))
            return stored;
        const service = new ObjectStorageService();
        return service.getObjectEntityDownloadURL(stored);
    },
};
