import { Button } from '@journey/components';
import { ArrowLeft } from 'lucide-react';
import React from 'react';
import { useLocation } from 'wouter';

export default function BlogPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-screen w-full flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
        <button
          onClick={() => setLocation('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Home
        </button>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setLocation('/sign-in')}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Sign in
          </Button>
          <Button
            onClick={() => setLocation('/sign-up')}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            Sign up
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <h1 className="mb-4 text-4xl font-bold text-gray-900">Blog</h1>
        <p className="text-lg text-gray-600">Coming soon...</p>
      </main>
    </div>
  );
}
