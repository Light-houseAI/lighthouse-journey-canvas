/**
 * Timeline Context
 * 
 * Provides timeline store context to components, allowing them to work
 * with either the current user timeline store or other user timeline store.
 */

import React, { createContext, useContext } from 'react';

import type { BaseTimelineState } from '../stores/shared-timeline-types';

const TimelineContext = createContext<BaseTimelineState | null>(null);

export interface TimelineProviderProps {
  store: BaseTimelineState;
  children: React.ReactNode;
}

export const TimelineProvider: React.FC<TimelineProviderProps> = ({ store, children }) => {
  return (
    <TimelineContext.Provider value={store}>
      {children}
    </TimelineContext.Provider>
  );
};

export const useTimelineContext = () => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error('useTimelineContext must be used within a TimelineProvider');
  }
  return context;
};