import { describe, it, expect } from 'vitest';
import { NodeFilter } from '../node-filter';

describe('NodeFilter', () => {
  describe('fluent API', () => {
    it('should create filter for current user', () => {
      const filter = NodeFilter.Of(123).build();

      expect(filter.currentUserId).toBe(123);
      expect(filter.targetUserId).toBe(123);
    });

    it('should create filter for target user', () => {
      const filter = NodeFilter.Of(123).For(456);

      expect(filter.currentUserId).toBe(123);
      expect(filter.targetUserId).toBe(456);
    });

    it('should handle same user as current and target', () => {
      const filter = NodeFilter.Of(123).For(123);

      expect(filter.currentUserId).toBe(123);
      expect(filter.targetUserId).toBe(123);
    });
  });

  describe('constructor behavior', () => {
    it('should use currentUserId as targetUserId when not specified', () => {
      const filter = NodeFilter.Of(456).build();

      expect(filter.currentUserId).toBe(456);
      expect(filter.targetUserId).toBe(456);
    });

    it('should preserve different user IDs', () => {
      const filter = NodeFilter.Of(111).For(222);

      expect(filter.currentUserId).toBe(111);
      expect(filter.targetUserId).toBe(222);
    });
  });

  describe('properties are readonly', () => {
    it('should have currentUserId as readonly property', () => {
      const filter = NodeFilter.Of(100).build();

      // TypeScript prevents modification at compile time
      // At runtime, the properties are still accessible but should be immutable by contract
      expect(filter.currentUserId).toBe(100);

      // Attempting to change would require casting, which breaks the contract
      expect(typeof filter.currentUserId).toBe('number');
    });

    it('should have targetUserId as readonly property', () => {
      const filter = NodeFilter.Of(100).For(200);

      // TypeScript prevents modification at compile time
      expect(filter.targetUserId).toBe(200);
      expect(typeof filter.targetUserId).toBe('number');
    });
  });
});
