/**
 * Magic Byte Validator Tests
 *
 * Tests for file type validation using magic bytes (file signatures)
 */

import { describe, expect, it } from 'vitest';

import { MagicByteValidator } from '../magic-byte-validator';

describe('MagicByteValidator', () => {
  describe('PDF validation', () => {
    it('should validate PDF with %PDF-1.4 signature', () => {
      const buffer = Buffer.from('%PDF-1.4\n%some content');

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe('application/pdf');
    });

    it('should validate PDF with %PDF-1.5 signature', () => {
      const buffer = Buffer.from('%PDF-1.5\n%some content');

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe('application/pdf');
    });

    it('should validate PDF with %PDF-1.7 signature', () => {
      const buffer = Buffer.from('%PDF-1.7\n%some content');

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe('application/pdf');
    });

    it('should reject invalid PDF signature', () => {
      const buffer = Buffer.from('not a pdf file');

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });
  });

  describe('Invalid files', () => {
    it('should reject text file', () => {
      const buffer = Buffer.from('This is a plain text file');

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });

    it('should reject HTML file', () => {
      const buffer = Buffer.from(
        '<!DOCTYPE html><html><body>Test</body></html>'
      );

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });

    it('should reject JSON file', () => {
      const buffer = Buffer.from('{"key": "value"}');

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });

    it('should reject empty buffer', () => {
      const buffer = Buffer.from([]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });

    it('should reject buffer that is too short', () => {
      const buffer = Buffer.from([0x50]); // Only 1 byte

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle buffer with null bytes', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });

    it('should handle buffer that starts with partial PDF signature', () => {
      const buffer = Buffer.from('%PDF'); // Missing version

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });

    it('should handle buffer that starts with partial ZIP signature', () => {
      const buffer = Buffer.from([0x50, 0x4b]); // Only PK

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });
  });
});
