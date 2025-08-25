# Manual Integration Test - AI Auto-Creation Flow

## Test Environment Setup
1. Start the server: `npm run dev`
2. Open browser to localhost:3000
3. Ensure user is logged in
4. Navigate to Professional Journey page

## Test Scenarios

### Scenario 1: Complete Information - Work Experience
**Timeline Action**: Click plus button between two experiences
**Expected Context Message**: "Add a new milestone between [experience1] and [experience2]"
**User Input**: "I worked as a Senior Developer at TechCorp from January 2020 to December 2022"
**Expected Result**: 
- AI should automatically create the work experience
- Timeline should refresh and show new node
- Chat should show confirmation: "✅ I've automatically added this to your timeline!"

### Scenario 2: Incomplete Information - Education
**Timeline Action**: Click plus button at end of timeline
**Expected Context Message**: "Add a new milestone after [current timeline]"
**User Input**: "I went to Stanford"
**Expected Result**:
- AI should ask clarifying questions: "What degree did you pursue at Stanford? When did you start and finish?"
**Follow-up Input**: "Computer Science Bachelor's degree from 2016 to 2020"
**Expected Result**: 
- AI should create education entry
- Timeline should update automatically

### Scenario 3: Project Addition to Experience
**Timeline Action**: Click plus button on experience branch (in focus mode)
**Expected Context Message**: "Add a project to my [experience name]"
**User Input**: "I built a machine learning recommendation system"
**Expected Result**:
- AI should ask for more details: "That sounds interesting! Can you tell me more about the timeline and technologies used?"
**Follow-up**: "Used Python and TensorFlow from March 2021 to August 2021"
**Expected Result**:
- Project should be added to the focused experience
- Timeline should update to show project branch

## API Endpoint Tests

### Test /api/ai/chat/initialize
```bash
curl -X POST http://localhost:3000/api/ai/chat/initialize \
  -H "Content-Type: application/json" \
  -b "cookies_from_browser"
```
**Expected**: `{ "threadId": "chat_[userId]_[timestamp]", "message": "Chat initialized successfully" }`

### Test /api/ai/chat/message
```bash
curl -X POST http://localhost:3000/api/ai/chat/message \
  -H "Content-Type: application/json" \
  -b "cookies_from_browser" \
  -d '{
    "message": "I worked as a Software Engineer at Google from 2020 to 2023",
    "threadId": "test_thread",
    "userId": "test_user",
    "context": {
      "insertionPoint": "after",
      "targetNode": { "title": "Previous Experience" }
    }
  }'
```
**Expected**: Response with `milestoneCreated: true` and confirmation message

## Component Integration Tests

### NaaviChat Component
1. **Props Handling**: Verify isOpen, onClose, initialMessage, and context props work
2. **Message Auto-send**: Initial message should be sent automatically when provided
3. **Context Integration**: Timeline context should be included in API calls
4. **Response Handling**: milestoneCreated flag should trigger timeline refresh

### JourneyTimeline Component
1. **Context Generation**: Different insertion points should generate appropriate messages
2. **Chat Integration**: Plus button clicks should open NaaviChat with context
3. **Data Refresh**: onMilestoneAdded callback should refresh timeline data

## Success Criteria

### ✅ Functional Requirements
- [ ] Plus buttons trigger appropriate context messages
- [ ] AI can create milestones from complete user input
- [ ] Timeline updates automatically after creation
- [ ] Clarification flow works for incomplete information
- [ ] Error handling provides clear feedback

### ✅ User Experience
- [ ] Smooth transition from timeline click to chat
- [ ] Natural conversation flow with AI
- [ ] Visual confirmation of successful operations
- [ ] No page refreshes required
- [ ] Consistent behavior across different browsers

### ✅ Technical Requirements
- [ ] TypeScript compilation passes
- [ ] No console errors during normal operation
- [ ] API endpoints respond correctly
- [ ] Memory usage remains stable during conversations
- [ ] Conversation context is maintained throughout session

## Common Issues to Check

1. **Authentication**: Ensure user session is valid for API calls
2. **CORS**: Verify cross-origin requests are handled properly
3. **WebSocket/SSE**: Check if any real-time features require special handling
4. **State Management**: Ensure stores are updated correctly after operations
5. **Error Boundaries**: Test behavior when API calls fail

## Performance Checks

1. **Timeline Refresh Speed**: Should complete within 1-2 seconds
2. **AI Response Time**: Should respond within 3-5 seconds for simple requests
3. **Memory Usage**: No memory leaks during extended chat sessions
4. **Bundle Size**: Ensure new features don't significantly increase client bundle size

## Browser Compatibility

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Mobile Responsiveness

- [ ] Plus buttons are touch-friendly
- [ ] Chat interface works on mobile screens
- [ ] Context messages are readable on small screens
- [ ] Timeline updates work correctly on mobile

## Notes
- Record any unexpected behaviors
- Document workarounds for known issues
- Note performance observations
- Capture screenshots of successful flows