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

  describe('PNG validation', () => {
    it('should validate PNG with correct signature', () => {
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      const buffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
      ]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe('image/png');
    });

    it('should reject buffer too short for PNG', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });

    it('should reject invalid PNG signature', () => {
      const buffer = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x00, // Wrong last byte
      ]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });
  });

  describe('JPEG validation', () => {
    it('should validate JPEG with correct signature', () => {
      // JPEG signature: FF D8 FF
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe('image/jpeg');
    });

    it('should validate JPEG with JFIF marker', () => {
      // JPEG with JFIF: FF D8 FF E0
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe('image/jpeg');
    });

    it('should validate JPEG with EXIF marker', () => {
      // JPEG with EXIF: FF D8 FF E1
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe('image/jpeg');
    });

    it('should reject buffer too short for JPEG', () => {
      const buffer = Buffer.from([0xff, 0xd8]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });

    it('should reject invalid JPEG signature', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0x00]); // Wrong third byte

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });
  });

  describe('GIF validation', () => {
    it('should validate GIF87a signature', () => {
      const buffer = Buffer.from('GIF87a\x00\x00');

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe('image/gif');
    });

    it('should validate GIF89a signature', () => {
      const buffer = Buffer.from('GIF89a\x00\x00');

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe('image/gif');
    });

    it('should reject buffer too short for GIF', () => {
      const buffer = Buffer.from('GIF89');

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });

    it('should reject invalid GIF version', () => {
      const buffer = Buffer.from('GIF90a\x00\x00');

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });
  });

  describe('WEBP validation', () => {
    it('should validate WEBP with correct signature', () => {
      // WEBP signature: RIFF + size + WEBP
      const buffer = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x00,
        0x00,
        0x00,
        0x00, // File size (placeholder)
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
      ]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe('image/webp');
    });

    it('should reject buffer too short for WEBP', () => {
      const buffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      ]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });

    it('should reject RIFF without WEBP', () => {
      const buffer = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x00,
        0x00,
        0x00,
        0x00,
        0x57,
        0x41,
        0x56,
        0x45, // WAVE (not WEBP)
      ]);

      const result = MagicByteValidator.validate(buffer);

      expect(result.isValid).toBe(false);
      expect(result.detectedType).toBeNull();
    });

    it('should reject invalid RIFF header', () => {
      const buffer = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x00, // Invalid RIFF
        0x00,
        0x00,
        0x00,
        0x00,
        0x57,
        0x45,
        0x42,
        0x50,
      ]);

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
