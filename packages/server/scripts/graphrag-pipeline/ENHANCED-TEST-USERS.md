# Enhanced Test User Generation

## Overview

The enhanced test user generation system creates realistic test users with:
- **Job search updates** - For activity scoring in matching
- **Experience insights** - For relevance matching
- **JSON export/import** - For reproducible test data
- **Consistent conventions** - Maintains `test-lighthouse.com` domain

## Key Features

### 1. Updates (Job Search Activity)
Each test user includes 3-8 recent updates with activity flags:
- `appliedToJobs` - Applied to positions
- `pendingInterviews` - Has upcoming interviews
- `hadInterviews` - Completed interviews
- `receivedOffers` - Got job offers
- `receivedRejections` - Got rejections
- `updatedProfile` - Updated profile/resume

These flags are used by `ActivityScoringService` to calculate activity scores.

### 2. Insights (Experience Learnings)
Each experience (education, job, project) includes 1-3 insights:
- Meaningful learnings from the experience
- Actionable advice for others
- Optional resources (books, articles, courses)

These are used by `ActivityScoringService.getInsightRelevance()` for matching.

### 3. JSON Pipeline
Two-step process for better control:
1. **Generate** - Create JSON profiles with LLM
2. **Load** - Import profiles to PostgreSQL

This allows:
- Reviewing generated data before loading
- Sharing test datasets
- Reproducible testing
- Version control of test data

## Usage

### Prerequisites
```bash
# Set OpenAI API key for LLM generation
export OPENAI_API_KEY=your-api-key

# Set database URL
export DATABASE_URL=postgresql://user:pass@localhost:5432/lighthouse
```

### Generate Test Users

#### Step 1: Generate JSON profiles
```bash
# Generate 10 mixed persona profiles
npx tsx generate-enhanced-test-users.ts generate --count 10

# Generate 20 engineer profiles
npx tsx generate-enhanced-test-users.ts generate --count 20 --persona engineer

# Generate to custom file
npx tsx generate-enhanced-test-users.ts generate --count 10 --output my-test-users.json
```

#### Step 2: Load to database
```bash
# Load from default file (test-users.json)
npx tsx generate-enhanced-test-users.ts load --input test-users.json

# Load from custom file
npx tsx generate-enhanced-test-users.ts load --input my-test-users.json
```

#### One-step generation and load
```bash
# Generate and immediately load to database
npx tsx generate-enhanced-test-users.ts generate --count 10 --load
```

### Cleanup
```bash
# View test users that would be deleted
npx tsx generate-enhanced-test-users.ts cleanup

# Actually delete test users
npx tsx generate-enhanced-test-users.ts cleanup --confirm
```

## JSON Structure

The generated JSON follows this structure:

```json
{
  "version": "1.0",
  "generated": "2024-01-15T10:30:00Z",
  "count": 2,
  "profiles": [
    {
      "user": {
        "email": "test.engineer.abc123@test-lighthouse.com",
        "firstName": "John",
        "lastName": "Doe",
        "userName": "test_engineer_abc123",
        "interest": "find-job"
      },
      "career": {
        "summary": "Senior engineer with 8 years experience...",
        "currentStatus": "actively-searching",
        "education": [
          {
            "school": "MIT",
            "degree": "BS",
            "field": "Computer Science",
            "startDate": "2012-09",
            "endDate": "2016-05",
            "insights": [
              {
                "description": "Foundation in algorithms is crucial for...",
                "resources": ["Introduction to Algorithms - CLRS"]
              }
            ]
          }
        ],
        "jobs": [
          {
            "role": "Senior Software Engineer",
            "company": "Tech Corp",
            "location": "San Francisco, CA",
            "description": "Leading backend development...",
            "startDate": "2020-01",
            "endDate": null,
            "technologies": ["Node.js", "AWS", "PostgreSQL"],
            "projects": [
              {
                "title": "API Platform Migration",
                "description": "Migrated monolith to microservices",
                "projectType": "professional",
                "technologies": ["Node.js", "Docker", "Kubernetes"],
                "startDate": "2020-03",
                "endDate": "2020-09"
              }
            ],
            "insights": [
              {
                "description": "System design decisions have long-term impacts...",
                "resources": ["Designing Data-Intensive Applications"]
              }
            ]
          }
        ],
        "recentUpdates": [
          {
            "updateType": "job-search",
            "content": "Applied to 5 senior positions at FAANG companies",
            "meta": {
              "appliedToJobs": true,
              "pendingInterviews": false
            }
          },
          {
            "updateType": "interview",
            "content": "Completed technical interview with Google",
            "meta": {
              "hadInterviews": true,
              "pendingInterviews": true
            }
          }
        ]
      }
    }
  ]
}
```

## Database Tables Populated

The loader populates these tables:

1. **users** - Test user accounts
2. **organizations** - Companies and schools
3. **timelineNodes** - Jobs, education, projects
4. **nodeInsights** - Experience learnings
5. **updates** - Job search activity

## Testing Enhanced Matching

After loading test users, you can validate the enhanced matching:

```bash
# Run validation suite
cd packages/server
npx tsx scripts/matching-validation.ts

# Run enhanced POC demo
npx tsx scripts/enhanced-matching-poc.ts

# Run integration tests
pnpm test src/services/__tests__/enhanced-matching.integration.test.ts
```

## Conventions

- **Email**: `test.[persona].[id]@test-lighthouse.com`
- **Username**: `test_[persona]_[id]`
- **Password**: `TestUser123!` (all test users)
- **Organizations**: Marked with `isTestData: true`

## Personas

Available personas:
- `engineer` - Software developers
- `product` - Product managers
- `design` - UX/UI designers
- `data` - Data scientists

Each persona has:
- Appropriate career progression
- Relevant technologies/skills
- Domain-specific insights
- Realistic job search patterns

## Rate Limiting

The generator includes rate limiting for OpenAI API:
- Pauses after every 3 users
- Prevents API throttling
- Ensures stable generation

## Troubleshooting

### "OPENAI_API_KEY not set"
Set your OpenAI API key:
```bash
export OPENAI_API_KEY=sk-...
```

### "Database connection failed"
Check your DATABASE_URL:
```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/lighthouse
```

### "Invalid JSON format"
Ensure the JSON file matches the schema in `test-users-schema.json`

### Rate limit errors
Reduce batch size or add delays:
```bash
# Generate in smaller batches
npx tsx generate-enhanced-test-users.ts generate --count 5
```

## Integration with Enhanced Matching

The generated test users are specifically designed for testing:

1. **Activity Scoring** (`ActivityScoringService`)
   - Updates provide job search signals
   - Meta flags enable activity scoring
   - Recent dates ensure relevance

2. **Insight Relevance** (`getInsightRelevance`)
   - Rich insights on experiences
   - Keywords for matching
   - Domain-specific learnings

3. **Unified Pipeline** (`UnifiedMatchingPipelineService`)
   - Complete user profiles
   - Hierarchical node structure
   - Ready for all matching strategies

This ensures comprehensive validation of the enhanced matching system.