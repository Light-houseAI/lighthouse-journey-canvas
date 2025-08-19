import React from 'react';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/auth-store';
import { UnauthenticatedApp } from '@/components/UnauthenticatedApp';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';

function Router() {
  const { isAuthenticated } = useAuthStore();

  // Simple conditional render based on persisted auth state
  return isAuthenticated ? <AuthenticatedApp /> : <UnauthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
