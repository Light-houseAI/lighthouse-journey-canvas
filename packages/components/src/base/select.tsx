"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * Native HTML Select component with consistent styling
 * Simple API: just pass options array and handle onChange
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, value, onChange, placeholder, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e.target.value)
    }

    return (
      <select
        ref={ref}
        value={value || ''}
        onChange={handleChange}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[&>option]:bg-background [&>option]:text-foreground",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }
)

Select.displayName = "Select"
