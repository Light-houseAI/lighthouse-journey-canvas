# Graduate Job Matching with Alumni Networks

## Overview

Implementation plan for context-aware graduate job matching leveraging alumni networks, based on research showing:
- 85% of jobs filled through networking
- Alumni 5x more responsive than cold contacts
- MIT study (20M LinkedIn users): weak ties more valuable than strong ties for job discovery

## Current System Analysis

### What We Have
- ✅ Organizations table (companies & schools) with `orgId` references
- ✅ Job nodes: `{orgId, role, startDate, endDate}` (473 total, 186 with orgId)
- ✅ Education nodes: `{orgId, degree, field, startDate, endDate}`
- ✅ Node insights (learnings/advice) linked to nodes
- ✅ Activity signals in updates meta (appliedToJobs, pendingInterviews, etc.)
- ✅ LLM skill extraction + vector similarity

### What We're Missing
- ❌ NO explicit tags on insights (need inference or manual tagging)
- ❌ NO outcome labels (apply→interview conversions)
- ❌ NO user connection graph (deferring weak ties for now)

## Architecture: Two-Stage Network-Enhanced Matching

### Stage 1: Candidate Generation
```
Content Retrieval (vector similarity)
    +
Alumni Network Expansion (school→company placement)
    ↓
Merged candidate set (deduped)
```

### Stage 2: Context-Aware Reranking
```
For each candidate:
  score = content_similarity * 0.6
        + alumni_uplift * 0.25
        + activity_signal * 0.15
```

## Implementation Phases (8 Weeks)

### Phase 1: Data Foundation (Week 1-2)

#### 1.1 Organization Canonicalization
Add to `organizations` table:
- `canonical_name` (normalized, lowercase, cleaned)
- `domain` (website domain for companies)
- `external_ids` (IPEDS for schools, LinkedIn IDs)

Build:
- Fuzzy matching service for name variants
- Manual review queue for top-traffic entities

#### 1.2 Current Employment Logic
Define current job:
```sql
current_job WHERE endDate IS NULL OR endDate > NOW()
```

Tasks:
- Add migration to clean stale `endDate` values
- Optional: Add `timelineNodes.is_current` computed field for performance

#### 1.3 Alumni Placement Cache
Create materialized view:
```sql
CREATE MATERIALIZED VIEW school_company_placement AS
SELECT
  edu.orgId as school_id,
  job.orgId as company_id,
  COUNT(DISTINCT job.userId) as alumni_count_current,
  MAX(job.startDate) as most_recent_hire,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY job.startDate) as median_hire_date
FROM timeline_nodes edu
JOIN timeline_nodes job ON job.userId = edu.userId
WHERE edu.type = 'education'
  AND job.type = 'job'
  AND (job.endDate IS NULL OR job.endDate > NOW())
GROUP BY edu.orgId, job.orgId
HAVING COUNT(DISTINCT job.userId) >= 3;  -- Privacy: k-anonymity
```

### Phase 2: Context-Aware Insight Retrieval (Week 3-4)

#### 2.1 Insight Stage Tagging
Use LLM to classify insights into stages:
- `resume` - Resume writing, skill highlighting
- `application` - Application strategies, cover letters
- `interview` - Interview prep, questions, culture
- `negotiation` - Offer evaluation, comp benchmarks
- `general` - General career advice

Implementation:
```typescript
interface InsightStageTag {
  stage: 'resume' | 'application' | 'interview' | 'negotiation' | 'general';
  confidence: number;
  keywords: string[];
}
```

Add to schema:
- `node_insights.stage_tags` (JSON field)
- Batch process existing insights
- Real-time tagging for new insights

