/**
 * Test helpers for permission testing
 */

/**
 * Set the test user ID for API requests
 * This allows testing permission filtering by simulating different users
 */
export function setTestUserId(userId: number): void {
  localStorage.setItem('test-user-id', userId.toString());
  console.log(`🧪 Test user ID set to: ${userId}`);
  console.log('🔄 Reload the page to see changes');
}

/**
 * Get the current test user ID
 */
export function getTestUserId(): number | null {
  const userId = localStorage.getItem('test-user-id');
  return userId ? parseInt(userId, 10) : null;
}

/**
 * Clear the test user ID
 */
export function clearTestUserId(): void {
  localStorage.removeItem('test-user-id');
  console.log('🧪 Test user ID cleared');
  console.log('🔄 Reload the page to see changes');
}

// Make functions available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).setTestUserId = setTestUserId;
  (window as any).getTestUserId = getTestUserId;
  (window as any).clearTestUserId = clearTestUserId;
  console.log('🧪 Test helpers available: setTestUserId(id), getTestUserId(), clearTestUserId()');
}