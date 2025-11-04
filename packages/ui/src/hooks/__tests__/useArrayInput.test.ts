import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useArrayInput } from '../useArrayInput';

describe('useArrayInput', () => {
  describe('initialization', () => {
    it('should initialize with empty array by default', () => {
      // Arrange & Act
      const { result } = renderHook(() => useArrayInput());

      // Assert
      expect(result.current.items).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.canAdd).toBe(true);
    });

    it('should initialize with provided items', () => {
      // Arrange
      const initialItems = ['Item 1', 'Item 2'];

      // Act
      const { result } = renderHook(() => useArrayInput(initialItems));

      // Assert
      expect(result.current.items).toEqual(initialItems);
    });
  });

  describe('addItem', () => {
    it('should add item to array', () => {
      // Arrange
      const { result } = renderHook(() => useArrayInput());

      // Act
      act(() => {
        result.current.addItem('New Item');
      });

      // Assert
      expect(result.current.items).toEqual(['New Item']);
      expect(result.current.error).toBeNull();
    });

    it('should trim whitespace when adding item', () => {
      // Arrange
      const { result } = renderHook(() => useArrayInput());

      // Act
      act(() => {
        result.current.addItem('  Item with spaces  ');
      });

      // Assert
      expect(result.current.items).toEqual(['Item with spaces']);
    });

    it('should reject empty items', () => {
      // Arrange
      const { result } = renderHook(() => useArrayInput());

      // Act
      act(() => {
        result.current.addItem('   ');
      });

      // Assert
      expect(result.current.items).toEqual([]);
      expect(result.current.error).toBe('Item cannot be empty');
    });

    it('should enforce max length', () => {
      // Arrange
      const { result } = renderHook(() => useArrayInput([], { maxLength: 2 }));

      // Act
      act(() => {
        result.current.addItem('Item 1');
      });
      act(() => {
        result.current.addItem('Item 2');
      });
      act(() => {
        result.current.addItem('Item 3');
      });

      // Assert
      expect(result.current.items).toEqual(['Item 1', 'Item 2']);
      expect(result.current.error).toBe('Maximum 2 items allowed');
      expect(result.current.canAdd).toBe(false);
    });

    it('should use custom validation', () => {
      // Arrange
      const validateItem = (item: string) => {
        if (item.length < 3) {
          return 'Item must be at least 3 characters';
        }
        return null;
      };
      const { result } = renderHook(() => useArrayInput([], { validateItem }));

      // Act
      act(() => {
        result.current.addItem('AB');
      });

      // Assert
      expect(result.current.items).toEqual([]);
      expect(result.current.error).toBe('Item must be at least 3 characters');
    });

    it('should return true on successful add', () => {
      // Arrange
      const { result } = renderHook(() => useArrayInput());

      // Act & Assert
      act(() => {
        const success = result.current.addItem('Valid Item');
        expect(success).toBe(true);
      });
    });

    it('should return false on failed add', () => {
      // Arrange
      const { result } = renderHook(() => useArrayInput());

      // Act & Assert
      act(() => {
        const success = result.current.addItem('   ');
        expect(success).toBe(false);
      });
    });
  });

  describe('removeItem', () => {
    it('should remove item by index', () => {
      // Arrange
      const { result } = renderHook(() =>
        useArrayInput(['Item 1', 'Item 2', 'Item 3'])
      );

      // Act
      act(() => {
        result.current.removeItem(1);
      });

      // Assert
      expect(result.current.items).toEqual(['Item 1', 'Item 3']);
    });

    it('should clear error when removing item', () => {
      // Arrange
      const { result } = renderHook(() => useArrayInput([], { maxLength: 2 }));

      // Add items to trigger error
      act(() => {
        result.current.addItem('Item 1');
      });
      act(() => {
        result.current.addItem('Item 2');
      });
      act(() => {
        result.current.addItem('Item 3'); // This will fail
      });

      expect(result.current.error).not.toBeNull();

      // Act
      act(() => {
        result.current.removeItem(0);
      });

      // Assert
      expect(result.current.error).toBeNull();
    });
  });

  describe('updateItem', () => {
    it('should update item at index', () => {
      // Arrange
      const { result } = renderHook(() => useArrayInput(['Item 1', 'Item 2']));

      // Act
      act(() => {
        result.current.updateItem(1, 'Updated Item');
      });

      // Assert
      expect(result.current.items).toEqual(['Item 1', 'Updated Item']);
    });

    it('should validate updated item', () => {
      // Arrange
      const validateItem = (item: string) => {
        if (item.length < 3) {
          return 'Item must be at least 3 characters';
        }
        return null;
      };
      const { result } = renderHook(() =>
        useArrayInput(['Valid Item'], { validateItem })
      );

      // Act
      act(() => {
        result.current.updateItem(0, 'AB');
      });

      // Assert
      expect(result.current.items).toEqual(['Valid Item']); // Unchanged
      expect(result.current.error).toBe('Item must be at least 3 characters');
    });
  });

  describe('setItems', () => {
    it('should replace all items', () => {
      // Arrange
      const { result } = renderHook(() => useArrayInput(['Item 1', 'Item 2']));

      // Act
      act(() => {
        result.current.setItems(['New 1', 'New 2', 'New 3']);
      });

      // Assert
      expect(result.current.items).toEqual(['New 1', 'New 2', 'New 3']);
    });

    it('should validate min length', () => {
      // Arrange
      const { result } = renderHook(() =>
        useArrayInput(['Item 1', 'Item 2'], { minLength: 2 })
      );

      // Act
      act(() => {
        result.current.setItems(['Only One']);
      });

      // Assert
      expect(result.current.items).toEqual(['Only One']);
      expect(result.current.error).toBe('At least 2 item(s) required');
    });
  });

  describe('canAdd flag', () => {
    it('should be true when no max length', () => {
      // Arrange & Act
      const { result } = renderHook(() => useArrayInput(['Item 1']));

      // Assert
      expect(result.current.canAdd).toBe(true);
    });

    it('should be false when at max length', () => {
      // Arrange & Act
      const { result } = renderHook(() =>
        useArrayInput(['Item 1', 'Item 2'], { maxLength: 2 })
      );

      // Assert
      expect(result.current.canAdd).toBe(false);
    });

    it('should update when items change', () => {
      // Arrange
      const { result } = renderHook(() => useArrayInput([], { maxLength: 1 }));

      expect(result.current.canAdd).toBe(true);

      // Act
      act(() => {
        result.current.addItem('Item 1');
      });

      // Assert
      expect(result.current.canAdd).toBe(false);

      // Act
      act(() => {
        result.current.removeItem(0);
      });

      // Assert
      expect(result.current.canAdd).toBe(true);
    });
  });
});
