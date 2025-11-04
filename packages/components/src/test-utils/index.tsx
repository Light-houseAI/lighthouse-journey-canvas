import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { vi } from 'vitest';

/**
 * Custom render function with providers if needed
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions
) {
  return render(ui, { ...options });
}

/**
 * Helper to test variant classes on an element
 */
export function expectVariantClass(element: HTMLElement, className: string) {
  const classes = element.className.split(' ');
  expect(classes).toContain(className);
}

/**
 * Helper for testing ref forwarding
 */
export function createRef<T>() {
  return { current: null as T | null };
}

/**
 * Helper to test className merging
 */
export function expectClassMerge(
  element: HTMLElement,
  baseClass: string,
  customClass: string
) {
  expect(element).toHaveClass(baseClass);
  expect(element).toHaveClass(customClass);
}

/**
 * Mock Radix UI component for testing
 */
export function mockRadixComponent(name: string) {
  return vi.fn(({ children, ...props }: any) => (
    <div data-radix-component={name} {...props}>
      {children}
    </div>
  ));
}

/**
 * Create a mock file for testing file uploads
 */
export function createMockFile(
  name = 'test.pdf',
  size = 1024,
  type = 'application/pdf'
): File {
  const content = new Array(size).fill('a').join('');
  return new File([content], name, { type });
}

/**
 * Wait for next tick (useful for async state updates)
 */
export async function waitForNextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Re-export common testing utilities
export * from '@testing-library/react';
export { vi } from 'vitest';
