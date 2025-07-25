// This file has been deprecated and replaced with:
// - server/repositories/skill-repository.ts (data access layer)
// - server/services/skill-service.ts (business logic layer)
//
// The old SkillStorage class with hardcoded SQL has been removed in favor of:
// 1. Proper Drizzle ORM usage with PostgreSQL
// 2. Repository pattern for data access
// 3. Service layer for business logic
// 4. Dependency injection for testability
//
// To use skills functionality, inject SkillService through the container:
// 
// import { getService, SERVICE_KEYS } from '../core/bootstrap';
// const skillService = await getService(SERVICE_KEYS.SKILL_SERVICE);
//
// This provides a clean, maintainable, and properly architected approach
// that aligns with our modern Node.js/TypeScript patterns.

export const DEPRECATED_FILE_MESSAGE = `
This file has been deprecated. Please use the new architecture:
- SkillRepository for data access
- SkillService for business logic
- Dependency injection through the container
`;

// Re-export types for backward compatibility during migration
export type { SkillRecord, SkillInput, SkillStats } from '../repositories/interfaces';
export type { ISkillService, SkillFilters } from '../interfaces';