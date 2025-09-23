# Test User Generation System

A sophisticated test user generation system that creates realistic career journeys with meaningful, AI-powered insights for the Lighthouse platform.

## 🎯 Key Features

- **AI-Powered Generation**: Uses OpenAI GPT-4o-mini with structured outputs for realistic content
- **Realistic Career Progressions**: Coherent career paths that mirror real professional journeys
- **Meaningful Insights**: Experience-based learnings and advice generated from context
- **Automatic Vector Sync**: All data automatically synced to vector database via HierarchyService
- **5 Diverse Personas**: Software Engineers, Product Managers, UX/Product Designers, Data Scientists, DevOps/SRE Engineers
- **Hierarchical Data**: Proper parent-child relationships (Jobs → Projects → Events → Actions)
- **Organization Linking**: Companies and schools properly linked via orgId
- **Schema-Driven**: Uses @journey/schema types for consistency with the platform

## 🚀 Quick Start

### Installation

```bash
cd packages/server/scripts/graphrag-pipeline
npm install
```

### Basic Usage

```bash
# Generate 10 test users with AI-powered content (mixed personas)
OPENAI_API_KEY=your-key npx tsx generate-test-users.ts --count 10

# Generate 20 software engineers
OPENAI_API_KEY=your-key npx tsx generate-test-users.ts --count 20 --persona software_engineer

# Generate mixed personas explicitly
OPENAI_API_KEY=your-key npx tsx generate-test-users.ts --count 10 --mixed

# Clean up all test users
npx tsx generate-test-users.ts cleanup --confirm
```

## 📊 Available Personas

### 1. **Software Engineer** (`software_engineer`)
- Full-stack engineers with modern web experience
- Skills: JavaScript, TypeScript, React, Node.js, Python, Go, GraphQL
- Career Path: Junior Developer → Senior Engineer → Staff/Principal → Tech Lead/Engineering Manager

### 2. **Product Manager** (`product_manager`)
- Customer-focused PMs with data-driven backgrounds
- Skills: SQL, Analytics, A/B Testing, User Research, Roadmapping
- Career Path: Associate PM → Senior PM → Principal PM → Director/VP Product

### 3. **UX/Product Designer** (`ux_designer`)
- User-centered designers with visual and interaction skills
- Skills: User Research, Wireframing, Prototyping, Design Systems
- Career Path: Junior Designer → Senior Designer → Principal/Staff → Design Manager

### 4. **Data Scientist** (`data_scientist`)
- ML engineers with statistical expertise
- Skills: Python, R, ML, Deep Learning, Statistics, TensorFlow/PyTorch
- Career Path: Data Analyst → Senior Data Scientist → Staff/Principal → ML Lead

### 5. **DevOps/SRE Engineer** (`devops_engineer`)
- Infrastructure and reliability engineers
- Skills: Kubernetes, Terraform, Cloud Architecture, IaC, Monitoring
- Career Path: Junior DevOps → SRE → Senior SRE → Infrastructure Manager

Each persona includes:
- Realistic career progression with 2-4 jobs
- Industry-appropriate companies (startups, scaleups, enterprise)
- 3-5 projects per job with appropriate technologies
- 2-3 contextual insights per role based on actual experiences

## 🧠 AI-Powered Insight Generation

### How It Works

Insights are generated using OpenAI GPT-4o-mini with structured outputs based on:
- **Role Context**: Current position and responsibilities
- **Project Experience**: Specific projects and their outcomes
- **Career Stage**: Entry, mid, senior, or leadership level
- **Company Culture**: Startup, scaleup, or enterprise environment

### Insight Categories

**Technical Insights:**
- Building for scale vs. clarity
- Technical debt management
- Architecture decisions
- Performance optimization learnings

**Leadership Insights:**
- Growing from IC to leadership
- Building trust and influence
- Team dynamics and culture
- Strategic vs. tactical thinking

**Growth Insights:**
- Career transitions
- Skill development strategies
- Building expertise and reputation
- Learning from failures

### Example Generated Insights

**Senior Engineer at Scale-up:**
- "Migrating to microservices taught me that incremental changes beat big-bang approaches"
- "Code review is as much about knowledge sharing as it is about quality control"

**Product Manager at Enterprise:**
- "Navigating stakeholder politics requires empathy more than authority"
- "The best product decisions often come from saying no to good ideas"

**UX Designer at Startup:**
- "Rapid prototyping beats perfect mockups when validating with users"
- "Design debt accumulates faster than technical debt but is harder to quantify"

## 🏗️ Data Structure

Each test user includes:
- **User Account**: Email, username, profile data
- **Education Nodes**: Universities with degrees and fields
- **Job Nodes**: 2-4 positions with realistic progression
- **Project Nodes**: 3-5 projects per job
- **Insights**: Experience-based learnings at each level
- **Organizations**: Automatically linked via orgId in meta fields
- **Vector Embeddings**: Automatically synced for GraphRAG

## ⚙️ Configuration Options

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--count <n>` | Number of users to generate | 10 |
| `--persona <type>` | Specific persona type (see list above) | mixed |
| `--mixed` | Generate mixed personas | false (true if no persona specified) |

### Environment Variables

```bash
# Required - OpenAI API key for content generation
OPENAI_API_KEY=your-openai-api-key

