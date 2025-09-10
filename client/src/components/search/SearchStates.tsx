/**
 * SearchStates Component
 * 
 * Loading, empty, and error states for search results
 */

import React from 'react';
import { Search, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { SearchStatesProps } from './types/search.types';

export const SearchStates: React.FC<SearchStatesProps> = ({
  type,
  message,
  onRetry,
  className
}) => {
  if (type === 'loading') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center py-8 px-4",
        className
      )}>
        {/* Loading skeleton for search results */}
        <div className="w-full space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start space-x-3 p-3">
              <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                <div className="flex space-x-2">
                  <div className="h-6 bg-gray-200 rounded animate-pulse w-16" />
                  <div className="h-6 bg-gray-200 rounded animate-pulse w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'empty') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center py-8 px-4 text-center",
        className
      )}>
        <Search className="h-12 w-12 text-[#4A4F4E] mb-4" />
        <h3 className="text-sm font-medium text-[#2E2E2E] mb-2">
          {message || "No profiles found"}
        </h3>
        <p className="text-xs text-[#454C52]">
          Try different keywords or search terms
        </p>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center py-8 px-4 text-center",
        className
      )}>
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-sm font-medium text-[#2E2E2E] mb-2">
          {message || "Search temporarily unavailable"}
        </h3>
        <p className="text-xs text-[#454C52] mb-4">
          Please check your connection and try again
        </p>
        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </Button>
        )}
      </div>
    );
  }

  return null;
};