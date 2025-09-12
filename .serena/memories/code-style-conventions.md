# Code Style and Conventions

## TypeScript Configuration
- **Strict Mode**: Enabled with strict type checking
- **Target**: ES2020 with ESNext modules
- **Path Aliases**: 
  - `@/*` maps to `./client/src/*`
  - `@shared/*` maps to `./shared/*`

## Code Formatting (Prettier)
- **Semicolons**: Required
- **Quotes**: Single quotes preferred
- **Print Width**: 80 characters
- **Tab Width**: 2 spaces (no tabs)
- **Trailing Commas**: ES5 style
- **Arrow Parens**: Always include parentheses
- **End of Line**: LF (Unix style)
- **Tailwind Plugin**: Automatic class sorting

## Linting Rules (ESLint)
- **Import Sorting**: Automatic with simple-import-sort plugin
- **TypeScript**: 
  - No unused variables (except prefixed with `_`)
  - `any` type warnings allowed
  - Non-null assertions warned
- **React Rules**:
  - No React import needed (React 17+)
  - PropTypes disabled (using TypeScript)
  - Hooks rules enforced
- **Console Statements**: Warn in development, error in production

## Naming Conventions
- **Files**: kebab-case for components, camelCase for utilities
- **Components**: PascalCase (e.g., `ProfileHeader.tsx`)
- **Hooks**: camelCase starting with `use` (e.g., `useProfileStore`)
- **Stores**: camelCase ending with `Store` (e.g., `authStore`)
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces**: PascalCase with descriptive names

## Component Structure
```typescript
// Component file structure
import React from 'react';
import { SomeRadixComponent } from '@radix-ui/react-component';
import { cn } from '@/lib/utils';

interface ComponentProps {
  // Props interface
}

export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // Component implementation
  return <div>...</div>;
}
```

## Store Patterns (Zustand)
```typescript
// Store structure with immer and persist
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface StoreState {
  // State properties
  // Actions
}

export const useStoreName = create<StoreState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Implementation
      })),
      { name: 'store-name' }
    )
  )
);
```

## Testing Patterns
- **Test Files**: `.test.ts` or `.spec.ts` suffix
- **Test Organization**: Describe blocks for components, it blocks for specific behaviors
- **Mocking**: Use Vitest's `vi` utilities
- **React Testing**: Use React Testing Library patterns
- **API Testing**: Contract testing with MSW (Mock Service Worker)

## Import Organization (Automatic)
1. React and external libraries
2. Internal components and utilities  
3. Relative imports
4. Type-only imports (when needed)

## Error Handling
- Use custom error utility functions
- Implement proper error boundaries
- Provide user-friendly error messages
- Log errors appropriately (console.error for development)