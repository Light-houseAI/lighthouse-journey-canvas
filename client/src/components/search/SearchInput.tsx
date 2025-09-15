/**
 * SearchInput Component
 * 
 * Professional search input with theme-consistent styling and subtle animations
 */

import { motion } from 'framer-motion';
import { Loader2,Search } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import type { SearchInputProps } from './types/search.types';

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = "Search profiles...",
  disabled = false,
  isLoading = false,
  className
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <motion.div 
        className="relative w-full"
        whileHover={{ y: -1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 transition-all duration-200">
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-4 w-4 text-[#4A4F4E]" />
              </motion.div>
            ) : (
              <motion.div
                animate={isFocused ? { scale: 1.05 } : { scale: 1 }}
                transition={{ duration: 0.15 }}
              >
                <Search className={cn(
                  "h-4 w-4 transition-colors duration-200",
                  isFocused ? "text-[#2E2E2E]" : "text-[#4A4F4E]"
                )} />
              </motion.div>
            )}
          </div>
          
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "w-full rounded-md border bg-white pl-10 pr-4 py-2.5 text-sm",
              "placeholder:text-[#454C52]",
              "text-[#2E2E2E]",
              "transition-all duration-200 ease-out",
              "disabled:cursor-not-allowed disabled:opacity-50",
              // Professional focus states with theme colors
              isFocused 
                ? "border-[#4A4F4E] shadow-[0px_0px_0px_3px_rgba(74,79,78,0.1)] outline-none"
                : "border-gray-200 hover:border-gray-300",
              // Theme consistent shadow
              "shadow-[0px_2px_5px_0px_rgba(103,110,118,0.08)]",
              isFocused && "shadow-[0px_2px_5px_0px_rgba(103,110,118,0.12)]"
            )}
          />
        </div>
      </motion.div>
    </div>
  );
};