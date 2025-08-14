# Add Project to Experience - Test Suite

Comprehensive test suite for validating the "add project to experience" functionality using the simplified career agent.

## 📁 Test Structure

```
server/tests/add-project-to-experience/
├── 01-basic-scenarios.test.ts      # Core functionality tests
├── 02-multiple-roles.test.ts       # Role-specific targeting tests  
├── 03-novel-companies.test.ts      # Generalization tests
├── 04-edge-cases.test.ts          # Error handling tests
├── run-all-tests.ts               # Comprehensive test runner
└── README.md                      # This documentation
```

## 🚀 Quick Start

### Run All Tests
```bash
npm run test:add-project:all
```

### Run Individual Test Categories
```bash
npm run test:add-project:basic           # Basic scenarios
npm run test:add-project:multiple-roles  # Multiple roles handling
npm run test:add-project:novel          # Novel companies
npm run test:add-project:edge-cases     # Edge cases
```

### Legacy Tests (Deprecated)
```bash
npm run test:simplified                 # Old simplified agent test
npm run test:multiple-roles            # Old multiple roles test
npm run test:novel                     # Old novel scenario test
```

## 📊 Test Categories

### 1. Basic Scenarios (`01-basic-scenarios.test.ts`)
**Purpose**: Validates core "add project to experience" functionality

**Test Cases**:
- ✅ Add project to well-known company (TechCorp)
- ✅ Add project to healthcare company (Optum)  
- ✅ Add project with minimal details
- ✅ Add project with rich details

**Success Criteria**:
- Profile updates correctly detected
- Projects added to correct experiences
- Agent responses mention relevant details
- Different detail levels handled appropriately

### 2. Multiple Roles (`02-multiple-roles.test.ts`)
**Purpose**: Validates role-specific targeting when users have multiple roles at the same company

**Test Cases**:
- 🔍 Semantic search finds multiple ABCO experiences
- 🎯 Role-specific search targeting ("principal software engineer")
- 🤖 Agent role-specific project addition
- 🔤 Case insensitive matching (ABCO vs abco vs Abco)
- 🔀 Disambiguation handling for ambiguous requests

**Real-World Scenario**:
- User worked at ABCO as Software Engineer (2012-2014)
- User worked at abco india private ltd as Principal Software Engineer (2018-2022)
- User says "add project to ABCO when I was principal software engineer"
- Agent should target the 2018-2022 role, not the 2012-2014 role

### 3. Novel Companies (`03-novel-companies.test.ts`)
**Purpose**: Validates generalization beyond training examples

**Test Cases**:
- 🌟 Meta/Facebook (Frontend Engineer, React Native)
- 📊 Netflix (Data Scientist, Recommendation Algorithm)
- ⚙️ Spotify (DevOps Engineer, Kubernetes Migration)
- 💳 Stripe (Backend Engineer, Payment API)
- 🎨 Adobe (Creative Software Engineer, Photoshop Plugin)
- 📊 Profile validation (new experiences created)

**Training vs Novel Comparison**:
| Aspect | Training Examples | Novel Examples |
|--------|------------------|----------------|
| Companies | TechCorp, Google, ABCO, Optum | Meta, Netflix, Spotify, Stripe, Adobe |
| Roles | Software Engineer, Principal Engineer | Frontend, Data Scientist, DevOps, Creative |
| Projects | Mobile App, ML Platform, Data Pipeline | React Native, Recommendation, Kubernetes, Payment API, Photoshop Plugin |

### 4. Edge Cases (`04-edge-cases.test.ts`)
**Purpose**: Validates robustness and error handling

**Test Cases**:
- 🚫 Non-existent company (should create new experience)
- ❓ Vague requests (should ask for clarification)
- 🏢 Missing company information
- 📄 Very long project descriptions
- 🔤 Special characters and formatting
- ⚪ Empty/whitespace messages

**Success Criteria**:
- Graceful error handling
- Appropriate clarification requests
- Reasonable assumptions when information is missing
- Robust processing of various input formats
- No crashes or unexpected failures

## 📈 Success Metrics