#### 2.2 Contextual Insight Service
```typescript
interface JobSearchContext {
  stage: 'resume' | 'application' | 'interview' | 'offer';
  targetRole?: string;
  targetCompany?: string;
  targetSector?: string;
}

async getContextualInsights(
  userId: number,
  context: JobSearchContext
): Promise<RankedInsight[]> {
  // 1. Get user's school(s) from education nodes
  const userSchools = await getUserSchools(userId);

  // 2. Find alumni with same school + similar trajectory
  const alumni = await findAlumniWithPath(userSchools, context.targetRole);

  // 3. Filter insights by:
  //    - Stage match (context.stage)
  //    - Target role/company (if specified)
  //    - Recency (prefer last 12 months)
  const insights = await filterInsights(alumni, context);

  // 4. Rank by weighted score
  return rankInsights(insights, {
    stageMatch: 0.4,
    entityMatch: 0.3,
    recency: 0.2,
    engagement: 0.1
  });
}
```

### Phase 3: Alumni-Enhanced Job Matching (Week 5-6)

#### 3.1 Alumni Boost Scoring
Replace fixed +20% with bounded, learned function:

```typescript
interface PlacementData {
  alumni_count: number;
  most_recent_hire: Date;
  wilson_score?: number; // Bayesian success rate (if we have outcomes)
}

function calculateAlumniUplift(
  userSchoolId: number,
  companyId: number,
  placementCache: PlacementData
): number {
  const { alumni_count, most_recent_hire, wilson_score } = placementCache;

  // Saturating log function (diminishing returns)
  const countScore = Math.log(1 + Math.min(alumni_count, 20)) / Math.log(21);

  // Recency decay (2-year half-life)
  const monthsAgo = monthsSince(most_recent_hire);
  const recencyWeight = Math.exp(-monthsAgo / 24);

  // Confidence (Wilson score or default for sparse data)
  const confidenceScore = wilson_score || 0.5;

  // Weighted combination
  const rawUplift =
    0.4 * countScore +
    0.3 * recencyWeight +
    0.3 * confidenceScore;

  // Cap at 15% to prevent prestige bias
  return Math.min(rawUplift * MAX_BOOST, 0.15);
}
```

Key features:
- **Saturation**: More alumni = better, but with diminishing returns
- **Recency**: Recent hires weighted higher (2-year half-life)
- **Confidence**: Bayesian shrinkage for low-sample schools
- **Cap**: Maximum 15% boost to prevent echo chambers

#### 3.2 Cold Start Fallback
When user's school has <3 alumni:
1. **Program-level expansion**: Aggregate by major/field (e.g., all "Computer Science" programs)
2. **Cohort expansion**: ±2 years graduation window
3. **Regional expansion**: Same geographic region
4. **Skill affinity**: Job postings requiring user's skills

```typescript
async getColdStartCandidates(userId: number): Promise<Job[]> {
  const user = await getUser(userId);
  const userEdu = await getUserEducation(userId);

  if (!userEdu || !userEdu.field) {
    return vectorSearchOnly(user.skills);
  }

  // Expand to program level
  const programPlacements = await db.execute(sql`
    SELECT DISTINCT job.orgId as company_id
    FROM timeline_nodes edu
    JOIN timeline_nodes job ON job.userId = edu.userId
    WHERE edu.type = 'education'
      AND (edu.meta->>'field')::text ILIKE ${`%${userEdu.field}%`}
      AND job.type = 'job'
      AND (job.endDate IS NULL OR job.endDate > NOW())
    GROUP BY job.orgId
    HAVING COUNT(DISTINCT job.userId) >= 2
  `);

  return getJobsAtCompanies(programPlacements);
}
```

#### 3.3 Two-Stage Retrieval Implementation
```typescript
async findJobMatches(context: MatchingContext): Promise<JobMatch[]> {
  // Stage 1: Candidate Generation
  const [contentCandidates, alumniCandidates] = await Promise.all([
    vectorSearch(context.userSkills, limit: 50),
    getAlumniCompanyJobs(context.userSchools, limit: 30)
  ]);

  // Merge and deduplicate
  const merged = deduplicateByJobId([
    ...contentCandidates,
    ...alumniCandidates
  ]);

  // Stage 2: Reranking with combined signals
  const scored = await Promise.all(
    merged.map(async (job) => {
      const contentSim = await getContentSimilarity(context.userId, job.id);
      const alumniUplift = await getAlumniUplift(context.userSchools, job.orgId);
      const activityBoost = await getActivityBoost(context.userId);

      return {
        job,
        score:
          contentSim * 0.6 +
          alumniUplift * 0.25 +
          activityBoost * 0.15,
        breakdown: { contentSim, alumniUplift, activityBoost }
      };
    })
  );

  // Sort and return top-K
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, context.limit || 10);
}
```

