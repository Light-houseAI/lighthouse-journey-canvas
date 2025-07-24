import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  email: string;
  interest?: string;
  hasCompletedOnboarding: boolean;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const response = await fetch("/api/me");
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    user: user as User | undefined,
    isLoading,
    isAuthenticated: !!user && !error,
    error,
  };
}