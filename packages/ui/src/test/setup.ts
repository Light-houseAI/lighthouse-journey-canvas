console.log('🔥 TEST SETUP FILE IS LOADING');

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage early before any other imports
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
};
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, expect } from 'vitest';

import { server } from '../mocks/server';

// Extend Vitest's expect with Testing Library matchers
expect.extend(matchers);

// Additional jsdom configuration for user-event compatibility
// See: https://github.com/testing-library/user-event/issues/1279
// The userEvent.setup() needs proper document initialization

// Ensure document is available before each test
beforeEach(() => {
  // Reset any document state and ensure DOM is clean
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
  }
});

// Setup MSW server for API mocking in tests
beforeAll(() => {
  console.log(
    '🚀 MSW Setup: Starting server with handlers:',
    server.listHandlers().length
  );

  // Add event listeners to debug MSW
  server.events.on('request:start', ({ request }) => {
    console.log('🎯 MSW intercepted:', request.method, request.url);
  });

  server.events.on('request:match', ({ request }) => {
    console.log('✅ MSW matched:', request.method, request.url);
  });

  server.events.on('request:unhandled', ({ request }) => {
    console.log('❌ MSW unhandled:', request.method, request.url);
  });

  server.listen({
    onUnhandledRequest: 'warn',
  });

  console.log('✅ MSW Setup: Server started');
});

afterEach(() => {
  server.resetHandlers();
  // Clear all timers to prevent hanging
  vi.clearAllTimers();
});

afterAll(() => {
  // Remove all event listeners before closing
  server.events.removeAllListeners();
  server.close();
});

// Clean up after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mock IntersectionObserver (commonly needed for React components)
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  takeRecords: vi.fn(),
  unobserve: vi.fn(),
}));

// Mock ResizeObserver (commonly needed for React Flow)
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

// Mock window.matchMedia (commonly needed for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo (commonly needed for scroll behavior)
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Mock window.location (commonly needed for URL operations)
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
  },
  writable: true,
});

// Don't set VITE_API_BASE_URL in tests
// httpClient will fall back to http://localhost:3000 which matches our handlers

// MSW handles fetch - don't override it
// Remove fetch mock to let MSW intercept properly

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    userAgent: 'test',
  },
  writable: true,
});

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  vi.clearAllTimers();

  // Mock console.error and console.warn but still allow intentional errors
  console.error = vi.fn((message) => {
    // Only suppress React Flow warnings and similar noise
    if (
      typeof message === 'string' &&
      (message.includes('Warning:') ||
        message.includes('React Flow:') ||
        message.includes('act(') ||
        message.includes('console.error was called'))
    ) {
      return;
    }
    originalConsoleError(message);
  });

  console.warn = vi.fn((message) => {
    // Suppress common warnings that don't affect tests
    if (
      typeof message === 'string' &&
      (message.includes('React Flow:') || message.includes('Warning:'))
    ) {
      return;
    }
    originalConsoleWarn(message);
  });
});

afterEach(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;

  // Final cleanup: ensure all timers are cleared
  vi.clearAllTimers();
  vi.useRealTimers();
});
