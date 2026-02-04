# Weekly Progress Update System Prompt

This document describes the system prompt used for generating weekly progress update reports from user workflow data.

## Overview

The Weekly Progress Update System Prompt transforms raw workflow session data (screen recordings, activity logs, timestamps, screenshots) into comprehensive weekly progress update reports.

## Routing Logic

| Query Type | System Prompt Used |
|------------|-------------------|
| Efficiency, speed, performance, productivity, workflow optimization | `ANSWER_GENERATION_SYSTEM_PROMPT` (existing) |
| Weekly progress update, progress report, status report, weekly summary | `PROGRESS_UPDATE_SYSTEM_PROMPT` (new) |

### Example Queries That Route to Progress Update Prompt

- "Create a weekly progress update"
- "Write a progress report from my workflow"
- "Generate a weekly status report"
- "What did I accomplish this week?"
- "Summarize my work as a report"
- "Create a status update"
- "Weekly standup report"
- "Structure my weekly update"

### Example Queries That Route to Optimization Prompt

- "How can I improve my efficiency?"
- "Make my workflow faster"
- "Optimize my productivity"
- "Where am I wasting time?"
- "How can I speed up my work?"

---

## Key Features

### 1. Flowing Narrative Analysis
- Analysis is written as natural flowing paragraphs
- NO "Step 1:", "Step 2:" headers
- Builds trust by showing the analysis process conversationally

### 2. Single File Output
- Generates ONLY ONE downloadable markdown file
- No separate .txt file generated
- File contains only the final report, not the analysis

### 3. Evidence-Based Reporting
- Anti-hallucination rules
- References actual session data
- Uses specific timestamps when available

---

## Output Format

### Analysis Narrative (in response text)
```
I analyzed your workflow data from [date]. The sessions cover approximately [duration] of work
across [tools]. Tracing the chronological activity, you began with [activity] around [time],
then transitioned to [next activity]. The primary tools identified include [tool list].
Key themes that emerged include [themes].
```

### Downloadable Report File
```download:weekly-progress-YYYY-MM-DD.md
# Weekly Progress Update Report

**Week of [DATE RANGE]**

## Summary
[Executive summary]

## Key Accomplishments
[Numbered accomplishments]

## Tools & Platforms Utilized
[Table format]

## Collaboration & Communication
[List of collaboration activities]

## AI Integration Observations
[If applicable]

## Upcoming Priorities
[Numbered priorities]

## Workflow Insights
[Strengths and areas for improvement]
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `progressupdate-system-prompt.ts` | TypeScript module exporting the system prompt |
| `progressupdate-system-prompt.md` | This documentation file |
| `progressupdate-system-prompt.txt` | Plain text version of the prompt |
| `query-classifier.ts` | Updated to include `PROGRESS_UPDATE` intent routing |

---

## Query Classifier Integration

The `query-classifier.ts` file has been updated with:

1. **New Intent Type**: `PROGRESS_UPDATE` added to `QueryIntent` union type
2. **Pattern Matching**: Regex patterns to detect progress update queries
3. **Routing Logic**: Routes to `A1_RETRIEVAL` agent only (similar to blog creation)

### Pattern Examples

```typescript
PROGRESS_UPDATE: [
  /\b(create|write|generate|make|draft)\s+(an?\s+)?(weekly\s+)?(progress\s+)?(update|report)/i,
  /\b(weekly|daily|monthly)\s+(progress\s+)?(update|report|summary)/i,
  /\b(progress\s+)?(report|update)\s+(from|based\s+on|about)\s+(my\s+)?(workflow|session|work)/i,
  /\bturn\s+(my\s+)?(workflow|session|work)\s+into\s+(an?\s+)?(progress\s+)?(report|update)/i,
  /\bsummar(ize|y)\s+(my\s+)?(work|week|activities?)\s+(as|into)\s+(an?\s+)?(report|update)/i,
  /\bwhat\s+(did|have)\s+i\s+(accomplish|achieve|complete|do)\s+(this|last)\s+(week|month)/i,
  /\b(create|write|generate)\s+(an?\s+)?(status|activity|work)\s+(report|update|summary)/i,
  /\b(weekly|daily)\s+(standup|status)\s+(update|report|summary)/i,
  /\b(generate|create)\s+(progress|weekly|work)\s+(summary|overview)/i,
  /\breport\s+(on|about)\s+(my\s+)?(activities?|work|accomplishments?)/i,
  /\bstructure\s+(my\s+)?(weekly|progress)\s+(update|report)/i,
  /\bformat\s+(as|into)\s+(an?\s+)?(progress|weekly)\s+(report|update)/i,
]
```

---

## Example Output

### Analysis Narrative (shown to user)
```
I analyzed your workflow data from January 29, 2026. This session log captures approximately
9 minutes of activity across multiple applications. The primary tools identified include
Google Chrome for research, Granola for AI-assisted note-taking, Google Slides for
presentation editing, and Google Calendar for scheduling.

Tracing the chronological flow, the session began at 3:47 PM with research in Chrome,
viewing a flowchart about workflow value creation. By 3:48 PM, the focus shifted to
Granola for reviewing session summaries. From 3:49 PM to 3:52 PM, intensive work occurred
in Google Slides on a presentation titled "High-Impact Placement Tactics." The session
concluded around 3:56 PM with collaboration activities including sharing the presentation
and scheduling a meeting.

Key themes that emerged include student job placement strategy development, AI-driven
workflow optimization research, and team collaboration through shared documents and
scheduled meetings.
```

### Downloadable File
```download:weekly-progress-2026-01-29.md
# Weekly Progress Update Report

**Week of January 27, 2026 – January 29, 2026**

## Summary

This week focused on developing strategic recommendations for student job placement
improvements, with particular emphasis on creating presentation materials and conducting
research on AI-driven workflow optimization.

[Report continues...]
```
