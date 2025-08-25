# Consolidated React Architecture Refactor Plan

## Executive Summary

This document consolidates the PRD and Improvement Report into a unified, modern React architecture plan for the Lighthouse Journey Canvas application. The plan incorporates 2025 best practices including React 19 features, modern testing strategies, and optimized state management patterns.

## 🎯 Vision & Goals

### Primary Objectives
1. **Architectural Excellence**: Feature-based organization with clear n-tier separation
2. **Testing Excellence**: 80%+ coverage with modern tools (Vitest, RTL, MSW)
3. **Developer Experience**: < 2 days onboarding, 50% faster feature development
4. **Performance**: 30% bundle reduction, < 2s initial load, < 500ms hot reload

### Key Modernizations for 2025
- React 19 with automatic dependency management and compiler optimizations
- Zustand (client state) + TanStack Query (server state) combo
- Vitest + React Testing Library + MSW for comprehensive testing
- Context API for dependency injection (native React solution)
- Feature-based code splitting with React.lazy and Suspense

## 📊 Current State Analysis

### Strengths
- Zustand stores well-organized
- TypeScript integration established
- Service layer foundation exists
- Custom hooks pattern in use

### Pain Points
- Mixed shared/feature components causing coupling
- No clear layer separation (presentation/business/data)
- Scattered test files without organization
- Limited dependency injection patterns
- No enforced architectural boundaries

## 🏗️ High-Level Architecture Changes

### 1. Feature-Based Organization
Transform from type-based to feature-based structure with self-contained modules:

```
client/src/
├── app/                    # Application shell
├── features/               # Feature modules
│   ├── timeline/          # Complete timeline feature
│   ├── auth/              # Authentication feature
│   ├── sharing/           # Sharing/permissions
│   └── profile/           # User profile
├── shared/                # Cross-feature utilities
├── lib/                   # External configurations
└── testing/               # Test infrastructure
```

### 2. Three-Tier Architecture

#### Presentation Layer (UI Components)
- Pure rendering logic only
- No business logic or API calls
- Event handlers passed via props
- Styled with TailwindCSS + shadcn/ui

#### Business Logic Layer (Services & Hooks)
- Data transformation and validation
- Business rules and calculations
- State orchestration
- Error handling

#### Data Access Layer (API & Stores)
- TanStack Query for server state
- Zustand for client state
- API communication
- Caching strategies

### 3. Modern State Management

```typescript
// Server State with TanStack Query
const { data, isLoading, error } = useQuery({
  queryKey: ['timeline', userId],
  queryFn: fetchTimelineData,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Client State with Zustand
const useUIStore = create((set) => ({
  selectedNodeId: null,
  expandedNodes: new Set(),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
}));
```

### 4. Dependency Injection via Context

```typescript
// Context-based DI (React native solution)
const ServiceContext = createContext<Services>(null);

export const ServiceProvider = ({ children }) => {
  const services = useMemo(() => ({
    timelineService: new TimelineService(apiClient),
    authService: new AuthService(apiClient),
  }), []);
  
  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
};

// Custom hook for service access
export const useService = <T>(selector: (services: Services) => T) => {
  const services = useContext(ServiceContext);
  return selector(services);
};
```

## 🔧 Low-Level Implementation Details

### Feature Module Structure

Each feature follows this structure:

```typescript
features/timeline/
├── api/                    # API calls with TanStack Query
│   ├── queries.ts         # Query definitions
│   └── mutations.ts       # Mutation definitions
├── components/            # Feature UI components
│   ├── TimelineView/
│   ├── NodeEditor/
│   └── shared/
├── hooks/                 # Feature-specific hooks
│   ├── useTimeline.ts
│   └── useNodeOperations.ts
├── services/              # Business logic
│   ├── timeline.service.ts
│   └── validation.service.ts
├── stores/                # Zustand stores for UI state
│   └── timeline.store.ts
├── types/                 # TypeScript definitions
├── utils/                 # Feature utilities
├── __tests__/            # Organized test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── index.ts              # Public API exports
```

### Testing Infrastructure

#### Technology Stack
- **Vitest**: Fast, Vite-powered test runner
- **React Testing Library**: User-centric component testing
- **MSW**: API mocking at network level
- **Playwright**: E2E testing

#### Test Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/testing/setup.ts',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'testing'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});

