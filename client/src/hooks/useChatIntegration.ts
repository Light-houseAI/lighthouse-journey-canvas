import { useCallback } from 'react';

/**
 * Simple chat integration hook for node components
 * Provides a clean interface for nodes to interact with the chat system
 */
export const useChatIntegration = () => {
  const addChatMessage = useCallback((message: string) => {
    // Dispatch a simple event that OverlayChat can listen to
    const chatEvent = new CustomEvent('addChatMessage', { 
      detail: { message }
    });
    window.dispatchEvent(chatEvent);
  }, []);

  const openChat = useCallback(() => {
    // Dispatch event to open/focus the chat
    const openEvent = new CustomEvent('openChat');
    window.dispatchEvent(openEvent);
  }, []);

  const addChatMessageAndOpen = useCallback((message: string) => {
    addChatMessage(message);
    openChat();
  }, [addChatMessage, openChat]);

  return {
    addChatMessage,
    openChat,
    addChatMessageAndOpen
  };
};

/**
 * Utility functions for creating context-aware messages
 */
export const createProjectUpdateMessage = (projectName: string, organization?: string) => {
  return `I want to add a new update to my project "${projectName}"${organization ? ` at ${organization}` : ''}. Can you help me capture this project update?`;
};

export const createEducationUpdateMessage = (title: string, organization?: string) => {
  return `I want to add a new achievement or update related to my education as a ${title}${organization ? ` at ${organization}` : ''}. Can you help me capture this?`;
};

export const createExperienceUpdateMessage = (
  title: string, 
  organization: string,
  activeProjects?: { name: string; organization?: string }[]
) => {
  if (!activeProjects || activeProjects.length === 0) {
    return `I want to add a new project update related to my role as ${title} at ${organization}. Can you help me capture this?`;
  }
  
  if (activeProjects.length === 1) {
    const project = activeProjects[0];
    return `I want to add a project update for "${project.name}"${project.organization ? ` at ${project.organization}` : ''} related to my role as ${title} at ${organization}. Can you help me capture this?`;
  }
  
  // Multiple projects - ask user to select
  const projectList = activeProjects.map((project, index) => 
    `${index + 1}. ${project.name}${project.organization ? ` at ${project.organization}` : ''}`
  ).join('\n');
  
  return `I want to add a project update for my role as ${title} at ${organization}. I have multiple active projects:

${projectList}

Which project would you like to add an update for? Please let me know the project name or number.`;
};