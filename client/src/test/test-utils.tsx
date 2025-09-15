import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, RenderOptions } from '@testing-library/react'
import React, { ReactElement } from 'react'

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
})

// Custom render function that includes QueryClient
const AllTheProviders: React.FC<{
  children: React.ReactNode
  queryClient?: QueryClient
}> = ({ children, queryClient = createTestQueryClient() }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient
  }
) => {
  const { queryClient, ...renderOptions } = options || {}
  
  return render(ui, {
    wrapper: (props) => (
      <AllTheProviders 
        queryClient={queryClient}
        {...props} 
      />
    ),
    ...renderOptions,
  })
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }
export { createTestQueryClient }