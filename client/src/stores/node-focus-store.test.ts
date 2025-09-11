import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useNodeFocusStore } from './node-focus-store';

describe('NodeFocusStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useNodeFocusStore.setState({
      focusedExperienceId: null,
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useNodeFocusStore());

      expect(result.current.focusedExperienceId).toBeNull();
    });
  });

  describe('Focus Management', () => {
    it('should set focused experience correctly', () => {
      const { result } = renderHook(() => useNodeFocusStore());
      const experienceId = 'exp-1';

      act(() => {
        result.current.setFocusedExperience(experienceId);
      });

      expect(result.current.focusedExperienceId).toBe(experienceId);
    });

    it('should clear focus correctly', () => {
      const { result } = renderHook(() => useNodeFocusStore());
      const experienceId = 'exp-1';

      // Set focus first
      act(() => {
        result.current.setFocusedExperience(experienceId);
      });

      expect(result.current.focusedExperienceId).toBe(experienceId);

      // Clear focus
      act(() => {
        result.current.clearFocus();
      });

      expect(result.current.focusedExperienceId).toBeNull();
    });

    it('should allow setting focus to null', () => {
      const { result } = renderHook(() => useNodeFocusStore());
      const experienceId = 'exp-1';

      // Set focus first
      act(() => {
        result.current.setFocusedExperience(experienceId);
      });

      // Set to null
      act(() => {
        result.current.setFocusedExperience(null);
      });

      expect(result.current.focusedExperienceId).toBeNull();
    });
  });

  describe('Focus State Helpers', () => {
    it('should correctly identify focused nodes', () => {
      const { result } = renderHook(() => useNodeFocusStore());
      const focusedId = 'exp-1';
      const otherNodeId = 'exp-2';

      act(() => {
        result.current.setFocusedExperience(focusedId);
      });

      expect(result.current.isFocused(focusedId)).toBe(true);
      expect(result.current.isFocused(otherNodeId)).toBe(false);
      expect(result.current.isFocused('non-existent')).toBe(false);
    });

    it('should correctly identify blurred nodes', () => {
      const { result } = renderHook(() => useNodeFocusStore());
      const focusedId = 'exp-1';
      const blurredId = 'exp-2';

      // No focus - nothing should be blurred
      expect(result.current.isBlurred(focusedId)).toBe(false);
      expect(result.current.isBlurred(blurredId)).toBe(false);

      // Set focus
      act(() => {
        result.current.setFocusedExperience(focusedId);
      });

      // Focused node should not be blurred, others should be
      expect(result.current.isBlurred(focusedId)).toBe(false);
      expect(result.current.isBlurred(blurredId)).toBe(true);
      expect(result.current.isBlurred('another-node')).toBe(true);
    });

    it('should handle edge cases with empty strings', () => {
      const { result } = renderHook(() => useNodeFocusStore());

      act(() => {
        result.current.setFocusedExperience('');
      });

      expect(result.current.focusedExperienceId).toBe('');
      expect(result.current.isFocused('')).toBe(true);
      expect(result.current.isFocused('other')).toBe(false);
      expect(result.current.isBlurred('')).toBe(false);
      expect(result.current.isBlurred('other')).toBe(true);
    });
  });

  describe('Multiple Focus Changes', () => {
    it('should handle rapid focus changes correctly', () => {
      const { result } = renderHook(() => useNodeFocusStore());

      act(() => {
        result.current.setFocusedExperience('exp-1');
      });
      expect(result.current.focusedExperienceId).toBe('exp-1');

      act(() => {
        result.current.setFocusedExperience('exp-2');
      });
      expect(result.current.focusedExperienceId).toBe('exp-2');

      act(() => {
        result.current.clearFocus();
      });
      expect(result.current.focusedExperienceId).toBeNull();

      act(() => {
        result.current.setFocusedExperience('exp-3');
      });
      expect(result.current.focusedExperienceId).toBe('exp-3');
    });
  });
});
