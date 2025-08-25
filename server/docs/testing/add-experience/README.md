# Add Experience - Test Suite

Comprehensive test suite for validating the "add experience" functionality using the simplified career agent.

## 📁 Test Structure

```
server/tests/add-experience/
├── basic-scenarios.test.ts        # Core functionality tests
├── conversation-flow.test.ts      # Multi-turn conversation tests
├── edge-cases.test.ts            # Error handling tests
├── validation.test.ts            # Data integrity and validation tests
├── duplicate-detection.test.ts   # Duplicate experience scenarios
└── README.md                     # This documentation
```

## 🚀 Quick Start

### Run All Tests
```bash
npm run test server/tests/add-experience/
```

### Run Individual Test Categories
```bash
npm run test server/tests/add-experience/basic-scenarios.test.ts
npm run test server/tests/add-experience/conversation-flow.test.ts
npm run test server/tests/add-experience/edge-cases.test.ts
npm run test server/tests/add-experience/validation.test.ts
npm run test server/tests/add-experience/duplicate-detection.test.ts
```

## 📊 Test Categories

### 1. Basic Scenarios (`basic-scenarios.test.ts`)
**Purpose**: Validates core "add experience" functionality

**Test Cases**:
- ✅ Add new experience with required fields (title, company, start date)
- ✅ Add experience with optional fields (end date, description)
- ✅ Add current role (no end date specified)
- ✅ Add past role with end date
- ✅ Add experience with rich description including technologies

**Success Criteria**:
- Profile updates correctly detected
- Experience added to filteredData.experiences array
- Agent responses contain success confirmations
- Database persistence validation

### 2. Conversation Flow (`conversation-flow.test.ts`)
**Purpose**: Validates multi-turn conversations and clarification handling

**Test Cases**:
- 🔄 Incomplete information → Agent asks for missing details
- 🔄 User: "I started working at Google" → Agent asks for role/start date
- 🔄 Multi-turn conversation flow from vague to specific
- 🔄 Conflicting information → Agent asks for correction
- 🔄 Resume interrupted conversation using same thread ID

**Real-World Scenarios**:
- User: "I want to add my job" → Agent: "What company and role?"
- User: "I started at Netflix" → Agent: "What was your role and when did you start?"
- User: "Add my startup experience" → Agent: "Which startup and what role?"

### 3. Edge Cases (`edge-cases.test.ts`)
**Purpose**: Validates robustness and error handling

**Test Cases**:
- 🚫 Invalid date formats → Agent requests clarification
- 🚫 Missing required fields → Graceful error handling
- 🚫 Future start dates → Validation warnings
- 🚫 End date before start date → Logic validation
- 🚫 Very long company names/descriptions → Proper handling
- 🚫 Special characters in input → Sanitization

**Success Criteria**:
- No crashes or unexpected failures
- Appropriate error messages
- Graceful degradation
- User-friendly clarification requests

### 4. Validation (`validation.test.ts`)
**Purpose**: Validates data integrity and format validation

**Test Cases**:
- ✅ Date format validation (various accepted formats)
- ✅ Required field validation (title, company, start)
- ✅ Optional field handling (end, description)
- ✅ Data sanitization (whitespace, normalization)
- ✅ Profile state consistency after updates

**Validation Rules**:
- Start date is required and must be valid
- End date must be after start date (if provided)
- Company and title must be non-empty strings
- Description is optional but sanitized if provided

### 5. Duplicate Detection (`duplicate-detection.test.ts`)
**Purpose**: Handles duplicate and similar experience scenarios

**Test Cases**:
- 🔍 Same company/role again → Agent confirms before adding
- 🔍 Similar company names → Agent asks for clarification
- 🔍 Same company, different roles → Agent confirms new role
- 🔍 Same role, different time periods → Agent confirms separate experience
- 🔍 Agent suggests updating existing vs creating new

**Duplicate Scenarios**:
| Existing Experience | New Request | Expected Behavior |
|-------------------|-------------|------------------|
| Google - Software Engineer (2020-2022) | Google - Software Engineer (2023-present) | Confirm new role |
| TechCorp - Developer (current) | TechCorp - Senior Developer | Suggest role update vs new experience |
| Google Inc - SWE | Google - Software Engineer | Clarify if same company |

## 🎯 Key Test Scenarios

### Happy Flow Examples:
```
1. "Add my Software Engineer role at TechCorp from January 2020 to December 2022"
   → Creates complete experience with all details

2. "I started as Senior Developer at StartupCo in March 2023"
   → Creates current role without end date

3. "Add my Principal Engineer position at BigTech where I led ML platform development"
   → Creates experience with rich description
```

