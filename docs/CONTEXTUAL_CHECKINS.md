# Contextual Check-ins & Milestone Tracking

This document explains how the enhanced Career AI Guide system extracts milestones, generates future tasks, and conducts contextual check-ins based on user history.

## How It Works

### 1. **Milestone Extraction from Conversations**

The system analyzes every conversation to extract:

#### **Completed Milestones**
- **Achievements**: Project completions, promotions, certifications
- **Skills**: New technologies learned, soft skills developed
- **Impact**: Measurable outcomes and business value created

#### **Progress Updates**
- Updates on existing projects/goals
- Status changes (planned → in-progress → completed)
- Blockers and challenges encountered

#### **New Goals**
- Future aspirations mentioned
- Commitments made during conversation
- Timeline expectations

**Example Extraction:**
```
User: "I finally finished the dashboard project this week. The stakeholders loved the new analytics features, and I learned a lot about React optimization."

Extracted:
- Milestone: "Completed dashboard project with analytics features"
- Skills: ["React optimization", "Stakeholder management"]
- Impact: "Positive stakeholder feedback"
- New Knowledge: React performance techniques
```

### 2. **Contextual Check-ins Based on History**

Instead of generic questions, the AI adapts based on:

#### **Recent Challenges**
- **High-severity ongoing issues** → Focus on problem-solving
- **Recurring patterns** → Deep-dive into root causes
- **Recently resolved challenges** → Extract lessons learned

#### **Decision-Making Patterns**
- **Shallow decision processes** → Focus on collaboration theme
- **Complex trade-offs mentioned** → Explore decision frameworks
- **Stakeholder conflicts** → Focus on communication strategies

#### **Achievement Momentum**
- **Recent successes** → Build on what's working
- **Skill development** → Explore application opportunities  
- **Positive feedback** → Identify replicable approaches

### 3. **Adaptive Theme Selection**

The system chooses from 5 contextual themes:

#### **challenges_insights** 
*When user has ongoing high-severity challenges*
- "You mentioned stakeholder expectations being challenging last week. How did that evolve?"
- "What approach did you try for the database performance issue?"

#### **decisions_collaboration**
*When decision-making processes need improvement*
- "Walk me through how you approached the technical trade-off decision."
- "How did you get buy-in from the engineering team?"

#### **learning_reflection**
*When user shows growth opportunities*
- "You learned React optimization this week - where else could you apply this?"
- "What would you do differently on the dashboard project?"

#### **goals_progress**
*When tracking toward specific objectives*
- "How's progress on the Q4 roadmap preparation?"
- "What's blocking you from finishing the team mentoring goals?"

#### **momentum_success**
*When building on positive momentum*
- "The stakeholder demo went well - what made it successful?"
- "How can we replicate this project success pattern?"

### 4. **Task Generation for Future Milestones**

When users mention new goals, the system generates:

#### **Specific Action Items**
```
Goal: "I want to become a better technical lead"

Generated Tasks:
1. Schedule 1:1s with each team member (High priority, 1 week)
2. Research technical leadership frameworks (Medium, 2 weeks)  
3. Shadow current tech lead in architecture meetings (High, ongoing)
4. Create team documentation standards (Low, 1 month)
```

#### **Dependencies & Sequencing**
- Tasks that must happen before others
- Logical progression from basic to advanced
- Resource requirements and constraints

#### **Success Criteria**
- Measurable outcomes for each task
- Timeline expectations
- Quality indicators

### 5. **Progress Tracking During Check-ins**

The system maintains context across conversations:

#### **Reference Previous Work**
- "Last time you mentioned the database performance issue..."
- "How did the stakeholder meeting go that you were preparing for?"
- "You were working on React optimization - any breakthroughs?"

#### **Track Goal Evolution**
- Monitor status changes (planned → in-progress → completed)
- Identify blockers and dependencies
- Celebrate completions and progress

#### **Pattern Recognition**
- Recurring challenges that need deeper attention
- Successful strategies worth replicating
- Skill development trajectories

