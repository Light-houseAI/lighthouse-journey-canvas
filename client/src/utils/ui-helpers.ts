/**
 * UI Helper functions for consistent component styling and behavior
 */

/**
 * Returns the appropriate Badge variant based on status value
 */
export function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: 'default',
    completed: 'secondary',
    planned: 'outline',
  };
  return variants[status] || 'outline';
}