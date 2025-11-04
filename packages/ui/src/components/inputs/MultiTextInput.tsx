import { Button } from '@journey/components';
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useArrayInput } from '../../hooks/useArrayInput';

export interface MultiTextInputProps {
  label: string;
  placeholder?: string;
  value: string[];
  onChange: (value: string[]) => void;
  maxItems?: number;
  maxLength?: number;
  error?: string;
  helperText?: string;
}

/**
 * Multi-text input component for adding/removing multiple string values
 * Used for contacts, channels, people, etc.
 */
export function MultiTextInput({
  label,
  placeholder = 'Enter item...',
  value,
  onChange,
  maxItems,
  maxLength = 100,
  error: externalError,
  helperText,
}: MultiTextInputProps) {
  const [inputValue, setInputValue] = useState('');

  const {
    items,
    addItem,
    removeItem,
    error: internalError,
  } = useArrayInput(value, {
    maxLength: maxItems,
    validateItem: (item) => {
      if (item.length > maxLength) {
        return `Item must be ${maxLength} characters or less`;
      }
      return null;
    },
  });

  // Sync items with parent
  useEffect(() => {
    if (JSON.stringify(items) !== JSON.stringify(value)) {
      onChange(items);
    }
  }, [items, value, onChange]);

  const handleAdd = () => {
    if (addItem(inputValue)) {
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const displayError = externalError || internalError;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {/* Input field */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          maxLength={maxLength}
        />
        <Button
          type="button"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          size="sm"
        >
          Add
        </Button>
      </div>

      {/* Helper text */}
      {helperText && !displayError && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}

      {/* Error message */}
      {displayError && <p className="text-sm text-red-600">{displayError}</p>}

      {/* Items list */}
      {items.length > 0 && (
        <div className="mt-2 space-y-1">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <span className="text-sm">{item}</span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-gray-400 hover:text-red-500"
                aria-label={`Remove ${item}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Count indicator */}
      {maxItems && (
        <p className="text-xs text-gray-500">
          {items.length} / {maxItems} items
        </p>
      )}
    </div>
  );
}
