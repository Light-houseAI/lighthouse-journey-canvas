/**
 * QuotaDisplay Component
 *
 * Displays user's storage quota with progress bar and warning at >80%
 */

import { AlertTriangle, HardDrive } from 'lucide-react';
import React from 'react';

import { useStorageQuota } from '../../hooks/use-storage-quota';

export const QuotaDisplay: React.FC = () => {
  const { data: quota, isLoading, isError } = useStorageQuota();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-gray-400" />
          <div className="flex-1">
            <p className="text-sm text-gray-600">Loading storage info...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !quota) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-gray-400" />
          <div className="flex-1">
            <p className="text-sm text-gray-600">Storage info unavailable</p>
          </div>
        </div>
      </div>
    );
  }

  const isNearLimit = quota.percentUsed > 80;
  const progressColor = isNearLimit ? 'bg-amber-500' : 'bg-teal-600';

  return (
    <div
      className={`rounded-lg border p-4 ${
        isNearLimit
          ? 'border-amber-200 bg-amber-50'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <HardDrive
            className={`h-5 w-5 ${isNearLimit ? 'text-amber-600' : 'text-gray-600'}`}
          />
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${isNearLimit ? 'text-amber-900' : 'text-gray-900'}`}
            >
              Storage Usage
            </p>
          </div>
          {isNearLimit && <AlertTriangle className="h-5 w-5 text-amber-600" />}
        </div>

        {/* Progress bar */}
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all duration-300 ${progressColor}`}
              style={{ width: `${quota.percentUsed}%` }}
              role="progressbar"
              aria-valuenow={quota.percentUsed}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Storage usage"
            />
          </div>
        </div>

        {/* Usage text */}
        <div className="flex items-center justify-between">
          <p
            className={`text-xs ${isNearLimit ? 'text-amber-700' : 'text-gray-600'}`}
          >
            {formatBytes(quota.bytesUsed)} of {formatBytes(quota.quotaBytes)}{' '}
            used
          </p>
          <p
            className={`text-xs font-medium ${isNearLimit ? 'text-amber-700' : 'text-gray-600'}`}
          >
            {quota.percentUsed}%
          </p>
        </div>

        {/* Warning message */}
        {isNearLimit && (
          <p className="text-xs text-amber-700">
            You're approaching your storage limit. Consider deleting unused
            files.
          </p>
        )}
      </div>
    </div>
  );
};