### Phase 4: Interview Matching Integration (Week 7-8)

#### 4.1 Company-Specific Interview Insights
Find users who interviewed at target company:
```typescript
async getCompanyInterviewInsights(
  companyId: number,
  userSchoolId: number
): Promise<InterviewInsight[]> {
  // Find interview events at company
  const interviews = await db
    .select()
    .from(timelineNodes)
    .where(
      and(
        eq(timelineNodes.type, 'event'),
        sql`${timelineNodes.meta}->>'eventType' = 'interview'`,
        sql`${timelineNodes.meta}->>'orgId' = ${companyId}`
      )
    );

  // Get insights from those interview nodes
  const insights = await db
    .select()
    .from(nodeInsights)
    .where(
      and(
        inArray(nodeInsights.nodeId, interviews.map(i => i.id)),
        sql`${nodeInsights.stage_tags}->>'stage' = 'interview'`
      )
    );

  // Filter for alumni (same school)
  const alumniInsights = insights.filter(async (insight) => {
    const node = interviews.find(i => i.id === insight.nodeId);
    const userSchools = await getUserSchools(node.userId);
    return userSchools.includes(userSchoolId);
  });

  return alumniInsights;
}
```

#### 4.2 Multi-Stage Job Search Journey
```typescript
interface JobSearchJourney {
  resume: {
    insights: Insight[];          // Resume writing tips from alumni
    alumni: User[];               // Alumni who got target role
    skillGaps: string[];          // Missing skills to highlight
  };

  application: {
    insights: Insight[];          // Application strategies
    successRate: number;          // Alumni success rate at company
    referralPaths: AlumniPath[];  // Potential referrers
  };

  interview: {
    insights: Insight[];          // Interview prep from alumni
    questionBank: string[];       // Common questions at company
    companyCulture: string[];     // Culture insights
  };

  offer: {
    insights: Insight[];          // Negotiation tips
    compBenchmarks: number[];     // Comp data from alumni
    acceptanceFactors: string[];  // Why alumni accepted/rejected
  };
}

async getJobSearchJourney(
  userId: number,
  jobId: string
): Promise<JobSearchJourney> {
  const job = await getJob(jobId);
  const userSchools = await getUserSchools(userId);
  const currentStage = await detectCurrentStage(userId);

  return {
    resume: await getResumeGuidance(userSchools, job.role),
    application: await getApplicationGuidance(userSchools, job.orgId),
    interview: await getInterviewGuidance(userSchools, job.orgId),
    offer: await getOfferGuidance(userSchools, job.role)
  };
}
```

## Privacy & Fairness Guardrails

### 1. k-Anonymity (Privacy)
```typescript
// Only show alumni counts if k >= 5
if (placement.alumni_count < 5) {
  return {
    hasAlumni: true,
    count: "Several",  // Vague language
    uplift: 0          // No scoring advantage
  };
}
```

### 2. User Opt-Out
```typescript
// Add to users table
export const users = pgTable('users', {
  // ... existing fields
  excludeFromAlumniAggregates: boolean('exclude_from_alumni_aggregates')
    .default(false),
});

// Filter in placement calculation
WHERE user.excludeFromAlumniAggregates = false
```

### 3. Uplift Cap (Fairness)
```typescript
// Cap alumni boost at 15% to prevent prestige bias
const MAX_BOOST = 0.15;
return Math.min(rawUplift, MAX_BOOST);
```

### 4. Exploration Slots (Fairness)
```typescript
// 30% of recommendations are content-only (no alumni boost)
const topK = 10;
const explorationSlots = Math.ceil(topK * 0.3);

const final = [
  ...alumniBoosedJobs.slice(0, topK - explorationSlots),
  ...contentOnlyJobs.slice(0, explorationSlots)
];
```

