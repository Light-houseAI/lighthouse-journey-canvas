/**
 * Timeline Store Hook
 * 
 * A hook that automatically determines which timeline store to use
 * based on the current route context.
 */

import { useLocation } from 'wouter';
import { useCurrentUserTimelineStore } from '../stores/current-user-timeline-store';
import { useOtherUserTimelineStore } from '../stores/other-user-timeline-store';

export const useTimelineStore = () => {
  const [location] = useLocation();
  
  // If the location has a username parameter (like /ugudlado), use other user store
  // Otherwise, use current user store
  const isViewingOtherUser = location !== '/' && location !== '/timeline' && !location.startsWith('/?');
  
  if (isViewingOtherUser) {
    return {
      ...useOtherUserTimelineStore(),
      isViewingOtherUser: true,
      isReadOnly: true,
    };
  } else {
    return {
      ...useCurrentUserTimelineStore(),
      isViewingOtherUser: false,
      isReadOnly: false,
    };
  }
};