### Overall Performance Grades:
- **95%+ = Excellent** (Production Ready)
- **85%+ = Good** (Minor improvements needed)
- **70%+ = Moderate** (Significant improvements needed)
- **<70% = Needs major fixes**

### Feature Validation:
- ✅ **Core Functionality**: Basic project addition works
- ✅ **Role-Specific Targeting**: Handles multiple roles correctly
- ✅ **Generalization**: Works beyond training examples
- ✅ **Error Handling**: Robust edge case management

## 🔧 Technical Details

### Test Environment:
- **User ID**: 17 (consistent across all tests)
- **Database**: Real PostgreSQL with user profile data
- **Vector Search**: Real semantic search with embeddings
- **Agent**: Simplified career agent (not legacy workflow)

### Key Components Tested:
- `processCareerConversation()` - Main agent entry point
- `semanticSearch()` - Experience and project search
- Profile update detection logic
- Database persistence validation
- Response quality analysis

### Profile Update Detection:
The tests validate three levels of profile update detection:
1. **Tool-based**: Formal `toolResults` analysis
2. **Response-based**: Text analysis for success indicators
3. **Fallback**: Aggressive detection when tools executed

## 🐛 Troubleshooting

### Common Issues:

**Test Timeouts**:
```bash
# Increase timeout or run individual tests
npm run test:add-project:basic
```

**Database Connection Errors**:
```bash
# Ensure PostgreSQL is running and DATABASE_URL is set
echo $DATABASE_URL
```

**Profile Update Detection Failures**:
- Check if agent response contains success indicators
- Verify tool execution logs in output
- Ensure database updates are persisting

**Semantic Search Issues**:
- Verify vector database is initialized
- Check if user profile has experience data
- Validate embedding generation is working

### Debug Mode:
Enable detailed logging by checking the console output during test runs. The tests include comprehensive logging of:
- Agent responses and actions
- Profile state before/after operations
- Semantic search results and similarities
- Database update confirmations

## 📝 Test Data

The tests use **User ID 17** which should have:
- Multiple experiences at different companies
- At least 2 roles at ABCO (different time periods)
- Projects in existing experiences
- Vector embeddings for semantic search

### Required Profile Structure:
```typescript
{
  experiences: [
    { company: "TechCorp", title: "Software Developer", projects: [...] },
    { company: "Optum", title: "Senior Software Engineer", projects: [...] },
    { company: "ABCO", title: "Software Engineer", projects: [...] },
    { company: "abco india private ltd", title: "Principal Software Engineer", projects: [...] },
    // ... other experiences
  ]
}
```

## 🔄 Migration from Legacy Tests

The new consolidated test suite replaces several older test files:
- `simplified-agent-test.ts` → `01-basic-scenarios.test.ts`
- `multiple-roles-test.ts` → `02-multiple-roles.test.ts`  
- `novel-scenario-test.ts` → `03-novel-companies.test.ts`
- Various edge case tests → `04-edge-cases.test.ts`

### Benefits of Consolidation:
- ✅ Organized by scenario type
- ✅ Comprehensive coverage
- ✅ Standardized result reporting
- ✅ Single command to run all tests
- ✅ Better documentation and maintenance

## 📚 Related Documentation

- [Simplified Career Agent](../../services/ai/simplified-career-agent.ts) - Main agent implementation
- [Career Tools](../../services/ai/career-tools.ts) - Tool definitions and implementations
- [Package.json Scripts](../../../package.json) - Available npm test commands

---

## 🎯 Usage Examples

### Development Workflow:
```bash
# 1. Make changes to simplified career agent
vim server/services/ai/simplified-career-agent.ts

# 2. Run basic tests first
npm run test:add-project:basic

# 3. Run specific scenario tests
npm run test:add-project:multiple-roles

# 4. Run full test suite before committing
npm run test:add-project:all
```

### CI/CD Integration:
```bash
# Primary test command for CI/CD
npm run test:all  # Runs comprehensive add-project test suite
```

This test suite ensures the simplified career agent reliably handles all "add project to experience" scenarios with high accuracy and appropriate error handling.