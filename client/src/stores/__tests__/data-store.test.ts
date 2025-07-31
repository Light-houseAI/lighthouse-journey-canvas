import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useDataStore } from '../data-store'
import { createMockProfileData, createMockApiResponse } from '@/test/mock-data'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('DataStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useDataStore.setState({
      profileData: null,
      isLoading: false,
      error: null,
    })
    
    // Clear all mocks
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useDataStore())
      
      expect(result.current.profileData).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('Data Management', () => {
    it('should set profile data correctly', () => {
      const { result } = renderHook(() => useDataStore())
      const mockData = createMockProfileData()

      act(() => {
        result.current.setProfileData(mockData)
      })

      expect(result.current.profileData).toEqual(mockData)
      expect(result.current.error).toBeNull()
    })

    it('should set loading state correctly', () => {
      const { result } = renderHook(() => useDataStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.isLoading).toBe(false)
    })

    it('should set error state correctly', () => {
      const { result } = renderHook(() => useDataStore())
      const errorMessage = 'Test error'

      act(() => {
        result.current.setError(errorMessage)
      })

      expect(result.current.error).toBe(errorMessage)
      expect(result.current.isLoading).toBe(false)
    })

    it('should clear profile data and reset state', () => {
      const { result } = renderHook(() => useDataStore())
      const mockData = createMockProfileData()

      // Set some data first
      act(() => {
        result.current.setProfileData(mockData)
        result.current.setError('Some error')
        result.current.setLoading(true)
      })

      // Clear data
      act(() => {
        result.current.clearProfileData()
      })

      expect(result.current.profileData).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('API Integration', () => {
    it('should load profile data successfully', async () => {
      const { result } = renderHook(() => useDataStore())
      const mockData = createMockProfileData()
      
      mockFetch.mockResolvedValueOnce(createMockApiResponse(mockData))

      await act(async () => {
        await result.current.loadProfileData()
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/profile')
      expect(result.current.profileData).toEqual(mockData)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should not reload if data already exists', async () => {
      const { result } = renderHook(() => useDataStore())
      const mockData = createMockProfileData()

      // Set existing data
      act(() => {
        result.current.setProfileData(mockData)
      })

      await act(async () => {
        await result.current.loadProfileData()
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle API errors when loading', async () => {
      const { result } = renderHook(() => useDataStore())
      const errorResponse = { ok: false, status: 500 }
      
      mockFetch.mockResolvedValueOnce(errorResponse)

      await act(async () => {
        await result.current.loadProfileData()
      })

      expect(result.current.profileData).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('HTTP error! status: 500')
    })

    it('should handle network errors when loading', async () => {
      const { result } = renderHook(() => useDataStore())
      const networkError = new Error('Network error')
      
      mockFetch.mockRejectedValueOnce(networkError)

      await act(async () => {
        await result.current.loadProfileData()
      })

      expect(result.current.profileData).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Network error')
    })

    it('should refresh profile data successfully', async () => {
      const { result } = renderHook(() => useDataStore())
      const mockData = createMockProfileData()
      
      mockFetch.mockResolvedValueOnce(createMockApiResponse(mockData))

      await act(async () => {
        await result.current.refreshProfileData()
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/profile')
      expect(result.current.profileData).toEqual(mockData)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle API errors when refreshing', async () => {
      const { result } = renderHook(() => useDataStore())
      const errorResponse = { ok: false, status: 404 }
      
      mockFetch.mockResolvedValueOnce(errorResponse)

      await act(async () => {
        await result.current.refreshProfileData()
      })

      expect(result.current.profileData).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('HTTP error! status: 404')
    })
  })

  describe('Loading States', () => {
    it('should set loading to true when starting to load data', async () => {
      const { result } = renderHook(() => useDataStore())
      const mockData = createMockProfileData()
      
      // Use a promise that we can control
      let resolvePromise: (value: any) => void
      const controlledPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      
      mockFetch.mockReturnValueOnce(controlledPromise)

      // Start loading
      act(() => {
        result.current.loadProfileData()
      })

      // Should be loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.error).toBeNull()

      // Resolve the promise
      act(() => {
        resolvePromise!(createMockApiResponse(mockData))
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })
})