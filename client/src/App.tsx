import React from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/auth-store";
import Home from "@/pages/home";
import ProfileReview from "@/pages/profile-review";
import ProfessionalJourney from "@/pages/professional-journey";
import SignUp from "@/pages/signup";
import SignIn from "@/pages/signin";
import OnboardingStep1 from "@/pages/onboarding-step1";
import OnboardingStep2 from "@/pages/onboarding-step2";
import DevLogout from "@/pages/dev-logout";
import NotFound from "@/pages/not-found";
import { TimelineDebugger } from "@/components/debug/TimelineDebugger";
import { Loader2 } from "lucide-react";

function Router() {
  const { user, isLoading, isAuthenticated, checkAuth } = useAuthStore();
  
  // Check authentication on mount
  React.useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Switch>
      {/* Public routes - only accessible when not authenticated */}
      <Route path="/signup">
        {isAuthenticated ? <Redirect to="/" /> : <SignUp />}
      </Route>
      <Route path="/signin">
        {isAuthenticated ? <Redirect to="/" /> : <SignIn />}
      </Route>

      {/* Protected routes - require authentication */}
      <Route path="/onboarding/step1">
        {!isAuthenticated ? <Redirect to="/signin" /> : <OnboardingStep1 />}
      </Route>
      <Route path="/onboarding/step2">
        {!isAuthenticated ? <Redirect to="/signin" /> : <OnboardingStep2 />}
      </Route>
      <Route path="/profile-review/:username">
        {!isAuthenticated ? <Redirect to="/signin" /> : <ProfileReview />}
      </Route>
      <Route path="/professional-journey">
        {!isAuthenticated ? (
          <Redirect to="/signin" />
        ) : !user?.interest ? (
          <Redirect to="/onboarding/step1" />
        ) : !user?.hasCompletedOnboarding ? (
          <Redirect to="/onboarding/step2" />
        ) : (
          <ProfessionalJourney />
        )}
      </Route>
      
      {/* Dev route for logout */}
      <Route path="/dev-logout" component={DevLogout} />
      
      {/* Debug route for timeline */}
      <Route path="/debug-timeline" component={TimelineDebugger} />

      {/* Main routes with conditional rendering */}
      <Route path="/">
        {!isAuthenticated ? (
          <Redirect to="/signin" />
        ) : !user?.interest ? (
          <Redirect to="/onboarding/step1" />
        ) : !user?.hasCompletedOnboarding ? (
          <Redirect to="/onboarding/step2" />
        ) : (
          <Redirect to="/professional-journey" />
        )}
      </Route>
      
      {/* Profile extraction page - only for manual access */}
      <Route path="/extract">
        {!isAuthenticated ? <Redirect to="/signin" /> : <Home />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
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
