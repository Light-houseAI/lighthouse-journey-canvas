import { useDataStore } from '@/stores/data-store';

/**
 * Component-level hook for journey data access
 * Provides clean interface to data store for components
 */
export const useJourneyData = () => {
  const profileData = useDataStore(state => state.profileData);
  const isLoading = useDataStore(state => state.isLoading);
  const error = useDataStore(state => state.error);
  const setProfileData = useDataStore(state => state.setProfileData);
  const loadProfileData = useDataStore(state => state.loadProfileData);
  const refreshProfileData = useDataStore(state => state.refreshProfileData);
  const clearProfileData = useDataStore(state => state.clearProfileData);

  return {
    // State
    profileData,
    isLoading,
    error,
    
    // Computed state
    hasData: profileData !== null,
    hasExperiences: profileData?.filteredData?.experiences?.length > 0,
    hasEducation: profileData?.filteredData?.education?.length > 0,
    
    // Actions
    setProfileData,
    loadProfileData,
    refreshProfileData,
    clearProfileData,
  };
};

/**
 * Component-level hook for UI coordination
 * Provides clean interface to UI coordinator store
 */
export const useUICoordination = () => {
  const { 
    reactFlowInstance, 
    setReactFlowInstance, 
    autoFitTimeline, 
    zoomToFocusedNode,
    logout 
  } = useDataStore(state => ({
    reactFlowInstance: state.reactFlowInstance,
    setReactFlowInstance: state.setReactFlowInstance,
    autoFitTimeline: state.autoFitTimeline,
    zoomToFocusedNode: state.zoomToFocusedNode,
    logout: state.logout
  })) as any; // TODO: Fix type issue after updating imports

  return {
    // State
    reactFlowInstance,
    hasReactFlowInstance: reactFlowInstance !== null,
    
    // Actions
    setReactFlowInstance,
    autoFitTimeline,
    zoomToFocusedNode,
    logout,
  };
};