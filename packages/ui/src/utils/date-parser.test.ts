import { describe, expect, it } from 'vitest';

import {
  calculateDuration,
  calculateTimelinePosition,
  detectDateOverlap,
  formatDateRange,
  parseFlexibleDate,
  sortByDate,
  sortItemsByDate,
} from './date-parser';

describe('Date Parser Utils', () => {
  describe('parseFlexibleDate', () => {
    it('should parse common date formats correctly', () => {
      const testCases = [
        { input: 'Jan 2023', expected: true },
        { input: 'January 2023', expected: true },
        { input: '01/2023', expected: true },
        { input: '2023-01', expected: true },
        { input: '2023', expected: true },
        { input: 'Jan 15, 2023', expected: true },
        { input: '01/15/2023', expected: true },
        { input: '2023-01-15', expected: true },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseFlexibleDate(input);
        expect(result.isValid).toBe(expected);
        if (expected) {
          expect(result.date).toBeInstanceOf(Date);
          expect(result.formatted).toBeTruthy();
        }
      });
    });

    it('should handle "Present" and "current" correctly', () => {
      const presentResult = parseFlexibleDate('Present');
      const currentResult = parseFlexibleDate('current');

      expect(presentResult.isValid).toBe(true);
      expect(presentResult.formatted).toBe('Present');
      expect(currentResult.isValid).toBe(true);
      expect(currentResult.formatted).toBe('Present');
    });

    it('should handle invalid dates', () => {
      const testCases = ['', null, undefined, 'invalid date', 'null'];

      testCases.forEach((input) => {
        const result = parseFlexibleDate(input);
        expect(result.isValid).toBe(false);
        expect(result.formatted).toBe('Unknown');
      });
    });

    it('should extract years from strings', () => {
      const result = parseFlexibleDate('Graduated in 2020');
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('2020');
    });
  });

  describe('formatDateRange', () => {
    it('should format complete date ranges', () => {
      const result = formatDateRange('2022-01', '2024-01');
      expect(result).toBe('Jan 2022 - Jan 2024');
    });

    it('should handle ongoing periods', () => {
      const result = formatDateRange('2022-01', null);
      expect(result).toBe('Jan 2022 - Present');
    });

    it('should handle invalid start dates', () => {
      const result = formatDateRange('invalid', '2024-01');
      expect(result).toBe('Unknown');
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration in months for short periods', () => {
      const result = calculateDuration('2023-01', '2023-06');
      expect(result).toContain('month');
    });

    it('should calculate duration in years for long periods', () => {
      const result = calculateDuration('2020-01', '2023-01');
      expect(result).toContain('year');
    });

    it('should handle current date for ongoing periods', () => {
      const result = calculateDuration('2023-01', null);
      expect(result).toBeTruthy();
    });
  });

  describe('detectDateOverlap', () => {
    it('should detect overlapping date ranges', () => {
      const range1 = { start: '2022-01', end: '2024-01' };
      const range2 = { start: '2023-06', end: '2024-06' };

      expect(detectDateOverlap(range1, range2)).toBe(true);
    });

    it('should detect non-overlapping date ranges', () => {
      const range1 = { start: '2020-01', end: '2022-01' };
      const range2 = { start: '2023-01', end: '2024-01' };

      expect(detectDateOverlap(range1, range2)).toBe(false);
    });

    it('should handle invalid dates safely', () => {
      const range1 = { start: 'invalid', end: '2022-01' };
      const range2 = { start: '2023-01', end: '2024-01' };

      expect(detectDateOverlap(range1, range2)).toBe(false);
    });
  });

  describe('calculateTimelinePosition', () => {
    it('should position single item correctly', () => {
      const items = [{ start: '2023-01', end: '2023-12' }];
      const position = calculateTimelinePosition(items, 0);

      expect(position.x).toBeGreaterThan(0);
      expect(position.y).toBe(300); // PRIMARY_Y
      expect(position.branch).toBe(0);
    });

    it('should position multiple items with spacing', () => {
      const items = [
        { start: '2020-01', end: '2022-01' },
        { start: '2022-02', end: '2024-01' },
        { start: '2024-02', end: 'Present' },
      ];

      const position1 = calculateTimelinePosition(items, 0);
      const position2 = calculateTimelinePosition(items, 1);
      const position3 = calculateTimelinePosition(items, 2);

      // All should be on same timeline (branch 0)
      expect(position1.branch).toBe(0);
      expect(position2.branch).toBe(0);
      expect(position3.branch).toBe(0);

      // All should have same Y position
      expect(position1.y).toBe(position2.y);
      expect(position2.y).toBe(position3.y);

      // X positions should be different and spaced appropriately
      expect(position2.x).toBeGreaterThan(position1.x);
      expect(position3.x).toBeGreaterThan(position2.x);
    });

    it('should handle overlapping dates with intelligent spacing', () => {
      const items = [
        { start: '2022-01', end: '2024-01' },
        { start: '2023-01', end: '2024-06' }, // Overlapping
      ];

      const position1 = calculateTimelinePosition(items, 0);
      const position2 = calculateTimelinePosition(items, 1);

      // Should maintain minimum distance
      const distance = Math.abs(position2.x - position1.x);
      expect(distance).toBeGreaterThanOrEqual(450); // MIN_NODE_DISTANCE
    });

    it('should handle invalid index gracefully', () => {
      const items = [{ start: '2023-01', end: '2023-12' }];

      const negativeIndex = calculateTimelinePosition(items, -1);
      const tooLargeIndex = calculateTimelinePosition(items, 5);

      expect(negativeIndex.x).toBe(200); // START_X
      expect(negativeIndex.y).toBe(300); // PRIMARY_Y
      expect(negativeIndex.branch).toBe(0);

      expect(tooLargeIndex.x).toBe(200); // START_X
      expect(tooLargeIndex.y).toBe(300); // PRIMARY_Y
      expect(tooLargeIndex.branch).toBe(0);
    });
  });

  describe('sortItemsByDate', () => {
    it('should sort items by start date', () => {
      const items = [
        { id: '3', start: '2024-01', end: '2024-12' },
        { id: '1', start: '2020-01', end: '2022-01' },
        { id: '2', start: '2022-02', end: '2023-12' },
      ];

      const sorted = sortItemsByDate(
        items,
        (item) => item.start,
        (item) => item.end
      );

      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('3');
    });

    it('should handle items with same start date using end date', () => {
      const items = [
        { id: '2', start: '2022-01', end: '2024-01' },
        { id: '1', start: '2022-01', end: '2023-01' },
      ];

      const sorted = sortItemsByDate(
        items,
        (item) => item.start,
        (item) => item.end
      );

      // Item with earlier end date should come first
      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
    });

    it('should handle items with invalid dates', () => {
      const items = [
        { id: '1', start: 'invalid', end: '2023-01' },
        { id: '2', start: '2022-01', end: '2023-01' },
        { id: '3', start: '2021-01', end: '2022-01' },
      ];

      const sorted = sortItemsByDate(
        items,
        (item) => item.start,
        (item) => item.end
      );

      // Valid dates should come first, invalid at the end
      expect(sorted[0].id).toBe('3'); // 2021
      expect(sorted[1].id).toBe('2'); // 2022
      expect(sorted[2].id).toBe('1'); // invalid
    });

    it('should handle ongoing items (no end date)', () => {
      const items = [
        { id: '1', start: '2022-01', end: null },
        { id: '2', start: '2023-01', end: '2024-01' },
      ];

      const sorted = sortItemsByDate(
        items,
        (item) => item.start,
        (item) => item.end
      );

      expect(sorted[0].id).toBe('1'); // Earlier start date
      expect(sorted[1].id).toBe('2');
    });
  });
});
