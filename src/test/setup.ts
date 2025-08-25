import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with Testing Library matchers
expect.extend(matchers)

// Clean up after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup()
})

// Mock IntersectionObserver (commonly needed for React components)
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  takeRecords: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock ResizeObserver (commonly needed for React Flow)
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock window.matchMedia (commonly needed for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock window.scrollTo (commonly needed for scroll behavior)
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
})

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks()
  
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
      return
    }
    originalConsoleError(message)
  })
  
  console.warn = vi.fn((message) => {
    // Suppress common warnings that don't affect tests
    if (
      typeof message === 'string' && 
      (message.includes('React Flow:') ||
       message.includes('Warning:'))
    ) {
      return
    }
    originalConsoleWarn(message)
  })
})

afterEach(() => {
  // Restore original console methods
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})