### 5. No PII Exposure
```typescript
// NEVER show individual alumni names without consent
interface AlumniPresence {
  count: number;              // Aggregated count only
  mostRecentHire: Date;       // Anonymized timestamp
  canRequestIntro: boolean;   // Flag for referral availability
  // NO: names, emails, profiles
}
```

## Success Metrics

| Metric | Baseline | Target | Timeline |
|--------|----------|--------|----------|
| Apply rate (alumni recs) | - | +40% vs content-only | Week 8 |
| Interview rate (via referrals) | - | 3x baseline | Week 12 |
| Coverage (users with alumni recs) | - | 60% | Week 8 |
| Insight relevance score | - | >7/10 user rating | Week 6 |
| Time to first interview | - | -30% | Week 16 |
| Alumni response rate | - | 40% (vs 8% cold) | Week 12 |

## Implementation Checklist

### Week 1-2: Data Foundation
- [ ] Add `canonical_name`, `domain`, `external_ids` to organizations
- [ ] Build fuzzy matching service for org name variants
- [ ] Create manual review queue for top organizations
- [ ] Add migration to clean stale job `endDate` values
- [ ] Create `school_company_placement` materialized view
- [ ] Add refresh job (daily at 2am)

### Week 3-4: Insight Tagging
- [ ] Add `stage_tags` JSON field to `node_insights`
- [ ] Build LLM insight stage classifier
- [ ] Batch process existing insights (tag all)
- [ ] Add real-time tagging for new insights
- [ ] Create `ContextualInsightService`
- [ ] Add insight ranking algorithm

### Week 5-6: Alumni Matching
- [ ] Implement `calculateAlumniUplift` with bounded scoring
- [ ] Create cold start fallback (program/cohort expansion)
- [ ] Build two-stage retrieval pipeline
- [ ] Add alumni boost to `UnifiedMatchingPipelineService`
- [ ] Implement privacy filters (k-anonymity, opt-out)
- [ ] Add exploration slots for fairness

### Week 7-8: Interview Integration
- [ ] Create `getCompanyInterviewInsights` method
- [ ] Build `JobSearchJourney` service
- [ ] Integrate interview insights with job recs
- [ ] Add referral path discovery
- [ ] Create A/B test framework
- [ ] Launch beta to 10% of users

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| School name variants (Stanford vs Stanford University) | High | Fuzzy matching + manual review queue + canonical IDs |
| Sparse alumni data (small schools) | High | Program-level fallback + skill affinity + ±2yr cohort |
| Stale employment data (people left companies) | Medium | Recency decay (2yr half-life) + validate end_date |
| Low insight quality (generic advice) | Medium | Stage tagging + entity matching + engagement ranking |
| Privacy concerns (identifying individuals) | High | k-anonymity (k≥5) + opt-out + no PII + aggregate-only |
| Performance (on-the-fly joins) | Low | Materialized views + daily refresh + user-level cache |
| Prestige bias (Ivy League advantage) | Medium | Uplift cap (15%) + exploration (30%) + fairness metrics |

## Future Enhancements (Deferred)

### When We Have Outcome Labels:
- Replace heuristic weights with learned LTR model
- Train on apply→interview, interview→offer conversions
- A/B test learned vs heuristic scoring

### When We Have Connection Graph:
- Add weak ties analysis (2nd degree connections)
- Implement social proof signals (mutual connections)
- Build referral request automation

### When We Have More Data:
- Graduate to GNN-based matching (Approach 2 from research)
- Add heterogeneous graph with meta-paths
- Implement personalized PageRank features

## References

- [MIT LinkedIn Study - Weak Ties](https://news.mit.edu/2022/weak-ties-linkedin-employment-0915)
- [Alumni Network Impact](https://moldstud.com/articles/p-the-role-of-alumni-networks-in-career-development-and-job-placement)
- [Graph Neural Networks for Job Matching](https://link.springer.com/article/10.1007/s41019-025-00293-y)
- [Reciprocal Job Recommendation for Graduates](https://www.mdpi.com/2076-3417/13/22/12305)
