/**
 * use-debounce Hook Tests
 *
 * Tests for debouncing values to limit update frequency
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebounce } from './use-debounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));

    expect(result.current).toBe('initial');
  });

  it('should debounce string value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated', delay: 500 });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Value should be updated after delay
    expect(result.current).toBe('updated');
  });

  it('should debounce number value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 0, delay: 300 },
      }
    );

    expect(result.current).toBe(0);

    rerender({ value: 100, delay: 300 });

    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(100);
  });

  it('should reset timer on rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'a', delay: 500 },
      }
    );

    // First update
    rerender({ value: 'ab', delay: 500 });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Still showing initial value
    expect(result.current).toBe('a');

    // Second update before first timer expires
    rerender({ value: 'abc', delay: 500 });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Still showing initial value because timer was reset
    expect(result.current).toBe('a');

    // Complete the second timer
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Now should show the latest value
    expect(result.current).toBe('abc');
  });

  it('should handle zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 0 },
      }
    );

    rerender({ value: 'updated', delay: 0 });

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe('updated');
  });

  it('should handle different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    // Update with different delay
    rerender({ value: 'updated', delay: 1000 });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should not update yet with longer delay
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should update after full 1000ms
    expect(result.current).toBe('updated');
  });

  it('should cleanup timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    rerender({ value: 'updated', delay: 500 });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should handle boolean values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: false, delay: 300 },
      }
    );

    expect(result.current).toBe(false);

    rerender({ value: true, delay: 300 });

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(true);
  });

  it('should handle object values', () => {
    const obj1 = { id: 1, name: 'Test' };
    const obj2 = { id: 2, name: 'Updated' };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: obj1, delay: 300 },
      }
    );

    expect(result.current).toBe(obj1);

    rerender({ value: obj2, delay: 300 });

    expect(result.current).toBe(obj1);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(obj2);
  });

  it('should handle array values', () => {
    const arr1 = [1, 2, 3];
    const arr2 = [4, 5, 6];

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: arr1, delay: 300 },
      }
    );

    expect(result.current).toBe(arr1);

    rerender({ value: arr2, delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(arr2);
  });

  it('should handle null and undefined values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: null as null | undefined | string, delay: 300 },
      }
    );

    expect(result.current).toBe(null);

    rerender({ value: undefined as null | undefined | string, delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(undefined);
  });
});