// testing/setup.ts
import { server } from './mocks/server';
import '@testing-library/jest-dom';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

#### MSW Handler Example

```typescript
// testing/mocks/handlers.ts
export const handlers = [
  http.get('/api/v2/timeline/nodes', () => {
    return HttpResponse.json({
      nodes: mockTimelineNodes,
      total: mockTimelineNodes.length,
    });
  }),
  
  http.post('/api/v2/timeline/nodes', async ({ request }) => {
    const body = await request.json();
    const newNode = { ...body, id: generateId() };
    return HttpResponse.json(newNode, { status: 201 });
  }),
];
```

### Performance Optimizations

#### Code Splitting

```typescript
// app/router/routes.tsx
const TimelineFeature = lazy(() => 
  import('features/timeline').then(m => ({ default: m.Timeline }))
);

export const router = createBrowserRouter([
  {
    path: '/timeline',
    element: (
      <Suspense fallback={<FeatureLoader />}>
        <TimelineFeature />
      </Suspense>
    ),
  },
]);
```

#### React Compiler Integration

```typescript
// React 19 automatic memoization
export default function TimelineView({ data }) {
  // Compiler automatically memoizes based on naming convention
  const processedNodes = useMemo(
    () => processTimelineData(data),
    [data] // Dependencies auto-managed by compiler
  );
  
  return <TimelineCanvas nodes={processedNodes} />;
}
```

#### Bundle Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'state-vendor': ['zustand', '@tanstack/react-query'],
          'ui-vendor': ['@radix-ui/*', 'class-variance-authority'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand'],
  },
});
```

### ESLint Architecture Enforcement

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          // Features cannot import from each other
          {
            target: './src/features/*',
            from: './src/features/!(shared)',
            except: ['./index.ts'],
            message: 'Features must be independent. Use shared layer for cross-feature code.',
          },
          // Shared cannot import from features
          {
            target: './src/shared',
            from: './src/features',
            message: 'Shared layer cannot depend on features.',
          },
          // Enforce layer hierarchy
          {
            target: './src/features/*/components',
            from: './src/features/*/services',
            message: 'Presentation layer cannot import from service layer directly.',
          },
        ],
      },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
  },
};
```

## 📅 Implementation Timeline (8 Weeks)

### Phase 1: Foundation (Weeks 1-2)
**Goals**: Establish new architecture and tooling

**Deliverables**:
- ✅ Feature-based directory structure created
- ✅ Context API dependency injection setup
- ✅ Vitest + MSW testing infrastructure
- ✅ Shared components extracted to `/shared`
- ✅ ESLint rules for architecture enforcement

**Key Tasks**:
```bash
# Setup new structure
mkdir -p src/{app,features,shared,lib,testing}
npm install vitest @testing-library/react msw @tanstack/react-query
npm install -D @vitest/ui @testing-library/jest-dom
```

### Phase 2: Timeline Feature Migration (Week 3)
**Goals**: Migrate Timeline as proof of concept

**Deliverables**:
- ✅ Timeline feature fully migrated
- ✅ Three-tier architecture implemented
- ✅ Zustand + TanStack Query integrated
- ✅ 90% test coverage achieved
- ✅ Performance baseline established

**Success Criteria**:
- All Timeline CRUD operations working
- < 200ms response time for operations
- Tests passing with MSW mocks

### Phase 3: Core Features Migration (Week 4)
**Goals**: Migrate Authentication and cross-cutting concerns

**Deliverables**:
- ✅ Authentication feature migrated
- ✅ Cross-feature communication patterns
- ✅ Global state management optimized
- ✅ Session management with Context

### Phase 4: Remaining Features (Week 5)
**Goals**: Complete Profile and Sharing features

**Deliverables**:
- ✅ Profile feature with form handling
- ✅ Sharing/permissions feature
- ✅ Reusable form components library
- ✅ Validation patterns established

### Phase 5: Performance Optimization (Week 6)
**Goals**: Optimize bundle and runtime performance

**Deliverables**:
- ✅ Code splitting implemented
- ✅ Bundle size reduced by 30%
- ✅ React Compiler integrated
- ✅ Performance monitoring setup
- ✅ Loading states optimized

**Metrics**:
```javascript
// Performance budget
{
  "bundle": {
    "initial": "< 200KB",
    "lazy": "< 50KB per feature"
  },
  "metrics": {
    "FCP": "< 1.5s",
    "TTI": "< 3s",
    "CLS": "< 0.1"
  }
}
```