### Confirmation Flow Examples:
```
1. User has "Google - SWE (2020-2022)" and requests "Google - Senior SWE (2023-present)"
   → Agent confirms this is a new separate role

2. User requests "Google Inc - Developer" when profile has "Google - Engineer"
   → Agent asks if this is the same company

3. User requests generic "Add my job at Microsoft"
   → Agent asks for specific role and start date
```

### Error Handling Examples:
```
1. "I worked from yesterday to tomorrow"
   → Agent identifies invalid date logic

2. "Add my role at"
   → Agent asks for company name

3. "I started in 2025"
   → Agent questions future start date
```

## 📈 Success Metrics

### Overall Performance Grades:
- **95%+ = Excellent** (Production Ready)
- **85%+ = Good** (Minor improvements needed)
- **70%+ = Moderate** (Significant improvements needed)
- **<70% = Needs major fixes**

### Feature Validation:
- ✅ **Core Functionality**: Basic experience addition works
- ✅ **Conversation Flow**: Handles incomplete information gracefully
- ✅ **Duplicate Detection**: Prevents/confirms duplicate experiences
- ✅ **Data Validation**: Ensures data integrity and consistency
- ✅ **Error Handling**: Robust edge case management

## 🔧 Technical Details

### Test Environment:
- **User ID**: 999 (consistent with other test suites)
- **Database**: Real PostgreSQL with TestDatabaseManager
- **Agent**: `processCareerConversation()` from simplified-career-agent
- **Tools**: `addExperience` from career-tools.ts

### Key Components Tested:
- `processCareerConversation()` - Main agent entry point
- `addExperience()` - Experience creation tool
- Profile update detection logic
- Database persistence validation
- Response quality analysis

### Profile Update Detection:
The tests validate experience creation through:
1. **Tool-based**: Formal `toolResults` analysis
2. **Response-based**: Text analysis for success indicators
3. **Database-based**: Direct profile state verification

## 🐛 Troubleshooting

### Common Issues:

**Test Timeouts**:
```bash
# Increase timeout or run individual tests
npm run test server/tests/add-experience/basic-scenarios.test.ts
```

**Database Connection Errors**:
```bash
# Ensure PostgreSQL is running and DATABASE_URL is set
echo $DATABASE_URL
```

**Profile Update Detection Failures**:
- Check if agent response contains success indicators
- Verify addExperience tool execution in logs
- Ensure database updates are persisting
- Validate filteredData.experiences array changes

### Debug Mode:
Enable detailed logging by checking console output during test runs. Tests include:
- Agent responses and actions
- Profile state before/after operations
- Tool execution confirmations
- Database update validations

## 📝 Test Data

The tests use **User ID 999** which should have:
- Existing experiences for duplicate detection tests
- Clean state that can be reset between tests
- Proper database relationships for profile updates

### Required Profile Structure:
```typescript
{
  experiences: [
    { 
      id: "exp1", 
      company: "TechCorp", 
      title: "Software Developer", 
      start: "2020-01-01",
      end: "2022-12-31",
      projects: [...] 
    },
    { 
      id: "exp2", 
      company: "Google", 
      title: "Software Engineer", 
      start: "2018-06-01",
      end: "2019-12-31",
      projects: [...] 
    }
    // ... other experiences for duplicate testing
  ]
}
```

## 🔄 Integration with Existing Tests

This test suite complements the existing `add-project-to-experience` tests:
- **add-experience**: Creates new work experiences
- **add-project-to-experience**: Adds projects to existing experiences

### Workflow Integration:
1. User adds experience using `add-experience` functionality
2. User then adds projects using `add-project-to-experience` functionality
3. Both test suites ensure end-to-end career profile building works

## 📚 Related Documentation

- [Simplified Career Agent](../../services/ai/simplified-career-agent.ts) - Main agent implementation
- [Career Tools](../../services/ai/career-tools.ts) - Tool definitions including addExperience
- [Add Project Tests](../add-project-to-experience/) - Complementary test suite
- [Test Database Manager](../utils/test-database.ts) - Shared test utilities

---

## 🎯 Usage Examples

### Development Workflow:
```bash
# 1. Make changes to simplified career agent or career tools
vim server/services/ai/simplified-career-agent.ts
vim server/services/ai/career-tools.ts

# 2. Run basic tests first
npm run test server/tests/add-experience/basic-scenarios.test.ts

# 3. Run specific scenario tests
npm run test server/tests/add-experience/duplicate-detection.test.ts

# 4. Run full test suite before committing
npm run test server/tests/add-experience/
```

### CI/CD Integration:
```bash
# Primary test command for CI/CD
npm run test server/tests/add-experience/
```

This test suite ensures the simplified career agent reliably handles all "add experience" scenarios with high accuracy, appropriate duplicate detection, and robust error handling.