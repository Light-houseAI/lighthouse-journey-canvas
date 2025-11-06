/**
 * File Upload Constants
 *
 * Shared constants for file upload functionality
 */

/**
 * Supported file types for uploads
 */
export const FILE_TYPES = {
  RESUME: 'resume',
  COVER_LETTER: 'cover_letter',
  PORTFOLIO: 'portfolio',
  BRAND_BUILDING_SCREENSHOT: 'brand_building_screenshot',
} as const;

export type FileType = (typeof FILE_TYPES)[keyof typeof FILE_TYPES];

/**
 * Maximum file size in bytes (10MB)
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Supported file extensions
 */
export const SUPPORTED_EXTENSIONS = {
  PDF: 'pdf',
  PNG: 'png',
  JPG: 'jpg',
  JPEG: 'jpeg',
  GIF: 'gif',
  WEBP: 'webp',
} as const;

/**
 * Supported MIME types
 */
export const SUPPORTED_MIME_TYPES = {
  PDF: 'application/pdf',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  WEBP: 'image/webp',
} as const;
