/**
 * Magic Byte Validator
 *
 * Validates file types by checking magic bytes (file signatures).
 * Supports PDF and common image formats (PNG, JPEG, GIF, WEBP).
 */

export interface ValidationResult {
  isValid: boolean;
  detectedType: string | null;
}

export class MagicByteValidator {
  /**
   * Validate file type using magic bytes
   * @param buffer - File buffer to validate (should be at least first 8KB)
   * @returns Validation result with detected type
   */
  static validate(buffer: Buffer): ValidationResult {
    if (!buffer || buffer.length === 0) {
      return { isValid: false, detectedType: null };
    }

    // Check for PDF signature: %PDF-
    if (this.isPDF(buffer)) {
      return {
        isValid: true,
        detectedType: 'application/pdf',
      };
    }

    // Check for PNG signature
    if (this.isPNG(buffer)) {
      return {
        isValid: true,
        detectedType: 'image/png',
      };
    }

    // Check for JPEG signature
    if (this.isJPEG(buffer)) {
      return {
        isValid: true,
        detectedType: 'image/jpeg',
      };
    }

    // Check for GIF signature
    if (this.isGIF(buffer)) {
      return {
        isValid: true,
        detectedType: 'image/gif',
      };
    }

    // Check for WEBP signature
    if (this.isWEBP(buffer)) {
      return {
        isValid: true,
        detectedType: 'image/webp',
      };
    }

    return { isValid: false, detectedType: null };
  }

  /**
   * Check if buffer starts with PDF signature
   * PDF signature: %PDF-1.x where x is the version number
   */
  private static isPDF(buffer: Buffer): boolean {
    if (buffer.length < 5) {
      return false;
    }

    // Check for %PDF- signature
    const signature = buffer.toString('ascii', 0, 5);
    return signature === '%PDF-';
  }

  /**
   * Check if buffer starts with PNG signature
   * PNG signature: 89 50 4E 47 0D 0A 1A 0A (8 bytes)
   */
  private static isPNG(buffer: Buffer): boolean {
    if (buffer.length < 8) {
      return false;
    }

    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  /**
   * Check if buffer starts with JPEG signature
   * JPEG signature: FF D8 FF (first 3 bytes)
   */
  private static isJPEG(buffer: Buffer): boolean {
    if (buffer.length < 3) {
      return false;
    }

    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  /**
   * Check if buffer starts with GIF signature
   * GIF signature: "GIF87a" or "GIF89a"
   */
  private static isGIF(buffer: Buffer): boolean {
    if (buffer.length < 6) {
      return false;
    }

    const signature = buffer.toString('ascii', 0, 6);
    return signature === 'GIF87a' || signature === 'GIF89a';
  }

  /**
   * Check if buffer starts with WEBP signature
   * WEBP signature: "RIFF" (0-3) + file size (4-7) + "WEBP" (8-11)
   */
  private static isWEBP(buffer: Buffer): boolean {
    if (buffer.length < 12) {
      return false;
    }

    const riff = buffer.toString('ascii', 0, 4);
    const webp = buffer.toString('ascii', 8, 12);
    return riff === 'RIFF' && webp === 'WEBP';
  }
}