# Optional - Database connection (defaults to local)
DATABASE_URL=postgresql://user:pass@localhost:5432/lighthouse
```

### Configuration Files

**`config/personas-config.ts`**
- Defines all 5 persona configurations
- Career paths, skills, and typical companies
- Insight themes for different career stages

**`config/hierarchy-rules.ts`**
- Enforces proper node parent-child relationships
- Validates timeline node hierarchy
- Ensures schema compliance

## 🔄 Generation Process

### How Users Are Generated

1. **User Account Creation**
   - Unique test email: `test.{persona}.{id}@test-lighthouse.com`
   - Standard password for all test users
   - Completed onboarding flag set

2. **Career Journey Generation (AI)**
   - GPT-4o-mini generates coherent career progression
   - 1-2 education nodes (university/college)
   - 2-4 job positions with natural progression
   - Appropriate years of experience

3. **Job Details & Projects (AI)**
   - For each job, generates 3-5 projects
   - Projects include: title, description, technologies, dates
   - Optional events (conferences, certifications)
   - All within the job's date range

4. **Insight Generation (AI)**
   - 2-3 insights per job based on role context
   - 2 insights per project based on specific experience
   - 2 insights for education nodes
   - Resources (books, articles) occasionally included

5. **Vector Synchronization**
   - HierarchyService automatically syncs all nodes
   - Embeddings generated via OpenAI
   - Ready for GraphRAG searches immediately

### Performance
- ~3-5 seconds per user with AI generation
- Rate limiting: 3 users before 1-second pause
- Batch processing for better reliability

## 🧹 Cleanup

The script includes built-in cleanup functionality:

```bash
# Preview what will be deleted
npx tsx generate-test-users.ts cleanup

# Confirm deletion
npx tsx generate-test-users.ts cleanup --confirm
```

This removes:
- User accounts
- Timeline nodes (jobs, education, projects)
- Node insights
- Vector embeddings
- GraphRAG chunks and edges

## 📈 Use Cases

### 1. GraphRAG Testing
```bash
# Generate diverse profiles for search testing
OPENAI_API_KEY=your-key npx tsx generate-test-users.ts --count 100 --mixed
```

### 2. UI/UX Testing
```bash
# Generate specific personas for interface testing
OPENAI_API_KEY=your-key npx tsx generate-test-users.ts --count 20 --persona ux_designer
```

### 3. Performance Testing
```bash
# Generate large datasets (consider rate limits)
OPENAI_API_KEY=your-key npx tsx generate-test-users.ts --count 50 --mixed
```

### 4. Demo Environments
```bash
# Create realistic demo data
OPENAI_API_KEY=your-key npx tsx generate-test-users.ts --count 30 --mixed
```

## 🔍 Identifying Test Users

All test users can be identified by:
- **Email Domain**: `@test-lighthouse.com`
- **Email Pattern**: `test.{persona}.{id}@test-lighthouse.com`
- **Username Pattern**: `test_{persona}_{id}`
- **Standard Password**: `TestUser123!`

## 🏗️ Technical Architecture

### Dependencies
- **@journey/schema**: Core schema types (TimelineNodeType, insightCreateSchema, etc.)
- **HierarchyService**: Manages node creation and vector sync
- **Container/Awilix**: Dependency injection for services
- **OpenAI SDK**: Structured output generation with GPT-4o-mini
- **Zod Schemas**: Type-safe AI generation

### Key Components

**`RealisticTestUserGenerator` Class:**
- Manages user generation lifecycle
- Handles AI prompt engineering
- Coordinates with HierarchyService
- Organization caching for efficiency

**Schema Integration:**
- Uses `jobMetaSchema`, `educationMetaSchema`, `projectMetaSchema` from @journey/schema
- Extends schemas with AI-specific fields (company name, school name)
- Validates all generated data against platform schemas

**Hierarchy Validation:**
- Enforces node relationships (Jobs/Education at root)
- Projects can be children of Jobs
- Events can be children of Projects
- Actions can be children of Events

## 🛡️ Safety Features

- Test domain prevents email conflicts
- Transaction-based operations with rollback
- Cleanup requires explicit confirmation
- No impact on production users
- Isolated test data identification

## 📝 Best Practices

1. **Start small** - Test with 5-10 users first
2. **Clean up regularly** - Don't let test data accumulate
3. **Monitor API usage** - OpenAI costs can add up with large batches
4. **Use mixed personas** - Creates more realistic user distributions
5. **Review generated content** - Verify AI-generated insights are appropriate

## 🐛 Troubleshooting

### OpenAI API Issues
- **Required**: OPENAI_API_KEY environment variable must be set
- Script will exit if API key is missing
- Verify API quota/limits not exceeded
- Ensure GPT-4o-mini model access

### Generation Errors
- Check console for specific user generation failures
- Errors are collected and reported at the end
- Partial failures don't stop the batch

### Database Connection Issues
- Check DATABASE_URL environment variable
- Verify PostgreSQL is running
- Check user permissions

### Vector Sync Issues
- Ensure HierarchyService is properly configured
- Check OpenAI embedding service setup
- Verify pgvector extension is installed

## 📚 Related Documentation

- [Timeline System Architecture](../../../docs/timeline-architecture.md)
- [GraphRAG Implementation](../../../docs/graphrag.md)
- [Vector Search Guide](../../../docs/vector-search.md)

## 🤝 Contributing

When adding new personas:
1. Update `personas-config.ts` with new persona definition
2. Add appropriate career paths and progressions
3. Include relevant insight themes
4. Test both template and LLM modes

## 📄 License

Part of the Lighthouse platform - internal use only.