## API Endpoints

### **GET /api/ai/checkin/:userId**
Generates contextual check-in questions based on recent history.

**Response:**
```json
{
  "theme": "challenges_insights",
  "reasoning": "User has ongoing stakeholder collaboration challenges",
  "suggestedQuestions": [
    "You mentioned stakeholder expectations being tough last week. How did that situation develop?",
    "What approach did you try for managing the conflicting requirements?",
    "How are you feeling about the stakeholder relationship now?"
  ],
  "specificFocus": ["stakeholder management", "conflict resolution"],
  "contextualReferences": ["dashboard project", "analytics requirements"]
}
```

### **POST /api/ai/process-checkin**
Processes check-in conversation to extract progress updates.

**Request:**
```json
{
  "userId": "user_123",
  "conversation": "The stakeholder issue got much better after I scheduled individual meetings with each department head..."
}
```

**Response:**
```json
{
  "progressUpdate": {
    "completedMilestones": [
      {
        "description": "Improved stakeholder relationships through 1:1 meetings",
        "category": "leadership",
        "impact": "Better requirement clarity and reduced conflicts"
      }
    ],
    "progressUpdates": [
      {
        "project": "dashboard project",
        "previousStatus": "blocked by stakeholder conflicts",
        "currentStatus": "moving forward with clear requirements"
      }
    ]
  },
  "generatedTasks": {
    "goalTasks": [
      {
        "goal": "maintain stakeholder relationships",
        "tasks": [
          {
            "description": "Schedule monthly stakeholder check-ins",
            "priority": "high",
            "timeframe": "ongoing"
          }
        ]
      }
    ]
  }
}
```

### **GET /api/ai/context/:userId**
Retrieves user's recent context and patterns.

**Response:**
```json
{
  "hasContext": true,
  "context": {
    "challengesSummary": {
      "total": 3,
      "ongoing": 1,
      "high_severity": 1
    },
    "achievementsSummary": {
      "total": 5,
      "recent": 2
    },
    "patterns": [
      {
        "type": "recurring_challenge",
        "description": "Stakeholder communication difficulties",
        "frequency": 3
      }
    ]
  }
}
```

## Integration with Journey Canvas

### **Milestone Updates**
- Extracted milestones automatically appear as journey nodes
- Progress updates modify existing project sub-milestones
- Skills are tagged and tracked across milestones

### **Goal Tracking**
- Generated tasks become actionable items in the journey
- Dependencies create logical sequences in the timeline
- Completion tracking maintains momentum

### **Contextual Memory**
- Working memory stores current projects and challenges
- Semantic memory enables cross-conversation context
- Pattern recognition improves question relevance

## Benefits

### **For Users**
- **Highly Relevant**: Questions directly address their current work
- **Progress Focused**: Tracks actual advancement toward goals
- **Pattern Aware**: Identifies recurring issues for deeper focus
- **Momentum Building**: Celebrates successes and builds on them

### **For Career Development**
- **Comprehensive Tracking**: Nothing important gets lost
- **Skill Development**: Maps learning journey across projects
- **Goal Achievement**: Breaks down aspirations into actionable steps
- **Reflection**: Encourages learning from both successes and challenges

## Example Conversation Flow

**Week 1:**
- User mentions struggling with stakeholder expectations
- System notes this as high-severity ongoing challenge

**Week 2 Check-in:**
- AI: "Last week you mentioned stakeholder expectations being challenging. How did that evolve?"
- User: "I scheduled 1:1 meetings with each department head"
- System extracts: progress on stakeholder challenge, new approach tried

**Week 3 Check-in:**  
- AI: "How did the individual stakeholder meetings work out?"
- User: "Much better! Requirements are clearer now"
- System extracts: challenge resolved, successful strategy identified

**Week 4 Check-in:**
- AI: "The stakeholder 1:1 approach worked well. Are you applying this pattern elsewhere?"
- Focus shifts to replicating success and building momentum

This creates a continuous improvement cycle where insights from one week inform better questions and tracking in subsequent weeks.