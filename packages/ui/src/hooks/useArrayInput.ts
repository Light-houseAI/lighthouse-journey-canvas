import { useCallback, useState } from 'react';

export interface UseArrayInputOptions {
  maxLength?: number;
  minLength?: number;
  validateItem?: (item: string) => string | null; // Returns error message or null
}

export interface UseArrayInputReturn {
  items: string[];
  addItem: (item: string) => boolean;
  removeItem: (index: number) => void;
  updateItem: (index: number, value: string) => void;
  setItems: (items: string[]) => void;
  error: string | null;
  canAdd: boolean;
}

// Validate item before adding to array
function validateAddItem(
  item: string,
  currentLength: number,
  maxLength: number | undefined,
  validateItem: UseArrayInputOptions['validateItem']
): string | null {
  if (!item) {
    return 'Item cannot be empty';
  }

  if (maxLength !== undefined && currentLength >= maxLength) {
    return `Maximum ${maxLength} items allowed`;
  }

  if (validateItem) {
    return validateItem(item);
  }

  return null;
}

/**
 * Hook for managing array input state with validation
 */
export function useArrayInput(
  initialItems: string[] = [],
  options: UseArrayInputOptions = {}
): UseArrayInputReturn {
  const { maxLength, minLength = 0, validateItem } = options;

  const [items, setItems] = useState<string[]>(initialItems);
  const [error, setError] = useState<string | null>(null);

  const canAdd = maxLength === undefined || items.length < maxLength;

  const addItem = useCallback(
    (item: string): boolean => {
      setError(null);

      const trimmedItem = item.trim();

      // Validate inputs
      const validationError = validateAddItem(
        trimmedItem,
        items.length,
        maxLength,
        validateItem
      );

      if (validationError) {
        setError(validationError);
        return false;
      }

      setItems((prev) => [...prev, trimmedItem]);
      return true;
    },
    [items.length, maxLength, validateItem]
  );

  const removeItem = useCallback((index: number) => {
    setError(null);
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback(
    (index: number, value: string) => {
      setError(null);

      // Custom validation
      if (validateItem) {
        const validationError = validateItem(value);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      setItems((prev) => prev.map((item, i) => (i === index ? value : item)));
    },
    [validateItem]
  );

  const setItemsWithValidation = useCallback(
    (newItems: string[]) => {
      setError(null);

      // Validate min length
      if (minLength > 0 && newItems.length < minLength) {
        setError(`At least ${minLength} item(s) required`);
      }

      setItems(newItems);
    },
    [minLength]
  );

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    setItems: setItemsWithValidation,
    error,
    canAdd,
  };
}
