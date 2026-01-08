import React, { useState } from "react";

import LandingPage from "../pages/landing";
import SignIn from "../pages/signin";
import SignUp from "../pages/signup";

/**
 * UnauthenticatedApp - Handles display for non-authenticated users
 * Shows landing page by default, with navigation to auth flow
 * No URL routing - pure component switching
 */
export function UnauthenticatedApp() {
  const [showAuth, setShowAuth] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  // Show landing page by default
  if (!showAuth) {
    return (
      <LandingPage
        onGetStarted={() => {
          setShowSignUp(true);
          setShowAuth(true);
        }}
        onSignIn={() => {
          setShowSignUp(false);
          setShowAuth(true);
        }}
        onSignUp={() => {
          setShowSignUp(true);
          setShowAuth(true);
        }}
      />
    );
  }

  // Show auth flow when user clicks sign in/sign up/get started
  return showSignUp ? 
    <SignUp onSwitchToSignIn={() => setShowSignUp(false)} /> : 
    <SignIn onSwitchToSignUp={() => setShowSignUp(true)} />;
}