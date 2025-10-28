/**
 * Magic Byte Validator
 *
 * Validates file types by checking magic bytes (file signatures).
 * Currently supports PDF files only.
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
}
