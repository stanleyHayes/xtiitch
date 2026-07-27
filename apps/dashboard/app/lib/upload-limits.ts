// Upload size ceiling for every image that rides a multipart form through a
// route action (Ghana Card photos, storefront logo/banner, design images).
// The dashboard deploys to Vercel, which rejects request bodies over 4.5 MB
// BEFORE the action runs — surfacing as a crash page instead of a form
// error. Capping each file at 2 MB keeps the largest form (two card photos,
// or logo + banner) safely under the platform limit.
export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_MB = 2;

export function isImageUploadAllowed(file: File): boolean {
  return file.size <= MAX_IMAGE_UPLOAD_BYTES;
}
