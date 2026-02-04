import React, { useState, useEffect } from "react";

import BlogPage from "../pages/blog";
import LandingPage from "../pages/landing";
import SignIn from "../pages/signin";
import SignUp from "../pages/signup";
import { KramaLandingPage } from "./krama-landing";

type UnauthenticatedView = 'landing' | 'blog' | 'signin' | 'signup' | 'join';

/**
 * UnauthenticatedApp - Handles display for non-authenticated users
 * Shows landing page by default, with navigation to auth flow and blog
 * Supports URL-based routing for /join, /sign-in, /sign-up
 */
export function UnauthenticatedApp() {
  const [currentView, setCurrentView] = useState<UnauthenticatedView>(() => {
    // Check URL path on initial load
    const path = window.location.pathname;
    if (path === '/join') return 'join';
    if (path === '/blog') return 'blog';
    if (path === '/signin' || path === '/sign-in') return 'signin';
    if (path === '/signup' || path === '/sign-up') return 'signup';
    return 'landing';
  });
  const [inviteCode, setInviteCode] = useState<string>('');

  // Handle URL-based routing on initial load
  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    
    if (path === '/join') {
      const code = params.get('code') || '';
      setInviteCode(code);
      setCurrentView('join');
    }
  }, []);

  // Determine if we should use the Krama landing page (krama-ai.com)
  // For now, we'll check the hostname or allow both landing pages to coexist
  const isKramaDomain = window.location.hostname.includes('krama-ai.com') || 
                        window.location.hostname === 'localhost'; // Use Krama for local dev too

  // Show Krama landing page for krama-ai.com domain
  if (currentView === 'landing' && isKramaDomain) {
    return <KramaLandingPage />;
  }

  // Show original landing page for light-houseai.com domain
  if (currentView === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => setCurrentView('signup')}
        onSignIn={() => setCurrentView('signin')}
        onSignUp={() => setCurrentView('signup')}
        onBlog={() => setCurrentView('blog')}
      />
    );
  }

  // Show blog page
  if (currentView === 'blog') {
    return (
      <BlogPage
        onBack={() => setCurrentView('landing')}
        onSignIn={() => setCurrentView('signin')}
        onSignUp={() => setCurrentView('signup')}
      />
    );
  }

  // Show signup with invite code for /join route
  if (currentView === 'join') {
    return (
      <SignUp 
        onSwitchToSignIn={() => setCurrentView('signin')} 
        inviteCode={inviteCode}
      />
    );
  }

  // Show auth flow when user clicks sign in/sign up/get started
  return currentView === 'signup' ?
    <SignUp onSwitchToSignIn={() => setCurrentView('signin')} /> :
    <SignIn onSwitchToSignUp={() => setCurrentView('signup')} />;
}
