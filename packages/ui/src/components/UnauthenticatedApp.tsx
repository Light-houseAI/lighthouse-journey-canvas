import React, { useState } from "react";

import SignIn from "../pages/signin";
import SignUp from "../pages/signup";

/**
 * UnauthenticatedApp - Handles display for non-authenticated users
 * Uses internal state to switch between signin and signup
 * No URL routing - pure component switching
 */
export function UnauthenticatedApp() {
  const [showSignUp, setShowSignUp] = useState(false);

  return showSignUp ? 
    <SignUp onSwitchToSignIn={() => setShowSignUp(false)} /> : 
    <SignIn onSwitchToSignUp={() => setShowSignUp(true)} />;
}