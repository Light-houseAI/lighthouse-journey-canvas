import { SubjectType } from '@journey/schema';

export interface Permission {
  subjectType: string;
  subjectId?: number;
}

export interface PermissionsDisplayProps {
  permissions?: Permission[];
  className?: string;
}

/**
 * PermissionsDisplay - Simple read-only display of sharing/permissions status
 * Renders as a badge/label showing visibility level
 */
export function PermissionsDisplay({
  permissions = [],
  className = '',
}: PermissionsDisplayProps) {
  // Calculate sharing info from permissions
  const isPublic = permissions.some(
    (p) => p.subjectType === SubjectType.Public
  );
  const sharedWithNetworks = permissions.filter(
    (p) => p.subjectType === SubjectType.Organization
  );
  const sharedWithIndividuals = permissions.filter(
    (p) => p.subjectType === SubjectType.User
  );

  // Don't show anything if content is private
  if (
    !isPublic &&
    sharedWithNetworks.length === 0 &&
    sharedWithIndividuals.length === 0
  ) {
    return null;
  }

  // Public access takes precedence
  if (isPublic) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 ${className}`}
      >
        Public
      </span>
    );
  }

  // Shared with networks/individuals
  const parts = [];
  if (sharedWithNetworks.length > 0) {
    parts.push(
      `${sharedWithNetworks.length} network${sharedWithNetworks.length > 1 ? 's' : ''}`
    );
  }
  if (sharedWithIndividuals.length > 0) {
    parts.push(
      `${sharedWithIndividuals.length} individual${sharedWithIndividuals.length > 1 ? 's' : ''}`
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 ${className}`}
    >
      Shared with {parts.join(' and ')}
    </span>
  );
}
