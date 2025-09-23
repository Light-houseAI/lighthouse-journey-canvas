# Test User Generation System

A sophisticated test user generation system that creates realistic career journeys with meaningful, experience-based insights for the Lighthouse platform.

## 🎯 Key Features

- **Realistic Career Progressions**: Coherent career paths that mirror real professional journeys
- **Meaningful Insights**: Experience-based learnings and advice, not just random data
- **LLM Integration**: Optional OpenAI integration for truly unique content
- **Automatic Vector Sync**: All data automatically synced to vector database for GraphRAG
- **Diverse Personas**: Engineers, Product Managers, Designers, Data Scientists, DevOps
- **Hierarchical Data**: Proper parent-child relationships (Jobs → Projects → Events)
- **Organization Linking**: Companies and schools properly linked via orgId

## 🚀 Quick Start

### Installation

```bash
cd packages/server/scripts/graphrag-pipeline
npm install
```

### Basic Usage

```bash
# Generate 10 test users with template-based content
npx tsx generate-realistic-test-users.ts --count 10

# Generate 20 software engineers
npx tsx generate-realistic-test-users.ts --count 20 --persona software_engineer

# Generate mixed personas with LLM-powered content
OPENAI_API_KEY=your-key npx tsx generate-realistic-test-users.ts --count 10 --mixed --use-llm

# Clean up all test users
npx tsx generate-realistic-test-users.ts cleanup --confirm
```

## 📊 Available Personas

1. **Software Engineer** - Full-stack engineers with modern web experience
2. **Product Manager** - Customer-focused PMs with data-driven backgrounds
3. **UX/Product Designer** - User-centered designers with visual skills
4. **Data Scientist** - ML engineers with statistical expertise
5. **DevOps/SRE** - Infrastructure and reliability engineers

Each persona includes:
- Realistic career progression (entry → mid → senior → leadership)
- Appropriate skill sets and tools
- Typical project types
- Relevant insight themes

## 🧠 Insight Generation

### What Makes Our Insights Special?

Unlike random test data, our insights are:
- **Experience-based**: Derived from actual role/project context
- **Actionable**: Provide value for career growth
- **Personal**: Written as first-person learnings
- **Meaningful**: Share wisdom that can help others

### Example Insights

**For a Senior Engineer Role:**
- "Leading a team through ambiguity taught me that clear communication beats perfect planning"
- "Building at scale revealed that simple solutions often outperform complex optimizations"

**For a Product Manager:**
- "User feedback loops shortened from months to days transformed our product velocity"
- "The hardest part of prioritization isn't saying no, it's explaining why"

**For a Designer:**
- "Accessibility constraints often lead to better design for everyone"
- "Design systems are living organisms that need constant nurturing"

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
| `--persona <type>` | Specific persona type | mixed |
| `--mixed` | Generate mixed personas | false |
| `--use-llm` | Use OpenAI for content generation | false |

### Environment Variables

```bash
# Required for LLM features
OPENAI_API_KEY=your-openai-api-key

# Database connection
DATABASE_URL=postgresql://user:pass@localhost:5432/lighthouse
```

## 🔄 Generation Modes

### Template-Based (Default)
- Fast generation using predefined templates
- Consistent, predictable content
- No API costs
- ~1 second per user

### LLM-Powered (--use-llm)
- Unique, contextual content for each user
- More realistic career progressions
- Highly varied insights
- ~3-5 seconds per user
- Requires OpenAI API key

## 🧹 Cleanup

The script includes built-in cleanup functionality:

```bash
# Preview what will be deleted
npx tsx generate-realistic-test-users.ts cleanup

# Confirm deletion
npx tsx generate-realistic-test-users.ts cleanup --confirm
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
npx tsx generate-realistic-test-users.ts --count 100 --mixed --use-llm
```

### 2. UI/UX Testing
```bash
# Generate specific personas for interface testing
npx tsx generate-realistic-test-users.ts --count 20 --persona ux_designer
```

### 3. Performance Testing
```bash
# Generate large datasets
npx tsx generate-realistic-test-users.ts --count 500 --mixed
```

### 4. Demo Environments
```bash
# Create realistic demo data
npx tsx generate-realistic-test-users.ts --count 30 --mixed --use-llm
```

## 🔍 Identifying Test Users

All test users can be identified by:
- **Email Domain**: `@test-lighthouse.com`
- **Email Pattern**: `test.{persona}.{id}@test-lighthouse.com`
- **Username Pattern**: `test_{persona}_{id}`
- **Standard Password**: `TestUser123!`

## 🏭 How It Works

1. **User Creation**: Creates user account with authentication
2. **Career Journey**: Generates realistic progression based on persona
3. **Education**: Adds university/college background
4. **Work History**: Creates 2-4 jobs with appropriate progression
5. **Projects**: Adds 3-5 projects under each job
6. **Insights Generation**:
   - Template mode: Selects from curated insights
   - LLM mode: Generates unique insights based on context
7. **Vector Sync**: Automatically syncs via HierarchyService
8. **Organization Linking**: Creates/links companies and schools

## 🛡️ Safety Features

- Test domain prevents email conflicts
- Transaction-based operations with rollback
- Cleanup requires explicit confirmation
- No impact on production users
- Isolated test data identification

## 📝 Best Practices

1. **Use LLM mode for demos** - Creates more impressive, varied content
2. **Use template mode for testing** - Faster and more predictable
3. **Clean up regularly** - Don't let test data accumulate
4. **Generate in batches** - Better for rate limits and monitoring
5. **Mix personas** - Creates more realistic distributions

## 🐛 Troubleshooting

### LLM Generation Fails
- Check OPENAI_API_KEY is set
- Verify API quota/limits
- Falls back to template mode automatically

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