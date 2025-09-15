# Code Style and Conventions

## TypeScript Configuration

- Strict mode enabled
- ES2020 target with ESNext modules
- Path aliases: `@/*` for client/src, `@shared/*` for shared types
- JSX preserve mode for React

## React Patterns

- Functional components with hooks
- Zustand for state management with equality functions
- Custom hooks in `hooks/` directory
- Component composition with Radix UI primitives

## File Organization

- Components in `client/src/components/`
- UI components in `client/src/components/ui/`
- Node components in `client/src/components/nodes/`
- Stores in `client/src/stores/`
- Utilities in `client/src/utils/`
- Pages in `client/src/pages/`

## Naming Conventions

- PascalCase for components and types
- camelCase for variables and functions
- kebab-case for file names (except components)
- UPPER_SNAKE_CASE for constants
- Descriptive names for React Flow nodes and edges

## React Flow Patterns

- Node types: 'workExperience', 'education', 'project', 'timeline'
- Edge types: 'straight', 'smoothstep' with custom styling
- Position calculations in utility functions
- Data interfaces for type safety

## State Management

- Zustand stores with TypeScript interfaces
- Separate stores for different concerns (timeline, chat, auth, ui)
- Actions and getters in store objects
- State persistence where needed

## Error Handling

- Try-catch blocks for async operations
- Graceful fallbacks for missing data
- User-friendly error messages
- Console logging for debugging
