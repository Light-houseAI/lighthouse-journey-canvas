# Real-Time UI Updates Implementation

This document explains how the real-time UI updates work when profile data is modified during chat interactions.

## Overview

The system uses Server-Sent Events (SSE) to send real-time updates from the server to the client when career tools modify the user's profile data. This ensures the UI refreshes immediately without requiring manual page refreshes.

## Architecture

### Server-Side (SSE Event Generation)

1. **SSE Response Context**: The chat endpoint (`/server/routes/ai.ts`) passes the SSE response object to the runtime context:
   ```typescript
   runtimeContext.set('sseResponse', res);
   ```

2. **Profile Update Helper**: The career tools (`/server/services/ai/career-tools.ts`) include a helper function to send profile update events:
   ```typescript
   function sendProfileUpdateEvent(runtimeContext: any, eventType: string, data: any) {
     try {
       const sseResponse = runtimeContext?.get('sseResponse');
       if (sseResponse && !sseResponse.destroyed) {
         sseResponse.write(`data: ${JSON.stringify({
           type: 'profile_update',
           eventType,
           data,
           timestamp: new Date().toISOString(),
         })}\\n\\n`);
       }
     } catch (error) {
       console.log('Failed to send SSE profile update event:', error);
     }
   }
   ```

3. **Tool Integration**: Each career tool calls this helper when data is modified:
   - `addExperience` - sends 'experience_added' event
   - `updateExperience` - sends 'experience_updated' event
   - `addEducation` - sends 'education_added' event  
   - `addProjectToExperience` - sends 'project_added' event
   - `addProjectWork` - sends 'project_update_added' event

### Client-Side (Event Handling)

1. **Event Handler**: The OverlayChat component (`/client/src/components/OverlayChat.tsx`) handles profile update events:
   ```typescript
   const handleProfileUpdate = (profileUpdateData: any) => {
     console.log('Profile update received:', profileUpdateData);
     
     const eventType = profileUpdateData.eventType;
     let message = '';
     
     switch (eventType) {
       case 'experience_added':
         message = `✅ Added experience: ${profileUpdateData.data.experience.title} at ${profileUpdateData.data.experience.company}`;
         break;
       case 'education_added':
         message = `🎓 Added education: ${profileUpdateData.data.education.degree ? profileUpdateData.data.education.degree + ' at ' : ''}${profileUpdateData.data.education.school}`;
         break;
       case 'project_added':
         message = `🚀 Added project: ${profileUpdateData.data.project.title} at ${profileUpdateData.data.experience.company}`;
         break;
       case 'project_update_added':
         message = `📝 Added update: ${profileUpdateData.data.update.title} to ${profileUpdateData.data.project.title}`;
         break;
       default:
         message = `✨ Profile updated: ${eventType}`;
     }
     
     // Show notification in chat
     showMessage('assistant', message);
     
     // Trigger UI refresh
     if (onProfileUpdated) {
       onProfileUpdated();
     }
   };
   ```

2. **SSE Stream Processing**: The streaming response handler includes profile update handling:
   ```typescript
   } else if (data.type === 'profile_update') {
     // Handle real-time profile updates from career tools
     handleProfileUpdate(data);
   } else if (data.type === 'followup') {
   ```

3. **UI Refresh**: The main page component (`/client/src/pages/professional-journey.tsx`) invalidates queries to refresh data:
   ```typescript
   onProfileUpdated={() => {
     // Refresh profile and project data when profile is updated
     queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
     queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
   }}
   ```

## Event Flow

1. User sends message in chat: "I started a new job at Google as a Software Engineer"
2. AI agent processes message and uses `addExperience` tool
3. Tool saves data to database AND sends SSE event:
   ```json
   {
     "type": "profile_update",
     "eventType": "experience_added", 
     "data": {
       "experience": {
         "title": "Software Engineer",
         "company": "Google",
         "start": "2024-01"
       },
       "action": "added"
     },
     "timestamp": "2024-07-25T10:30:00.000Z"
   }
   ```
4. Client receives SSE event and shows notification: "✅ Added experience: Software Engineer at Google"
5. Client triggers query invalidation to refresh UI components
6. User sees updated data immediately in the professional journey visualization

## Benefits

- **Immediate Feedback**: Users see changes reflected in the UI instantly
- **No Manual Refresh**: Eliminates need for page refreshes or manual data fetching
- **Visual Confirmation**: Chat notifications confirm that actions were completed
- **Consistent State**: All UI components stay synchronized with the latest data
- **Better UX**: Creates a seamless, responsive experience during chat interactions

## Event Types

| Event Type | Description | Data Structure |
|------------|-------------|----------------|
| `experience_added` | New work experience added | `{ experience: {...}, action: 'added' }` |
| `experience_updated` | Existing work experience updated | `{ experience: {...}, originalExperience: {...}, action: 'updated' }` |
| `education_added` | New education entry added | `{ education: {...}, action: 'added' }` |
| `project_added` | New project added to experience | `{ experience: {...}, project: {...}, action: 'added' }` |
| `project_update_added` | New update added to project | `{ experience: {...}, project: {...}, update: {...}, addedSkills: [...], action: 'added' }` |

## Testing

To test the real-time updates:

1. Open the professional journey page
2. Start a chat conversation
3. Tell the AI about a new job, education, or project
4. Watch for:
   - Immediate chat notification when data is saved
   - UI components refreshing automatically
   - New data appearing in the timeline visualization

## Error Handling

- SSE event sending includes try-catch blocks to prevent crashes
- Client-side event parsing includes error handling for malformed events
- Failed events don't interrupt the chat flow
- Console logging helps debug event transmission issues