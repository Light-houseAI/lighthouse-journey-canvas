/**
 * Query Tracing Dashboard Page
 *
 * Internal admin dashboard for monitoring the insight generation pipeline.
 * Provides visibility into query classification, agent routing, and execution.
 */

import {
  Activity,
  BarChart3,
  List,
  Shield,
} from 'lucide-react';
import React from 'react';
import { useLocation } from 'wouter';

import {
  QueryListView,
  QueryDetailView,
  StatsOverview,
} from '../components/query-tracing';
import { useQueryTracingStore } from '../stores/query-tracing-store';

// ============================================================================
// TAB NAVIGATION
// ============================================================================

type TabId = 'overview' | 'traces' | 'agent-performance';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: <Activity className="h-4 w-4" /> },
  { id: 'traces', label: 'Query Traces', icon: <List className="h-4 w-4" /> },
  { id: 'agent-performance', label: 'Agent Performance', icon: <BarChart3 className="h-4 w-4" /> },
];

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors
            ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }
          `}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN PAGE CONTENT
// ============================================================================

function TracesTabContent() {
  const { selectedTraceId } = useQueryTracingStore();

  return (
    <div className="grid h-full gap-6 lg:grid-cols-2">
      <div className="overflow-auto">
        <QueryListView />
      </div>
      <div className="overflow-auto rounded-lg border border-gray-200 bg-white p-4">
        <QueryDetailView />
      </div>
    </div>
  );
}

function AgentPerformanceTab() {
  // This could show more detailed agent-specific analytics
  // For now, it uses the same StatsOverview with a focus on agent stats
  return (
    <div>
      <StatsOverview />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function QueryTracingPage() {
  const [, setLocation] = useLocation();
  const { activeTab, setActiveTab } = useQueryTracingStore();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <StatsOverview />;
      case 'traces':
        return <TracesTabContent />;
      case 'agent-performance':
        return <AgentPerformanceTab />;
      default:
        return <StatsOverview />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-indigo-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Query Tracing Dashboard</h1>
                <p className="text-sm text-gray-500">
                  Internal monitoring for the Insight Generation Pipeline
                </p>
              </div>
            </div>
            <button
              onClick={() => setLocation('/')}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Back to App
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-[73px] z-10 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {renderTabContent()}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-gray-500 sm:px-6 lg:px-8">
          Admin Dashboard • Data retained for 30 days • Refreshes automatically
        </div>
      </footer>
    </div>
  );
}
