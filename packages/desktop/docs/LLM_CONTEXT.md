# LLM Context & Prompt Engineering

This document explains what context we pass to the LLM for generating personalized writing suggestions.

## Context Structure

### User Profile Context

Extracted from the selected user profile:

```typescript
{
  userName: string                // User's full name
  currentRole: string | null      // Current job title
  recentProjects: string[]        // Top 3 most recent project titles
  skills: string[]                // Top 10 unique technologies from all projects
  education: string[]             // Degrees and school names
  userInsights: string[]          // Top 5 key achievements from profile
  networkInsights?: NetworkInsights  // Professional network data
}
```

### User Insights

**Source**: Extracted from user's profile insights and job insights

**Example**:
- "Led team of 12 engineers across 3 product areas"
- "Improved system throughput by 300% while reducing costs by 40%"
- "Reduced production defects by 65% through comprehensive testing strategy"

**Usage**: Provides concrete examples of the user's achievements to help LLM suggest similar formatting and quantification patterns.

### Network Insights

**Source**: Generated mock data simulating professional network analysis

**Components**:

1. **Professional Network Size**
   - Number of connections
   - Relationship strength (strong/medium/weak)

2. **Common Companies**
   - Companies where user's connections work
   - Example: "Tech Corp, Amazon, Microsoft"

3. **Common Skills & Technologies**
   - Skills frequently appearing in network
   - Example: "Microservices, Distributed Systems, Cloud Infrastructure"

4. **Successful Career Patterns**
   - Career progression paths from network
   - Example: "Senior Engineer → Staff Engineer → Principal Engineer (5-8 years)"
   - Common transitions and timeframes

5. **Key Network Connections**
   - Top 3 connections with details
   - Example: "Sarah Chen - Senior Engineering Manager at Google (strong connection)"

## LLM Prompt Structure

### System Prompt

Provides role definition and general guidance:

```
You are an expert writing assistant helping users create professional documents.

Analyze the user's current text and provide ONE actionable suggestion to improve it.

Respond with JSON:
{
  "message": "brief, actionable suggestion",
  "confidence": 0-100,
  "reasoning": "why this suggestion matters (can reference network insights)",
  "examples": ["optional", "example text"]
}

ONLY suggest if confidence >= 80.
```

### Intent-Specific Guidance

**For Resume Writing**:
- Use strong action verbs (Led, Architected, Implemented, Reduced, Increased)
- Include quantifiable metrics showing impact (X%, $Y, Z users)
- Focus on outcomes and business value, not just tasks
- Highlight achievements that align with career paths common in the network

**For Requirements Documentation**:
- Be specific and testable
- Use "shall/must" language for functional requirements
- Include measurable acceptance criteria
- For technical requirements: specify performance metrics (latency, throughput, uptime)
- For user stories: use "As a [role], I want [capability] so that [benefit]" format

### User Context Prompt

**Full template sent to LLM**:

```
User Profile:
- Name: {userName}
- Current Position: {currentRole}
- Recent Projects: {recentProjects}
- Technical Skills: {skills}
- Education: {education}

User's Key Achievements & Insights:
  • {insight1}
  • {insight2}
  • {insight3}

Network Intelligence (use this to provide personalized recommendations):
- Professional Network: {X} connections
- Companies in Network: {companies}
- Common Skills & Technologies: {skillOverlap}
- Successful Career Patterns:
  • {careerPath1}
  • {careerPath2}
- Key Network Connections:
  • {connection1}
  • {connection2}
  • {connection3}

Current Text Being Written ({intent}):
{currentText}

Based on the user's profile, achievements, and professional network, provide ONE specific,
actionable suggestion to improve this text. Reference similar patterns from successful people
in their network when applicable.
```

## Context-Aware Recommendations

The LLM uses this rich context to provide:

### Resume Writing Suggestions

1. **Pattern Matching**: Compare user's current text to their existing achievements
2. **Network Benchmarking**: Suggest metrics/formats used by successful people in their network
3. **Skill Highlighting**: Recommend emphasizing skills common in their target companies
4. **Career Path Alignment**: Suggest framing achievements in line with network career patterns

**Example**:
- User writes: "Worked on microservices project"
- Context shows: Network connections at FAANG with similar backgrounds
- LLM suggests: "Led microservices architecture serving 10M+ users, similar to successful transitions from mid-level to Staff Engineer in your network"

### Requirements Documentation Suggestions

1. **Specificity**: Encourage measurable criteria based on industry standards in network
2. **Format Consistency**: Match user story format to patterns in their context
3. **Technical Alignment**: Use technologies and metrics relevant to their skill set
4. **Completeness**: Ensure acceptance criteria cover all aspects

**Example**:
- User writes: "System should be fast"
- Context shows: User has experience with distributed systems, network uses specific SLAs
- LLM suggests: "System shall respond to API requests with p95 latency < 200ms and 99.9% uptime SLA, aligning with your distributed systems background"

## Confidence Scoring

LLM returns confidence (0-100):
- **>= 80**: Suggestion shown to user
- **< 80**: No suggestion displayed (not confident enough)

This ensures quality control and prevents unhelpful suggestions.

## Privacy & Data Flow

1. User profile data stays local (loaded from JSON files)
2. Network insights are mock data (not real connections)
3. Only anonymized context sent to OpenAI API
4. No PII stored or transmitted beyond session
5. Session-only editing (changes not persisted)

## Future Enhancements

Potential improvements to context:
- Real LinkedIn/GitHub network integration
- Historical writing samples analysis
- Company-specific terminology extraction
- Industry benchmarks and standards
- User feedback loop for suggestion quality
