import { ObjectStorageService } from '../replit_integrations/object_storage/index.js';

// Matches a base64 image data URL and captures its MIME type + payload.
const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s;

/** True for values stored as object-storage entity paths (the new format). */
export function isObjectStoragePath(value: string): boolean {
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
  async store(dataUrl: string): Promise<string> {
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
   * Mints a short-lived presigned PUT URL the driver's phone can upload a proof
   * photo to directly, plus the normalized /objects/... entity path that should
   * later be sent on the challan PUT. This keeps large image bytes off the API.
   */
  async createUploadUrl(): Promise<{ uploadURL: string; objectPath: string }> {
    const service = new ObjectStorageService();
    const uploadURL = await service.getObjectEntityUploadURL();
    const objectPath = service.normalizeObjectEntityPath(uploadURL);
    return { uploadURL, objectPath };
  },

  /**
   * Confirms that an /objects/... entity path actually exists in storage before
   * it is linked to a challan, so a client can't persist a path it never wrote.
   */
  async verifyExists(objectPath: string): Promise<boolean> {
    if (!isObjectStoragePath(objectPath)) return false;
    const service = new ObjectStorageService();
    try {
      await service.getObjectEntityFile(objectPath);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Turns a stored proof-photo value into something the browser can render:
   * - object paths (/objects/...) become short-lived signed download URLs
   * - legacy base64 data URLs are returned unchanged (transition support)
   * - null/empty is passed through
   */
  async resolve(stored: string | null | undefined): Promise<string | null> {
    if (!stored) return null;
    if (!isObjectStoragePath(stored)) return stored;
    const service = new ObjectStorageService();
    return service.getObjectEntityDownloadURL(stored);
  },

  /**
   * Removes a stored proof-photo's backing object from object storage.
   * - object paths (/objects/...) are deleted from storage (idempotently: a
   *   missing object is not an error)
   * - legacy base64 data URLs have no separate object, so nothing is removed
   * - null/empty is a no-op
   */
  async remove(stored: string | null | undefined): Promise<void> {
    if (!stored) return;
    if (!isObjectStoragePath(stored)) return;
    const service = new ObjectStorageService();
    await service.deleteObjectEntity(stored);
  },
};
