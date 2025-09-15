# Task Completion Workflow

## Before Starting Development
1. **Check for existing patterns** in project memory and codebase
2. **Read PRD/specifications** thoroughly to understand requirements
3. **Set up todo tracking** using TodoWrite for complex tasks
4. **Plan TDD approach** - tests first, then implementation

## During Development (TDD Cycle)
1. **Write failing test** that validates the requirement
2. **Implement minimal code** to make the test pass
3. **Refactor** while keeping tests green
4. **Commit** with descriptive message following conventional commits
5. **Update todos** to reflect progress

## Quality Checks Before Each Commit
```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Formatting check
pnpm format:check

# Run relevant tests
pnpm test -- --run [test-pattern]
```

## Commit Message Format
```
type(scope): brief description

- Specific change 1 with test evidence
- Specific change 2 with coverage impact
- Test results: [X passing/Y failing]
- Coverage: [before% → after%]

Resolves: [requirement/todo item]
```

## Before Task Completion
1. **All tests passing** with >90% coverage
2. **All todos marked complete** 
3. **Code reviewed** for quality and patterns
4. **Integration tested** with existing features
5. **Documentation updated** if necessary
6. **Performance verified** if applicable

## Final Validation Checklist
- ✅ All requirements implemented
- ✅ Tests covering edge cases and happy paths
- ✅ Error handling implemented
- ✅ TypeScript types properly defined
- ✅ Components follow established patterns
- ✅ Accessibility considerations addressed
- ✅ No console errors or warnings
- ✅ Code follows project conventions

## Post-Completion
1. **Update project memory** with new patterns discovered
2. **Document architectural decisions** for future reference
3. **Clean up any temporary files or comments**
4. **Prepare for solution-architect review** if needed

## Testing Strategy Order
1. **Contract Tests**: API endpoint validation
2. **Unit Tests**: Individual component/function testing
3. **Integration Tests**: Component interaction testing
4. **E2E Tests**: Full user workflow validation

## Commands for Task Validation
```bash
# Run all quality checks
pnpm pre-commit

# Full test suite
pnpm test

# E2E validation
pnpm test:e2e

# Build verification
pnpm build
```