import { describe, it, expect } from 'vitest';
import {
  brandPlatformSchema,
  brandScreenshotSchema,
  brandActivitySchema,
  brandBuildingDataSchema,
  careerTransitionMetaSchema,
  type BrandPlatform,
  type BrandScreenshot,
  type BrandActivity,
  type BrandBuildingData,
} from '../types.js';

describe('Brand Building Schemas', () => {
  describe('brandPlatformSchema', () => {
    it('should accept LinkedIn', () => {
      const result = brandPlatformSchema.parse('LinkedIn');
      expect(result).toBe('LinkedIn');
    });

    it('should accept X', () => {
      const result = brandPlatformSchema.parse('X');
      expect(result).toBe('X');
    });

    it('should reject invalid platform', () => {
      expect(() => brandPlatformSchema.parse('Twitter')).toThrow();
      expect(() => brandPlatformSchema.parse('Facebook')).toThrow();
    });
  });

  describe('brandScreenshotSchema', () => {
    const validScreenshot: BrandScreenshot = {
      storageKey: 'users/123/brand-building/node-456/LinkedIn/screenshot.png',
      filename: 'screenshot.png',
      mimeType: 'image/png',
      sizeBytes: 1000000,
      notes: 'Sample notes',
    };

    it('should accept valid screenshot', () => {
      const result = brandScreenshotSchema.parse(validScreenshot);
      expect(result).toEqual(validScreenshot);
    });

    it('should accept screenshot without notes', () => {
      const { notes, ...screenshotWithoutNotes } = validScreenshot;
      const result = brandScreenshotSchema.parse(screenshotWithoutNotes);
      expect(result).toEqual(screenshotWithoutNotes);
    });

    it('should reject screenshot with invalid mimeType', () => {
      expect(() =>
        brandScreenshotSchema.parse({ ...validScreenshot, mimeType: 'text/plain' })
      ).toThrow();
    });

    it('should reject screenshot with size > 5MB', () => {
      expect(() =>
        brandScreenshotSchema.parse({ ...validScreenshot, sizeBytes: 6000000 })
      ).toThrow();
    });

    it('should reject screenshot with notes > 500 chars', () => {
      expect(() =>
        brandScreenshotSchema.parse({
          ...validScreenshot,
          notes: 'a'.repeat(501),
        })
      ).toThrow();
    });

    it('should reject empty storageKey', () => {
      expect(() =>
        brandScreenshotSchema.parse({ ...validScreenshot, storageKey: '' })
      ).toThrow();
    });
  });

  describe('brandActivitySchema', () => {
    const validActivity: BrandActivity = {
      platform: 'LinkedIn',
      profileUrl: 'https://linkedin.com/in/johndoe',
      screenshots: [
        {
          storageKey: 'key1',
          filename: 'screenshot1.png',
          mimeType: 'image/png',
          sizeBytes: 1000000,
        },
      ],
      timestamp: '2025-11-06T10:00:00Z',
    };

    it('should accept valid activity', () => {
      const result = brandActivitySchema.parse(validActivity);
      expect(result).toEqual(validActivity);
    });

    it('should accept activity with 5 screenshots', () => {
      const screenshots = Array.from({ length: 5 }, (_, i) => ({
        storageKey: `key${i}`,
        filename: `screenshot${i}.png`,
        mimeType: 'image/png',
        sizeBytes: 1000000,
      }));
      const result = brandActivitySchema.parse({
        ...validActivity,
        screenshots,
      });
      expect(result.screenshots).toHaveLength(5);
    });

    it('should reject activity with 0 screenshots', () => {
      expect(() =>
        brandActivitySchema.parse({ ...validActivity, screenshots: [] })
      ).toThrow();
    });

    it('should reject activity with > 5 screenshots', () => {
      const screenshots = Array.from({ length: 6 }, (_, i) => ({
        storageKey: `key${i}`,
        filename: `screenshot${i}.png`,
        mimeType: 'image/png',
        sizeBytes: 1000000,
      }));
      expect(() =>
        brandActivitySchema.parse({ ...validActivity, screenshots })
      ).toThrow();
    });

    it('should reject invalid profile URL', () => {
      expect(() =>
        brandActivitySchema.parse({ ...validActivity, profileUrl: 'not-a-url' })
      ).toThrow();
    });
  });

  describe('brandBuildingDataSchema', () => {
    const validData: BrandBuildingData = {
      activities: {
        LinkedIn: [
          {
            platform: 'LinkedIn',
            profileUrl: 'https://linkedin.com/in/johndoe',
            screenshots: [
              {
                storageKey: 'key1',
                filename: 'screenshot1.png',
                mimeType: 'image/png',
                sizeBytes: 1000000,
              },
            ],
            timestamp: '2025-11-06T10:00:00Z',
          },
        ],
        X: [],
      },
      overallSummary: 'Overall summary',
      summaries: {
        LinkedIn: 'LinkedIn summary',
        X: 'X summary',
      },
      keyPoints: {
        LinkedIn: ['Point 1', 'Point 2'],
        X: ['Point 3', 'Point 4'],
      },
    };

    it('should accept valid brand building data', () => {
      const result = brandBuildingDataSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should accept data without optional fields', () => {
      const minimalData: BrandBuildingData = {
        activities: {
          LinkedIn: [],
          X: [],
        },
      };
      const result = brandBuildingDataSchema.parse(minimalData);
      expect(result).toEqual(minimalData);
    });

    it('should accept empty activities', () => {
      const result = brandBuildingDataSchema.parse({
        activities: { LinkedIn: [], X: [] },
      });
      expect(result.activities).toEqual({ LinkedIn: [], X: [] });
    });
  });

  describe('careerTransitionMetaSchema', () => {
    it('should accept career transition meta with brandBuildingData', () => {
      const meta = {
        title: 'Career Transition',
        brandBuildingData: {
          activities: { LinkedIn: [], X: [] },
        },
      };
      const result = careerTransitionMetaSchema.parse(meta);
      expect(result.brandBuildingData).toBeDefined();
    });

    it('should accept career transition meta without brandBuildingData', () => {
      const meta = {
        title: 'Career Transition',
      };
      const result = careerTransitionMetaSchema.parse(meta);
      expect(result.brandBuildingData).toBeUndefined();
    });
  });
});