### Phase 6: Testing Excellence (Week 7)
**Goals**: Comprehensive test coverage

**Deliverables**:
- ✅ 80%+ overall test coverage
- ✅ E2E test suite with Playwright
- ✅ Performance regression tests
- ✅ Visual regression tests (optional)
- ✅ CI/CD pipeline integration

### Phase 7: Documentation & Training (Week 8)
**Goals**: Knowledge transfer and sustainability

**Deliverables**:
- ✅ Architecture documentation
- ✅ Development guidelines
- ✅ Team training sessions
- ✅ Code review checklist
- ✅ Maintenance procedures

## 📊 Success Metrics

### Technical Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Test Coverage | 80%+ overall, 90%+ critical | Vitest coverage report |
| Bundle Size | 30% reduction | Webpack/Vite analyzer |
| Build Time | < 30s full build | CI/CD metrics |
| Hot Reload | < 500ms | Development metrics |
| Initial Load | < 2s | Lighthouse score |
| TypeScript Coverage | 100% (no `any`) | ESLint report |
| Circular Dependencies | 0 | Dependency cruiser |

### Developer Experience Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Onboarding Time | < 2 days | New developer feedback |
| Feature Development | 50% faster | Sprint velocity |
| Code Reusability | 80% component reuse | Component analytics |
| Test Execution | < 30s full suite | CI/CD metrics |

### Quality Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Bug Rate | 50% reduction | Issue tracking |
| Code Review Time | 30% faster | PR metrics |
| Deployment Frequency | 2x increase | Deployment logs |
| Mean Time to Recovery | 50% reduction | Incident reports |

## 🚨 Risk Mitigation

### Technical Risks

**Migration Complexity**
- **Mitigation**: Incremental feature-by-feature migration
- **Rollback**: Feature flags for instant rollback
- **Validation**: Comprehensive testing at each phase

**Performance Regression**
- **Mitigation**: Performance benchmarks before/after
- **Monitoring**: Real-time performance tracking
- **Budget**: Strict performance budgets enforced

**Team Adoption**
- **Mitigation**: Comprehensive training and documentation
- **Support**: Dedicated architecture champion
- **Review**: Strict code review process

### Mitigation Strategies

```typescript
// Feature flags for safe rollout
const useFeatureFlag = (flag: string) => {
  return process.env.NODE_ENV === 'production' 
    ? getRemoteFlag(flag)
    : true; // All features on in dev
};

// Performance monitoring
const PerformanceMonitor = () => {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        analytics.track('performance', entry);
      });
    });
    observer.observe({ entryTypes: ['measure', 'navigation'] });
  }, []);
};
```

## ✅ Quality Gates

Each phase must meet these criteria before proceeding:

1. **Technical Validation**
   - All tests passing (unit, integration, e2e)
   - Performance metrics met
   - No critical security issues
   - Zero high-priority bugs

2. **Code Quality**
   - 100% TypeScript coverage
   - ESLint passing with architecture rules
   - Code review approval from 2+ developers
   - Documentation updated

3. **Business Validation**
   - Feature parity maintained
   - User acceptance testing passed
   - Stakeholder sign-off received
   - Rollback plan tested

## 🛠️ Tooling & Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.22.0",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.5.0",
    "zod": "^3.22.0",
    "@radix-ui/react-*": "latest",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "vitest": "^1.2.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/jest-dom": "^6.2.0",
    "msw": "^2.1.0",
    "playwright": "^1.41.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "prettier": "^3.2.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.2.0"
  }
}
```

### VS Code Extensions
- ESLint
- Prettier
- Vitest Runner
- React Developer Tools
- TypeScript Error Lens

## 📝 Conclusion

This consolidated plan merges the formal structure of the PRD with the technical depth of the Improvement Report, updated with 2025 best practices. The approach emphasizes:

1. **Modern React patterns** with React 19 features
2. **Optimal state management** with Zustand + TanStack Query
3. **Comprehensive testing** with Vitest + RTL + MSW
4. **Performance-first** architecture with code splitting
5. **Developer experience** through clear patterns and tooling

The 8-week timeline provides a realistic path to transformation while maintaining application stability and team productivity.

---

_Last Updated: January 2025_
_Status: Ready for Implementation_
_Next Step: Team Review and Approval_